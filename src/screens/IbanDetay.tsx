import { useCallback, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BookmarkPlus,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  MapPin,
  MoreHorizontal,
  QrCode,
  ScanLine,
  Share2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import BankLogo from "../components/BankLogo";
import Sheet, { PrimaryButton, SecondaryButton, SheetAction } from "../components/Sheet";
import { analyzeIban, problemMessage } from "../lib/iban";
import { copyText, vibrate } from "../lib/device";
import { formatWhen } from "../lib/format";
import { useBranch } from "../lib/useBranch";
import { goBack, navigate } from "../lib/router";
import { useApp } from "../store";

function CopyButton({ value, label, onCopy }: { value: string; label: string; onCopy: (value: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCopy(value)}
      className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
      aria-label={label}
    >
      <Copy className="h-4 w-4" />
    </button>
  );
}

export default function IbanDetailScreen({ iban: rawIban }: { iban: string }) {
  const { history, isSaved, saveIban, removeHistory, settings, toast } = useApp();
  const info = analyzeIban(rawIban);
  const record = history.find((r) => r.iban === info.compact);
  const saved = isSaved(info.compact);
  const branch = useBranch(info.bankCode, info.branch, info.valid);

  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [label, setLabel] = useState("");

  const copyValue = useCallback(
    async (value: string) => {
      const ok = await copyText(value);
      vibrate(settings.haptics);
      if (ok) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } else {
        toast("Kopyalanamadı");
      }
    },
    [settings.haptics, toast],
  );

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "IBAN", text: info.formatted });
      } catch {
        /* paylaşım iptal edildi */
      }
    } else {
      await copyValue(info.formatted);
      toast("IBAN kopyalandı");
    }
  };

  const confirmSave = () => {
    const result = saveIban(info.compact, label);
    setLabelOpen(false);
    toast(result === "saved" ? "IBAN kaydedildi" : "Bu IBAN zaten kayıtlı");
  };

  const components: { label: string; value: string; note?: string }[] = [
    { label: "Banka Kodu", value: info.bankCode },
    { label: "Şube Kodu", value: info.branch, note: branch?.name },
    { label: "Hesap Numarası", value: info.account },
  ];


  return (
    <div className="min-h-screen w-full bg-background pb-32 font-body text-foreground">
      <header className="px-5 pb-5 pt-12">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => goBack("/gecmis")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Geri dön"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">IBAN detayı</p>
            <p className="mt-1 text-xs text-muted-foreground">{record ? formatWhen(record.at) : "Kayıt dışı"}</p>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Daha fazla seçenek"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-5">
        <section
          aria-labelledby="detail-title"
          className={`rounded-theme border bg-card p-5 shadow-sm ${info.valid ? "border-success/35" : "border-destructive/40"}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div
                className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
                  info.valid ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
                }`}
              >
                {info.valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
                {info.valid ? "Geçerli" : "Geçersiz"}
              </div>

              <h1 id="detail-title" className="font-heading text-[25px] font-bold tracking-tight">
                {info.valid ? "IBAN doğrulandı" : "IBAN geçersiz"}
              </h1>

              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <ShieldCheck className={`h-4 w-4 shrink-0 ${info.valid ? "text-success" : "text-destructive"}`} />
                {info.valid
                  ? "MOD-97 doğrulaması başarılı"
                  : info.complete
                    ? problemMessage(info.problem)
                    : "IBAN 26 karakter olmalıdır"}
              </p>
            </div>

            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${info.valid ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              {info.valid ? <BadgeCheck className="h-6 w-6" /> : <TriangleAlert className="h-6 w-6" />}
            </div>
          </div>

          <div className="mt-6 rounded-theme border border-border bg-input px-4 py-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {info.valid ? "Doğrulanan IBAN" : "Kontrol edilen IBAN"}
            </p>

            <div className="flex items-start gap-3">
              <span className="flex h-8 min-w-10 items-center justify-center rounded-lg bg-destructive text-[11px] font-bold text-destructive-foreground">
                TR
              </span>

              <p className="min-w-0 flex-1 font-body text-[16px] font-semibold leading-7 tracking-[0.045em] tabular-nums text-foreground">
                {info.formatted || "—"}
              </p>

              <button
                type="button"
                onClick={() => copyValue(info.formatted)}
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label="IBAN'ı kopyala"
              >
                <Copy className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </section>

        {info.complete && (
          <section aria-labelledby="bank-title" className="mt-5 rounded-theme border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <BankLogo bank={info.bankName} className="h-14 w-[76px] rounded-xl bg-muted p-2.5" />

              <div className="min-w-0 flex-1">
                <h2 id="bank-title" className="font-heading text-base font-semibold text-card-foreground">
                  {info.bankName}
                </h2>
                {info.valid && info.knownBank && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-success">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Doğrulanmış banka eşleşmesi
                  </p>
                )}
                {branch && (
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="branch-line">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {branch.name}
                      {branch.place && ` · ${branch.place}`}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {info.complete && info.valid && (
          <section className="mt-7" aria-labelledby="parsed-title">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Ayrıştırılmış bilgiler</p>
                <h2 id="parsed-title" className="mt-1 font-heading text-lg font-semibold">
                  IBAN bileşenleri
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">Kopyalanabilir</span>
            </div>

            <div className="overflow-hidden rounded-theme border border-border bg-card">
              {components.map((item, index) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between px-4 py-4 ${
                    index < components.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="mt-1 font-body text-base font-semibold tracking-[0.08em] tabular-nums text-card-foreground">
                      {item.value}
                    </p>
                    {item.note && <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>}
                  </div>

                  <CopyButton value={item.value} label={`${item.label} değerini kopyala`} onCopy={copyValue} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-7" aria-labelledby="verification-title">
          <div className="mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Kontrol kaydı</p>
            <h2 id="verification-title" className="mt-1 font-heading text-lg font-semibold">
              Doğrulama bilgisi
            </h2>
          </div>

          <div className="rounded-theme border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-4 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-primary">
                <Clock3 className="h-[18px] w-[18px]" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">Kontrol zamanı</p>
                <p className="mt-1 text-sm font-medium text-card-foreground">{record ? formatWhen(record.at) : "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-primary">
                <ScanLine className="h-[18px] w-[18px]" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">Yöntem</p>
                <p className="mt-1 text-sm font-medium text-card-foreground">MOD-97</p>
              </div>
            </div>
          </div>
        </section>

        {info.valid && (
          <button
            type="button"
            disabled={saved}
            onClick={() => {
              setLabel("");
              setLabelOpen(true);
            }}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-theme border border-primary/45 bg-secondary px-4 py-3.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
          >
            {saved ? (
              <>
                <Check className="h-[18px] w-[18px] text-success" />
                Kayıtlı IBAN
              </>
            ) : (
              <>
                <BookmarkPlus className="h-[18px] w-[18px] text-primary" />
                IBAN&apos;ı Kaydet
                <span className="text-xs font-normal text-muted-foreground">Etiket ekle</span>
              </>
            )}
          </button>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[393px] gap-2">
          <button
            type="button"
            onClick={() => copyValue(info.formatted)}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-theme border border-border bg-secondary text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <Copy className="h-[18px] w-[18px] text-primary" />
            {copied ? "Kopyalandı" : "Kopyala"}
          </button>

          <button
            type="button"
            onClick={share}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-theme border border-border bg-secondary text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <Share2 className="h-[18px] w-[18px] text-primary" />
            Paylaş
          </button>

          {info.valid && (
            <button
              type="button"
              onClick={() => navigate(`/qr/${info.compact}`)}
              className="flex h-12 flex-[1.35] items-center justify-center gap-2 rounded-theme bg-primary text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <QrCode className="h-[18px] w-[18px]" />
              QR Kod Oluştur
            </button>
          )}
        </div>
      </div>

      {menuOpen && (
        <Sheet title="Seçenekler" onClose={() => setMenuOpen(false)}>
          <SheetAction
            icon={<Copy className="h-5 w-5" />}
            label="IBAN'ı kopyala"
            onClick={() => {
              setMenuOpen(false);
              copyValue(info.formatted);
            }}
          />
          {record && (
            <SheetAction
              danger
              icon={<Trash2 className="h-5 w-5" />}
              label="Geçmişten kaldır"
              onClick={() => {
                removeHistory(record.id);
                setMenuOpen(false);
                toast("Geçmişten kaldırıldı");
                goBack("/gecmis");
              }}
            />
          )}
        </Sheet>
      )}

      {labelOpen && (
        <Sheet title="IBAN'ı kaydet" onClose={() => setLabelOpen(false)}>
          <p className="mb-3 text-xs text-muted-foreground">
            {info.bankName} · {info.formatted}
          </p>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmSave()}
            maxLength={40}
            placeholder="Etiket (ör. Kira Ödemesi)"
            aria-label="Etiket"
            className="w-full rounded-theme border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="mt-4 flex gap-3">
            <SecondaryButton onClick={() => setLabelOpen(false)}>Vazgeç</SecondaryButton>
            <PrimaryButton onClick={confirmSave}>Kaydet</PrimaryButton>
          </div>
        </Sheet>
      )}
    </div>
  );
}
