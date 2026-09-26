/**
 * Ibanova mobil uygulaması: canlı web uygulamasını (ibanova.onrender.com) tam ekran bir WebView'da açar ve
 * web'in tek başına yapamadığı telefon özelliklerini bir köprüyle sağlar: paylaşım menüsü, QR görselini
 * paylaşma/kaydetme, pano, titreşim, Face ID / parmak izi kilidi ve App Store / Google Play aboneliği.
 *
 * Köprü sözleşmesi web tarafında src/lib/native.ts dosyasındadır.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, BackHandler, Linking, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import Constants from "expo-constants";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import * as Sub from "./subscription";

SplashScreen.preventAutoHideAsync().catch(() => {});
Sub.configureSubscriptions();

const APP_URL: string = (Constants.expoConfig?.extra?.appUrl as string | undefined) ?? "https://ibanova.onrender.com";
const APP_ORIGIN = new URL(APP_URL).origin;
const VERSION = Constants.expoConfig?.version ?? "1.0.0";
const BG = "#0B1216";
const ACCENT = "#00D5E8";

/** Sayfa yüklenmeden önce çalışır: window.IbanovaNative köprüsünü tanımlar. */
const BRIDGE = `(function () {
  if (window.IbanovaNative) return;
  var pending = {}, seq = 0;
  window.__ibanovaResolve = function (id, ok, value) {
    var p = pending[id]; if (!p) return; delete pending[id];
    if (ok) p.resolve(value); else p.reject(new Error(value || "Hata"));
  };
  window.IbanovaNative = {
    platform: ${JSON.stringify(Platform.OS)},
    version: ${JSON.stringify(VERSION)},
    call: function (method, args) {
      return new Promise(function (resolve, reject) {
        var id = ++seq; pending[id] = { resolve: resolve, reject: reject };
        window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, method: method, args: args || {} }));
      });
    }
  };
})(); true;`;

const isOwnUrl = (url: string) => url.startsWith(APP_ORIGIN + "/") || url === APP_ORIGIN;

function safeFilename(name: unknown): string {
  const base = String(name || "ibanova.png").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  return base.endsWith(".png") ? base : `${base}.png`;
}

async function handle(method: string, args: Record<string, unknown>): Promise<unknown> {
  switch (method) {
    case "share": {
      await Share.share({ message: String(args.text ?? ""), title: args.title ? String(args.title) : undefined });
      return true;
    }
    case "shareImage": {
      const file = new File(Paths.cache, safeFilename(args.filename));
      if (file.exists) file.delete();
      file.create();
      file.write(String(args.base64 ?? ""), { encoding: "base64" });
      await Sharing.shareAsync(file.uri, {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: args.title ? String(args.title) : "Paylaş",
      });
      return true;
    }
    case "copy":
      await Clipboard.setStringAsync(String(args.text ?? ""));
      return true;
    case "readClipboard":
      return (await Clipboard.getStringAsync()) ?? "";
    case "haptic":
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return true;
    case "biometricAvailable":
      return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
    case "biometricAuth": {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: String(args.reason || "Ibanova'yı açmak için doğrulayın"),
        cancelLabel: "Vazgeç",
      });
      return r.success;
    }
    // Abonelik (bkz. subscription.ts)
    case "subStatus":
      return Sub.getStatus();
    case "subPlans":
      return Sub.getPlans();
    case "subPurchase":
      return Sub.purchase(String(args.planId ?? ""));
    case "subRestore":
      return Sub.restore();
    case "subLogin":
      return Sub.logIn(String(args.userId ?? ""));
    case "subLogout":
      return Sub.logOut();
    case "subManage":
      return Sub.openManagement();
    case "quotaGet":
      return Sub.quotaGet();
    case "quotaSet":
      return Sub.quotaSet(args.value);
    default:
      throw new Error(`Bilinmeyen işlem: ${method}`);
  }
}

