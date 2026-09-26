import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { analyzeIban, formatIban } from "./lib/iban";
import { vibrate } from "./lib/device";
import { clearCredential } from "./lib/biometric";
import {
  ApiError,
  changePassword as apiChangePassword,
  deleteAccount as apiDeleteAccount,
  resetPassword as apiResetPassword,
  login as apiLogin,
  pushMe,
  signup as apiSignup,
} from "./lib/api";
import { isNativeApp, nativeCall } from "./lib/native";
import { EMPTY_QUOTA, canCheckFree, consume, freeLeft as quotaFreeLeft, localDay, mergeQuota, parseQuota, type QuotaState } from "./lib/quota";
import {
  cacheStatus,
  fetchStatus,
  linkUser,
  loadCachedStatus,
  sanitizeStatus,
  unlinkUser,
  userIdFromToken,
  type SubStatus,
} from "./lib/subscription";

export interface CheckRecord {
  id: string;
  iban: string; // boşluksuz
  at: string; // ISO
}

export interface SavedIban {
  id: string;
  name: string;
  iban: string; // boşluksuz
  at: string; // son kontrol, ISO
}

export interface Settings {
  clipboard: boolean;
  haptics: boolean;
  notifications: boolean;
  biometric: boolean;
}

interface Data {
  history: CheckRecord[];
  saved: SavedIban[];
  settings: Settings;
  profileName: string;
}

export const SAMPLE_IBAN = "TR760001000519786457841326";

export interface Account {
  email: string;
  name: string;
}

const STORAGE_KEY = "ibanova:v1";
const TOKEN_KEY = "ibanova:token";
const ACCOUNT_KEY = "ibanova:account";
const QUOTA_KEY = "ibanova:quota";
/**
 * Geliştirme/test için örnek veri modu: localStorage'da `ibanova:demo = "1"` varsa ilk açılışta ve
 * sıfırlamada örnek veriler yüklenir. Gerçek kullanıcılar her zaman boş bir uygulamayla başlar.
 */
const DEMO_KEY = "ibanova:demo";
export function isDemo(): boolean {
  try {
    return localStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Uçtan uca testler için: tarayıcıda (uygulama dışında) web sürümünü açık tutar. Gerçek kullanıcıya
 * bir şey kazandırmaz; web'de satın alma olmadığı için yalnızca örnek/test kullanımı içindir.
 */
export function isWebTest(): boolean {
  try {
    return localStorage.getItem("ibanova:web") === "1";
  } catch {
    return false;
  }
}

const DEFAULT_SETTINGS: Settings = { clipboard: true, haptics: true, notifications: true, biometric: false };

function emptyData(): Data {
  return { history: [], saved: [], settings: { ...DEFAULT_SETTINGS }, profileName: "" };
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function demoData(): Data {
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const H = 3_600_000;
  const D = 86_400_000;
  return {
    history: [
      { id: uid(), iban: SAMPLE_IBAN, at: iso(20 * 60_000) },
      { id: uid(), iban: "TR410006200784100000009084", at: iso(D + 2 * H) },
      { id: uid(), iban: "TR150009900123456789004412", at: iso(D + 8 * H) },
    ],
    saved: [
      { id: uid(), name: "Kira Ödemesi", iban: SAMPLE_IBAN, at: iso(98 * D) },
      { id: uid(), name: "Ortak Hesap", iban: "TR410006200784100000009084", at: iso(102 * D) },
    ],
    settings: { ...DEFAULT_SETTINGS },
    profileName: "Ayşe Demir",
  };
}

const isValidDate = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(new Date(v).getTime());

/** Depodan gelen geçmiş kayıtlarını doğrular; eksik/bozuk alanlı kayıtlar sessizce kaybolmak yerine ayıklanır. */
export function sanitizeHistory(raw: unknown): CheckRecord[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CheckRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Partial<CheckRecord>;
    if (typeof r.iban !== "string" || !r.iban || !isValidDate(r.at)) continue;
    const id = typeof r.id === "string" && r.id && !seen.has(r.id) ? r.id : uid();
    seen.add(id);
    out.push({ id, iban: r.iban, at: r.at });
  }
  return out.slice(0, 200);
}

export function sanitizeSaved(raw: unknown): SavedIban[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const ibans = new Set<string>();
  const out: SavedIban[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Partial<SavedIban>;
    if (typeof s.iban !== "string" || !s.iban || ibans.has(s.iban) || !isValidDate(s.at)) continue;
    const id = typeof s.id === "string" && s.id && !seen.has(s.id) ? s.id : uid();
    const name = typeof s.name === "string" && s.name.trim() ? s.name : analyzeIban(s.iban).bankName;
    seen.add(id);
    ibans.add(s.iban);
    out.push({ id, name, iban: s.iban, at: s.at });
  }
  return out;
}

/** Depodan veya hesap sunucusundan gelen ham veriyi güvenli bir Data nesnesine dönüştürür. */
function sanitizeData(parsed: unknown): Data | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Partial<Data>;
  if (!Array.isArray(p.history) || !Array.isArray(p.saved)) return null;
  return {
    history: sanitizeHistory(p.history),
    saved: sanitizeSaved(p.saved),
    settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
    profileName: typeof p.profileName === "string" ? p.profileName.trim().slice(0, 60) : "",
  };
}

function load(): Data {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const sanitized = sanitizeData(JSON.parse(raw));
      if (sanitized) return sanitized;
    }
  } catch {
    /* bozuk veya erişilemeyen depolama: boş başla */
  }
  return isDemo() ? demoData() : emptyData();
}

