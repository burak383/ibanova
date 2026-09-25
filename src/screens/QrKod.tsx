import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, BadgeCheck, Check, Download, Ellipsis, RotateCcw, Share2, ShieldCheck, TriangleAlert, Type } from "lucide-react";
import BankLogo from "../components/BankLogo";
import Sheet, { SheetAction } from "../components/Sheet";
import { analyzeIban, last4 } from "../lib/iban";
import { copyText } from "../lib/device";
import { goBack, navigate } from "../lib/router";
import { useApp } from "../store";

const QR_OPTIONS = { errorCorrectionLevel: "M" as const, margin: 1, width: 640, color: { dark: "#0B1216", light: "#FFFFFF" } };

/** QR görselini (isteğe bağlı IBAN metniyle) tek bir PNG'ye çizer. */
async function renderImage(iban: string, formatted: string, withText: boolean): Promise<Blob> {
  const qr = await QRCode.toDataURL(iban, QR_OPTIONS);
  const img = new Image();
  img.src = qr;
  await img.decode();

  const pad = 40;
  const size = 640;
  const textH = withText ? 72 : 0;
  const canvas = document.createElement("canvas");
  canvas.width = size + pad * 2;
  canvas.height = size + pad * 2 + textH;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, pad, pad, size, size);
  if (withText) {
    ctx.fillStyle = "#0B1216";
    ctx.font = "600 30px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(formatted, canvas.width / 2, size + pad + 52);
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG oluşturulamadı"))), "image/png"),
  );
}

