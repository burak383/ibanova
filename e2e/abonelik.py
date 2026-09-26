"""Abonelik ve günlük 1 ücretsiz sorgu. Mobil uygulama köprüsü (RevenueCat tarafı) sahte bir nesneyle taklit edilir.
Kullanım: npm run build, sunucu çalışırken  E2E_URL=http://localhost:8080/ python3 e2e/abonelik.py"""
import json
import os
import uuid
from playwright.sync_api import sync_playwright

URL = os.environ.get("E2E_URL", "http://localhost:8080/")
A = "TR760001000519786457841326"
B = "TR410006200784100000009084"
BAD = "TR760001000519786457841327"  # tam uzunlukta ama MOD-97 hatalı

# cfg: available (abonelik altyapısı kurulu mu), usedToday (anahtarlıkta bugün kullanılmış IBAN'lar), cancel
FAKE = """
(() => {
  const cfg = %s;
  window.__calls = [];
  const day = (() => { const d = new Date(), p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); })();
  const st = JSON.parse(sessionStorage.getItem('fake') || 'null') || {
    active: false, available: cfg.available !== false,
    quota: cfg.usedToday ? JSON.stringify({ day, ibans: cfg.usedToday }) : '' };
  const save = () => sessionStorage.setItem('fake', JSON.stringify(st));
  const status = () => ({ available: st.available, active: st.active, productId: st.active ? 'ibanova_yillik' : null,
    expires: st.active ? new Date(Date.now() + 365 * 864e5).toISOString() : null, willRenew: true, managementURL: null });
  const plans = [
    { id: '$rc_monthly', period: 'monthly', price: '₺49,99', pricePerMonth: null, title: 'Aylık', intro: null },
    { id: '$rc_annual', period: 'annual', price: '₺399,99', pricePerMonth: '₺33,33', title: 'Yıllık', intro: null },
  ];
  window.IbanovaNative = { platform: 'ios', version: '1.0.0', call: (m, a) => {
    window.__calls.push([m, a || null]);
    switch (m) {
      case 'subStatus': return Promise.resolve(status());
      case 'subPlans': return Promise.resolve(plans);
      case 'subPurchase':
        if (cfg.cancel) return Promise.resolve({ result: 'cancelled', status: status() });
        st.active = true; save();
        return Promise.resolve({ result: 'purchased', status: status() });
      case 'subRestore': case 'subLogin': case 'subLogout': return Promise.resolve(status());
      case 'quotaGet': return Promise.resolve(st.quota);
      case 'quotaSet': st.quota = a.value; save(); return Promise.resolve(true);
      default: return Promise.resolve(true);
    }
  }};
})();
"""

res = []


def check(n, c, x=""):
    res.append(bool(c))
    print(("PASS " if c else "FAIL ") + n + ("" if c else f"  [{x}]"))


