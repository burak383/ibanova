/**
 * Abonelik (RevenueCat) ve günlük ücretsiz sorgu hakkının kalıcı kaydı.
 *
 * Satın alma Apple / Google'ın kendi ödeme ekranıyla yapılır; RevenueCat makbuzu doğrular ve
 * "premium" yetkisinin (entitlement) aktif olup olmadığını söyler. Web tarafı (src/lib/subscription.ts)
 * bu fonksiyonlara köprü üzerinden ulaşır.
 */
import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import Purchases, {
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const API_KEY = String((Platform.OS === "ios" ? extra.revenuecatIosKey : extra.revenuecatAndroidKey) ?? "");
export const ENTITLEMENT = String(extra.revenuecatEntitlement ?? "premium");
const ANDROID_PACKAGE = "com.ibanova.app";

let configured = false;

/** Uygulama açılırken bir kez çağrılır. Anahtar girilmemişse abonelik kapalı kalır (satın alma sunulmaz). */
export function configureSubscriptions(): boolean {
  if (configured) return true;
  if (!API_KEY) return false;
  try {
    Purchases.configure({ apiKey: API_KEY });
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

export interface SubStatus {
  /** Abonelik altyapısı bu cihazda kullanılabilir mi (anahtar girildi ve SDK açıldı) */
  available: boolean;
  active: boolean;
  productId: string | null;
  /** ISO tarih; ömür boyu ürünlerde null */
  expires: string | null;
  willRenew: boolean;
  managementURL: string | null;
}

const NO_SUB: SubStatus = { available: false, active: false, productId: null, expires: null, willRenew: false, managementURL: null };

export function statusFrom(info: CustomerInfo): SubStatus {
  const ent = info.entitlements.active[ENTITLEMENT];
  return {
    available: true,
    active: Boolean(ent?.isActive),
    productId: ent?.productIdentifier ?? null,
    expires: ent?.expirationDate ?? null,
    willRenew: Boolean(ent?.willRenew),
    managementURL: info.managementURL ?? null,
  };
}

export async function getStatus(): Promise<SubStatus> {
  if (!configured) return NO_SUB;
  return statusFrom(await Purchases.getCustomerInfo());
}

export interface Plan {
  id: string;
  period: "monthly" | "annual" | "other";
  price: string;
  /** Aylık karşılığı (yıllık planda karşılaştırma için), ör. "₺33,33" */
  pricePerMonth: string | null;
  title: string;
  /** Ücretsiz deneme / giriş fiyatı varsa kısa açıklaması */
  intro: string | null;
}

let packages: PurchasesPackage[] = [];

function periodOf(p: PurchasesPackage): Plan["period"] {
  if (p.packageType === PACKAGE_TYPE.MONTHLY) return "monthly";
  if (p.packageType === PACKAGE_TYPE.ANNUAL) return "annual";
  return "other";
}

function introText(p: PurchasesPackage): string | null {
  const intro = p.product.introPrice;
  if (!intro) return null;
  const unit = { DAY: "gün", WEEK: "hafta", MONTH: "ay", YEAR: "yıl" }[intro.periodUnit] ?? intro.periodUnit;
  const span = `${intro.periodNumberOfUnits * (intro.cycles || 1)} ${unit}`;
  return intro.price === 0 ? `${span} ücretsiz deneme` : `İlk ${span} ${intro.priceString}`;
}

export async function getPlans(): Promise<Plan[]> {
  if (!configured) return [];
  const offerings = await Purchases.getOfferings();
  packages = offerings.current?.availablePackages ?? [];
  return packages.map((p) => ({
    id: p.identifier,
    period: periodOf(p),
    price: p.product.priceString,
    pricePerMonth: periodOf(p) === "annual" ? (p.product.pricePerMonthString ?? null) : null,
    title: p.product.title,
    intro: introText(p),
  }));
}

/** Satın alma. Kullanıcı vazgeçerse "cancelled" döner (hata sayılmaz). */
export async function purchase(planId: string): Promise<{ result: "purchased" | "cancelled"; status: SubStatus }> {
  if (!configured) throw new Error("Abonelik şu an kullanılamıyor");
  if (!packages.length) await getPlans();
  const pkg = packages.find((p) => p.identifier === planId);
  if (!pkg) throw new Error("Plan bulunamadı, tekrar deneyin");
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { result: "purchased", status: statusFrom(customerInfo) };
  } catch (e) {
    const err = e as { code?: string; userCancelled?: boolean | null; message?: string };
    if (err.userCancelled || err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { result: "cancelled", status: await getStatus() };
    }
    if (err.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
      throw new Error("Ödeme onay bekliyor. Onaylanınca aboneliğiniz otomatik açılır.");
    }
    if (err.code === PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR) {
      throw new Error("Bu cihazda satın alma izni kapalı.");
    }
    if (err.code === PURCHASES_ERROR_CODE.NETWORK_ERROR) {
      throw new Error("İnternet bağlantısı yok, tekrar deneyin.");
    }
    throw new Error("Satın alma tamamlanamadı, tekrar deneyin.");
  }
}

export async function restore(): Promise<SubStatus> {
  if (!configured) throw new Error("Abonelik şu an kullanılamıyor");
  return statusFrom(await Purchases.restorePurchases());
}

/** Ibanova hesabına giriş yapılınca abonelik o hesaba bağlanır; hesabın diğer cihazlarında da geçerli olur. */
export async function logIn(userId: string): Promise<SubStatus> {
  if (!configured || !userId) return getStatus();
  const { customerInfo } = await Purchases.logIn(userId);
  return statusFrom(customerInfo);
}

export async function logOut(): Promise<SubStatus> {
  if (!configured) return NO_SUB;
  if (await Purchases.isAnonymous()) return getStatus();
  return statusFrom(await Purchases.logOut());
}

/** Aboneliği yönet / iptal et: mağazanın kendi abonelik sayfası açılır. */
export async function openManagement(): Promise<boolean> {
  let url: string | null = null;
  try {
    url = (await getStatus()).managementURL;
  } catch {
    /* varsayılan adrese düş */
  }
  if (!url) {
    url =
      Platform.OS === "ios"
        ? "https://apps.apple.com/account/subscriptions"
        : `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE}`;
  }
  await Linking.openURL(url);
  return true;
}

export function onStatusChange(cb: (s: SubStatus) => void): () => void {
  if (!configured) return () => {};
  const listener = (info: CustomerInfo) => cb(statusFrom(info));
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

/**
 * Günlük ücretsiz sorgu kaydı. Web'in localStorage'ı uygulama silinince gider; burada anahtarlık
 * (iOS Keychain / Android Keystore) kullanılır. iOS'ta uygulama silinip yeniden kurulsa da kayıt kalır.
 */
const QUOTA_KEY = "ibanova_quota_v1";

export async function quotaGet(): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(QUOTA_KEY)) ?? "";
  } catch {
    return "";
  }
}

export async function quotaSet(value: unknown): Promise<boolean> {
  const s = String(value ?? "").slice(0, 2000);
  try {
    await SecureStore.setItemAsync(QUOTA_KEY, s);
    return true;
  } catch {
    return false;
  }
}
