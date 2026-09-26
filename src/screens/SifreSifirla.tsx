import { useState, type FormEvent } from "react";
import { ArrowLeft, BadgeCheck, KeyRound } from "lucide-react";
import Field from "../components/Field";
import { PrimaryButton } from "../components/Sheet";
import { ApiError, MIN_PASSWORD } from "../lib/api";
import { navigate } from "../lib/router";
import { isNativeApp } from "../lib/native";
import { isDemo, isWebTest, useApp } from "../store";

/** Bağlantı tarayıcıda açıldıysa (uygulama dışında) sıfırlamadan sonra kullanıcı uygulamaya yönlendirilir. */
const inBrowserOnly = () => !isNativeApp() && !import.meta.env.DEV && !isDemo() && !isWebTest();

/** E-postadaki "şifre sıfırlama" bağlantısının açtığı ekran (#/sifre-sifirla/<jeton>). */
export default function ResetPasswordScreen({ token }: { token: string }) {
  const { completeReset, authBusy } = useApp();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const browserOnly = inBrowserOnly();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < MIN_PASSWORD)
      return setError(`Şifre en az ${MIN_PASSWORD} karakter olmalı`);
    if (pw !== pw2) return setError("Şifreler eşleşmiyor");
    setError("");
    try {
      await completeReset(token, pw);
      // Jeton adres çubuğunda ve geçmişte kalmasın
      if (browserOnly) {
        window.history.replaceState(null, "", "#/sifre-sifirla/tamam");
        setDone(true);
      } else navigate("/profil", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Bir şeyler ters gitti, tekrar deneyin.",
      );
    }
  };

  if (done) {
    return (
      <div className="min-h-screen w-full bg-background px-5 pt-16 font-body text-foreground">
        <BadgeCheck className="h-12 w-12 text-success" />
        <h1 className="mt-4 font-heading text-[26px] font-bold tracking-tight">
          Şifreniz yenilendi
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ibanova uygulamasını açıp e-posta adresiniz ve yeni şifrenizle giriş
          yapabilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background pb-28 font-body text-foreground">
      <header className="px-5 pb-5 pt-12">
        {!browserOnly && (
          <button
            type="button"
            onClick={() => navigate("/hesap", { replace: true })}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Geri dön"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="mt-4 font-heading text-[26px] font-bold tracking-tight">
          Yeni şifre belirleyin
        </h1>
        <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
          Yeni şifreniz kaydedilince diğer cihazlardaki oturumlarınız kapanır.
        </p>
      </header>

      <main className="px-5">
        <form
          onSubmit={submit}
          className="space-y-4 rounded-theme border border-border bg-card p-5 shadow-lg"
        >
          <Field
            id="reset-pw"
            label={`Yeni şifre (en az ${MIN_PASSWORD} karakter)`}
            type={show ? "text" : "password"}
            value={pw}
            onChange={setPw}
            autoComplete="new-password"
            toggle={{ shown: show, onToggle: () => setShow((v) => !v) }}
          />
          <Field
            id="reset-pw2"
            label="Yeni şifre (tekrar)"
            type={show ? "text" : "password"}
            value={pw2}
            onChange={setPw2}
            autoComplete="new-password"
          />
          {error && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}
          <PrimaryButton
            type="submit"
            disabled={authBusy}
            className="w-full gap-2"
          >
            <KeyRound className="h-4 w-4" />
            {authBusy ? "Bekleyin…" : "Şifreyi Kaydet"}
          </PrimaryButton>
        </form>
      </main>
    </div>
  );
}
