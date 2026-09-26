import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Check, Crown, Infinity as InfinityIcon, Loader2, MapPin, Smartphone } from "lucide-react";
import { goBack } from "../lib/router";
import { isNativeApp } from "../lib/native";
import { FREE_PER_DAY } from "../lib/quota";
import { fetchPlans, formatDate, openManagement, purchasePlan, restorePurchases, type Plan } from "../lib/subscription";
import { useApp } from "../store";

const FEATURES = [
  { icon: InfinityIcon, title: "Sınırsız IBAN kontrolü", text: `Ücretsiz planda günde ${FREE_PER_DAY} sorgu` },
  { icon: MapPin, title: "Banka ve şube bilgisi her sorguda", text: "Banka, şube kodu ve hesap numarası ayrıştırma" },
  { icon: Smartphone, title: "Tüm cihazlarında", text: "Ibanova hesabınla giriş yaptığın her telefonda geçerli" },
];

const PERIOD_LABEL: Record<Plan["period"], string> = { monthly: "Aylık", annual: "Yıllık", other: "" };
const PER: Record<Plan["period"], string> = { monthly: "/ ay", annual: "/ yıl", other: "" };

/**
 * Ibanova Premium. Satın alma App Store / Google Play'in kendi ödeme ekranıyla yapılır; fiyatlar mağazadan
 * (kullanıcının ülkesine göre) gelir. Apple 3.1.2 gereği: fiyat, süre, otomatik yenileme bilgisi, geri yükleme,
 * kullanım koşulları ve gizlilik politikası bağlantıları bu ekranda gösterilir.
 */
