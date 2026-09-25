import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { branchKey, decodeXmlBytes, describeFetchError, loadSubeler, parseSubeXml } from "./subeler.js";
import { SAMPLE_XML } from "./test-fixtures.js";



describe("şube listesi ayrıştırma", () => {
  it("şubeleri banka+şube koduyla (baştaki sıfırlardan bağımsız) eşler", () => {
    const s = parseSubeXml(SAMPLE_XML);
    expect(s[branchKey("00010", "0519")]).toEqual({ ad: "KADIKÖY/İSTANBUL ŞUBESİ", il: "İSTANBUL", ilce: "KADIKÖY" });
  });
  it("HTML varlıklarını çözer, adı boş şubeyi atlar", () => {
    const s = parseSubeXml(SAMPLE_XML);
    expect(s["10-1"].ad).toBe("A & B ŞUBESİ");
    expect(s["10-2"]).toBeUndefined();
  });
  it("XML bildirimindeki windows-1254 kodlamasını doğru çözer", () => {
    const xml = `<?xml version="1.0" encoding="windows-1254"?><x><sube><bKd>1</bKd><sKd>2</sKd><sAd>ŞİĞÜÖÇ</sAd></sube></x>`;
    // windows-1254: Ş=0xDE İ=0xDD Ğ=0xD0 Ü=0xDC Ö=0xD6 Ç=0xC7
    const bytes = Buffer.from(xml.replace("ŞİĞÜÖÇ", "@@"), "latin1");
    const idx = bytes.indexOf("@@");
    const buf = Buffer.concat([bytes.subarray(0, idx), Buffer.from([0xde, 0xdd, 0xd0, 0xdc, 0xd6, 0xc7]), bytes.subarray(idx + 2)]);
    expect(parseSubeXml(decodeXmlBytes(buf))["1-2"].ad).toBe("ŞİĞÜÖÇ");
  });
  it("geçersiz kodlarda anahtar üretmez", () => {
    expect(branchKey("abc", "1")).toBeNull();
  });
});

describe("şube listesi yükleme", () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ibanova-sube-"));
  });
  const okFetch = async () => new Response(SAMPLE_XML, { status: 200 });
  const failFetch = async () => {
    throw new Error("ağ yok");
  };

  it("TCMB'den indirir ve önbelleğe yazar", async () => {
    const cacheFile = path.join(dir, "c.json");
    const r = await loadSubeler({ cacheFile, fetchImpl: okFetch });
    expect(r.source).toMatch(/^tcmb/);
    expect(r.count).toBe(2);
    expect(fs.existsSync(cacheFile)).toBe(true);
  });
  it("taze önbellek varken tekrar indirmez", async () => {
    const cacheFile = path.join(dir, "c.json");
    await loadSubeler({ cacheFile, fetchImpl: okFetch });
    const r = await loadSubeler({ cacheFile, fetchImpl: failFetch });
    expect(r.source).toBe("önbellek");
  });
  it("indirme başarısızsa eski önbelleğe düşer", async () => {
    const cacheFile = path.join(dir, "c.json");
    await loadSubeler({ cacheFile, fetchImpl: okFetch });
    const r = await loadSubeler({ cacheFile, fetchImpl: failFetch, maxAgeMs: 0 });
    expect(r.source).toBe("eski önbellek");
    expect(r.count).toBe(2);
  });
  it("hiçbir kaynak yoksa boş liste döner, çökmez", async () => {
    const r = await loadSubeler({ cacheFile: path.join(dir, "yok.json"), fetchImpl: failFetch });
    expect(r.count).toBe(0);
    expect(r.error).toBeTruthy();
  });
  it("ilk adres başarısızsa ikinci TCMB adresini dener", async () => {
    const seen = [];
    const fetchImpl = async (url) => {
      seen.push(url);
      if (seen.length === 1) throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
      return new Response(SAMPLE_XML);
    };
    const r = await loadSubeler({ fetchImpl, urls: ["https://a.example/x.xml", "https://b.example/x.xml"] });
    expect(r.count).toBe(2);
    expect(r.source).toBe("tcmb: b.example");
    expect(seen).toHaveLength(2);
  });
  it("indirme olmazsa sunucu klasöründeki elle indirilmiş listeye düşer ve hatayı açıklar", async () => {
    const f = path.join(dir, "bankaSubeTumListe.xml");
    fs.writeFileSync(f, SAMPLE_XML);
    const fetchImpl = async () => {
      throw new TypeError("fetch failed", { cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE", message: "unable to verify" } });
    };
    const r = await loadSubeler({ cacheFile: path.join(dir, "c.json"), fallbackFile: f, fetchImpl });
    expect(r.count).toBe(2);
    expect(r.source).toBe("elle indirilen dosya");
    expect(r.error).toMatch(/sertifika/);
  });
  it("fetch hatasının asıl sebebini okunur hale getirir", () => {
    expect(describeFetchError(new TypeError("fetch failed", { cause: { code: "ENOTFOUND", message: "getaddrinfo" } }))).toMatch(
      /ENOTFOUND — alan adı çözülemedi/,
    );
    expect(describeFetchError(Object.assign(new Error("x"), { name: "TimeoutError" }))).toMatch(/TIMEOUT/);
  });
  it("elle indirilmiş XML dosyasını kullanabilir", async () => {
    const f = path.join(dir, "liste.xml");
    fs.writeFileSync(f, SAMPLE_XML);
    const r = await loadSubeler({ localFile: f });
    expect(r.count).toBe(2);
  });
});

