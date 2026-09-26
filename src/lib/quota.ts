/**
 * Günlük ücretsiz sorgu hakkı. Abone olmayan kullanıcı her gün FREE_PER_DAY farklı geçerli IBAN'ı
 * ücretsiz kontrol edebilir. Aynı gün aynı IBAN'ı yeniden açmak yeni hak harcamaz.
 * Gün, cihazın yerel saatine göre gece yarısı yenilenir.
 */

export const FREE_PER_DAY = 1;

export interface QuotaState {
  /** YYYY-MM-DD (yerel saat) */
  day: string;
  /** O gün kontrol edilen IBAN'lar (boşluksuz) */
  ibans: string[];
}

export const EMPTY_QUOTA: QuotaState = { day: "", ibans: [] };

export function localDay(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function parseQuota(raw: unknown): QuotaState {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return EMPTY_QUOTA;
    }
  }
  if (!v || typeof v !== "object") return EMPTY_QUOTA;
  const q = v as Partial<QuotaState>;
  if (typeof q.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(q.day) || !Array.isArray(q.ibans)) return EMPTY_QUOTA;
  return { day: q.day, ibans: q.ibans.filter((i): i is string => typeof i === "string").slice(0, 50) };
}

/** Bugüne ait kullanılmış IBAN'lar (eski günün kaydı sayılmaz). */
function usedToday(state: QuotaState, day: string): string[] {
  return state.day === day ? state.ibans : [];
}

export function freeLeft(state: QuotaState, day = localDay()): number {
  return Math.max(0, FREE_PER_DAY - usedToday(state, day).length);
}

/** Bu IBAN bugün ücretsiz gösterilebilir mi? */
export function canCheckFree(state: QuotaState, iban: string, day = localDay()): boolean {
  const used = usedToday(state, day);
  return used.includes(iban) || used.length < FREE_PER_DAY;
}

/** Hakkı harcar; IBAN bugün zaten kontrol edildiyse durum aynen döner. */
export function consume(state: QuotaState, iban: string, day = localDay()): QuotaState {
  const used = usedToday(state, day);
  if (used.includes(iban)) return state.day === day ? state : { day, ibans: used };
  return { day, ibans: [...used, iban] };
}

/**
 * İki kaynağı (web depolaması + telefonun anahtarlığı) birleştirir: daha yeni gün kazanır, aynı gündeyse
 * kullanılan IBAN'lar birleşir. Böylece birinin silinmesi hakkı sıfırlamaz.
 */
export function mergeQuota(a: QuotaState, b: QuotaState): QuotaState {
  if (a.day === b.day) return { day: a.day, ibans: Array.from(new Set([...a.ibans, ...b.ibans])) };
  return a.day > b.day ? a : b;
}