export default function SubscriptionScreen() {
  const { sub, setSubStatus, toast, unlimited } = useApp();
  const native = isNativeApp();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [plansError, setPlansError] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState<"" | "buy" | "restore">("");

  const loadPlans = () => {
    setPlansError(false);
    setPlans(null);
    fetchPlans()
      .then((p) => {
        const sorted = [...p].sort((a, b) => (a.period === "annual" ? -1 : b.period === "annual" ? 1 : 0));
        setPlans(sorted);
        setSelected((cur) => cur || sorted[0]?.id || "");
      })
      .catch(() => setPlansError(true));
  };

  useEffect(() => {
    if (native && sub.available && !sub.active) loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native, sub.available, sub.active]);

  const buy = async () => {
    if (!selected || busy) return;
    setBusy("buy");
    try {
      const r = await purchasePlan(selected);
      setSubStatus(r.status);
      if (r.result === "purchased" && r.status.active) {
        toast("Premium'a hoş geldiniz");
        goBack("/");
      }
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Satın alma tamamlanamadı");
    } finally {
      setBusy("");
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy("restore");
    try {
      const s = await restorePurchases();
      setSubStatus(s);
      toast(s.active ? "Aboneliğiniz geri yüklendi" : "Bu mağaza hesabında aktif abonelik bulunamadı");
    } catch {
      toast("Geri yükleme yapılamadı, tekrar deneyin");
    } finally {
      setBusy("");
    }
  };

  const manage = () => openManagement().catch(() => toast("Mağaza abonelik sayfası açılamadı"));

  const chosen = plans?.find((p) => p.id === selected);

  return (
    <div className="min-h-screen w-full bg-background pb-16 font-body text-foreground">
      <header className="px-5 pb-2 pt-12">
        <button
          type="button"
          onClick={() => goBack("/")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="Geri dön"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-[0_0_30px] shadow-primary/20">
          <Crown className="h-7 w-7" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Ibanova Premium</p>
        <h1 className="mt-1.5 font-heading text-[26px] font-bold leading-tight tracking-tight">
          {sub.active ? "Premium aktif" : "Sınırsız IBAN kontrolü"}
        </h1>
      </header>

      <main className="px-5">
        <ul className="mt-4 space-y-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ul>

        {sub.active ? (
          <section className="mt-7 rounded-theme border border-success/40 bg-card p-4" data-testid="sub-active">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <BadgeCheck className="h-5 w-5 text-success" /> Aboneliğiniz aktif
            </p>
            {sub.expires && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {sub.willRenew ? "Yenilenme tarihi" : "Bitiş tarihi"}: {formatDate(sub.expires)}
                {!sub.willRenew && " (otomatik yenileme kapalı)"}
              </p>
            )}
            <button
              type="button"
              onClick={manage}
              className="mt-4 w-full rounded-theme border border-border bg-secondary py-3 text-sm font-semibold text-secondary-foreground"
            >
              Aboneliği yönet veya iptal et
            </button>
          </section>
        ) : !native ? (
          <p className="mt-7 rounded-theme border border-border bg-card p-4 text-sm text-muted-foreground">
            Premium aboneliği Ibanova&apos;nın iPhone ve Android uygulamasından alınabilir.
          </p>
        ) : !sub.available ? (
          <p className="mt-7 rounded-theme border border-border bg-card p-4 text-sm text-muted-foreground">
            {unlimited ? "Şu an tüm sorgular ücretsiz." : "Abonelik şu an kullanılamıyor, daha sonra tekrar deneyin."}
          </p>
        ) : (
          <section className="mt-7" aria-label="Planlar">
            {plansError ? (
              <div className="rounded-theme border border-border bg-card p-4 text-center text-sm text-muted-foreground">
                Planlar yüklenemedi.
                <button type="button" onClick={loadPlans} className="ml-1 font-semibold text-primary">
                  Tekrar dene
                </button>
              </div>
            ) : plans === null ? (
              <div className="flex justify-center py-8 text-primary">
                <Loader2 className="h-6 w-6 animate-spin" aria-label="Yükleniyor" />
              </div>
            ) : plans.length === 0 ? (
              <p className="rounded-theme border border-border bg-card p-4 text-sm text-muted-foreground">
                Şu an satın alınabilecek plan yok, daha sonra tekrar deneyin.
              </p>
            ) : (
              <div className="space-y-3" role="radiogroup" aria-label="Abonelik planı">
                {plans.map((p) => {
                  const on = p.id === selected;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSelected(p.id)}
                      className={`relative flex w-full items-center gap-3 rounded-theme border bg-card px-4 py-4 text-left transition-colors ${
                        on ? "border-primary shadow-[0_0_0_1px] shadow-primary" : "border-border"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50"
                        }`}
                      >
                        {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{PERIOD_LABEL[p.period] || p.title}</span>
                          {p.period === "annual" && (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                              En avantajlı
                            </span>
                          )}
                        </span>
                        {(p.pricePerMonth || p.intro) && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {[p.pricePerMonth && `Aylık ${p.pricePerMonth}`, p.intro].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-heading text-base font-bold">{p.price}</span>
                        <span className="block text-[11px] text-muted-foreground">{PER[p.period]}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={buy}
              disabled={!chosen || busy !== ""}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-theme bg-primary py-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {busy === "buy" && <Loader2 className="h-4 w-4 animate-spin" />}
              {chosen?.intro?.includes("ücretsiz") ? "Ücretsiz denemeyi başlat" : "Abone ol"}
            </button>
          </section>
        )}

        {native && sub.available && (
          <button
            type="button"
            onClick={restore}
            disabled={busy !== ""}
            className="mt-4 flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-primary disabled:opacity-60"
          >
            {busy === "restore" && <Loader2 className="h-4 w-4 animate-spin" />}
            Satın alımları geri yükle
          </button>
        )}

        <p className="mt-6 text-[11px] leading-5 text-muted-foreground">
          {chosen && !sub.active && (
            <>
              {PERIOD_LABEL[chosen.period]} abonelik: {chosen.price} {PER[chosen.period]}.{" "}
            </>
          )}
          Ödeme, satın almayı onayladığınızda App Store veya Google Play hesabınızdan alınır. Abonelik, dönem bitmeden
          en az 24 saat önce iptal edilmezse aynı süre ve ücretle otomatik olarak yenilenir. Aboneliğinizi mağaza hesap
          ayarlarından yönetebilir ve iptal edebilirsiniz. Ibanova hesabınızı silmek aboneliği iptal etmez.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <a href="/kosullar" className="font-semibold text-primary">
            Kullanım Koşulları
          </a>
          <a href="/gizlilik" className="font-semibold text-primary">
            Gizlilik Politikası
          </a>
        </p>
      </main>
    </div>
  );
}
