import { useEffect, useState } from "react";
import { AppProvider, useApp } from "./store";
import { hasCredential } from "./lib/biometric";
import LockScreen from "./components/LockScreen";
import { useRoute } from "./lib/router";
import Toast from "./components/Toast";
import AnaSayfa from "./screens/AnaSayfa";
import Gecmis from "./screens/Gecmis";
import KayitliIbanlar from "./screens/KayitliIbanlar";
import Profil from "./screens/Profil";
import IbanDetay from "./screens/IbanDetay";
import QrKod from "./screens/QrKod";
import Hesap from "./screens/Hesap";
import Gizlilik from "./screens/Gizlilik";
import SifreSifirla from "./screens/SifreSifirla";
import Abonelik from "./screens/Abonelik";
import UygulamayiIndir from "./screens/UygulamayiIndir";
import { isNativeApp } from "./lib/native";
import { isDemo, isWebTest } from "./store";

function Screen() {
  const route = useRoute();
  switch (route.name) {
    case "history":
      return <Gecmis />;
    case "saved":
      return <KayitliIbanlar />;
    case "profile":
      return <Profil />;
    case "account":
      return <Hesap />;
    case "privacy":
      return <Gizlilik />;
    case "reset":
      return <SifreSifirla token={route.token} />;
    case "subscription":
      return <Abonelik />;
    case "detail":
      return <IbanDetay iban={route.iban} />;
    case "qr":
      return <QrKod iban={route.iban} />;
    default:
      return <AnaSayfa />;
  }
}

const RELOCK_AFTER_MS = 60_000;

/**
 * Ibanova yalnızca mobil uygulamada kullanılır (abonelik App Store / Google Play üzerinden satılır).
 * Tarayıcıda yalnızca e-postadaki şifre sıfırlama bağlantısı çalışır; geri kalan her şey indirme sayfasına gider.
 * Yerel geliştirmede ve örnek veri modunda (testler, ekran görüntüleri) web açık kalır.
 */
function webAllowed(): boolean {
  return isNativeApp() || import.meta.env.DEV || isDemo() || isWebTest();
}

function Shell() {
  const route = useRoute();
  if (!webAllowed() && route.name !== "reset") return <UygulamayiIndir />;
  return <AppShell />;
}

function AppShell() {
  const { settings, resetAll } = useApp();
  const lockEnabled = settings.biometric && hasCredential();
  const [locked, setLocked] = useState(lockEnabled);

  // Uygulama arka planda bir süre kaldıysa yeniden kilitle
  useEffect(() => {
    if (!lockEnabled) {
      setLocked(false);
      return;
    }
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) setLocked(true);
    };
    // Mobil uygulama, arka plana geçip dönüşünü ayrıca bildirir (WebView'da visibilitychange güvenilir değil)
    const onAppState = (e: Event) => {
      const state = (e as CustomEvent<string>).detail;
      if (state === "background") hiddenAt = Date.now();
      else if (state === "active" && hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) setLocked(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("ibanova:app-state", onAppState);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("ibanova:app-state", onAppState);
    };
  }, [lockEnabled]);

  if (locked && lockEnabled) {
    return (
      <LockScreen
        onUnlock={() => setLocked(false)}
        onReset={() => {
          resetAll();
          setLocked(false);
        }}
      />
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[480px]">
        <Screen />
      </div>
      <Toast />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
