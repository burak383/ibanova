import { describe, expect, it } from "vitest";
import { EMPTY_QUOTA, canCheckFree, consume, freeLeft, localDay, mergeQuota, parseQuota } from "./quota";

const A = "TR760001000519786457841326";
const B = "TR410006200784100000009084";
const D1 = "2026-09-26";
const D2 = "2026-09-27";

describe("günlük ücretsiz sorgu", () => {
  it("ilk IBAN ücretsiz, ikinci farklı IBAN kilitli", () => {
    expect(canCheckFree(EMPTY_QUOTA, A, D1)).toBe(true);
    const s = consume(EMPTY_QUOTA, A, D1);
    expect(freeLeft(s, D1)).toBe(0);
    expect(canCheckFree(s, B, D1)).toBe(false);
  });

  it("aynı gün aynı IBAN'ı yeniden açmak hak harcamaz", () => {
    const s = consume(EMPTY_QUOTA, A, D1);
    expect(canCheckFree(s, A, D1)).toBe(true);
    expect(consume(s, A, D1)).toEqual(s);
  });

  it("ertesi gün hak yenilenir", () => {
    const s = consume(EMPTY_QUOTA, A, D1);
    expect(freeLeft(s, D2)).toBe(1);
    expect(canCheckFree(s, B, D2)).toBe(true);
    expect(consume(s, B, D2)).toEqual({ day: D2, ibans: [B] });
  });

  it("birleştirme: yeni gün kazanır, aynı gün birleşir", () => {
    expect(mergeQuota({ day: D1, ibans: [A] }, { day: D2, ibans: [B] })).toEqual({ day: D2, ibans: [B] });
    expect(mergeQuota({ day: D1, ibans: [A] }, { day: D1, ibans: [B, A] }).ibans.sort()).toEqual([A, B].sort());
    expect(mergeQuota(EMPTY_QUOTA, { day: D1, ibans: [A] })).toEqual({ day: D1, ibans: [A] });
  });

  it("bozuk kayıtlar boş sayılır", () => {
    expect(parseQuota("")).toEqual(EMPTY_QUOTA);
    expect(parseQuota("{bozuk")).toEqual(EMPTY_QUOTA);
    expect(parseQuota({ day: "dün", ibans: [] })).toEqual(EMPTY_QUOTA);
    expect(parseQuota(JSON.stringify({ day: D1, ibans: [A, 5] }))).toEqual({ day: D1, ibans: [A] });
  });

  it("yerel gün biçimi", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
