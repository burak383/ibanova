import { describe, expect, it } from "vitest";
import { analyzeIban, caretAfterFormat, formatIban, normalizeIban } from "./iban";

const VALID = "TR760001000519786457841326";

describe("normalizeIban", () => {
  it("boşluk ve işaretleri atar, büyük harfe çevirir", () => {
    expect(normalizeIban("tr76 0001-0005.1978 6457 8413 26")).toBe(VALID);
  });
  it("rakamla başlayan girdiye TR ekler", () => {
    expect(normalizeIban("760001000519786457841326")).toBe(VALID);
  });
  it("26 karakterden sonrasını keser", () => {
    expect(normalizeIban(VALID + "999")).toBe(VALID);
  });
  it("boş girdiyi kabul eder", () => {
    expect(normalizeIban("  ")).toBe("");
  });
});

describe("formatIban", () => {
  it("4'lü gruplar", () => {
    expect(formatIban(VALID)).toBe("TR76 0001 0005 1978 6457 8413 26");
    expect(formatIban("TR7")).toBe("TR7");
    expect(formatIban("")).toBe("");
  });
});

describe("analyzeIban", () => {
  it("geçerli IBAN'ı çözümler", () => {
    const i = analyzeIban(VALID);
    expect(i.valid).toBe(true);
    expect(i.complete).toBe(true);
    expect(i.bankCode).toBe("00010");
    expect(i.bankName).toBe("Ziraat Bankası");
    expect(i.branch).toBe("0519");
    expect(i.account).toBe("786457841326");
    expect(i.masked).toBe("TR76 •••• •••• •••• 1326");
  });
  it("tasarımdaki örnek IBAN'ın MOD-97'si geçerlidir", () => {
    expect(analyzeIban("TR33 0006 1005 1978 6457 8413 26").valid).toBe(true);
  });
  it("bilinen bankaları eşler", () => {
    expect(analyzeIban("TR410006200784100000009084").bankName).toBe("Garanti BBVA");
    expect(analyzeIban("TR140009900123456789004412").bankName).toBe("ING");
  });
  it("kontrol hanesi hatasını yakalar", () => {
    const i = analyzeIban("TR15 0009 9001 2345 6789 0044 12");
    expect(i.valid).toBe(false);
    expect(i.problem).toBe("checksum");
  });
  it("tek rakam değişikliğini yakalar", () => {
    expect(analyzeIban("TR760001000519786457841327").valid).toBe(false);
  });
  it("TR dışı ülkeyi reddeder", () => {
    const i = analyzeIban("DE89370400440532013000" + "0000");
    expect(i.valid).toBe(false);
    expect(i.problem).toBe("country");
  });
  it("TR içinde harf varsa biçim hatası verir", () => {
    const i = analyzeIban("TR76000100051978645784132A");
    expect(i.valid).toBe(false);
    expect(i.problem).toBe("format");
  });
  it("eksik IBAN tamamlanmamış sayılır", () => {
    const i = analyzeIban("TR76 0001");
    expect(i.complete).toBe(false);
    expect(i.valid).toBe(false);
    expect(i.problem).toBeUndefined();
  });
  it("bilinmeyen banka kodu", () => {
    const i = analyzeIban("TR33 0006 1005 1978 6457 8413 26");
    expect(i.knownBank).toBe(false);
    expect(i.bankName).toBe("Bilinmeyen banka");
  });
});

describe("caretAfterFormat", () => {
  it("imleç tamamen sondaysa yeni gruplama sonrasında da sonda kalır", () => {
    // 8 alnum karakter, henüz boşluksuz: "TR760001" -> "TR76 0001"
    expect(caretAfterFormat("TR760001", 8, "TR76 0001")).toBe(9);
  });
  it("bir grubun ortasındaki imleç, aynı sayıda karakterden sonraki konuma taşınır", () => {
    // raw="TR76000100" (henüz boşluksuz), imleç 6. konumda (2 sıfırdan sonra, "TR7600|0100")
    // formatted="TR76 0001 00": aynı 2 sıfırdan sonraki konum 7'dir ("TR76 00|01 00")
    expect(caretAfterFormat("TR76000100", 6, "TR76 0001 00")).toBe(7);
  });
  it("baştaki TR öneki otomatik eklendiğinde imleç kaymasını telafi eder", () => {
    // Kullanıcı yalnızca rakam yapıştırdı, normalizeIban baştan TR ekler
    const raw = "7600010005197864578413";
    const formatted = formatIban(normalizeIban(raw));
    // Ham metnin başında imleç (0) -> TR eklendiği için biçimlenmiş metinde 2. konum
    expect(caretAfterFormat(raw, 0, formatted)).toBe(2);
  });
  it("boş girdide 0 döner", () => {
    expect(caretAfterFormat("", 0, "")).toBe(0);
  });
});
