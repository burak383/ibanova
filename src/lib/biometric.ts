/**
 * Cihaz kilidi (Face ID / parmak izi / Windows Hello) — WebAuthn platform doğrulayıcısı.
 * Bu, verilerin bulunduğu cihazda uygulamayı açarken kullanılan yerel bir kilittir;
 * sunucu tarafı doğrulaması yoktur.
 */
const CRED_KEY = "ibanova:cred";

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function isBiometricAvailable(): Promise<boolean> {
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
