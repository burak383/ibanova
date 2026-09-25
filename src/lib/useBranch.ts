import { useEffect, useState } from "react";
import { fetchBranch, type BranchInfo } from "./api";

/** "KADIKÖY/İSTANBUL ŞUBESİ" → "Kadıköy/İstanbul Şubesi" (Türkçe büyük/küçük harf kurallarıyla) */
export function titleCaseTr(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/(^|[\s/(\-.])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("tr-TR"))
    .replace(/\s+/g, " ")
    .trim();
}

export interface BranchLabel {
  name: string;
  place: string;
}

export function formatBranch(b: BranchInfo): BranchLabel {
  const name = titleCaseTr(b.ad);
  const parts = [b.ilce, b.il].filter(Boolean).map(titleCaseTr);
  // İlçe ile il aynıysa (ör. "Merkez/Ankara" değil de "Ankara/Ankara") tekrar etme
  const place = parts.filter((p, i) => parts.indexOf(p) === i).join(", ");
  return { name, place };
}

/**
 * IBAN'daki banka + şube kodundan şube adını getirir (TCMB listesi, hesap sunucusu üzerinden).
 * Sunucu kapalıysa ya da şube bulunamazsa `null` döner; ekranlar bu durumda yalnızca kodu gösterir.
 */
export function useBranch(bankCode: string, branchCode: string, enabled: boolean): BranchLabel | null {
  const [label, setLabel] = useState<BranchLabel | null>(null);
  useEffect(() => {
    setLabel(null);
    if (!enabled || !bankCode || !branchCode) return;
    let alive = true;
    fetchBranch(bankCode, branchCode).then((b) => {
      if (alive && b) setLabel(formatBranch(b));
    });
    return () => {
      alive = false;
    };
  }, [bankCode, branchCode, enabled]);
  return label;
}
