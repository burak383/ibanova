import { describe, expect, it } from "vitest";
import { sanitizeHistory, sanitizeSaved } from "./store";

describe("sanitizeHistory", () => {
  it("geçerli kayıtları korur", () => {
    const out = sanitizeHistory([{ id: "1", iban: "TR76", at: "2026-01-01T00:00:00.000Z" }]);
    expect(out).toEqual([{ id: "1", iban: "TR76", at: "2026-01-01T00:00:00.000Z" }]);
  });
  it("geçersiz tarihli kaydı sessizce düşürmez, tarihi olmayanı ayıklar", () => {
    const out = sanitizeHistory([
      { id: "1", iban: "TR76", at: "bozuk-tarih" },
      { id: "2", iban: "TR41", at: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("2");
  });
  it("iban alanı olmayanı ayıklar", () => {
    expect(sanitizeHistory([{ id: "1", at: "2026-01-01T00:00:00.000Z" }])).toHaveLength(0);
  });
  it("dizi olmayan girdide boş dizi döner", () => {
    expect(sanitizeHistory(null)).toEqual([]);
    expect(sanitizeHistory("bozuk")).toEqual([]);
    expect(sanitizeHistory(undefined)).toEqual([]);
  });
  it("eksik veya tekrar eden id'lere yeni id üretir", () => {
    const out = sanitizeHistory([
      { iban: "TR76", at: "2026-01-01T00:00:00.000Z" },
      { id: "x", iban: "TR41", at: "2026-01-01T00:00:00.000Z" },
      { id: "x", iban: "TR15", at: "2026-01-01T00:00:00.000Z" },
    ]);
    const ids = out.map((r) => r.id);
    expect(new Set(ids).size).toBe(3);
  });
  it("200 kayıtla sınırlar", () => {
    const many = Array.from({ length: 250 }, (_, i) => ({
      id: String(i),
      iban: "TR76",
      at: "2026-01-01T00:00:00.000Z",
    }));
    expect(sanitizeHistory(many)).toHaveLength(200);
  });
});

describe("sanitizeSaved", () => {
  it("geçerli kayıtları korur", () => {
    const out = sanitizeSaved([{ id: "1", name: "Kira", iban: "TR760001000519786457841326", at: "2026-01-01T00:00:00.000Z" }]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Kira");
  });
  it("boş ada banka adını yedek olarak kullanır", () => {
    const out = sanitizeSaved([{ id: "1", name: "  ", iban: "TR760001000519786457841326", at: "2026-01-01T00:00:00.000Z" }]);
    expect(out[0].name).toBe("Ziraat Bankası");
  });
  it("aynı IBAN'ı tekrar eklemez", () => {
    const out = sanitizeSaved([
      { id: "1", name: "A", iban: "TR76", at: "2026-01-01T00:00:00.000Z" },
      { id: "2", name: "B", iban: "TR76", at: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("A");
  });
  it("geçersiz tarihli kaydı ayıklar", () => {
    expect(sanitizeSaved([{ id: "1", name: "A", iban: "TR76", at: "yok" }])).toHaveLength(0);
  });
});
