import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { branchKey } from "./subeler.js";
import { EmailTakenError } from "./store.js";
import { deletionHtml, privacyHtml, supportHtml, termsHtml } from "./pages.js";

export const MIN_PASSWORD = 8;
const RESET_TTL_MS = 60 * 60_000; // şifre sıfırlama bağlantısı 1 saat geçerli

function emailValid(email) {
  return typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function cleanName(name) {
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 60) : null;
}

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Express uygulamasını kurar (dinlemeye başlatmaz; testler için ayrı tutulur).
 * @param {object} opts
 * @param {import("./store.js").FileStore | import("./store.js").PgStore} opts.store  Kullanıcı deposu (init edilmiş)
 * @param {string} opts.secret                 JWT imzalama anahtarı
 * @param {() => Record<string, {ad: string, il: string, ilce: string}> | null} [opts.getSubeler]
 * @param {{ maxAttempts?: number, windowMs?: number, lockMs?: number }} [opts.rateLimit]
 * @param {{ available: boolean, send: (m: {to: string, subject: string, text: string}) => Promise<unknown> }} [opts.mailer]
 * @param {string} [opts.appUrl]              E-postadaki bağlantılar için uygulamanın genel adresi
 * @param {string} [opts.staticDir]           Derlenmiş ön yüz (dist); verilirse aynı adresten sunulur
 * @param {string[]} [opts.corsOrigins]       Başka kökenden erişime izin verilecek adresler (boşsa CORS kapalı)
 * @param {number | boolean | string} [opts.trustProxy]  Render gibi proxy arkasında gerçek istemci IP'si için
 * @param {{ sorumlu?: string, eposta?: string }} [opts.policyInfo]  Gizlilik/hesap silme sayfalarındaki geliştirici bilgisi
 */
