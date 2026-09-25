import { useEffect, useRef, useState } from "react";
import { enrollBiometric, isBiometricAvailable, verifyBiometric, clearCredential } from "../lib/biometric";
import BottomNav from "../components/BottomNav";
import Sheet, { PrimaryButton, SecondaryButton, SheetAction } from "../components/Sheet";
import { isThisMonth } from "../lib/format";
import { navigate } from "../lib/router";
import { useApp, type Settings } from "../store";
import {
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardPaste,
  Hand,
  LockKeyhole,
  LogIn,
  MoreHorizontal,
  ScanFace,
  ShieldCheck,
  SlidersHorizontal,
  Pencil,
  RotateCcw,
  UserCircle2,
  UserRound,
} from "lucide-react";

const settingItems: { key: keyof Settings; label: string; description?: string; icon: typeof Bell }[] = [
  {
    key: "clipboard",
    label: "Panodan otomatik algıla",
    description: "Kopyalanan IBAN'ı hızlıca kontrol et",
    icon: ClipboardPaste,
  },
  {
    key: "haptics",
    label: "Haptik geri bildirim",
    icon: Hand,
  },
  {
    key: "notifications",
    label: "Bildirimler",
    icon: Bell,
  },
];

function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        enabled ? "bg-primary" : "border border-border bg-secondary"
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full shadow-sm transition-transform ${
          enabled ? "right-1 bg-primary-foreground" : "left-1 bg-muted-foreground"
        }`}
      />
    </button>
  );
}

export default function ProfileScreen() {
  const { history, saved, settings, updateSetting, resetAll, toast, profileName, setProfileName, account } = useApp();
  const [bioSupported, setBioSupported] = useState<boolean | null>(null);
  const [bioBusy, setBioBusy] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    isBiometricAvailable().then((ok) => alive && setBioSupported(ok));
    return () => {
      alive = false;
    };
  }, []);

  const toggleBiometric = async () => {
    if (bioBusy) return;
    setBioBusy(true);
    if (settings.biometric) {
      // Kilidi kapatmak için önce kimlik doğrula
      if (await verifyBiometric()) {
        clearCredential();
        updateSetting("biometric", false);
        toast("Cihaz kilidi kapatıldı");
      } else {
        toast("Doğrulama başarısız, kilit açık kaldı");
      }
    } else if (await enrollBiometric()) {
      updateSetting("biometric", true);
      toast("Cihaz kilidi açıldı");
    } else {
      toast("Cihaz kilidi ayarlanamadı");
    }
    setBioBusy(false);
  };

  const initial = profileName.trim().charAt(0).toLocaleUpperCase("tr-TR");
  const monthly = history.filter((r) => isThisMonth(r.at)).length;

  return (
    <div className="min-h-screen w-full bg-background pb-28 font-body text-foreground">
      <header className="px-5 pb-6 pt-12">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Hesabım
            </p>
            <h1 className="mt-2 font-heading text-[28px] font-bold tracking-tight">
              Profil
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Daha fazla seçenek"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-5">
        <section
          aria-labelledby="profile-title"
          className="rounded-theme border border-border bg-card p-5 shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-primary/50 bg-muted shadow-[0_0_0_5px] shadow-primary/10">
              <span className="flex h-full w-full items-center justify-center font-heading text-2xl font-bold text-primary">
                {initial || <UserRound className="h-8 w-8" aria-hidden="true" />}
              </span>
            </div>

            <div className="min-w-0">
              <h2
                id="profile-title"
                className="font-heading text-xl font-bold tracking-tight"
              >
                {profileName || <span className="text-muted-foreground">Adınızı ekleyin</span>}
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(profileName);
                    setNameOpen(true);
                  }}
                  aria-label="Adı düzenle"
                  className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full align-middle text-muted-foreground hover:text-primary"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </h2>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
                {account ? `${account.email} ile senkronize` : "Verileriniz cihazınızda korunur"}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 divide-x divide-border rounded-xl bg-muted py-3.5">
            <div className="px-4">
              <p className="font-heading text-lg font-bold tabular-nums">{monthly}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                doğrulama bu ay
              </p>
            </div>
            <div className="px-4">
              <p className="font-heading text-lg font-bold tabular-nums">{saved.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">kayıtlı IBAN</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/hesap")}
            className="mt-4 flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-muted px-4 py-3.5 text-left"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
                {account ? <UserCircle2 className="h-[18px] w-[18px]" /> : <LogIn className="h-[18px] w-[18px]" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{account ? account.name : "Giriş Yap / Hesap Oluştur"}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {account ? account.email : "Verilerinizi hesabınızla senkronize edin"}
                </span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        </section>

        <section className="mt-6" aria-labelledby="privacy-title">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Kontrol sizde
            </p>
            <h2
              id="privacy-title"
              className="mt-1.5 font-heading text-lg font-semibold"
            >
              Gizlilik ve doğrulama
            </h2>
          </div>

          <button
            type="button"
            onClick={() => settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="flex w-full items-center justify-between gap-4 rounded-theme border border-primary/60 bg-secondary px-4 py-4 text-left shadow-lg shadow-primary/10"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <SlidersHorizontal className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-heading text-sm font-semibold text-secondary-foreground">
                  Tercihleri yönet
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Gizlilik ve doğrulama ayarlarınızı düzenleyin
                </span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
          </button>

          <div ref={settingsRef} className="mt-3 overflow-hidden rounded-theme border border-border bg-card">
            {settingItems.map(({ key, label, description, icon: Icon }, index) => (
              <div
                key={key}
                className={`flex items-center justify-between gap-4 px-4 py-4 ${
                  index < settingItems.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    {description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {description}
                      </p>
                    )}
                  </div>
                </div>
                <Toggle
                  label={label}
                  enabled={settings[key]}
                  onChange={() => updateSetting(key, !settings[key])}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6" aria-labelledby="security-title">
          <h2
            id="security-title"
            className="mb-3 font-heading text-lg font-semibold"
          >
            Güvenlik
          </h2>

          <div className="overflow-hidden rounded-theme border border-border bg-card">
            <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                  <ScanFace className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-medium">Face ID ile erişim</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Profilinizi biyometrik olarak koruyun
                  </p>
                </div>
              </div>
              {bioSupported === false ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  Desteklenmiyor
                </span>
              ) : (
                <Toggle label="Face ID ile erişim" enabled={settings.biometric} onChange={toggleBiometric} />
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate("/gizlilik")}
              className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-muted"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                <LockKeyhole className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Veri gizliliği ve KVKK</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  IBAN verileri doğrulama için işlenir; bankacılık hesabınıza erişim sağlanmaz. Aydınlatma metnini
                  okuyun.
                </span>
              </span>
              <ChevronRight className="mt-2.5 h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          </div>
        </section>

        <section className="mb-4 mt-6" aria-labelledby="help-title">
          <h2
            id="help-title"
            className="mb-3 font-heading text-lg font-semibold"
          >
            Yardım
          </h2>

          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            aria-expanded={helpOpen}
            className="flex w-full items-center justify-between gap-4 rounded-theme border border-border bg-card px-4 py-4 text-left"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                <CircleHelp className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  IBAN doğrulama nasıl çalışır?
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  MOD-97 biçim tutarlılığını kontrol eder, hesap sahipliğini
                  değil.
                </span>
              </span>
            </span>
            <ChevronRight
              className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${helpOpen ? "rotate-90" : ""}`}
            />
          </button>

          {helpOpen && (
            <div className="mt-2 rounded-theme border border-border bg-card px-4 py-4 text-xs leading-5 text-muted-foreground">
              <p>
                Türkiye IBAN&apos;ı 26 karakterdir: <span className="text-foreground">TR</span>, 2 kontrol hanesi, 5
                haneli banka kodu, 1 yedek hane ve 16 haneli hesap alanı.
              </p>
              <p className="mt-2">
                MOD-97 algoritması kontrol hanelerini hesaplayarak IBAN&apos;ın yazım hatası içerip içermediğini
                anlar. Hesabın gerçekten var olduğunu ya da kime ait olduğunu doğrulamaz.
              </p>
            </div>
          )}
        </section>
      </main>

      {menuOpen && (
        <Sheet title="Profil" onClose={() => setMenuOpen(false)}>
          <SheetAction
            danger
            icon={<RotateCcw className="h-5 w-5" />}
            label="Verileri sıfırla"
            onClick={() => {
              setMenuOpen(false);
              setConfirmReset(true);
            }}
          />
        </Sheet>
      )}

      {confirmReset && (
        <Sheet title="Veriler sıfırlansın mı?" onClose={() => setConfirmReset(false)}>
          <p className="mb-4 text-sm text-muted-foreground">
            Bu cihazdaki geçmiş, kayıtlı IBAN&apos;lar, ad ve tercihler silinir. Hesabınıza giriş yaptıysanız
            hesaptaki veriler de temizlenir.
          </p>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setConfirmReset(false)}>Vazgeç</SecondaryButton>
            <PrimaryButton
              onClick={() => {
                resetAll();
                setConfirmReset(false);
                toast("Veriler sıfırlandı");
              }}
            >
              Sıfırla
            </PrimaryButton>
          </div>
        </Sheet>
      )}

      {nameOpen && (
        <Sheet title="Adı düzenle" onClose={() => setNameOpen(false)}>
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && nameDraft.trim()) {
                setProfileName(nameDraft);
                setNameOpen(false);
              }
            }}
            maxLength={40}
            aria-label="Ad Soyad"
            className="w-full rounded-theme border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="mt-4 flex gap-3">
            <SecondaryButton onClick={() => setNameOpen(false)}>Vazgeç</SecondaryButton>
            <PrimaryButton
              disabled={!nameDraft.trim()}
              onClick={() => {
                setProfileName(nameDraft);
                setNameOpen(false);
                toast("Ad güncellendi");
              }}
            >
              Kaydet
            </PrimaryButton>
          </div>
        </Sheet>
      )}

      <BottomNav active="profile" />
    </div>
  );
}