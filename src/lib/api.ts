/** Hesap/senkron ve şube bilgisi için hafif backend'e (server/) konuşan istemci. */

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP durum kodu; ağ hatasında 0 */
    public status = 0,
  ) {
    super(message);
  }
}

export interface AuthResponse {
  token: string;
  email: string;
  name: string;
  data: unknown;
}

export interface BranchInfo {
  ad: string;
  il: string;
  ilce: string;
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.");
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* gövde boş olabilir */
  }
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : "Bir şeyler ters gitti, tekrar deneyin.";
    throw new ApiError(message, res.status);
  }
  return body as T;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export function signup(email: string, password: string, name: string) {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export function login(email: string, password: string) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function pushMe(token: string, payload: { name?: string; data?: unknown }) {
  return request<{ ok: true; name: string }>("/me", {
    method: "PUT",
    headers: bearer(token),
    body: JSON.stringify(payload),
  });
}

export function changePassword(token: string, currentPassword: string, newPassword: string) {
  return request<{ ok: true; token: string }>("/me/password", {
    method: "PUT",
    headers: bearer(token),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function deleteAccount(token: string, password: string) {
  return request<{ ok: true }>("/me", {
    method: "DELETE",
    headers: bearer(token),
    body: JSON.stringify({ password }),
  });
}

export function forgotPassword(email: string) {
  return request<{ ok: true; message: string }>("/auth/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, newPassword: string) {
  return request<AuthResponse>("/auth/reset", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export interface ServerConfig {
  passwordReset: boolean;
  minPassword: number;
}

let configPromise: Promise<ServerConfig | null> | null = null;
/** Sunucu özellikleri (ör. e-posta ile şifre sıfırlama açık mı). Sunucu yoksa null. */
export function fetchConfig(): Promise<ServerConfig | null> {
  if (!configPromise) {
    configPromise = request<ServerConfig>("/config").catch(() => {
      configPromise = null; // sunucu sonradan açılırsa tekrar sorulsun
      return null;
    });
  }
  return configPromise;
}

export const MIN_PASSWORD = 8;

const branchCache = new Map<string, Promise<BranchInfo | null>>();

/**
 * IBAN'daki banka + şube kodundan şube adını getirir. Sunucu yoksa, liste yüklenmemişse ya da
 * şube bulunamazsa `null` döner (hata fırlatmaz). Aynı sorgu tekrar ağa gitmez.
 */
export function fetchBranch(bankCode: string, branchCode: string): Promise<BranchInfo | null> {
  const key = `${bankCode}-${branchCode}`;
  let p = branchCache.get(key);
  if (!p) {
    p = request<BranchInfo>(`/sube?banka=${encodeURIComponent(bankCode)}&sube=${encodeURIComponent(branchCode)}`)
      .then((b) => (b && typeof b.ad === "string" ? b : null))
      .catch((e: unknown) => {
        // Geçici hatalarda (sunucu kapalı, liste yükleniyor) sonraki denemede tekrar sorulsun
        if (!(e instanceof ApiError) || e.status !== 404) branchCache.delete(key);
        return null;
      });
    branchCache.set(key, p);
  }
  return p;
}
