"""Yayına hazırlık kontrolleri: boş ilk açılış, harici kaynak yok, KVKK, şifre kuralı, şifremi unuttum.

Tek serviste (Express dist/ klasörünü sunarken) çalıştırın; şifre sıfırlama e-postası geliştirme modunda
sunucu çıktısına yazılır, test bağlantıyı oradan okur:
  npm run build
  IBANOVA_DB_FILE=/tmp/ib.json PORT=8080 node server/index.js > /tmp/ib-server.log 2>&1 &
  E2E_URL=http://localhost:8080/ SERVER_LOG=/tmp/ib-server.log python3 e2e/yayin.py
"""
import json
import os
import re
import time
import uuid
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

# Web sürümü yalnızca uygulamada açılır; testler tarayıcıda çalıştığı için test bayrağıyla açık tutulur
WEB_TEST = "try { localStorage.setItem('ibanova:web', '1') } catch (e) {}"

URL = os.environ.get("E2E_URL", "http://localhost:8080/")
SERVER_LOG = os.environ.get("SERVER_LOG", "/tmp/ib-server.log")
ORIGIN = urlparse(URL).netloc
results = []
console_errors = []


def check(name, cond, extra=""):
    results.append((bool(cond), name))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))


def new_page(b):
    ctx = b.new_context(viewport={"width": 393, "height": 852})
    ctx.add_init_script(WEB_TEST)
    pg = ctx.new_page()
    pg.on(
        "console",
        lambda m: console_errors.append(m.text)
        if m.type == "error"
        and "ERR_TUNNEL" not in m.text
        and "fonts.g" not in m.text
        # testin bilerek yaptığı hatalı istekler (yanlış şifre vb.); CSP ihlalleri "Refused to…" diye gelir
        and not re.match(r"Failed to load resource: the server responded with a status of 4\d\d", m.text)
        else None,
    )
    pg.on("pageerror", lambda e: console_errors.append(str(e)))
    return ctx, pg


