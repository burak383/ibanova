/**
 * TCMB'nin yayımladığı resmi banka şube listesini (EFT katılımcıları) indirir, ayrıştırır ve
 * önbelleğe alır. Kaynak: https://eft.tcmb.gov.tr/bankasubelistesi/bankaSubeTumListe.xml
 *
 * XML yapısı: <bankaSubeTumListe><bankaSubeleri><banka>…</banka><sube><bKd/><sKd/><sAd/><sIlAd/><sIlcAd/>…</sube>…
 */
import fs from "node:fs";

export const TCMB_URL = "https://eft.tcmb.gov.tr/bankasubelistesi/bankaSubeTumListe.xml";
const DAY = 24 * 60 * 60 * 1000;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
      if (e[0] === "#") {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decodeEntities(m[1]) : "";
}

/** Banka ve şube kodlarını sayıya indirerek (baştaki sıfırlardan bağımsız) anahtar üretir. */
export function branchKey(bankCode, branchCode) {
  const b = parseInt(String(bankCode), 10);
  const s = parseInt(String(branchCode), 10);
  if (!Number.isFinite(b) || !Number.isFinite(s)) return null;
  return `${b}-${s}`;
}

/** XML metnini { "10-519": { ad, il, ilce }, … } sözlüğüne çevirir. */
export function parseSubeXml(xml) {
  const out = {};
  const re = /<sube(?:\s[^>]*)?>([\s\S]*?)<\/sube>/g;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const key = branchKey(tag(block, "bKd"), tag(block, "sKd"));
    const ad = tag(block, "sAd");
    if (!key || !ad) continue;
    out[key] = { ad, il: tag(block, "sIlAd"), ilce: tag(block, "sIlcAd") };
  }
  return out;
}

/** Ham baytları, XML bildirimindeki kodlamaya göre (örn. windows-1254) metne çevirir. */
export function decodeXmlBytes(buf) {
  const head = Buffer.from(buf.slice(0, 200)).toString("latin1");
  const enc = (head.match(/encoding=["']([^"']+)["']/i)?.[1] || "utf-8").toLowerCase();
  try {
    return new TextDecoder(enc).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

function readCache(cacheFile) {
  try {
    const parsed = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    if (parsed && typeof parsed.subeler === "object" && typeof parsed.at === "number") return parsed;
  } catch {
    /* önbellek yok */
  }
  return null;
}

/**
 * Şube listesini döndürür: taze önbellek varsa onu, yoksa TCMB'den indirir; indirme başarısız olursa
 * eski önbelleğe, o da yoksa boş listeye düşer. `localFile` verilirse (elle indirilmiş XML) onu kullanır.
 */
/**
 * Node'un fetch hatası yalnızca "fetch failed" der; asıl sebep (DNS, sertifika, zaman aşımı…) `cause` içindedir.
 * Kullanıcıya anlamlı bir açıklama üretir.
 */
export function describeFetchError(e) {
  const cause = e && typeof e === "object" ? e.cause : undefined;
  const code = cause?.code || e?.code || (e?.name === "TimeoutError" ? "TIMEOUT" : "");
  const hints = {
    ENOTFOUND: "alan adı çözülemedi (DNS / internet bağlantısı)",
    EAI_AGAIN: "alan adı çözülemedi (DNS geçici hata)",
    ECONNREFUSED: "bağlantı reddedildi",
    ECONNRESET: "bağlantı karşı taraftan kesildi (güvenlik duvarı/antivirüs olabilir)",
    ETIMEDOUT: "bağlantı zaman aşımına uğradı",
    UND_ERR_CONNECT_TIMEOUT: "bağlantı zaman aşımına uğradı",
    TIMEOUT: "yanıt 30 sn içinde gelmedi",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: "sunucu sertifikası doğrulanamadı (eksik ara sertifika)",
    UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "sertifika zinciri doğrulanamadı",
    SELF_SIGNED_CERT_IN_CHAIN: "zincirde kendinden imzalı sertifika var (kurumsal proxy/antivirüs SSL taraması olabilir)",
    CERT_HAS_EXPIRED: "sunucu sertifikasının süresi dolmuş",
  };
  const detail = cause?.message || e?.message || String(e);
  return code ? `${code}${hints[code] ? ` — ${hints[code]}` : ""} (${detail})` : detail;
}

/** Denenecek resmi TCMB adresleri (biri erişilemezse diğeri denenir). */
export const TCMB_URLS = [
  TCMB_URL,
  "https://eftemkt.tcmb.gov.tr/bankasubelistesi/bankaSubeTumListe.xml",
];

export async function loadSubeler({
  cacheFile,
  localFile,
  fallbackFile,
  urls = TCMB_URLS,
  fetchImpl = fetch,
  maxAgeMs = DAY,
} = {}) {
  const fromFile = (file, source) => {
    const subeler = parseSubeXml(decodeXmlBytes(fs.readFileSync(file)));
    return { subeler, source, count: Object.keys(subeler).length };
  };
  if (localFile) return fromFile(localFile, "dosya");

  const cache = cacheFile ? readCache(cacheFile) : null;
  if (cache && Date.now() - cache.at < maxAgeMs) {
    return { subeler: cache.subeler, source: "önbellek", count: Object.keys(cache.subeler).length };
  }

  const errors = [];
  for (const url of urls) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const subeler = parseSubeXml(decodeXmlBytes(new Uint8Array(await res.arrayBuffer())));
      const count = Object.keys(subeler).length;
      if (count === 0) throw new Error("indirilen dosyada şube bulunamadı");
      if (cacheFile) {
        try {
          fs.writeFileSync(cacheFile, JSON.stringify({ at: Date.now(), subeler }));
        } catch {
          /* önbellek yazılamadı: bellekte devam */
        }
      }
      return { subeler, source: `tcmb: ${new URL(url).host}`, count };
    } catch (e) {
      errors.push(`${new URL(url).host}: ${describeFetchError(e)}`);
    }
  }
  const error = errors.join(" | ");

  if (cache) return { subeler: cache.subeler, source: "eski önbellek", count: Object.keys(cache.subeler).length, error };
  // Elle indirilip sunucu klasörüne konmuş liste (ortam değişkeni gerekmez)
  if (fallbackFile && fs.existsSync(fallbackFile)) {
    try {
      const r = fromFile(fallbackFile, "elle indirilen dosya");
      if (r.count > 0) return { ...r, error };
    } catch {
      /* bozuk dosya: aşağıya düş */
    }
  }
  return { subeler: {}, source: "yok", count: 0, error };
}
