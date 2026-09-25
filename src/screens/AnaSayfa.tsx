import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Bell,
  BookmarkPlus,
  Check,
  ClipboardPaste,
  Copy,
  Keyboard,
  MapPin,
  QrCode,
  Search,
  Share2,
  Sparkles,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import BottomNav from "../components/BottomNav";
import BankLogo from "../components/BankLogo";
import Sheet, { PrimaryButton, SecondaryButton } from "../components/Sheet";
import { IBAN_LENGTH, analyzeIban, caretAfterFormat, formatIban, normalizeIban, problemMessage } from "../lib/iban";
import { canReadClipboard, copyText, readClipboardText, shareText, vibrate } from "../lib/device";
import { useBranch } from "../lib/useBranch";
import { navigate } from "../lib/router";
import { useApp } from "../store";

export default function IbanVerificationScreen() {
  const { input, setInput, recordCheck, isSaved, saveIban, settings, toast, profileName } = useApp();
  const firstName = profileName.trim().split(/\s+/)[0] || "";
  const [labelOpen, setLabelOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [clipboardIban, setClipboardIban] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  const info = useMemo(() => analyzeIban(input), [input]);
  const saved = info.valid && isSaved(info.compact);
  const branch = useBranch(info.bankCode, info.branch, info.valid);

  // Biçimlendirme sonrası imleci doğru yere geri koy
  useLayoutEffect(() => {
    if (caret.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [input]);

  // Panodaki IBAN'ı uygulamaya dönüldüğünde algıla (ayar açıksa)
  useEffect(() => {
    if (!settings.clipboard) {
      setClipboardIban("");
      return;
    }
    const check = async () => {
      if (document.visibilityState !== "visible" || !canReadClipboard()) return;
      try {
        const text = await readClipboardText();
        const found = analyzeIban(text);
        setClipboardIban(found.valid && found.compact !== analyzeIban(input).compact ? found.compact : "");
      } catch {
        /* izin verilmedi veya pano boş: sessizce geç */
      }
    };
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [settings.clipboard, input]);

  const commit = (raw: string, caretRaw?: number) => {
    const next = normalizeIban(raw);
    const formatted = formatIban(next);

    if (caretRaw !== undefined) {
      caret.current = caretAfterFormat(raw, caretRaw, formatted);
    }

    setInput(formatted);
    if (next.length === IBAN_LENGTH) recordCheck(next);
  };

  const copyIban = async () => {
    const ok = await copyText(info.formatted);
    vibrate(settings.haptics);
    toast(ok ? "IBAN kopyalandı" : "Kopyalanamadı");
  };

  const pasteIban = async () => {
    try {
      const text = await readClipboardText();
      if (text) commit(text);
      else toast("Panoda metin yok");
    } catch {
      toast("Panoya erişim izni verilmedi");
    }
  };

  const shareIban = async () => {
    // İptal edilirse sessiz kal; paylaşım yoksa kopyala
    if ((await shareText("IBAN doğrulama sonucu", info.formatted)) === "unsupported") await copyIban();
  };

  const confirmSave = () => {
    const result = saveIban(info.compact, label);
    setLabelOpen(false);
    setLabel("");
    toast(result === "saved" ? "IBAN kaydedildi" : "Bu IBAN zaten kayıtlı");
  };

  return (
    <div className="min-h-screen w-full bg-background pb-28 font-body text-foreground">
      <header className="px-5 pb-6 pt-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Profil"
              onClick={() => navigate("/profil")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm"
            >
              {firstName ? (
                <span className="font-heading text-sm font-bold">{firstName.charAt(0).toLocaleUpperCase("tr-TR")}</span>
              ) : (
                <UserRound size={18} aria-hidden="true" />
              )}
            </button>

            <div>
              <h1 className="font-heading text-lg font-semibold tracking-tight">
                {firstName ? `Merhaba, ${firstName}` : "Merhaba"}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">IBAN kontrollerin güvende</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Geçmiş IBAN ara"
              onClick={() => navigate("/gecmis")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/70 bg-card text-primary"
            >
              <Search size={20} strokeWidth={1.8} />
            </button>

            <button
              type="button"
              aria-label="Bildirimler"
              onClick={() => toast("Yeni bildirimin yok")}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground"
            >
              <Bell size={20} strokeWidth={1.8} />
              {settings.notifications && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="px-5">
        <section aria-labelledby="verify-title">
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_14px] shadow-primary/80" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Anlık kontrol</span>
            </div>

            <h2 id="verify-title" className="font-heading text-[28px] font-bold leading-tight tracking-tight">
              IBAN Doğrula
            </h2>
            <p className="mt-2 max-w-[300px] text-sm leading-6 text-muted-foreground">
              IBAN&apos;ı girin, biçimlendirelim ve doğrulayalım.
            </p>
          </div>

          <div className="rounded-theme border border-primary/40 bg-card p-4 shadow-lg shadow-background/20">
            <div className="mb-3 flex items-center justify-between">
              <label htmlFor="iban" className="text-xs font-medium text-muted-foreground">
                Türkiye IBAN&apos;ı
              </label>

              <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles size={14} />
                Otomatik biçimlendirme
              </span>
            </div>

            <div className="rounded-theme border border-border bg-input px-3 py-3">
              <div className="flex items-center gap-1.5">
                <span className="hidden h-8 min-w-9 items-center justify-center rounded-lg bg-destructive min-[380px]:flex text-[11px] font-bold text-destructive-foreground">
                  TR
                </span>

                <input
                  id="iban"
                  ref={inputRef}
                  value={input}
                  onChange={(event) => commit(event.target.value, event.target.selectionStart ?? undefined)}
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="TR00 0000 0000 0000 0000 0000 00"
                  aria-label="Türkiye IBAN'ı"
                  className="min-w-0 flex-1 bg-transparent font-body text-[length:clamp(10px,calc((100vw-134px)/18),14px)] font-semibold tracking-normal text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/60 min-[380px]:text-[length:clamp(11px,calc((100vw-182px)/18),14px)]"
                />

                <button
                  type="button"
                  aria-label="Alanı temizle"
                  onClick={() => {
                    setInput("");
                    inputRef.current?.focus();
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-3 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={pasteIban}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-semibold text-secondary-foreground"
                >
                  <ClipboardPaste size={18} className="text-primary" />
                  Panodan Yapıştır
                </button>
              </div>
            </div>

            {clipboardIban && (
              <button
                type="button"
                onClick={() => {
                  commit(clipboardIban);
                  setClipboardIban("");
                }}
                className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-left text-xs text-foreground"
              >
                <span className="min-w-0 truncate">
                  <span className="font-semibold text-primary">Panoda IBAN bulundu: </span>
                  {formatIban(clipboardIban)}
                </span>
                <span className="shrink-0 font-semibold text-primary">Kontrol et</span>
              </button>
            )}

            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Keyboard size={14} />
              Yazdıkça kontrol edilir ve gruplandırılır.
            </p>
          </div>
        </section>

        <section className="mt-6" aria-labelledby="result-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="result-title" className="font-heading text-base font-semibold">
              Doğrulama sonucu
            </h2>
            <span className="text-xs text-muted-foreground">{info.complete ? "Şimdi" : ""}</span>
          </div>

          {!info.complete ? (
            <article className="rounded-theme border border-border bg-card px-4 py-6 text-center" aria-live="polite">
              <p className="font-heading text-sm font-semibold">
                {info.compact.length === 0 ? "IBAN bekleniyor" : "Yazmaya devam edin"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {info.compact.length} / {IBAN_LENGTH} karakter
              </p>
              <div className="mx-auto mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(info.compact.length / IBAN_LENGTH) * 100}%` }}
                />
              </div>
            </article>
          ) : (
            <article className="overflow-hidden rounded-theme border border-border bg-card shadow-sm" aria-live="polite">
              <div className="border-b border-border px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full ${
                        info.valid ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {info.valid ? <Check size={24} /> : <TriangleAlert size={22} />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading text-base font-semibold">
                          {info.valid ? "IBAN doğrulandı" : "IBAN geçersiz"}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            info.valid
                              ? "bg-success text-success-foreground"
                              : "bg-destructive text-destructive-foreground"
                          }`}
                        >
                          {info.valid ? "Geçerli" : "Geçersiz"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {info.valid ? "MOD-97 doğrulaması başarılı" : problemMessage(info.problem)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_12px] ${
                      info.valid ? "bg-primary shadow-primary/90" : "bg-destructive shadow-destructive/90"
                    }`}
                  />
                </div>
              </div>

              {info.valid && (
                <div className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <BankLogo
                      bank={info.bankName}
                      className="h-12 w-16 rounded-xl bg-foreground p-2"
                      iconClassName="h-6 w-6 !text-background"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-sm font-semibold text-card-foreground">{info.bankName}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground" data-testid="branch-line">
                        <MapPin size={14} className="shrink-0" />
                        {branch ? (
                          <span className="truncate" title="IBAN'daki şube kodundan TCMB şube listesine göre bulundu">
                            {branch.name}
                            {branch.place && ` · ${branch.place}`}
                          </span>
                        ) : (
                          "Türkiye"
                        )}
                      </p>
                    </div>

                    {info.knownBank && <BadgeCheck size={21} className="text-success" />}
                  </div>

                  <div className="my-4 h-px bg-border" />

                  <div className="grid grid-cols-2 gap-2">
                    <InfoTile label="Banka Kodu" value={info.bankCode} />
                    <InfoTile label="Şube Kodu" value={info.branch} />
                    <InfoTile label="Hesap Numarası" value={info.account} wide />
                  </div>
                </div>
              )}

              <div className={`grid border-t border-border ${info.valid ? "grid-cols-3" : "grid-cols-2"}`}>
                <ActionButton icon={<Copy size={18} />} label="Kopyala" onClick={copyIban} />
                <ActionButton icon={<Share2 size={18} />} label="Paylaş" onClick={shareIban} />
                {info.valid && (
                  <ActionButton
                    icon={<QrCode size={18} />}
                    label="QR Kod Oluştur"
                    onClick={() => navigate(`/qr/${info.compact}`)}
                  />
                )}
              </div>
            </article>
          )}

          {info.valid && (
            <button
              type="button"
              disabled={saved}
              onClick={() => {
                setLabel("");
                setLabelOpen(true);
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-theme border border-primary/50 bg-secondary px-4 py-3.5 text-sm font-semibold text-secondary-foreground disabled:opacity-60"
            >
              {saved ? (
                <>
                  <Check size={18} className="text-success" />
                  Kayıtlı IBAN
                </>
              ) : (
                <>
                  <BookmarkPlus size={18} className="text-primary" />
                  IBAN&apos;ı Kaydet
                  <span className="ml-1 text-xs font-normal text-muted-foreground">Özel etiket ekle</span>
                </>
              )}
            </button>
          )}
        </section>
      </main>

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

      <BottomNav active="home" />
    </div>
  );
}

function InfoTile({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-xl bg-muted px-3 py-3 ${wide ? "col-span-2" : ""}`}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-body text-sm font-semibold tracking-[0.05em] text-foreground">{value}</p>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 border-r border-border py-3 text-xs font-medium text-secondary-foreground last:border-r-0"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </button>
  );
}
