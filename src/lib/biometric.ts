/**
 * Cihaz kilidi (Face ID / parmak izi / Windows Hello) — WebAuthn platform doğrulayıcısı.
 * Bu, verilerin bulunduğu cihazda uygulamayı açarken kullanılan yerel bir kilittir;
 * sunucu tarafı doğrulaması yoktur.
 */
import { isNativeApp, nativeCall } from "./native";

const CRED_KEY = "ibanova:cred";
/** Uygulamada kilit, telefonun kendi Face ID / parmak izi sistemiyle yapılır (WebView'da WebAuthn yok). */
const NATIVE_MARK = "native";

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function isBiometricAvailable(): Promise<boolean> {
  if (isNativeApp()) return nativeCall<boolean>("biometricAvailable").catch(() => false);
  try {
    return (
      typeof window.PublicKeyCredential !== "undefined" &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

export function hasCredential(): boolean {
  try {
    return !!localStorage.getItem(CRED_KEY);
  } catch {
    return false;
  }
}

export function clearCredential() {
  try {
    localStorage.removeItem(CRED_KEY);
  } catch {
    /* yoksay */
  }
}

export async function enrollBiometric(): Promise<boolean> {
  if (isNativeApp()) {
    const ok = await nativeCall<boolean>("biometricAuth", { reason: "Ibanova kilidini açmak için doğrulayın" }).catch(() => false);
    if (ok) {
      try {
        localStorage.setItem(CRED_KEY, NATIVE_MARK);
      } catch {
        return false;
      }
    }
    return ok;
  }
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: random(32),
        rp: { name: "Ibanova" },
        user: { id: random(16), name: "ibanova", displayName: "Ibanova" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem(CRED_KEY, toB64(cred.rawId));
    return true;
  } catch {
    return false;
  }
}

export async function verifyBiometric(): Promise<boolean> {
  try {
    const stored = localStorage.getItem(CRED_KEY);
    if (!stored) return false;
    if (isNativeApp() || stored === NATIVE_MARK) {
      if (!isNativeApp()) return false; // uygulamada kurulan kilit tarayıcıda doğrulanamaz
      return await nativeCall<boolean>("biometricAuth", { reason: "Ibanova'yı açmak için doğrulayın" });
    }
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        allowCredentials: [{ type: "public-key", id: fromB64(stored) }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}
