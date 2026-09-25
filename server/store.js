/**
 * Kullanıcı deposu. Aynı arayüzün iki uygulaması var:
 *  - PgStore:   DATABASE_URL tanımlıysa PostgreSQL (yayında kullanılır; Render'ın dosya sistemi kalıcı değildir)
 *  - FileStore: yerel geliştirme için tek bir JSON dosyası
 *
 * Kullanıcı nesnesi olduğu gibi (JSON) saklanır; e-posta benzersizdir.
 */
import fs from "node:fs";

export class EmailTakenError extends Error {}

export class FileStore {
  constructor(file) {
    this.file = file;
    this.queue = Promise.resolve();
  }

  async init() {}

  #read() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (parsed && Array.isArray(parsed.users)) return parsed;
    } catch {
      /* dosya yok veya bozuk */
    }
    return { users: [] };
  }

  #write(db) {
    // Geçici dosyaya yazıp yer değiştir: yazma yarıda kesilirse veritabanı bozulmaz
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, this.file);
  }

  /** Yazma işlemlerini sıraya koyar; eşzamanlı istekler birbirinin yazdığını ezmez. */
  #serial(fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  async findByEmail(email) {
    return this.#read().users.find((u) => u.email === email) ?? null;
  }

  async findById(id) {
    return this.#read().users.find((u) => u.id === id) ?? null;
  }

  insert(user) {
    return this.#serial(() => {
      const db = this.#read();
      if (db.users.some((u) => u.email === user.email)) throw new EmailTakenError();
      db.users.push(user);
      this.#write(db);
    });
  }

  update(user) {
    return this.#serial(() => {
      const db = this.#read();
      const i = db.users.findIndex((u) => u.id === user.id);
      if (i === -1) return false;
      db.users[i] = user;
      this.#write(db);
      return true;
    });
  }

  remove(id) {
    return this.#serial(() => {
      const db = this.#read();
      const before = db.users.length;
      db.users = db.users.filter((u) => u.id !== id);
      this.#write(db);
      return db.users.length < before;
    });
  }

  async close() {}
}

export class PgStore {
  /**
   * @param {{ connectionString?: string, Pool?: any, pool?: any }} opts  `Pool`/`pool` testlerde enjekte edilir
   */
  constructor({ connectionString, Pool, pool }) {
    this.connectionString = connectionString;
    this.PoolClass = Pool;
    this.pool = pool ?? null;
  }

  async init() {
    if (!this.pool) {
      const PoolClass = this.PoolClass ?? (await import("pg")).default.Pool;
      // SSL tercihleri bağlantı adresinden gelir (ör. harici bağlantıda ?sslmode=require)
      this.pool = new PoolClass({ connectionString: this.connectionString, max: 5 });
    }
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id    TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        doc   JSONB NOT NULL
      )`);
  }

  #row(r) {
    if (!r) return null;
    return typeof r.doc === "string" ? JSON.parse(r.doc) : r.doc;
  }

  async findByEmail(email) {
    const { rows } = await this.pool.query("SELECT doc FROM users WHERE email = $1", [email]);
    return this.#row(rows[0]);
  }

  async findById(id) {
    const { rows } = await this.pool.query("SELECT doc FROM users WHERE id = $1", [id]);
    return this.#row(rows[0]);
  }

  async insert(user) {
    try {
      await this.pool.query("INSERT INTO users (id, email, doc) VALUES ($1, $2, $3)", [
        user.id,
        user.email,
        JSON.stringify(user),
      ]);
    } catch (e) {
      if (e?.code === "23505" || /unique|duplicate/i.test(String(e?.message))) throw new EmailTakenError();
      throw e;
    }
  }

  async update(user) {
    const r = await this.pool.query("UPDATE users SET email = $2, doc = $3 WHERE id = $1", [
      user.id,
      user.email,
      JSON.stringify(user),
    ]);
    return r.rowCount > 0;
  }

  async remove(id) {
    const r = await this.pool.query("DELETE FROM users WHERE id = $1", [id]);
    return r.rowCount > 0;
  }

  async close() {
    await this.pool?.end?.();
  }
}

export function createStore({ databaseUrl, dbFile }) {
  return databaseUrl ? new PgStore({ connectionString: databaseUrl }) : new FileStore(dbFile);
}
