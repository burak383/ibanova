import { CreditCard, Smartphone } from "lucide-react";

const APP_STORE = import.meta.env.VITE_APP_STORE_URL?.trim() || "";
const PLAY_STORE =
  import.meta.env.VITE_PLAY_STORE_URL?.trim() ||
  "https://play.google.com/store/apps/details?id=com.ibanova.app";

/**
 * Ibanova yalnızca mobil uygulama olarak kullanılır; tarayıcıdan girenler bu sayfayı görür.
 * (Şifre sıfırlama bağlantısı ve sunucunun verdiği /gizlilik, /hesap-silme, /destek, /kosullar sayfaları
 * tarayıcıda çalışmaya devam eder.)
 */
export default function DownloadScreen() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const stores = [
    {
      key: "ios",
      label: "App Store",
      sub: "iPhone için indir",
      url: APP_STORE,
      show: !isAndroid,
    },
    {
      key: "android",
      label: "Google Play",
      sub: "Android için indir",
      url: PLAY_STORE,
      show: !isIos,
    },
  ].filter((s) => s.show);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background px-6 pb-10 pt-16 font-body text-foreground">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-[0_0_40px] shadow-primary/25">
        <CreditCard className="h-8 w-8" />
      </div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        Ibanova
      </p>
      <h1 className="mt-2 font-heading text-[28px] font-bold leading-tight tracking-tight">
        IBAN kontrolü artık uygulamada
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Ibanova&apos;yı telefonunuza indirin: IBAN&apos;ları anında doğrulayın,
        banka ve şube bilgisini görün, kaydedin ve QR kodla paylaşın. Mevcut
        hesabınızla uygulamada giriş yapabilirsiniz.
      </p>

      <div className="mt-8 space-y-3">
        {stores.map((s) =>
          s.url ? (
            <a
              key={s.key}
              href={s.url}
              rel="noopener"
              className="flex items-center gap-3 rounded-theme border border-border bg-card px-4 py-4"
            >
              <Smartphone className="h-6 w-6 text-primary" />
              <span>
                <span className="block text-xs text-muted-foreground">
                  {s.sub}
                </span>
                <span className="block font-heading text-base font-semibold">
                  {s.label}
                </span>
              </span>
            </a>
          ) : (
            <div
              key={s.key}
              className="flex items-center gap-3 rounded-theme border border-border bg-card px-4 py-4 opacity-70"
            >
              <Smartphone className="h-6 w-6 text-muted-foreground" />
              <span>
                <span className="block text-xs text-muted-foreground">
                  Çok yakında
                </span>
                <span className="block font-heading text-base font-semibold">
                  {s.label}
                </span>
              </span>
            </div>
          ),
        )}
      </div>

      <nav className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-12 text-xs">
        <a href="/destek" className="text-primary">
          Destek
        </a>
        <a href="/gizlilik" className="text-primary">
          Gizlilik Politikası
        </a>
        <a href="/kosullar" className="text-primary">
          Kullanım Koşulları
        </a>
        <a href="/hesap-silme" className="text-primary">
          Hesap silme
        </a>
      </nav>
    </div>
  );
}