export function createApp({
  store,
  secret,
  getSubeler = () => null,
  rateLimit = {},
  mailer = { available: false, send: async () => {} },
  appUrl = "",
  staticDir,
  corsOrigins = [],
  trustProxy = false,
  policyInfo = {},
  /** Hesap silindikten sonra çağrılır (ör. RevenueCat abone kaydını silmek için); hatası yanıtı bozmaz */
  onAccountDeleted = null,
}) {
  const maxAttempts = rateLimit.maxAttempts ?? 5;
  const windowMs = rateLimit.windowMs ?? 15 * 60_000;
  const lockMs = rateLimit.lockMs ?? 15 * 60_000;
  /** @type {Map<string, { count: number, first: number, lockedUntil: number }>} */
  const failures = new Map();
  /** Şifre sıfırlama e-postası sıklığı: e-posta başına saatte en çok 3 */
  const resetRequests = new Map();

  // Bellek şişmesin: süresi geçmiş kayıtları düzenli temizle
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, f] of failures) if (f.lockedUntil < now && now - f.first > windowMs) failures.delete(k);
    for (const [k, list] of resetRequests) {
      const fresh = list.filter((t) => now - t < 60 * 60_000);
      if (fresh.length) resetRequests.set(k, fresh);
      else resetRequests.delete(k);
    }
  }, 5 * 60_000);
  sweep.unref?.();

  // tv (token sürümü): şifre değişince/sıfırlanınca eski oturumların hepsi geçersiz olur
  const sign = (user) => jwt.sign({ sub: user.id, tv: user.tokenVersion ?? 0 }, secret, { expiresIn: "30d" });

  const publicUser = (user, extra = {}) => ({ email: user.email, name: user.name, data: user.data, ...extra });

  async function auth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Yetkilendirme gerekli" });
    let payload;
    try {
      payload = jwt.verify(token, secret);
    } catch {
      return res.status(401).json({ error: "Oturumunuzun süresi doldu, tekrar giriş yapın" });
    }
    const user = await store.findById(payload.sub);
    if (!user || (payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ error: "Oturumunuzun süresi doldu, tekrar giriş yapın" });
    }
    req.user = user;
    next();
  }

  // ---- hatalı giriş sınırı (e-posta + IP başına) ----
  const limitKey = (req, email) => `${email}|${req.ip}`;
  function lockedFor(key) {
    const f = failures.get(key);
    if (!f) return 0;
    const now = Date.now();
    if (f.lockedUntil > now) return f.lockedUntil - now;
    if (now - f.first > windowMs) failures.delete(key);
    return 0;
  }
  function recordFailure(key) {
    const now = Date.now();
    const f = failures.get(key);
    if (!f || now - f.first > windowMs) {
      failures.set(key, { count: 1, first: now, lockedUntil: 0 });
      return;
    }
    f.count += 1;
    if (f.count >= maxAttempts) f.lockedUntil = now + lockMs;
  }
  function clearFailures(email) {
    for (const k of failures.keys()) if (k.startsWith(`${email}|`)) failures.delete(k);
  }
  const tooMany = (res, ms) =>
    res
      .status(429)
      .json({ error: `Çok fazla hatalı deneme. ${Math.max(1, Math.ceil(ms / 60_000))} dakika sonra tekrar deneyin.` });

  const badPassword = (p) => typeof p !== "string" || p.length < MIN_PASSWORD || p.length > 200;

  const app = express();
  app.disable("x-powered-by");
  if (trustProxy !== false) app.set("trust proxy", trustProxy);

  // Temel güvenlik başlıkları
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    });
    if (req.secure) res.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    next();
  });

  if (corsOrigins.length) app.use("/api", cors({ origin: corsOrigins }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/config", (_req, res) => {
    const s = getSubeler();
    res.json({
      passwordReset: Boolean(mailer.available),
      minPassword: MIN_PASSWORD,
      branches: Boolean(s && Object.keys(s).length),
    });
  });

  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, name } = req.body ?? {};
    if (!emailValid(email)) return res.status(400).json({ error: "Geçerli bir e-posta girin" });
    if (badPassword(password)) return res.status(400).json({ error: `Şifre en az ${MIN_PASSWORD} karakter olmalı` });
    const normalized = email.trim().toLowerCase();
    const user = {
      id: crypto.randomUUID(),
      email: normalized,
      name: cleanName(name) ?? "Kullanıcı",
      passwordHash: bcrypt.hashSync(password, 10),
      tokenVersion: 0,
      data: null,
      createdAt: new Date().toISOString(),
    };
    try {
      await store.insert(user);
    } catch (e) {
      if (e instanceof EmailTakenError) return res.status(409).json({ error: "Bu e-posta ile zaten bir hesap var" });
      throw e;
    }
    res.status(201).json(publicUser(user, { token: sign(user) }));
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body ?? {};
    const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
    const key = limitKey(req, normalized);
    const wait = lockedFor(key);
    if (wait) return tooMany(res, wait);
    const user = normalized ? await store.findByEmail(normalized) : null;
    if (!user || !bcrypt.compareSync(String(password ?? ""), user.passwordHash)) {
      recordFailure(key);
      const nowWait = lockedFor(key);
      if (nowWait) return tooMany(res, nowWait);
      return res.status(401).json({ error: "E-posta veya şifre hatalı" });
    }
    failures.delete(key);
    res.json(publicUser(user, { token: sign(user) }));
  });

  // ---- şifremi unuttum ----
  const GENERIC_FORGOT = {
    ok: true,
    message: "Bu e-postaya kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi.",
  };

  app.post("/api/auth/forgot", async (req, res) => {
    if (!mailer.available) return res.status(503).json({ error: "Şifre sıfırlama şu an kullanılamıyor" });
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!emailValid(email)) return res.status(400).json({ error: "Geçerli bir e-posta girin" });

    // Hesabın var olup olmadığını belli etmemek için her durumda aynı yanıt
    const now = Date.now();
    const recent = (resetRequests.get(email) ?? []).filter((t) => now - t < 60 * 60_000);
    if (recent.length >= 3) return res.json(GENERIC_FORGOT);
    resetRequests.set(email, [...recent, now]);

    const user = await store.findByEmail(email);
    if (user) {
      const secretPart = crypto.randomBytes(32).toString("base64url");
      user.reset = { hash: sha256(secretPart), exp: now + RESET_TTL_MS };
      await store.update(user);
      const base = (appUrl || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
      const link = `${base}/#/sifre-sifirla/${user.id}.${secretPart}`;
      try {
        await mailer.send({
          to: user.email,
          subject: "Ibanova şifre sıfırlama",
          text:
            `Merhaba,\n\nIbanova hesabınız için şifre sıfırlama isteği aldık. Yeni şifre belirlemek için ` +
            `aşağıdaki bağlantıyı 1 saat içinde açın:\n\n${link}\n\n` +
            `Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmez.`,
        });
      } catch (e) {
        console.error("Şifre sıfırlama e-postası gönderilemedi:", e?.message ?? e);
        return res.status(502).json({ error: "E-posta gönderilemedi, biraz sonra tekrar deneyin" });
      }
    }
    res.json(GENERIC_FORGOT);
  });

  app.post("/api/auth/reset", async (req, res) => {
    const { token, newPassword } = req.body ?? {};
    const invalid = () => res.status(400).json({ error: "Bağlantı geçersiz ya da süresi dolmuş. Yeni bir bağlantı isteyin." });
    if (typeof token !== "string" || !token.includes(".")) return invalid();
    const [id, secretPart] = token.split(".", 2);
    const user = await store.findById(id);
    if (!user?.reset || user.reset.exp < Date.now() || !safeEqual(sha256(secretPart), user.reset.hash)) return invalid();
    if (badPassword(newPassword)) return res.status(400).json({ error: `Şifre en az ${MIN_PASSWORD} karakter olmalı` });
    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1; // açık oturumları kapat
    delete user.reset; // bağlantı tek kullanımlık
    await store.update(user);
    clearFailures(user.email);
    res.json(publicUser(user, { token: sign(user) }));
  });

  // ---- hesap ----
  app.get("/api/me", auth, (req, res) => res.json(publicUser(req.user)));

  app.put("/api/me", auth, async (req, res) => {
    const { name, data } = req.body ?? {};
    const user = req.user;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      user.data = data;
      // Profildeki ad hesap adıyla aynı kalsın
      const fromData = cleanName(data.profileName);
      if (fromData) user.name = fromData;
    }
    const direct = cleanName(name);
    if (direct) user.name = direct;
    await store.update(user);
    res.json({ ok: true, name: user.name });
  });

  app.put("/api/me/password", auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    const user = req.user;
    const key = limitKey(req, user.email);
    const wait = lockedFor(key);
    if (wait) return tooMany(res, wait);
    if (!bcrypt.compareSync(String(currentPassword ?? ""), user.passwordHash)) {
      recordFailure(key);
      return res.status(403).json({ error: "Mevcut şifre hatalı" });
    }
    if (badPassword(newPassword)) return res.status(400).json({ error: `Yeni şifre en az ${MIN_PASSWORD} karakter olmalı` });
    if (newPassword === currentPassword) return res.status(400).json({ error: "Yeni şifre eskisiyle aynı olamaz" });
    failures.delete(key);
    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    delete user.reset;
    await store.update(user);
    // Bu cihaz yeni oturumla devam eder; diğer cihazlardaki eski oturumlar kapanır
    res.json({ ok: true, token: sign(user) });
  });

  app.delete("/api/me", auth, async (req, res) => {
    const { password } = req.body ?? {};
    const user = req.user;
    const key = limitKey(req, user.email);
    const wait = lockedFor(key);
    if (wait) return tooMany(res, wait);
    if (!bcrypt.compareSync(String(password ?? ""), user.passwordHash)) {
      recordFailure(key);
      return res.status(403).json({ error: "Şifre hatalı" });
    }
    await store.remove(user.id);
    failures.delete(key);
    if (onAccountDeleted) {
      try {
        await onAccountDeleted(user.id);
      } catch (e) {
        console.error("Hesap silme sonrası temizlik başarısız:", e instanceof Error ? e.message : e);
      }
    }
    res.json({ ok: true });
  });

  // ---- şube adı (TCMB listesinden, varsa) ----
  app.get("/api/sube", (req, res) => {
    const subeler = getSubeler();
    if (!subeler || Object.keys(subeler).length === 0) {
      return res.status(503).json({ error: "Şube listesi şu an kullanılamıyor" });
    }
    const key = branchKey(req.query.banka, req.query.sube);
    const found = key ? subeler[key] : undefined;
    if (!found) return res.status(404).json({ error: "Şube bulunamadı" });
    res.json(found);
  });

  app.use("/api", (_req, res) => res.status(404).json({ error: "Bulunamadı" }));

  // ---- Google Play'in istediği, JavaScript'siz okunabilen sayfalar ----
  const pageInfo = () => ({ ...policyInfo, appUrl: appUrl || "" });
  const sendPage = (res, html) => res.set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }).send(html);
  app.get(["/gizlilik", "/privacy"], (_req, res) => sendPage(res, privacyHtml(pageInfo())));
  app.get(["/hesap-silme", "/delete-account"], (_req, res) => sendPage(res, deletionHtml(pageInfo())));
  app.get(["/destek", "/support"], (_req, res) => sendPage(res, supportHtml(pageInfo())));
  app.get(["/kosullar", "/terms"], (_req, res) => sendPage(res, termsHtml(pageInfo())));

  // ---- derlenmiş ön yüz (tek serviste yayın) ----
  const indexFile = staticDir ? path.join(staticDir, "index.html") : null;
  if (indexFile && fs.existsSync(indexFile)) {
    app.use(
      express.static(staticDir, {
        index: false,
        setHeaders(res, filePath) {
          // Vite dosya adlarına içerik özeti ekler; bunlar sonsuza dek önbelleğe alınabilir
          res.set(
            "Cache-Control",
            filePath.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
          );
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      res.set("Cache-Control", "no-cache");
      res.sendFile(indexFile);
    });
  }

  // Beklenmeyen hatalar: ayrıntıyı sızdırmadan JSON yanıt
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Geçersiz istek" });
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "İstek çok büyük" });
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası, biraz sonra tekrar deneyin" });
  });

  return app;
}
