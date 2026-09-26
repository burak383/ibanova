import { ArrowLeft, ExternalLink, TriangleAlert } from "lucide-react";
import { SON_GUNCELLEME, privacyPolicy } from "../../shared/policy.js";
import { goBack } from "../lib/router";

const SORUMLU = import.meta.env.VITE_VERI_SORUMLUSU?.trim();
const EPOSTA = import.meta.env.VITE_ILETISIM_EPOSTA?.trim();

/**
 * Gizlilik Politikası ve KVKK Aydınlatma Metni. Metin `shared/policy.js`'den gelir; sunucunun verdiği
 * JavaScript'siz /gizlilik sayfasıyla (Google Play'e girilen adres) birebir aynıdır.
 */
export default function PrivacyScreen() {
  const doc = privacyPolicy({
    sorumlu: SORUMLU,
    eposta: EPOSTA,
    appUrl: typeof window !== "undefined" ? window.location.origin : "",
  });

  return (
    <div className="min-h-screen w-full bg-background pb-16 font-body text-foreground">
      <header className="px-5 pb-2 pt-12">
        <button
          type="button"
          onClick={() => goBack("/profil")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="Geri dön"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">KVKK Aydınlatma Metni</p>
        <h1 className="mt-1.5 font-heading text-[26px] font-bold tracking-tight">Gizlilik Politikası</h1>
        <p className="mt-1 text-xs text-muted-foreground">Son güncelleme: {SON_GUNCELLEME}</p>
      </header>

      <main className="px-5">
        {doc.taslak && (
          <div className="mt-3 flex gap-2 rounded-theme border border-destructive/40 bg-destructive/10 p-3 text-xs leading-5 text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Taslak: geliştirici / veri sorumlusu bilgileri henüz girilmedi (VITE_VERI_SORUMLUSU, VITE_ILETISIM_EPOSTA).
          </div>
        )}

        {doc.sections.map((s) => (
          <section key={s.title} className="mt-6">
            <h2 className="mb-2 font-heading text-base font-semibold">{s.title}</h2>
            <div className="space-y-2 text-sm leading-6 text-muted-foreground">
              {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
              {s.items && (
                <ul className="list-disc space-y-1 pl-5">
                  {s.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}

        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-5 text-sm">
          <a href="/gizlilik" target="_blank" rel="noopener" className="flex items-center gap-2 text-primary">
            <ExternalLink className="h-4 w-4" /> Politikayı ayrı sayfada aç
          </a>
          <a href="/hesap-silme" target="_blank" rel="noopener" className="flex items-center gap-2 text-primary">
            <ExternalLink className="h-4 w-4" /> Hesap ve veri silme
          </a>
          <a href="/kosullar" target="_blank" rel="noopener" className="flex items-center gap-2 text-primary">
            <ExternalLink className="h-4 w-4" /> Kullanım Koşulları
          </a>
        </div>
      </main>
    </div>
  );
}