export default function QrCodeScreen({ iban: rawIban }: { iban: string }) {
  const { toast } = useApp();
  const info = analyzeIban(rawIban);
  const [includeIban, setIncludeIban] = useState(true);
  const [qrUrl, setQrUrl] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!info.valid) return;
    setQrFailed(false);
    setQrUrl("");
    QRCode.toDataURL(info.compact, QR_OPTIONS)
      .then((url) => !cancelled && setQrUrl(url))
      .catch(() => {
        if (cancelled) return;
        setQrFailed(true);
        toast("QR kod oluşturulamadı");
      });
    return () => {
      cancelled = true;
    };
  }, [info.compact, info.valid, toast, attempt]);

  const retryQr = useCallback(() => setAttempt((n) => n + 1), []);

  const handleSave = async () => {
    setBusy(true);
    try {
      const blob = await renderImage(info.compact, info.formatted, includeIban);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iban-qr-${last4(info.compact)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Görsel kaydedildi");
    } catch {
      toast("Görsel kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = await renderImage(info.compact, info.formatted, includeIban);
      const file = new File([blob], `iban-qr-${last4(info.compact)}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "IBAN QR kodu" });
      } else if (navigator.share) {
        await navigator.share({ title: "IBAN QR kodu", text: info.formatted });
      } else {
        await copyText(info.formatted);
        toast("Paylaşım desteklenmiyor, IBAN kopyalandı");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast("Paylaşılamadı");
    } finally {
      setBusy(false);
    }
  };

  if (!info.valid) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-8 text-center font-body text-foreground">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <TriangleAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-heading text-lg font-semibold">QR kod oluşturulamadı</h1>
        <p className="mt-2 text-sm text-muted-foreground">Yalnızca doğrulanmış IBAN&apos;lar için QR kod üretilir.</p>
        <button
          type="button"
          onClick={() => navigate("/", { replace: true })}
          className="mt-6 rounded-theme bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
        >
          Ana Sayfa&apos;ya dön
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background pb-32 font-body text-foreground">
      <header className="px-5 pb-5 pt-12">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => goBack("/")}
            aria-label="Geri dön"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Güvenli paylaşım</p>
            <h1 className="mt-1 font-heading text-lg font-semibold tracking-tight">QR Kod</h1>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Daha fazla seçenek"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
          >
            <Ellipsis className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="px-5">
        <section
          aria-labelledby="qr-title"
          className="relative overflow-hidden rounded-theme border border-border bg-card px-5 pb-5 pt-6 shadow-xl"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-0 -left-20 h-32 w-32 rounded-full bg-accent/5 blur-3xl" />

          <div className="relative text-center">
            <div className="mb-5 flex items-center justify-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">Doğrulanmış IBAN</span>
            </div>

            <h2 id="qr-title" className="font-heading text-xl font-bold tracking-tight">
              IBAN QR kodunuz hazır
            </h2>
            <p className="mx-auto mt-2 max-w-[270px] text-sm leading-5 text-muted-foreground">
              Bankacılık uygulamasından okutularak güvenle paylaşılabilir.
            </p>

            <div className="mx-auto mt-6 flex w-full max-w-[276px] flex-col items-center justify-center rounded-theme bg-foreground p-5 shadow-lg">
              <div className="aspect-square w-full">
                {qrUrl ? (
                  <img src={qrUrl} alt="IBAN QR kodu" className="h-full w-full object-contain" />
                ) : qrFailed ? (
                  <button
                    type="button"
                    onClick={retryQr}
                    className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg bg-muted-foreground/10 text-background"
                  >
                    <TriangleAlert className="h-6 w-6" aria-hidden="true" />
                    <span className="text-xs font-semibold">Oluşturulamadı</span>
                    <span className="flex items-center gap-1 text-[11px] font-medium underline">
                      <RotateCcw className="h-3 w-3" aria-hidden="true" />
                      Tekrar dene
                    </span>
                  </button>
                ) : (
                  <div className="h-full w-full animate-pulse rounded-lg bg-muted-foreground/20" />
                )}
              </div>
              {includeIban && (
                <p className="mt-3 text-[11px] font-semibold tracking-[0.04em] text-background">{info.formatted}</p>
              )}
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-theme border border-border bg-muted px-3.5 py-3 text-left">
              <BankLogo bank={info.bankName} className="h-11 w-16 rounded-xl bg-foreground p-2" iconClassName="h-5 w-5 !text-background" />

              <div className="min-w-0 flex-1">
                <p className="font-heading text-sm font-semibold text-card-foreground">{info.bankName}</p>
                <p className="mt-1 text-xs text-muted-foreground">IBAN ···· {last4(info.compact)}</p>
              </div>

              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success/15 text-success">
                <BadgeCheck className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            </div>
          </div>
        </section>

        <section aria-label="QR kod seçenekleri" className="mt-4 rounded-theme border border-border bg-card px-4 py-1">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
                <Type className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>

              <div>
                <p className="text-sm font-medium text-card-foreground">IBAN&apos;ı metin olarak da ekle</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Kaydedilen görselin altında gösterilir</p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={includeIban}
              aria-label="IBAN'ı metin olarak ekle"
              onClick={() => setIncludeIban((value) => !value)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                includeIban ? "bg-primary shadow-lg" : "border border-border bg-secondary"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full shadow-sm transition-transform ${
                  includeIban ? "right-1 bg-primary-foreground" : "left-1 bg-muted-foreground"
                }`}
              />
            </button>
          </div>
        </section>

        <div className="mt-4 flex items-start gap-2.5 px-1">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <p className="text-xs leading-5 text-muted-foreground">Paylaşmadan önce alıcıyı ve IBAN bilgisini doğrulayın.</p>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[393px] gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !qrUrl}
            className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-theme border border-border bg-secondary px-4 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            <Download className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
            Görsel Olarak Kaydet
          </button>

          <button
            type="button"
            onClick={handleShare}
            disabled={busy || !qrUrl}
            className="flex min-h-14 flex-[0.78] items-center justify-center gap-2 rounded-theme bg-primary px-4 text-sm font-bold text-primary-foreground shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Share2 className="h-[18px] w-[18px]" aria-hidden="true" />
            Paylaş
          </button>
        </div>
      </div>

      {menuOpen && (
        <Sheet title="Seçenekler" onClose={() => setMenuOpen(false)}>
          <SheetAction
            icon={<Check className="h-5 w-5" />}
            label="IBAN'ı kopyala"
            onClick={async () => {
              setMenuOpen(false);
              toast((await copyText(info.formatted)) ? "IBAN kopyalandı" : "Kopyalanamadı");
            }}
          />
          <SheetAction
            icon={<BadgeCheck className="h-5 w-5" />}
            label="IBAN detayını aç"
            onClick={() => {
              setMenuOpen(false);
              navigate(`/iban/${info.compact}`);
            }}
          />
        </Sheet>
      )}
    </div>
  );
}
