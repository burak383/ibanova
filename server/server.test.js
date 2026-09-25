import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import { createApp } from "./app.js";
import { FileStore, PgStore } from "./store.js";
import { parseSubeXml } from "./subeler.js";
import { SAMPLE_XML } from "./test-fixtures.js";

const PW = "sifre1234"; // en az 8 karakter

// Gerçek PostgreSQL'e karşı da çalıştırmak için: TEST_DATABASE_URL=postgres://... npm test
const REAL_PG = process.env.TEST_DATABASE_URL;
const KINDS = ["dosya", "postgres (pg-mem)", ...(REAL_PG ? ["postgres (gerçek)"] : [])];

async function makeStore(kind) {
  if (kind === "postgres (gerçek)") {
    const pg = (await import("pg")).default;
    const pool = new pg.Pool({ connectionString: REAL_PG });
    await pool.query("DROP TABLE IF EXISTS users");
    return new PgStore({ pool });
  }
  if (kind === "dosya") {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ibanova-api-"));
    return new FileStore(path.join(dir, "db.json"));
  }
  const { Pool } = newDb().adapters.createPg();
  return new PgStore({ Pool });
}

describe.each(KINDS)("hesap API'si (%s deposu)", (kind) => {
  let server;
  let base;
  let subeler = null;
  let store;
  const mails = [];

  beforeAll(async () => {
    store = await makeStore(kind);
    await store.init();
    const app = createApp({
      store,
      secret: "test-secret-test-secret-test-secret-123",
      getSubeler: () => subeler,
      rateLimit: { maxAttempts: 3, windowMs: 60_000, lockMs: 60_000 },
      mailer: { available: true, send: async (m) => mails.push(m) },
      appUrl: "https://ibanova.example",
    });
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    base = `http://127.0.0.1:${server.address().port}/api`;
  });
  afterAll(async () => {
    server?.close();
    await store?.close();
  });

  const call = async (method, p, body, token) => {
    const res = await fetch(base + p, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json(), headers: res.headers };
  };
  const signup = (email, password = PW, name = "Ada") => call("POST", "/auth/signup", { email, password, name });
  const login = (email, password = PW) => call("POST", "/auth/login", { email, password });

  it("kayıt ve giriş (e-posta büyük/küçük harf ve boşluktan bağımsız)", async () => {
    const s = await signup("a@x.com");
    expect(s.status).toBe(201);
    expect(s.body.token).toBeTruthy();
    const l = await login("A@X.com ");
    expect(l.status).toBe(200);
    expect(l.body.name).toBe("Ada");
    expect(l.body.passwordHash).toBeUndefined();
  });

  it("8 karakterden kısa şifre, geçersiz e-posta ve tekrar kayıt reddedilir", async () => {
    expect((await signup("b@x.com", "1234567")).status).toBe(400);
    expect((await signup("gecersiz")).status).toBe(400);
    expect((await signup("a@x.com")).status).toBe(409);
  });

  it("bozuk JSON gövdesi 500 değil 400 döner", async () => {
    const res = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bozuk" });
    expect(res.status).toBe(400);
  });

  it("art arda hatalı girişten sonra geçici olarak kilitler; başka hesap etkilenmez", async () => {
    await signup("kilit@x.com");
    expect((await login("kilit@x.com", "yanlis-1")).status).toBe(401);
    expect((await login("kilit@x.com", "yanlis-2")).status).toBe(401);
    const third = await login("kilit@x.com", "yanlis-3");
    expect(third.status).toBe(429);
    expect(third.body.error).toMatch(/dakika/);
    expect((await login("kilit@x.com")).status).toBe(429);
    expect((await login("a@x.com")).status).toBe(200);
  });

  it("profil adı senkronda hesap adıyla eşleşir", async () => {
    const { body } = await signup("ad@x.com");
    const put = await call("PUT", "/me", { data: { profileName: "Yeni Ad", history: [], saved: [] } }, body.token);
    expect(put.body.name).toBe("Yeni Ad");
    const me = await call("GET", "/me", null, body.token);
    expect(me.body.name).toBe("Yeni Ad");
    expect(me.body.data.profileName).toBe("Yeni Ad");
  });

  it("şifre değişince eski oturumlar kapanır, yeni şifre ve yeni oturum çalışır", async () => {
    const { body } = await signup("sifre@x.com");
    const oldToken = body.token;
    expect((await call("PUT", "/me/password", { currentPassword: "yanlis", newPassword: "yeni-sifre-1" }, oldToken)).status).toBe(403);
    expect((await call("PUT", "/me/password", { currentPassword: PW, newPassword: "kisa" }, oldToken)).status).toBe(400);
    const ok = await call("PUT", "/me/password", { currentPassword: PW, newPassword: "yeni-sifre-1" }, oldToken);
    expect(ok.status).toBe(200);
    expect((await call("GET", "/me", null, oldToken)).status).toBe(401);
    expect((await call("GET", "/me", null, ok.body.token)).status).toBe(200);
    expect((await login("sifre@x.com")).status).toBe(401);
    expect((await login("sifre@x.com", "yeni-sifre-1")).status).toBe(200);
  });

  it("hesap silme şifre ister; silinen hesabın oturumu ve girişi çalışmaz", async () => {
    const { body } = await signup("sil@x.com");
    expect((await call("DELETE", "/me", { password: "yanlis" }, body.token)).status).toBe(403);
    expect((await call("DELETE", "/me", { password: PW }, body.token)).status).toBe(200);
    expect((await call("GET", "/me", null, body.token)).status).toBe(401);
    expect((await login("sil@x.com")).status).toBe(401);
    expect((await signup("sil@x.com")).status).toBe(201);
  });

  describe("şifremi unuttum", () => {
    const tokenFrom = (mail) => mail.text.match(/#\/sifre-sifirla\/(\S+)/)[1];

    it("kayıtlı olmayan e-postada da aynı yanıtı verir ve e-posta göndermez", async () => {
      const before = mails.length;
      const r = await call("POST", "/auth/forgot", { email: "yok@x.com" });
      expect(r.status).toBe(200);
      expect(r.body.message).toMatch(/varsa/);
      expect(mails.length).toBe(before);
    });

    it("bağlantı e-postayla gelir; yeni şifre belirlenir, eski oturumlar kapanır, bağlantı tek kullanımlıktır", async () => {
      const { body } = await signup("unuttum@x.com");
      const r = await call("POST", "/auth/forgot", { email: "Unuttum@x.com" });
      expect(r.status).toBe(200);
      const mail = mails.at(-1);
      expect(mail.to).toBe("unuttum@x.com");
      expect(mail.text).toContain("https://ibanova.example/#/sifre-sifirla/");
      const token = tokenFrom(mail);

      expect((await call("POST", "/auth/reset", { token, newPassword: "kisa" })).status).toBe(400);
      const ok = await call("POST", "/auth/reset", { token, newPassword: "sifirlandi-1" });
      expect(ok.status).toBe(200);
      expect(ok.body.token).toBeTruthy();
      expect((await call("GET", "/me", null, body.token)).status).toBe(401);
      expect((await login("unuttum@x.com", "sifirlandi-1")).status).toBe(200);
      expect((await call("POST", "/auth/reset", { token, newPassword: "tekrar-dene-1" })).status).toBe(400);
    });

    it("sahte ya da değiştirilmiş bağlantı reddedilir", async () => {
      await signup("sahte@x.com");
      await call("POST", "/auth/forgot", { email: "sahte@x.com" });
      const token = tokenFrom(mails.at(-1));
      const tampered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
      expect((await call("POST", "/auth/reset", { token: tampered, newPassword: "yeni-sifre-9" })).status).toBe(400);
      expect((await call("POST", "/auth/reset", { token: "yok.yok", newPassword: "yeni-sifre-9" })).status).toBe(400);
      expect((await call("POST", "/auth/reset", { newPassword: "yeni-sifre-9" })).status).toBe(400);
    });

    it("sıfırlama başarılı olunca hatalı giriş kilidi kalkar", async () => {
      await signup("kilitsifir@x.com");
      for (let i = 0; i < 3; i++) await login("kilitsifir@x.com", `yanlis-${i}`);
      expect((await login("kilitsifir@x.com")).status).toBe(429);
      await call("POST", "/auth/forgot", { email: "kilitsifir@x.com" });
      await call("POST", "/auth/reset", { token: tokenFrom(mails.at(-1)), newPassword: "yepyeni-sifre" });
      expect((await login("kilitsifir@x.com", "yepyeni-sifre")).status).toBe(200);
    });

    it("aynı e-postaya saatte en çok 3 bağlantı gönderir", async () => {
      await signup("spam@x.com");
      const before = mails.length;
      for (let i = 0; i < 5; i++) expect((await call("POST", "/auth/forgot", { email: "spam@x.com" })).status).toBe(200);
      expect(mails.length - before).toBe(3);
    });
  });

  it("yapılandırma: şifre sıfırlama açık, en az şifre 8", async () => {
    const r = await call("GET", "/config");
    expect(r.body).toEqual({ passwordReset: true, minPassword: 8 });
  });

  it("şube uç noktası: liste yoksa 503, bulunursa ad döner, yoksa 404", async () => {
    subeler = null;
    expect((await call("GET", "/sube?banka=00010&sube=0519")).status).toBe(503);
    subeler = parseSubeXml(SAMPLE_XML);
    const found = await call("GET", "/sube?banka=00010&sube=0519");
    expect(found.status).toBe(200);
    expect(found.body.ilce).toBe("KADIKÖY");
    expect((await call("GET", "/sube?banka=00010&sube=9999")).status).toBe(404);
  });

  it("bilinmeyen API yolu JSON 404 döner; güvenlik başlıkları vardır", async () => {
    const r = await call("GET", "/boyle-bir-sey-yok");
    expect(r.status).toBe(404);
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(r.headers.get("x-powered-by")).toBeNull();
  });
});

describe("yayın ayarları", () => {
  let server;
  let base;
  let dir;
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ibanova-static-"));
    fs.mkdirSync(path.join(dir, "assets"));
    fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>Ibanova</title>");
    fs.writeFileSync(path.join(dir, "assets", "app-abc123.js"), "console.log(1)");
    const store = new FileStore(path.join(dir, "db.json"));
    const app = createApp({
      store,
      secret: "test-secret-test-secret-test-secret-123",
      staticDir: dir,
      trustProxy: 1,
      corsOrigins: ["https://izinli.example"],
    });
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(() => server?.close());

  it("ön yüzü aynı adresten sunar; derleme dosyaları uzun süre önbelleğe alınır", async () => {
    const index = await fetch(`${base}/`);
    expect(index.status).toBe(200);
    expect(await index.text()).toContain("<title>Ibanova</title>");
    expect(index.headers.get("cache-control")).toBe("no-cache");
    const asset = await fetch(`${base}/assets/app-abc123.js`);
    expect(asset.headers.get("cache-control")).toContain("immutable");
  });

  it("API yine JSON döner, ön yüze düşmez", async () => {
    const r = await fetch(`${base}/api/health`);
    expect(await r.json()).toEqual({ ok: true });
    expect((await fetch(`${base}/api/yok`)).status).toBe(404);
  });

  it("CORS yalnızca izinli kökene açık", async () => {
    const ok = await fetch(`${base}/api/health`, { headers: { Origin: "https://izinli.example" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://izinli.example");
    const bad = await fetch(`${base}/api/health`, { headers: { Origin: "https://kotu.example" } });
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("proxy arkasında HTTPS isteğine HSTS başlığı ekler", async () => {
    const r = await fetch(`${base}/api/health`, { headers: { "X-Forwarded-Proto": "https" } });
    expect(r.headers.get("strict-transport-security")).toContain("max-age=");
  });

  it("proxy arkasında hatalı giriş sınırı gerçek istemci IP'sine göre işler", async () => {
    const post = (ip, password) =>
      fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify({ email: "biri@x.com", password }),
      });
    for (let i = 0; i < 5; i++) await post("1.1.1.1", "yanlis");
    expect((await post("1.1.1.1", "yanlis")).status).toBe(429);
    // Başka bir kullanıcının IP'si kilitlenmez (proxy IP'si ortak olsa bile)
    expect((await post("2.2.2.2", "yanlis")).status).toBe(401);
  });
});
