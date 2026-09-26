/**
 * Abonelik: satın alma yalnızca mobil uygulamada, App Store / Google Play üzerinden yapılır
 * (mobile/subscription.ts, RevenueCat). Bu dosya köprüyü sarar ve son bilinen durumu cihazda saklar;
 * böylece internet yokken açılan uygulamada abone kullanıcı kilitlenmez.
 */
import { isNativeApp, nativeCall } from "./native";

export interface SubStatus {
  available: boolean;
  active: boolean;
  productId: string | null;
  expires: string | null;
  willRenew: boolean;
  managementURL: string | null;
}

export interface Plan {
  id: string;
  period: "monthly" | "annual" | "other";
  price: string;
  pricePerMonth: string | null;
  title: string;
  intro: string | null;
}

export const NO_SUB: SubStatus = {
  available: false,
  active: false,
  productId: null,
  expires: null,
  willRenew: false,
  managementURL: null,
};

const CACHE_KEY = "ibanova:sub";

export function sanitizeStatus(raw: unknown): SubStatus {
  if (!raw || typeof raw !== "object") return NO_SUB;
  const s = raw as Partial<SubStatus>;
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    available: s.available === true,
    active: s.active === true,
    productId: str(s.productId),
    expires: str(s.expires),
    willRenew: s.willRenew === true,
    managementURL: str(s.managementURL),
  };
}

/** Önbellekteki durum; süresi geçmiş abonelik aktif sayılmaz. */
export function loadCachedStatus(now = Date.now()): SubStatus {
  try {
    const s = sanitizeStatus(JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null"));
    if (s.active && s.expires && new Date(s.expires).getTime() < now) return { ...s, active: false };
    return s;
  } catch {
    return NO_SUB;
  }
}

export function cacheStatus(s: SubStatus) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* depolama kapalı */
  }
}

export async function fetchStatus(): Promise<SubStatus> {
  if (!isNativeApp()) return NO_SUB;
  return sanitizeStatus(await nativeCall("subStatus"));
}

export async function fetchPlans(): Promise<Plan[]> {
  if (!isNativeApp()) return [];
  const plans = await nativeCall<Plan[]>("subPlans");
  return Array.isArray(plans) ? plans : [];
}

export async function purchasePlan(planId: string): Promise<{ result: "purchased" | "cancelled"; status: SubStatus }> {
  const r = await nativeCall<{ result: "purchased" | "cancelled"; status: unknown }>("subPurchase", { planId });
  return { result: r?.result === "purchased" ? "purchased" : "cancelled", status: sanitizeStatus(r?.status) };
}

export async function restorePurchases(): Promise<SubStatus> {
  return sanitizeStatus(await nativeCall("subRestore"));
}

export async function openManagement(): Promise<void> {
  await nativeCall("subManage");
}

/** Hesaba giriş yapılınca abonelik hesaba bağlanır (diğer cihazlarda da geçerli olur). */
export async function linkUser(userId: string): Promise<SubStatus | null> {
  if (!isNativeApp() || !userId) return null;
  return sanitizeStatus(await nativeCall("subLogin", { userId }));
}

export async function unlinkUser(): Promise<SubStatus | null> {
  if (!isNativeApp()) return null;
  return sanitizeStatus(await nativeCall("subLogout"));
}

/** JWT'nin içindeki kullanıcı kimliği (imza doğrulanmaz; yalnızca abonelik eşlemesi için). */
export function userIdFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === "string" && sub ? sub : null;
  } catch {
    return null;
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}
