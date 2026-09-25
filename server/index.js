import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createMailer } from "./mailer.js";
import { createStore } from "./store.js";
import { loadSubeler } from "./subeler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const PRODUCTION = env.NODE_ENV === "production";
const PORT = Number(env.PORT || 8787);

// ---- ayarlar ----
const DEV_SECRET = "ibanova-yalnizca-yerel-gelistirme-anahtari";
const JWT_SECRET = env.IBANOVA_JWT_SECRET || (PRODUCTION ? "" : DEV_SECRET);
if (JWT_SECRET.length < 32) {
  console.error(
    "HATA: IBANOVA_JWT_SECRET tanımlı değil ya da 32 karakterden kısa. Bu anahtar olmadan oturumlar güvenli değildir.\n" +
      "Render'da: Environment > IBANOVA_JWT_SECRET (render.yaml ile otomatik üretilir).",
  );
  process.exit(1);
}
if (JWT_SECRET === DEV_SECRET) {
  console.warn("UYARI: geliştirme anahtarı kullanılıyor (yalnızca yerelde). Yayında IBANOVA_JWT_SECRET tanımlanmalı.");
}

if (PRODUCTION && !env.DATABASE_URL) {
  console.error(
    "HATA: DATABASE_URL tanımlı değil. Render'ın dosya sistemi kalıcı olmadığından hesaplar kaybolur.\n" +
      "Bir PostgreSQL veritabanı bağlayın (README > Render'a yükleme).",
  );
  process.exit(1);
}

const store = createStore({
  databaseUrl: env.DATABASE_URL,
  dbFile: env.IBANOVA_DB_FILE || path.join(__dirname, "data.json"),
});

const SUBE_CACHE = env.IBANOVA_SUBE_CACHE || path.join(__dirname, "subeler-cache.json");
const SUBE_FILE = env.IBANOVA_SUBE_XML || undefined;
const SUBE_FALLBACK = path.join(__dirname, "bankaSubeTumListe.xml");

let subeler = null;
async function refreshSubeler() {
  const result = await loadSubeler({ cacheFile: SUBE_CACHE, localFile: SUBE_FILE, fallbackFile: SUBE_FALLBACK });
  if (result.count > 0) subeler = result.subeler;
  console.log(`Şube listesi: ${result.count} şube (${result.source})`);
  if (result.count === 0) {
    console.log("  Şube adları gösterilmeyecek; uygulamanın geri kalanı normal çalışır.");
    if (!PRODUCTION && result.error) console.log(`  (TCMB: ${result.error})`);
  }
}

const trustProxy = env.TRUST_PROXY !== undefined ? (Number.isNaN(Number(env.TRUST_PROXY)) ? env.TRUST_PROXY : Number(env.TRUST_PROXY)) : PRODUCTION ? 1 : false;

async function main() {
  await store.init();
  const mailer = await createMailer({ env, production: PRODUCTION });

  const app = createApp({
    store,
    secret: JWT_SECRET,
    getSubeler: () => subeler,
    mailer,
    appUrl: env.APP_URL || env.RENDER_EXTERNAL_URL || "",
    staticDir: path.join(__dirname, "..", "dist"),
    corsOrigins: (env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
    trustProxy,
  });

  const server = app.listen(PORT, () => {
    console.log(`Ibanova ${PRODUCTION ? "yayında" : "geliştirme"} — http://localhost:${PORT}`);
    console.log(`  Veritabanı: ${env.DATABASE_URL ? "PostgreSQL" : "yerel dosya (server/data.json)"}`);
    console.log(
      `  Şifre sıfırlama e-postası: ${mailer.kind === "smtp" ? "SMTP" : mailer.kind === "console" ? "konsola yazılır (geliştirme)" : "kapalı (SMTP ayarlı değil)"}`,
    );
    refreshSubeler().catch((e) => console.error("Şube listesi yüklenemedi:", e));
    setInterval(() => refreshSubeler().catch(() => {}), 24 * 60 * 60 * 1000).unref();
  });

  // Render yeniden başlatırken bağlantıları düzgün kapat
  const shutdown = () => {
    server.close(() => store.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((e) => {
  console.error("Sunucu başlatılamadı:", e);
  process.exit(1);
});