def fmt(i):
    return " ".join(i[k:k + 4] for k in range(0, len(i), 4))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"])

    def app(cfg):
        ctx = b.new_context(viewport={"width": 393, "height": 852})
        ctx.add_init_script(FAKE % json.dumps(cfg))
        pg = ctx.new_page()
        pg.goto(URL)
        pg.wait_for_selector("#iban")
        pg.wait_for_timeout(300)
        return ctx, pg

    def type_iban(pg, iban):
        pg.fill("#iban", fmt(iban))
        pg.wait_for_timeout(250)

    calls = lambda pg, m: [c[1] for c in pg.evaluate("window.__calls") if c[0] == m]
    shown = lambda pg: pg.locator("text=IBAN doğrulandı").count() == 1
    locked = lambda pg: pg.locator("[data-testid=locked-result]").count() == 1

    # ---------- 1. Ücretsiz kullanıcı: günde 1 geçerli IBAN ----------
    ctx, pg = app({})
    check("Ana sayfada '1 ücretsiz sorgu' bilgisi görünür", "1 ücretsiz sorgu" in pg.inner_text("[data-testid=free-quota]"))
    type_iban(pg, BAD)
    check("Hatalı IBAN gösterilir ve hak harcamaz", pg.locator("text=IBAN geçersiz").count() == 1
          and "1 ücretsiz sorgu" in pg.inner_text("[data-testid=free-quota]"))
    type_iban(pg, A)
    check("İlk geçerli IBAN'ın sonucu gösterilir", shown(pg) and not locked(pg))
    check("Hak bitti bilgisi görünür", "kullandınız" in pg.inner_text("[data-testid=free-quota]"))
    q = calls(pg, "quotaSet")
    check("Kullanılan hak telefonun anahtarlığına yazılır", q and A in json.loads(q[-1]["value"])["ibans"], q)
    type_iban(pg, B)
    check("İkinci farklı IBAN kilitli: sonuç ve banka bilgisi gösterilmez",
          locked(pg) and not shown(pg) and pg.locator("text=Banka Kodu").count() == 0)
    check("Kilitliyken 'Kaydet' düğmesi yok", pg.locator("button:has-text('Kaydet')").count() == 0)
    type_iban(pg, BAD)
    check("Hak bitince hatalı IBAN da kilitli (sonuç sızmaz)", locked(pg) and pg.locator("text=IBAN geçersiz").count() == 0)
    type_iban(pg, A)
    check("Bugün bakılan IBAN yeniden açılabilir", shown(pg))
    hist = [h["iban"] for h in json.loads(pg.evaluate("localStorage.getItem('ibanova:v1')"))["history"]]
    check("Kilitli IBAN geçmişe yazılmaz", B not in hist and A in hist, hist)
    pg.reload(); pg.wait_for_selector("#iban"); pg.wait_for_timeout(400)
    type_iban(pg, B)
    check("Yeniden açılınca da hak bitmiş sayılır", locked(pg))

    # ---------- 2. Abonelik ekranı ----------
    pg.click("text=Sınırsız sorgu için Premium")
    pg.wait_for_selector("text=Sınırsız IBAN kontrolü")
    pg.wait_for_selector("text=₺399,99")
    txt = pg.inner_text("main")
    check("Planlar mağaza fiyatlarıyla gösterilir", "₺49,99" in txt and "₺399,99" in txt and "Aylık ₺33,33" in txt, txt[:300])
    radios = pg.locator("[role=radio]")
    check("Yıllık plan önce ve seçili gelir", "Yıllık" in radios.nth(0).inner_text()
          and radios.nth(0).get_attribute("aria-checked") == "true")
    check("Otomatik yenileme ve iptal bilgisi yazılı (Apple 3.1.2)", "otomatik olarak yenilenir" in txt and "iptal" in txt)
    check("Kullanım Koşulları ve Gizlilik bağlantıları var",
          pg.locator("a[href='/kosullar']").count() == 1 and pg.locator("a[href='/gizlilik']").count() == 1)
    radios.nth(1).click()
    check("Plan seçimi değişir", radios.nth(1).get_attribute("aria-checked") == "true"
          and "₺49,99 / ay" in pg.inner_text("main"))
    pg.click("text=Satın alımları geri yükle"); pg.wait_for_timeout(300)
    check("Geri yükleme: abonelik yoksa bilgi verir", pg.locator("text=aktif abonelik bulunamadı").count() == 1)
    pg.click("button:has-text('Abone ol')")
    pg.wait_for_selector("#iban", timeout=5000); pg.wait_for_timeout(300)
    check("Satın alınan plan köprüye iletilir", calls(pg, "subPurchase")[-1] == {"planId": "$rc_monthly"}, calls(pg, "subPurchase"))
    check("Satın alma sonrası ana sayfaya döner ve kilit kalkar", shown(pg) and not locked(pg))
    check("Abone olunca ücretsiz hak bilgisi gizlenir", pg.locator("[data-testid=free-quota]").count() == 0)
    type_iban(pg, "TR150009900123456789004412")
    check("Abone: yeni IBAN'lar sınırsız", shown(pg) or pg.locator("text=IBAN geçersiz").count() == 1)
    pg.goto(URL + "#/profil"); pg.wait_for_selector("[data-testid=premium-row]")
    check("Profilde Premium aktif görünür", "Aktif" in pg.inner_text("[data-testid=premium-row]"))
    pg.click("[data-testid=premium-row]"); pg.wait_for_selector("[data-testid=sub-active]")
    pg.click("text=Aboneliği yönet veya iptal et"); pg.wait_for_timeout(200)
    check("Abonelik yönetimi mağaza sayfasını açar", len(calls(pg, "subManage")) == 1)

    # Hesaba giriş yapınca abonelik hesaba bağlanır
    pg.goto(URL + "#/hesap"); pg.wait_for_selector("h1:has-text('Hesap')")
    pg.click("button[role=tab]:has-text('Hesap Oluştur')")
    pg.fill("#acc-name", "Abone Test")
    pg.fill("#acc-email", f"abone-{uuid.uuid4().hex[:8]}@ornek.com")
    pg.fill("#acc-password", "guclu-sifre-1")
    pg.click("button[type=submit]")
    pg.wait_for_selector("h1:has-text('Profil')", timeout=5000); pg.wait_for_timeout(300)
    logins = calls(pg, "subLogin")
    check("Hesap açılınca abonelik hesap kimliğine bağlanır", logins and len(logins[-1]["userId"]) == 36, logins)
    ctx.close()

    # ---------- 3. Uygulama silinse de (web depolaması boş) anahtarlıktaki hak geçerli ----------
    ctx, pg = app({"usedToday": [A]})
    pg.wait_for_timeout(300)
    type_iban(pg, B)
    check("Anahtarlıkta bugün kullanılmış hak varsa yeni IBAN kilitli", locked(pg))
    type_iban(pg, A)
    check("Anahtarlıktaki IBAN açılabilir", shown(pg))
    ctx.close()

    # ---------- 4. Satın alma iptal edilirse ----------
    ctx, pg = app({"cancel": True})
    pg.goto(URL + "#/abonelik"); pg.wait_for_selector("text=₺399,99")
    pg.click("button:has-text('Abone ol')"); pg.wait_for_timeout(400)
    check("Vazgeçilen satın almada ekranda kalınır, hata gösterilmez",
          pg.locator("button:has-text('Abone ol')").count() == 1 and pg.locator("text=tamamlanamadı").count() == 0)
    ctx.close()

    # ---------- 5. Abonelik altyapısı kurulu değilse (RevenueCat anahtarı yok) herkes sınırsız ----------
    ctx, pg = app({"available": False})
    type_iban(pg, A); type_iban(pg, B)
    check("Altyapı yokken kilit ve sayaç yok", shown(pg) and pg.locator("[data-testid=free-quota]").count() == 0)
    pg.goto(URL + "#/profil"); pg.wait_for_selector("h1:has-text('Profil')")
    check("Altyapı yokken profilde Premium satırı yok", pg.locator("[data-testid=premium-row]").count() == 0)
    ctx.close()

    # ---------- 6. Tarayıcıda web sürümü kapalı ----------
    ctx = b.new_context(viewport={"width": 393, "height": 852})
    pg = ctx.new_page()
    pg.goto(URL); pg.wait_for_timeout(600)
    check("Tarayıcıda indirme sayfası görünür, uygulama açılmaz",
          pg.locator("text=IBAN kontrolü artık uygulamada").count() == 1 and pg.locator("#iban").count() == 0)
    check("Google Play bağlantısı var", pg.locator("a[href*='play.google.com/store/apps/details?id=com.ibanova.app']").count() == 1)
    pg.goto(URL + "#/profil"); pg.wait_for_timeout(300)
    check("Uygulama ekranlarına adresle de girilemez", pg.locator("text=IBAN kontrolü artık uygulamada").count() == 1)
    pg.goto(URL + "#/sifre-sifirla/deneme"); pg.wait_for_timeout(300)
    check("E-postadaki şifre sıfırlama bağlantısı tarayıcıda çalışır",
          pg.locator("text=Yeni şifre belirleyin").count() == 1 and pg.locator("button[aria-label='Geri dön']").count() == 0)
    r = pg.goto(URL.rstrip("/") + "/kosullar")
    check("Kullanım Koşulları sayfası açılır", r.status == 200 and "otomatik olarak yenilenir" in pg.content())
    ctx.close()
    b.close()

print(f"{sum(res)}/{len(res)} geçti")
