import { useCallback, useEffect, useRef, useState } from "react";
import { LockKeyhole, ScanFace } from "lucide-react";
import { verifyBiometric } from "../lib/biometric";

export default function LockScreen({ onUnlock, onReset }: { onUnlock: () => void; onReset: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const attempt = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    const ok = await verifyBiometric();
    setBusy(false);
    if (ok) onUnlock();
    else setFailed(true);
  }, [onUnlock]);

  // StrictMode geliştirme modunda efekti iki kez çalıştırır; eşzamanlı ikinci WebAuthn isteğini önle
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void attempt();
  }, [attempt]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-8 text-center font-body text-foreground">
      <span className="flex h-20 w-20 items-center justify-center rounded-full border border-primary/50 bg-card text-primary shadow-[0_0_0_8px] shadow-primary/10">
        <LockKeyhole className="h-9 w-9" aria-hidden="true" />
      </span>
      <h1 className="mt-6 font-heading text-2xl font-bold tracking-tight">Ibanova kilitli</h1>
      <p className="mt-2 max-w-[280px] text-sm text-muted-foreground">
        {failed ? "Doğrulama tamamlanamadı. Tekrar deneyin." : "Devam etmek için kimliğinizi doğrulayın."}
      </p>
      <button
        type="button"
        onClick={attempt}
        disabled={busy}
        className="mt-8 flex items-center gap-2 rounded-theme bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        <ScanFace className="h-5 w-5" aria-hidden="true" />
        Kilidi aç
      </button>
      <button type="button" onClick={onReset} className="mt-6 text-xs font-medium text-muted-foreground underline">
        Erişemiyor musun? Verileri sıfırla ve kilidi kaldır
      </button>
    </div>
  );
}