with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"])

    # ---------- 1. Yeni kullanıcı boş bir uygulamayla başlar ----------
    ctx, pg = new_page(b)
    external = []
    pg.on(
        "request",
        lambda r: external.append(r.url)
        if urlparse(r.url).netloc != ORIGIN
        and not r.url.startswith("data:")
        else None,
    )
    pg.goto(URL)
    pg.wait_for_selector("#iban")
    check("IBAN alanı boş başlar (örnek IBAN yok)", pg.input_value("#iban") == "")
    check("selamlama isimsiz", pg.locator("h1").first.inner_text().strip() == "Merhaba")
    pg.goto(URL + "#/gecmis")
    pg.wait_for_selector("h1:has-text('Geçmiş')")
    check("geçmiş boş", pg.locator("article").count() == 0)
    pg.goto(URL + "#/kayitli")
    pg.wait_for_selector("h1:has-text('Kayıtlı')")
    check("kayıtlı IBAN yok", pg.locator("article").count() == 0)
    pg.goto(URL + "#/profil")
    pg.wait_for_selector("h1:has-text('Profil')")
    body = pg.locator("body").inner_text()
    check("örnek kişi adı yok", "Ayşe" not in body and "Kira Ödemesi" not in body)
    check("isim yerine 'Adınızı ekleyin' gösterilir", pg.locator("h2:has-text('Adınızı ekleyin')").count() == 1)
    check("profilde fotoğraf yok (stok görsel kaldırıldı)", pg.locator("main img").count() == 0)
    pg.goto(URL)
    pg.wait_for_selector("#iban")
    pg.fill("#iban", "TR76 0001 0005 1978 6457 8413 26")
    pg.wait_for_selector("h3:has-text('IBAN doğrulandı')")
    pg.goto(URL + "#/iban/TR760001000519786457841326")
    pg.wait_for_selector("#detail-title")
    pg.wait_for_timeout(500)
    check("hiçbir harici sunucuya istek yok (yazı tipleri dahil)", not external, external[:3])
    # Sıfırlama gerçek kullanıcıda boşa döner
    pg.goto(URL + "#/profil")
    pg.wait_for_selector("h1:has-text('Profil')")
    pg.click('button[aria-label="Daha fazla seçenek"]')
    pg.click("text=Verileri sıfırla")
    pg.click("[role=dialog] button:has-text('Sıfırla')")
    pg.goto(URL + "#/gecmis")
    pg.wait_for_selector("h1:has-text('Geçmiş')")
    check("verileri sıfırla → boş (örnek veri yüklenmez)", pg.locator("article").count() == 0)
    ctx.close()

    # ---------- 2. KVKK aydınlatma metni ----------
    ctx, pg = new_page(b)
    pg.goto(URL + "#/profil")
    pg.wait_for_selector("h1:has-text('Profil')")
    pg.click("button:has-text('Gizlilik Politikası ve KVKK')")
    pg.wait_for_selector("h1:has-text('Gizlilik Politikası')")
    t = pg.locator("main").inner_text()
    check("profilden aydınlatma metnine gidilir", "KVKK m.11" in t and "veri sorumlusu" in t)
    pg.click("button[aria-label='Geri dön']")
    pg.wait_for_selector("h1:has-text('Profil')")
    check("geri dönülür", True)
    pg.goto(URL + "#/hesap")
    pg.wait_for_selector("h1:has-text('Hesap')")
    pg.click("button[role=tab]:has-text('Hesap Oluştur')")
    pg.click("button:has-text('Aydınlatma Metni')")
    pg.wait_for_selector("h1:has-text('Gizlilik Politikası')")
    check("kayıt ekranından aydınlatma metnine gidilir", True)
    ctx.close()

    # ---------- 2b. Google Play için JavaScript'siz okunabilen sayfalar ----------
    ctx = b.new_context(java_script_enabled=False)
    pg = ctx.new_page()
    for path, must in [
        ("gizlilik", ["Gizlilik Politikası", "Güvenlik", "Saklama süresi ve silme", "KVKK m.11", "/hesap-silme"]),
        ("hesap-silme", ["Hesap ve Veri Silme", "Hesabı Sil", "Neler silinir", "E-postayla"]),
    ]:
        resp = pg.goto(URL + path)
        text = pg.locator("body").inner_text()
        missing = [m for m in must if m not in text]
        check(f"/{path} JavaScript kapalıyken okunuyor (200, gerekli bölümler var)", resp.status == 200 and not missing, missing)
    check("gizlilik politikası uygulama içi ekranla aynı başlığı taşır", pg.goto(URL + "gizlilik") and pg.title() == "Ibanova Gizlilik Politikası")
    ctx.close()

    # ---------- 3. Şifre en az 8 karakter ----------
    EMAIL = f"yayin-{uuid.uuid4().hex[:8]}@ornek.com"
    ctx, pg = new_page(b)
    pg.goto(URL + "#/hesap")
    pg.wait_for_selector("h1:has-text('Hesap')")
    pg.click("button[role=tab]:has-text('Hesap Oluştur')")
    pg.fill("#acc-name", "Yayın Test")
    pg.fill("#acc-email", EMAIL)
    pg.fill("#acc-password", "1234567")
    pg.click("button[type=submit]")
    check("7 karakterlik şifre reddedilir", "8 karakter" in pg.locator("[role=alert]").inner_text())
    pg.fill("#acc-password", "ilk-sifre-1")
    pg.click("button[type=submit]")
    pg.wait_for_selector("h1:has-text('Profil')", timeout=5000)
    check("8+ karakterle hesap açılır", pg.locator("button:has-text('Yayın Test')").count() == 1)
    pg.click("button:has-text('Yayın Test')")
    pg.click("button:has-text('Çıkış Yap')")
    pg.wait_for_selector("h1:has-text('Profil')")
    ctx.close()

    # ---------- 4. Şifremi unuttum ----------
    ctx, pg = new_page(b)
    pg.goto(URL + "#/hesap")
    pg.wait_for_selector("h1:has-text('Hesap')")
    pg.wait_for_selector("button:has-text('Şifremi unuttum')", timeout=5000)
    pg.fill("#acc-email", EMAIL)
    pg.click("button:has-text('Şifremi unuttum')")
    check("e-posta alanı önceden dolu gelir", pg.input_value("#forgot-email") == EMAIL)
    log_before = open(SERVER_LOG, encoding="utf-8").read()
    pg.click("[role=dialog] button:has-text('Bağlantı Gönder')")
    pg.wait_for_selector("[role=dialog] [role=status]")
    check("hesabın varlığını belli etmeyen onay mesajı", "varsa" in pg.locator("[role=dialog] [role=status]").inner_text())
    link = None
    for _ in range(20):
        new_log = open(SERVER_LOG, encoding="utf-8").read()[len(log_before):]
        m = re.search(r"(https?://\S+/#/sifre-sifirla/\S+)", new_log)
        if m:
            link = m.group(1)
            break
        time.sleep(0.2)
    check("sıfırlama bağlantısı e-postaya (geliştirmede sunucu çıktısına) yazıldı", link is not None)
    pg.click("[role=dialog] button:has-text('Tamam')")
    ctx.close()

    # Bağlantıyı yeni bir tarayıcıda aç (kullanıcı e-postadan tıklamış gibi)
    ctx, pg = new_page(b)
    reset_url = URL.rstrip("/") + "/" + link.split("/", 3)[3] if link else URL
    pg.goto(reset_url)
    pg.wait_for_selector("h1:has-text('Yeni şifre belirleyin')")
    pg.fill("#reset-pw", "yeni-sifre-12")
    pg.fill("#reset-pw2", "baska-sifre-12")
    pg.click("button[type=submit]")
    check("şifreler eşleşmezse uyarır", "eşleşmiyor" in pg.locator("[role=alert]").inner_text())
    pg.fill("#reset-pw2", "yeni-sifre-12")
    pg.click("button[type=submit]")
    pg.wait_for_selector("h1:has-text('Profil')", timeout=5000)
    check("yeni şifre kaydedilince giriş yapılmış olarak profile gelir", pg.locator("button:has-text('Yayın Test')").count() == 1)
    check("jeton adres çubuğunda kalmaz", "sifre-sifirla" not in pg.url, pg.url)
    ctx.close()

    ctx, pg = new_page(b)
    pg.goto(reset_url)
    pg.wait_for_selector("h1:has-text('Yeni şifre belirleyin')")
    pg.fill("#reset-pw", "ucuncu-sifre-1")
    pg.fill("#reset-pw2", "ucuncu-sifre-1")
    pg.click("button[type=submit]")
    pg.wait_for_selector("[role=alert]")
    check("aynı bağlantı ikinci kez kullanılamaz", "geçersiz" in pg.locator("[role=alert]").inner_text())
    pg.goto(URL + "#/hesap")
    pg.wait_for_selector("h1:has-text('Hesap')")
    pg.fill("#acc-email", EMAIL)
    pg.fill("#acc-password", "ilk-sifre-1")
    pg.click("button[type=submit]")
    pg.wait_for_selector("[role=alert]")
    check("eski şifre artık çalışmaz", pg.locator("h1:has-text('Hesap')").count() == 1)
    pg.fill("#acc-password", "yeni-sifre-12")
    pg.click("button[type=submit]")
    pg.wait_for_selector("h1:has-text('Profil')", timeout=5000)
    check("yeni şifreyle giriş yapılır", True)
    ctx.close()

    b.close()

check("tarayıcı konsolunda hata yok (CSP ihlali dahil)", not console_errors, console_errors[:3])
fails = [n for ok, n in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} geçti")
if fails:
    print("BAŞARISIZ:", json.dumps(fails, ensure_ascii=False))
