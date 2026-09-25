export const IBAN_LENGTH = 26;

/** TCMB/EFT banka kodları (en yaygın bankalar). Listede olmayan kodlar "Bilinmeyen banka" olarak gösterilir. */
const BANKS: Record<string, string> = {
  "00010": "Ziraat Bankası",
  "00012": "Halkbank",
  "00015": "Vakıfbank",
  "00032": "TEB",
  "00046": "Akbank",
  "00059": "Şekerbank",
  "00062": "Garanti BBVA",
  "00064": "İş Bankası",
  "00067": "Yapı Kredi",
  "00099": "ING",
  "00103": "Fibabanka",
  "00111": "QNB",
  "00123": "HSBC",
  "00134": "DenizBank",
  "00135": "Anadolubank",
  "00146": "Odeabank",
  "00203": "Albaraka Türk",
  "00205": "Kuveyt Türk",
  "00206": "Türkiye Finans",
  "00209": "Ziraat Katılım",
  "00210": "Vakıf Katılım",
  "00211": "Emlak Katılım",
};

export const UNKNOWN_BANK = "Bilinmeyen banka";

export type IbanProblem = "country" | "format" | "checksum";

export interface IbanInfo {
  compact: string;
  formatted: string;
  masked: string;
  complete: boolean;
  valid: boolean;
  problem?: IbanProblem;
  bankCode: string;
  bankName: string;
  knownBank: boolean;
  branch: string;
  account: string;
}

/** Harf/rakam dışını atar, büyük harfe çevirir, rakamla başlıyorsa TR ekler, 26 karakterle sınırlar. */
export function normalizeIban(raw: string): string {
  let s = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (/^\d/.test(s)) s = "TR" + s;
  return s.slice(0, IBAN_LENGTH);
}

export function formatIban(compact: string): string {
  return compact.replace(/(.{4})/g, "$1 ").trim();
}

function mod97(compact: string): number {
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder;
}

export function analyzeIban(raw: string): IbanInfo {
  const compact = normalizeIban(raw);
  const complete = compact.length === IBAN_LENGTH;
  let valid = false;
  let problem: IbanProblem | undefined;

  if (complete) {
    if (!compact.startsWith("TR")) problem = "country";
    else if (!/^TR\d{24}$/.test(compact)) problem = "format";
    else if (mod97(compact) !== 1) problem = "checksum";
    else valid = true;
  }

  const bankCode = compact.length >= 9 ? compact.slice(4, 9) : "";
  const bankName = BANKS[bankCode] ?? UNKNOWN_BANK;
  const rest = compact.length >= 26 ? compact.slice(10) : ""; // 16 haneli hesap alanı
  return {
    compact,
    formatted: formatIban(compact),
    masked: complete ? `${compact.slice(0, 4)} •••• •••• •••• ${compact.slice(-4)}` : formatIban(compact),
    complete,
    valid,
    problem,
    bankCode,
    bankName,
    knownBank: bankCode in BANKS,
    branch: rest.slice(0, 4),
    account: rest.slice(4),
  };
}

export const last4 = (compact: string) => compact.slice(-4);

/**
 * Biçimlendirme (boşluk ekleme) sırasında imlecin göründüğü yerde kalmasını sağlar.
 * `raw`: kullanıcının yazdığı ham metin, `caretRaw`: o metindeki imleç konumu,
 * `formatted`: normalize+formatIban sonrası yeni değer.
 */
export function caretAfterFormat(raw: string, caretRaw: number, formatted: string): number {
  const prefixShift = /^\s*\d/.test(raw) ? 2 : 0;
  const alnumBefore = raw.slice(0, caretRaw).replace(/[^a-zA-Z0-9]/g, "").length + prefixShift;
  let pos = 0;
  let seen = 0;
  while (pos < formatted.length && seen < alnumBefore) {
    if (formatted[pos] !== " ") seen++;
    pos++;
  }
  return pos;
}

export function problemMessage(problem?: IbanProblem): string {
  switch (problem) {
    case "country":
      return "Şimdilik yalnızca Türkiye (TR) IBAN'ları doğrulanır";
    case "format":
      return "TR IBAN'ı TR ve 24 rakamdan oluşmalıdır";
    case "checksum":
      return "MOD-97 doğrulaması başarısız — IBAN'ı kontrol edin";
    default:
      return "";
  }
}
