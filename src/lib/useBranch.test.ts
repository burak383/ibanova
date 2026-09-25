import { describe, expect, it } from "vitest";
import { formatBranch, titleCaseTr } from "./useBranch";

describe("titleCaseTr", () => {
  it("Türkçe İ/ı kurallarıyla baş harfleri büyütür", () => {
    expect(titleCaseTr("KADIKÖY/İSTANBUL ŞUBESİ")).toBe("Kadıköy/İstanbul Şubesi");
    expect(titleCaseTr("IĞDIR  ŞUBESİ")).toBe("Iğdır Şubesi");
  });
});

describe("formatBranch", () => {
  it("şube adı ve ilçe, il bilgisini birleştirir", () => {
    expect(formatBranch({ ad: "KADIKÖY ŞUBESİ", il: "İSTANBUL", ilce: "KADIKÖY" })).toEqual({
      name: "Kadıköy Şubesi",
      place: "Kadıköy, İstanbul",
    });
  });
  it("ilçe ile il aynıysa tekrarlamaz, boşları atlar", () => {
    expect(formatBranch({ ad: "X", il: "ANKARA", ilce: "ANKARA" }).place).toBe("Ankara");
    expect(formatBranch({ ad: "X", il: "ANKARA", ilce: "" }).place).toBe("Ankara");
  });
});
