import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound, LogIn, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import Field from "../components/Field";
import Sheet, { PrimaryButton, SecondaryButton } from "../components/Sheet";
import { ApiError, MIN_PASSWORD, fetchConfig, forgotPassword } from "../lib/api";
import { goBack, navigate } from "../lib/router";
import { useApp } from "../store";

type Tab = "giris" | "kayit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AccountScreen() {
  const { account, authBusy, signIn, signUp, signOut, changePassword, deleteAccount } = useApp();
  const [tab, setTab] = useState<Tab>("giris");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const [sheet, setSheet] = useState<"password" | "delete" | "forgot" | null>(null);
  const [resetAvailable, setResetAvailable] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchConfig().then((c) => alive && setResetAvailable(Boolean(c?.passwordReset)));
    return () => {
      alive = false;
    };
  }, []);

  const openForgot = () => {
    setForgotEmail(email.trim());
    setForgotSent("");
    setSheetError("");
    setSheet("forgot");
  };

  const submitForgot = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(forgotEmail.trim())) return setSheetError("Geçerli bir e-posta girin");
    setSheetError("");
    setForgotBusy(true);
    try {
      const r = await forgotPassword(forgotEmail.trim());
      setForgotSent(r.message);
    } catch (err) {
      setSheetError(messageOf(err));
    } finally {
      setForgotBusy(false);
    }
  };
  const [sheetError, setSheetError] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [deletePw, setDeletePw] = useState("");

  const openSheet = (which: "password" | "delete") => {
    setCurrentPw("");
    setNewPw("");
    setNewPw2("");
    setDeletePw("");
    setSheetError("");
    setSheet(which);
  };

  const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Bir şeyler ters gitti, tekrar deneyin.");

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPw) return setSheetError("Mevcut şifrenizi girin");
    if (newPw.length < MIN_PASSWORD) return setSheetError(`Yeni şifre en az ${MIN_PASSWORD} karakter olmalı`);
    if (newPw !== newPw2) return setSheetError("Yeni şifreler eşleşmiyor");
    if (newPw === currentPw) return setSheetError("Yeni şifre eskisiyle aynı olamaz");
    setSheetError("");
    try {
      await changePassword(currentPw, newPw);
      setSheet(null);
    } catch (err) {
      setSheetError(messageOf(err));
    }
  };

  const submitDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!deletePw) return setSheetError("Şifrenizi girin");
    setSheetError("");
    try {
      await deleteAccount(deletePw);
      setSheet(null);
      goBack("/profil");
    } catch (err) {
      setSheetError(messageOf(err));
    }
  };

  const validate = (): string => {
    if (!EMAIL_RE.test(email.trim())) return "Geçerli bir e-posta girin";
    if (password.length < MIN_PASSWORD) return `Şifre en az ${MIN_PASSWORD} karakter olmalı`;
    if (tab === "kayit" && !name.trim()) return "Adınızı girin";
    return "";
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    try {
      if (tab === "giris") await signIn(email.trim(), password);
      else await signUp(email.trim(), password, name);
      goBack("/profil");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Bir şeyler ters gitti, tekrar deneyin.");
    }
  };

  if (account) {
    return (
      <div className="min-h-screen w-full bg-background pb-28 font-body text-foreground">
        <header className="px-5 pb-5 pt-12">
          <button
            type="button"
            onClick={() => goBack("/profil")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Geri dön"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </header>
        <main className="px-5">
          <div className="rounded-theme border border-border bg-card p-5 text-center shadow-lg">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="font-heading text-lg font-bold">{account.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{account.email}</p>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Verileriniz bu hesapla senkronize ediliyor. Çıkış yaptığınızda cihazınızdaki veriler silinmez, yalnızca
              senkronizasyon durur.
            </p>
            <button
              type="button"
              onClick={() => {
                signOut();
                goBack("/profil");
              }}
              className="mt-5 w-full rounded-theme border border-destructive/40 bg-destructive/10 py-3 text-sm font-semibold text-destructive"
            >
              Çıkış Yap
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-theme border border-border bg-card">
            <button
              type="button"
              onClick={() => openSheet("password")}
              className="flex w-full items-center gap-3 border-b border-border px-4 py-4 text-left text-sm font-medium hover:bg-muted"
            >
              <KeyRound className="h-5 w-5 text-primary" />
              Şifreyi Değiştir
            </button>
            <button
              type="button"
              onClick={() => openSheet("delete")}
              className="flex w-full items-center gap-3 px-4 py-4 text-left text-sm font-medium text-destructive hover:bg-muted"
            >
              <Trash2 className="h-5 w-5" />
              Hesabı Sil
            </button>
          </div>
        </main>

        {sheet === "password" && (
          <Sheet title="Şifreyi değiştir" onClose={() => setSheet(null)}>
            <form onSubmit={submitPassword} className="space-y-4">
              <Field
                id="pw-current"
                label="Mevcut şifre"
                type="password"
                value={currentPw}
                onChange={setCurrentPw}
                autoComplete="current-password"
              />
              <Field
                id="pw-new"
                label={`Yeni şifre (en az ${MIN_PASSWORD} karakter)`}
                type="password"
                value={newPw}
                onChange={setNewPw}
                autoComplete="new-password"
              />
              <Field
                id="pw-new2"
                label="Yeni şifre (tekrar)"
                type="password"
                value={newPw2}
                onChange={setNewPw2}
                autoComplete="new-password"
              />
              <p className="text-[11px] leading-5 text-muted-foreground">
                Şifre değişince diğer cihazlardaki oturumlar kapanır.
              </p>
              {sheetError && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {sheetError}
                </p>
              )}
              <div className="flex gap-3">
                <SecondaryButton onClick={() => setSheet(null)}>Vazgeç</SecondaryButton>
                <PrimaryButton type="submit" disabled={authBusy}>
                  {authBusy ? "Bekleyin…" : "Değiştir"}
                </PrimaryButton>
              </div>
            </form>
          </Sheet>
        )}

        {sheet === "delete" && (
          <Sheet title="Hesap silinsin mi?" onClose={() => setSheet(null)}>
            <form onSubmit={submitDelete} className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Hesabınız ve sunucudaki senkron verileriniz kalıcı olarak silinir. Bu cihazdaki geçmiş ve kayıtlı
                IBAN&apos;lar yerinde kalır. Onaylamak için şifrenizi girin.
              </p>
              <Field
                id="del-password"
                label="Şifre"
                type="password"
                value={deletePw}
                onChange={setDeletePw}
                autoComplete="current-password"
              />
              {sheetError && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {sheetError}
                </p>
              )}
              <div className="flex gap-3">
                <SecondaryButton onClick={() => setSheet(null)}>Vazgeç</SecondaryButton>
                <button
                  type="submit"
                  disabled={authBusy || !deletePw}
                  className="flex h-12 flex-1 items-center justify-center rounded-theme bg-destructive text-sm font-bold text-destructive-foreground disabled:opacity-40"
                >
                  {authBusy ? "Bekleyin…" : "Kalıcı Olarak Sil"}
                </button>
              </div>
            </form>
          </Sheet>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background pb-28 font-body text-foreground">
      <header className="px-5 pb-5 pt-12">
        <button
          type="button"
          onClick={() => goBack("/profil")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="Geri dön"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="mt-4 font-heading text-[26px] font-bold tracking-tight">Hesap</h1>
        <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
          Hesap oluşturmak isteğe bağlıdır; uygulama hesapsız da tamamen çalışır. Hesap açarsanız verileriniz
          cihazlar arasında senkronize edilebilir.
        </p>
      </header>

      <main className="px-5">
        <div className="flex rounded-theme border border-border bg-card p-1" role="tablist" aria-label="Hesap sekmesi">
          {(
            [
              { key: "giris" as const, label: "Giriş Yap" },
              { key: "kayit" as const, label: "Hesap Oluştur" },
            ]
          ).map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTab(item.key);
                  setError("");
                }}
                className={`flex-1 rounded-xl px-3 py-2.5 text-xs ${
                  active ? "bg-primary font-semibold text-primary-foreground" : "font-medium text-muted-foreground"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4 rounded-theme border border-border bg-card p-5 shadow-lg">
          {tab === "kayit" && (
            <Field id="acc-name" label="Ad Soyad" type="text" value={name} onChange={setName} autoComplete="name" />
          )}
          <Field
            id="acc-email"
            label="E-posta"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <Field
            id="acc-password"
            label="Şifre"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={setPassword}
            autoComplete={tab === "giris" ? "current-password" : "new-password"}
            toggle={{ shown: showPassword, onToggle: () => setShowPassword((v) => !v) }}
          />

          {error && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}

          <PrimaryButton type="submit" disabled={authBusy} className="w-full gap-2">
            {tab === "giris" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {authBusy ? "Bekleyin…" : tab === "giris" ? "Giriş Yap" : "Hesap Oluştur"}
          </PrimaryButton>

          {tab === "giris" && resetAvailable && (
            <button
              type="button"
              onClick={openForgot}
              className="block w-full text-center text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              Şifremi unuttum
            </button>
          )}

          {tab === "kayit" && (
            <p className="text-center text-[11px] leading-5 text-muted-foreground">
              Hesap oluşturarak{" "}
              <button
                type="button"
                onClick={() => navigate("/gizlilik")}
                className="font-medium text-primary underline underline-offset-2"
              >
                Gizlilik Politikası ve Aydınlatma Metni
              </button>
              &apos;ni okuduğunuzu onaylarsınız.
            </p>
          )}
        </form>

        <p className="mt-4 text-center text-[11px] leading-5 text-muted-foreground">
          Ibanova hesabı bir banka hesabı değildir; bankacılık bilgilerinize ya da hesaplarınıza erişmez.
        </p>
      </main>

      {sheet === "forgot" && (
        <Sheet title="Şifremi unuttum" onClose={() => setSheet(null)}>
          {forgotSent ? (
            <div className="space-y-4">
              <p role="status" className="text-sm leading-6 text-muted-foreground">
                {forgotSent} Bağlantı 1 saat geçerlidir; gelen kutunuzu ve istenmeyen klasörünü kontrol edin.
              </p>
              <PrimaryButton className="w-full" onClick={() => setSheet(null)}>
                Tamam
              </PrimaryButton>
            </div>
          ) : (
            <form onSubmit={submitForgot} className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Hesabınızın e-postasını girin; yeni şifre belirlemeniz için bir bağlantı gönderelim.
              </p>
              <Field
                id="forgot-email"
                label="E-posta"
                type="email"
                value={forgotEmail}
                onChange={setForgotEmail}
                autoComplete="email"
              />
              {sheetError && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {sheetError}
                </p>
              )}
              <div className="flex gap-3">
                <SecondaryButton onClick={() => setSheet(null)}>Vazgeç</SecondaryButton>
                <PrimaryButton type="submit" disabled={forgotBusy}>
                  {forgotBusy ? "Gönderiliyor…" : "Bağlantı Gönder"}
                </PrimaryButton>
              </div>
            </form>
          )}
        </Sheet>
      )}
    </div>
  );
}
