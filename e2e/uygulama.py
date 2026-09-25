"""Mobil uygulama köprüsü: web uygulaması, uygulama içinde (window.IbanovaNative varken) telefon
özelliklerini doğru çağırıyor mu? Köprü sahte bir nesneyle taklit edilir.
Kullanım: sunucu çalışırken  E2E_URL=http://localhost:8080/ python3 e2e/uygulama.py"""
import os
from playwright.sync_api import sync_playwright
MOCK = """
window.__calls = [];
window.IbanovaNative = { platform: 'android', version: '1.0.0', call: (m, a) => {
  window.__calls.push([m, a && a.base64 ? {...a, base64: a.base64.slice(0,8)+'…('+a.base64.length+')'} : a]);
  const r = { biometricAvailable: true, biometricAuth: true, readClipboard: 'TR41 0006 2007 8410 0000 0090 84' }[m];
  return Promise.resolve(r === undefined ? true : r);
}};
try { localStorage.setItem('ibanova:demo','1') } catch(e) {}
"""
URL = os.environ.get("E2E_URL", "http://localhost:8080/")
res = []
def check(n, c, x=""):
    res.append(c); print(("PASS " if c else "FAIL ") + n + ("" if c else f"  [{x}]"))
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width":393,"height":852}); ctx.add_init_script(MOCK); pg = ctx.new_page()
    calls = lambda: pg.evaluate("window.__calls.map(c=>c[0])")
    pg.goto(URL + ""); pg.wait_for_selector("#iban")
    pg.click("button:has-text('Kopyala')"); pg.wait_for_timeout(300)
    check("Kopyala → yerel pano + titreşim", "copy" in calls() and "haptic" in calls(), calls())
    pg.click("button:has-text('Paylaş')"); pg.wait_for_timeout(300)
    check("Paylaş → yerel paylaşım menüsü", "share" in calls(), calls())
    pg.click('button[aria-label="Alanı temizle"]'); pg.click("button:has-text('Panodan Yapıştır')"); pg.wait_for_timeout(400)
    check("Panodan Yapıştır → yerel pano okunur ve IBAN kutuya girer", "readClipboard" in calls() and pg.input_value("#iban") == "TR41 0006 2007 8410 0000 0090 84", pg.input_value("#iban"))
    pg.goto(URL + "#/qr/TR760001000519786457841326"); pg.wait_for_selector("img[alt='IBAN QR kodu']")
    pg.click("button:has-text('Görsel Olarak Kaydet')"); pg.wait_for_timeout(800)
    last = pg.evaluate("window.__calls.filter(c=>c[0]==='shareImage').pop()")
    check("QR kaydet → PNG görseli yerel menüye gider", bool(last) and last[1]["filename"].endswith(".png") and "(" in last[1]["base64"], last)
    pg.goto(URL + "#/profil"); pg.wait_for_selector("h1:has-text('Profil')"); pg.wait_for_timeout(500)
    check("Face ID satırı 'Desteklenmiyor' değil, açılabilir anahtar", pg.locator("button[aria-label='Face ID ile erişim']").count() == 1)
    pg.click("button[aria-label='Face ID ile erişim']"); pg.wait_for_timeout(500)
    check("Kilidi açınca yerel biyometrik doğrulama istenir", "biometricAuth" in calls(), calls())
    pg.reload(); pg.wait_for_timeout(800)
    n = pg.evaluate("window.__calls.filter(c=>c[0]==='biometricAuth').length")
    check("Uygulama yeniden açılınca kilit ekranı yerel doğrulamayla açılır", n >= 1 and pg.locator("h1:has-text('Profil')").count() == 1, n)
    b.close()
print(f"{sum(res)}/{len(res)} geçti")
