import { describe, expect, it } from "vitest";
import { revenuecatDeleter } from "./revenuecat.js";

describe("RevenueCat abone kaydı silme", () => {
  it("anahtar yoksa kapalı", () => {
    expect(revenuecatDeleter("")).toBeNull();
  });

  it("doğru adrese gizli anahtarla DELETE gönderir; 404 sorun sayılmaz", async () => {
    const calls = [];
    const del = revenuecatDeleter("sk_test", async (url, opts) => {
      calls.push({ url, opts });
      return { ok: false, status: 404 };
    });
    await expect(del("a/b c")).resolves.toBe(true);
    expect(calls[0].url).toBe("https://api.revenuecat.com/v1/subscribers/a%2Fb%20c");
    expect(calls[0].opts.method).toBe("DELETE");
    expect(calls[0].opts.headers.Authorization).toBe("Bearer sk_test");
  });

  it("sunucu hatasında hata fırlatır", async () => {
    const del = revenuecatDeleter("sk_test", async () => ({ ok: false, status: 500 }));
    await expect(del("u1")).rejects.toThrow("HTTP 500");
  });
});