export default function App() {
  const web = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Açılış ekranı: ilk sayfa yüklenince (ya da en geç 10 sn sonra) kapanır
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 10_000);
    return () => clearTimeout(t);
  }, []);

  // Android geri tuşu: önce uygulama içinde geri git
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack.current && web.current) {
        web.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  // Arka plana geçiş/dönüş: kilit yeniden etkinleşsin, panodaki IBAN yeniden algılansın
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const s = state === "active" ? "active" : "background";
      web.current?.injectJavaScript(
        `window.dispatchEvent(new CustomEvent("ibanova:app-state", { detail: ${JSON.stringify(s)} }));` +
          (s === "active" ? `window.dispatchEvent(new Event("focus"));` : "") +
          "true;",
      );
    });
    return () => sub.remove();
  }, []);

  // Abonelik durumu değişince (satın alma, yenileme, iptal, başka cihazda alım) sayfaya bildir
  useEffect(
    () =>
      Sub.onStatusChange((status) => {
        web.current?.injectJavaScript(
          `window.dispatchEvent(new CustomEvent("ibanova:sub", { detail: ${JSON.stringify(status)} })); true;`,
        );
      }),
    [],
  );

  const reply = useCallback((id: number, ok: boolean, value: unknown) => {
    web.current?.injectJavaScript(`window.__ibanovaResolve(${Number(id)}, ${ok}, ${JSON.stringify(value ?? null)}); true;`);
  }, []);

  const onMessage = useCallback(
    async (e: WebViewMessageEvent) => {
      // Köprüyü yalnızca kendi sitemiz kullanabilir
      if (!isOwnUrl(e.nativeEvent.url)) return;
      let msg: { id: number; method: string; args?: Record<string, unknown> };
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      try {
        reply(msg.id, true, await handle(msg.method, msg.args ?? {}));
      } catch (err) {
        reply(msg.id, false, err instanceof Error ? err.message : String(err));
      }
    },
    [reply],
  );

  /** Kendi sitemiz dışındaki bağlantılar (mailto:, başka siteler) telefonun uygulamasında açılır. */
  const onShouldStart = useCallback((req: { url: string }) => {
    const { url } = req;
    if (isOwnUrl(url) || url.startsWith("about:") || url.startsWith("blob:") || url.startsWith("data:")) return true;
    Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    canGoBack.current = nav.canGoBack;
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
        <StatusBar style="light" />
        {error ? (
          <View style={styles.center}>
            <Text style={styles.title}>Bağlantı kurulamadı</Text>
            <Text style={styles.body}>İnternet bağlantınızı kontrol edip tekrar deneyin.</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.button}
              onPress={() => {
                setError(false);
                setLoading(true);
                web.current?.reload();
              }}
            >
              <Text style={styles.buttonText}>Tekrar dene</Text>
            </Pressable>
          </View>
        ) : null}
        <WebView
          ref={web}
          source={{ uri: APP_URL }}
          style={[styles.web, error && styles.hidden]}
          injectedJavaScriptBeforeContentLoaded={BRIDGE}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={onShouldStart}
          onOpenWindow={(e) => {
            const url = e.nativeEvent.targetUrl;
            if (isOwnUrl(url)) web.current?.injectJavaScript(`location.href = ${JSON.stringify(url)}; true;`);
            else Linking.openURL(url).catch(() => {});
          }}
          onNavigationStateChange={onNavigationStateChange}
          onLoadEnd={() => {
            setLoading(false);
            SplashScreen.hideAsync().catch(() => {});
          }}
          onError={() => setError(true)}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 500) setError(true);
          }}
          originWhitelist={["https://*"]}
          applicationNameForUserAgent={`IbanovaApp/${VERSION}`}
          domStorageEnabled
          javaScriptEnabled
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          bounces={false}
          overScrollMode="never"
          allowsInlineMediaPlayback
          webviewDebuggingEnabled={__DEV__}
        />
        {loading && !error ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  web: { flex: 1, backgroundColor: BG },
  hidden: { display: "none" },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  title: { color: "#E6EEF2", fontSize: 20, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  body: { color: "#9FB0B8", fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 24 },
  button: { backgroundColor: ACCENT, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  buttonText: { color: BG, fontSize: 15, fontWeight: "700" },
});