function loadAccount(): Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Account>;
    if (typeof parsed.email === "string" && typeof parsed.name === "string") return parsed as Account;
  } catch {
    /* yok say */
  }
  return null;
}

interface Ctx {
  history: CheckRecord[];
  saved: SavedIban[];
  settings: Settings;
  profileName: string;
  setProfileName: (name: string) => void;
  /** Ana Sayfa'daki alan; ekranlar arası geçişte korunur */
  input: string;
  setInput: (v: string) => void;
  recordCheck: (iban: string) => void;
  removeHistory: (id: string) => void;
  clearHistory: () => void;
  isSaved: (iban: string) => boolean;
  saveIban: (iban: string, name: string) => "saved" | "exists";
  renameSaved: (id: string, name: string) => void;
  removeSaved: (ids: string[]) => void;
  updateSetting: (key: keyof Settings, value: boolean) => void;
  resetAll: () => void;
  toast: (message: string) => void;
  toastMessage: string;
  /** Hesap/senkron: uygulama hesapsız da tam çalışır, hesap tamamen isteğe bağlıdır. */
  account: Account | null;
  authBusy: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Hesabı sunucudan siler; cihazdaki veriler yerinde kalır. */
  deleteAccount: (password: string) => Promise<void>;
  /** E-postadaki bağlantıyla yeni şifre belirler ve giriş yapar. */
  completeReset: (token: string, newPassword: string) => Promise<void>;
  /** Abonelik (yalnızca mobil uygulamada satın alınır) */
  sub: SubStatus;
  setSubStatus: (s: SubStatus) => void;
  refreshSub: () => Promise<void>;
  /** Sınırsız sorgu: aktif abonelik, örnek veri modu ya da abonelik altyapısı henüz kurulmamış */
  unlimited: boolean;
  /** Bugün kalan ücretsiz sorgu */
  freeLeft: number;
  /** Bu IBAN'ın sonucu gösterilebilir mi (abone ya da bugünkü ücretsiz hak) */
  canCheck: (iban: string) => boolean;
  /** Geçerli bir IBAN gösterildiğinde günlük hakkı harcar */
  consumeCheck: (iban: string) => void;
}

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(load);
  const [input, setInput] = useState(() => (isDemo() ? formatIban(SAMPLE_IBAN) : ""));
  const [toastMessage, setToastMessage] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);

  const [account, setAccount] = useState<Account | null>(loadAccount);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [authBusy, setAuthBusy] = useState(false);
  // Hesap girişinden hemen sonra uzaktan gelen veriyi yerelle karıştırırken,
  // o değişikliği hemen geri sunucuya "senkronlamayı" (gereksiz round-trip) atla.
  const skipNextSync = useRef(false);

  const persistAuth = (nextToken: string | null, nextAccount: Account | null) => {
    setToken(nextToken);
    setAccount(nextAccount);
    try {
      if (nextToken) localStorage.setItem(TOKEN_KEY, nextToken);
      else localStorage.removeItem(TOKEN_KEY);
      if (nextAccount) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(nextAccount));
      else localStorage.removeItem(ACCOUNT_KEY);
    } catch {
      /* depolama kapalı: oturum yalnızca bellekte sürer */
    }
  };

  // --- Abonelik ve günlük ücretsiz hak ---
  const demo = isDemo();
  const [sub, setSub] = useState<SubStatus>(loadCachedStatus);
  const [quota, setQuota] = useState<QuotaState>(() => {
    try {
      return parseQuota(localStorage.getItem(QUOTA_KEY));
    } catch {
      return EMPTY_QUOTA;
    }
  });
  const [day, setDay] = useState(localDay);
  // Telefonun anahtarlığındaki kayıt okunmadan oraya yazma (boş durumla üzerine yazmasın)
  const nativeQuotaLoaded = useRef(!isNativeApp());

  const setSubStatus = useCallback((s: SubStatus) => {
    setSub(s);
    cacheStatus(s);
  }, []);

  const refreshSub = useCallback(async () => {
    if (!isNativeApp()) return;
    try {
      setSubStatus(await fetchStatus());
    } catch {
      /* çevrimdışı: son bilinen durum geçerli */
    }
  }, [setSubStatus]);

  useEffect(() => {
    refreshSub();
    if (isNativeApp()) {
      nativeCall<string>("quotaGet")
        .then((raw) => setQuota((q) => mergeQuota(q, parseQuota(raw))))
        .catch(() => {})
        .finally(() => {
          nativeQuotaLoaded.current = true;
        });
    }
    const onSub = (e: Event) => setSubStatus(sanitizeStatus((e as CustomEvent<unknown>).detail));
    const onActive = (e?: Event) => {
      if (e && (e as CustomEvent<string>).detail !== "active") return;
      setDay(localDay());
      refreshSub();
    };
    const onFocus = () => setDay(localDay());
    window.addEventListener("ibanova:sub", onSub);
    window.addEventListener("ibanova:app-state", onActive);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("ibanova:sub", onSub);
      window.removeEventListener("ibanova:app-state", onActive);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshSub, setSubStatus]);

  useEffect(() => {
    const raw = JSON.stringify(quota);
    try {
      localStorage.setItem(QUOTA_KEY, raw);
    } catch {
      /* depolama kapalı */
    }
    if (isNativeApp() && nativeQuotaLoaded.current && quota.day) nativeCall("quotaSet", { value: raw }).catch(() => {});
  }, [quota]);

  // Hesaba giriş yapılınca abonelik hesaba bağlanır; çıkışta bağ çözülür
  const linkedUser = useRef<string | null>(null);
  useEffect(() => {
    const userId = userIdFromToken(token);
    if (userId === linkedUser.current) return;
    const prev = linkedUser.current;
    linkedUser.current = userId;
    const op = userId ? linkUser(userId) : prev ? unlinkUser() : Promise.resolve(null);
    op.then((s) => s && setSubStatus(s)).catch(() => {});
  }, [token, setSubStatus]);

  const unlimited = demo || sub.active || !sub.available;
  const canCheck = useCallback(
    (iban: string) => unlimited || canCheckFree(quota, iban, day),
    [unlimited, quota, day],
  );
  const consumeCheck = useCallback(
    (iban: string) => {
      if (unlimited) return;
      const today = localDay();
      setDay(today);
      setQuota((q) => consume(q, iban, today));
    },
    [unlimited],
  );

  const accountRef = useRef(account);
  accountRef.current = account;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* depolama dolu ya da kapalı: bellekte devam et */
    }
  }, [data]);

  const toast = useCallback((message: string) => {
    setToastMessage(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMessage(""), 2200);
  }, []);

  // Hesap girişliyken yerel değişiklikleri sunucuya gönder (debounce'lu). Ağ yoksa sessizce vazgeçer,
  // sıradaki değişiklikte tekrar dener. Oturum geçersizleşmişse (şifre başka cihazda değişti, hesap
  // silindi, süre doldu) yerel oturumu kapatır ve kullanıcıya söyler.
  useEffect(() => {
    if (!token) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      pushMe(token, { data })
        .then((r) => {
          const acc = accountRef.current;
          if (acc && r?.name && r.name !== acc.name) persistAuth(token, { ...acc, name: r.name });
        })
        .catch((e: unknown) => {
          if (e instanceof ApiError && e.status === 401) {
            persistAuth(null, null);
            toast("Oturumunuzun süresi doldu, tekrar giriş yapın");
          }
        });
    }, 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, token]);

  const recordCheck = useCallback((iban: string) => {
    setData((d) => {
      const rest = d.history.filter((r) => r.iban !== iban);
      const next: CheckRecord = { id: uid(), iban, at: new Date().toISOString() };
      // Kayıtlı IBAN'ın "son kontrol" tarihini güncelle
      const saved = d.saved.map((s) => (s.iban === iban ? { ...s, at: next.at } : s));
      return { ...d, history: [next, ...rest].slice(0, 200), saved };
    });
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setAuthBusy(true);
      try {
        const res = await apiLogin(email, password);
        persistAuth(res.token, { email: res.email, name: res.name });
        const remote = sanitizeData(res.data);
        if (remote) {
          skipNextSync.current = true;
          setData(remote);
        } else {
          // Hesapta henüz veri yok: cihazdaki mevcut veriyi ilk senkron olarak gönder
          await pushMe(res.token, { data });
        }
        toast("Giriş yapıldı");
      } catch (e) {
        throw e instanceof ApiError ? e : new ApiError("Giriş yapılamadı");
      } finally {
        setAuthBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, toast],
  );

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      setAuthBusy(true);
      try {
        const res = await apiSignup(email, password, name);
        persistAuth(res.token, { email: res.email, name: res.name });
        const trimmed = name.trim();
        const nextData = trimmed ? { ...data, profileName: trimmed } : data;
        if (trimmed) {
          skipNextSync.current = true;
          setData(nextData);
        }
        await pushMe(res.token, { data: nextData });
        toast("Hesap oluşturuldu");
      } catch (e) {
        throw e instanceof ApiError ? e : new ApiError("Hesap oluşturulamadı");
      } finally {
        setAuthBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, toast],
  );

  const signOut = useCallback(() => {
    persistAuth(null, null);
    toast("Çıkış yapıldı");
    // Not: cihazdaki veriler silinmez, uygulama hesapsız da tam işlevseldir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const completeReset = useCallback(
    async (resetToken: string, newPassword: string) => {
      setAuthBusy(true);
      try {
        const res = await apiResetPassword(resetToken, newPassword);
        const remote = sanitizeData(res.data);
        if (remote) {
          skipNextSync.current = true;
          setData(remote);
        }
        persistAuth(res.token, { email: res.email, name: res.name });
        toast("Şifreniz yenilendi, giriş yapıldı");
      } finally {
        setAuthBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!token) throw new ApiError("Önce giriş yapın", 401);
      setAuthBusy(true);
      try {
        const res = await apiChangePassword(token, currentPassword, newPassword);
        // Sunucu eski oturumları geçersiz kıldı; bu cihaz yeni oturumla devam eder
        skipNextSync.current = true;
        persistAuth(res.token, accountRef.current);
        toast("Şifre değiştirildi");
      } finally {
        setAuthBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, toast],
  );

  const deleteAccount = useCallback(
    async (password: string) => {
      if (!token) throw new ApiError("Önce giriş yapın", 401);
      setAuthBusy(true);
      try {
        await apiDeleteAccount(token, password);
        persistAuth(null, null);
        toast("Hesap silindi");
      } finally {
        setAuthBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, toast],
  );

  const value = useMemo<Ctx>(
    () => ({
      history: data.history,
      saved: data.saved,
      settings: data.settings,
      profileName: data.profileName,
      setProfileName: (name) => setData((d) => ({ ...d, profileName: name.trim() || d.profileName })),
      input,
      setInput,
      recordCheck,
      removeHistory: (id) => setData((d) => ({ ...d, history: d.history.filter((r) => r.id !== id) })),
      clearHistory: () => setData((d) => ({ ...d, history: [] })),
      isSaved: (iban) => data.saved.some((s) => s.iban === iban),
      saveIban: (iban, name) => {
        if (data.saved.some((s) => s.iban === iban)) return "exists";
        const label = name.trim() || analyzeIban(iban).bankName;
        setData((d) => ({
          ...d,
          saved: [{ id: uid(), name: label, iban, at: new Date().toISOString() }, ...d.saved],
        }));
        return "saved";
      },
      renameSaved: (id, name) =>
        setData((d) => ({
          ...d,
          saved: d.saved.map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s)),
        })),
      removeSaved: (ids) => setData((d) => ({ ...d, saved: d.saved.filter((s) => !ids.includes(s.id)) })),
      updateSetting: (key, v) => {
        setData((d) => ({ ...d, settings: { ...d.settings, [key]: v } }));
        vibrate(data.settings.haptics);
      },
      resetAll: () => {
        clearCredential();
        const demo = isDemo();
        setData(demo ? demoData() : emptyData());
        setInput(demo ? formatIban(SAMPLE_IBAN) : "");
      },
      toast,
      toastMessage,
      account,
      authBusy,
      signIn,
      signUp,
      signOut,
      changePassword,
      deleteAccount,
      completeReset,
      sub,
      setSubStatus,
      refreshSub,
      unlimited,
      freeLeft: unlimited ? Infinity : quotaFreeLeft(quota, day),
      canCheck,
      consumeCheck,
    }),
    [
      data,
      input,
      recordCheck,
      toast,
      toastMessage,
      account,
      authBusy,
      signIn,
      signUp,
      signOut,
      changePassword,
      deleteAccount,
      completeReset,
      sub,
      setSubStatus,
      refreshSub,
      unlimited,
      quota,
      day,
      canCheck,
      consumeCheck,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp yalnızca AppProvider içinde kullanılabilir");
  return ctx;
}
