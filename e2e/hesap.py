"""Hesap (giriş/kayıt/senkron) akışı için uçtan uca kontroller.
Kullanım: node server/index.js (arka planda, boş bir data.json ile) VE
npm run build && npx vite preview --port 4173 (arka planda) çalışırken:
python3 e2e/hesap.py
"""
import json
import os
import time
import uuid
from playwright.sync_api import sync_playwright

URL = os.environ.get("E2E_URL", "http://localhost:4173/")
results = []


def check(name, cond, extra=""):
    results.append((bool(cond), name))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))


EMAIL = f"e2e-{uuid.uuid4().hex[:8]}@ornek.com"
PASSWORD = "guclu-sifre-1"  # en az 8 karakter

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"])

    # ---------- 1. Hesap oluşturma ve cihaz verisinin hesaba taşınması ----------
    ctx = b.new_context(viewport={"width": 393, "height": 852})
    pg = ctx.new_page()
    pg.goto(URL)
    pg.wait_for_selector("#iban")
    # Örnek veriyi belirgin biçimde değiştir: yeni bir IBAN kontrol et
    pg.fill("#iban", "TR41 0006 2007 8410 0000 0090 84")
    pg.wait_for_timeout(300)

    pg.goto(URL + "#/profil")
    pg.wait_for_selector("h1:has-text('Profil')")
    pg.click("text=Giriş Yap / Hesap Oluştur")
    pg.wait_for_selector("h1:has-text('Hesap')")
    pg.click("button[role=tab]:has-text('Hesap Oluştur')")
    pg.fill("#acc-name", "E2E Kullanıcı")
    pg.fill("#acc-email", EMAIL)
    pg.fill("#acc-password", PASSWORD)
    pg.click("button[type=submit]")
    pg.wait_for_selector("h1:has-text('Profil')", timeout=5000)
    check("hesap oluşturunca profile döner ve hesap adı görünür", pg.locator("text=E2E Kullanıcı").count() >= 1)
    check("hesap e-postası profilde görünür", pg.locator(f"text={EMAIL}").count() >= 1)
    ctx.close()

    # Sunucu tarafında veri gerçekten kaydedildi mi? (senkron debounce'unu bekle)
    time.sleep(1.5)

    # ---------- 2. Farklı bir cihaz/bağlamda giriş yapınca hesaptaki veriler gelir ----------
    ctx2 = b.new_context(viewport={"width": 393, "height": 852})
    pg2 = ctx2.new_page()
    pg2.goto(URL + "#/hesap")
    pg2.wait_for_selector("h1:has-text('Hesap')")
    # "Giriş Yap" varsayılan sekme olmalı
    check("varsayılan sekme Giriş Yap", pg2.locator("button[role=tab][aria-selected=true]:has-text('Giriş Yap')").count() == 1)
    pg2.fill("#acc-email", EMAIL)
    pg2.fill("#acc-password", PASSWORD)
    pg2.click("button[type=submit]")
    pg2.wait_for_selector("h1:has-text('Profil')", timeout=5000)
    check("girişten sonra hesap adıyla profil güncellenir", pg2.locator("text=E2E Kullanıcı").count() >= 1)
    pg2.goto(URL + "#/gecmis")
    pg2.wait_for_selector("h1:has-text('Geçmiş')")
    check(
        "başka bir bağlamda giriş yapınca hesaptaki (senkronlanan) IBAN geçmişi gelir",
        pg2.locator("text=Garanti BBVA").count() >= 1,
    )
    ctx2.close()

    # ---------- 3. Yanlış şifre ve tekrar kayıt reddedilir ----------
    ctx3 = b.new_context(viewport={"width": 393, "height": 852})
    pg3 = ctx3.new_page()
    pg3.goto(URL + "#/hesap")
    pg3.wait_for_selector("h1:has-text('Hesap')")
    pg3.fill("#acc-email", EMAIL)
    pg3.fill("#acc-password", "yanlis-sifre")
    pg3.click("button[type=submit]")
    pg3.wait_for_selector("[role=alert]")
    check("yanlış şifreyle giriş reddedilir ve hata gösterilir", pg3.locator("[role=alert]").count() == 1)
    check("hatalı girişte Hesap ekranında kalınır (Profil'e atlamaz)", pg3.locator("h1:has-text('Hesap')").count() == 1)

    pg3.click("button[role=tab]:has-text('Hesap Oluştur')")
    pg3.fill("#acc-name", "Tekrar")
    pg3.fill("#acc-email", EMAIL)
    pg3.fill("#acc-password", "baska-sifre-1")
    pg3.click("button[type=submit]")
    pg3.wait_for_selector("[role=alert]")
    check("aynı e-posta ile tekrar kayıt reddedilir", pg3.locator("text=zaten").count() >= 1)
    ctx3.close()

    # ---------- 4. Çıkış yapınca cihaz verisi silinmez, sadece senkron durur ----------
    ctx4 = b.new_context(viewport={"width": 393, "height": 852})
    pg4 = ctx4.new_page()
    pg4.goto(URL + "#/hesap")
    pg4.wait_for_selector("h1:has-text('Hesap')")
    pg4.fill("#acc-email", EMAIL)
    pg4.fill("#acc-password", PASSWORD)
    pg4.click("button[type=submit]")
    pg4.wait_for_selector("h1:has-text('Profil')", timeout=5000)
    pg4.click("button:has-text('E2E Kullanıcı')")
    pg4.wait_for_selector("button:has-text('Çıkış Yap')")
    pg4.click("button:has-text('Çıkış Yap')")
    pg4.wait_for_selector("h1:has-text('Profil')", timeout=5000)
    check("çıkış sonrası tekrar 'Giriş Yap' seçeneği görünür", pg4.locator("text=Giriş Yap / Hesap Oluştur").count() == 1)
    pg4.goto(URL + "#/gecmis")
    pg4.wait_for_selector("h1:has-text('Geçmiş')")
    check("çıkış sonrası cihazdaki geçmiş verisi hâlâ görünür (silinmez)", pg4.locator("article").count() > 0)
    ctx4.close()

    def login(page, email, password):
        page.goto(URL + "#/hesap")
        page.wait_for_selector("h1:has-text('Hesap')")
        page.fill("#acc-email", email)
        page.fill("#acc-password", password)
        page.click("button[type=submit]")

    # ---------- 5. Profil adı değişince hesap adı da güncellenir ----------
    ctx5 = b.new_context(viewport={"width": 393, "height": 852})
    pg5 = ctx5.new_page()
    login(pg5, EMAIL, PASSWORD)
    pg5.wait_for_selector("h1:has-text('Profil')", timeout=5000)
    pg5.click("button[aria-label='Adı düzenle']")
    pg5.fill("input[aria-label='Ad Soyad']", "Yeni İsim")
    pg5.click("[role=dialog] button:has-text('Kaydet')")
    pg5.wait_for_timeout(1800)  # senkron debounce'u + yanıt
    check("profil adı değişince hesap kartındaki ad da güncellenir", pg5.locator("button:has-text('Yeni İsim')").count() == 1)
    ctx5.close()

    # ---------- 6. Şifre değiştirme: eski oturum kapanır, yeni şifreyle girilir ----------
    NEW_PASSWORD = "daha-guclu-2"
    ctxA = b.new_context(viewport={"width": 393, "height": 852})  # "diğer cihaz"
    pgA = ctxA.new_page()
    login(pgA, EMAIL, PASSWORD)
    pgA.wait_for_selector("h1:has-text('Profil')", timeout=5000)

    ctx6 = b.new_context(viewport={"width": 393, "height": 852})
    pg6 = ctx6.new_page()
    login(pg6, EMAIL, PASSWORD)
    pg6.wait_for_selector("h1:has-text('Profil')", timeout=5000)
    pg6.click("button:has-text('Yeni İsim')")
    pg6.click("button:has-text('Şifreyi Değiştir')")
    pg6.fill("#pw-current", PASSWORD)
    pg6.fill("#pw-new", NEW_PASSWORD)
    pg6.fill("#pw-new2", "farkli-sifre")
    pg6.click("[role=dialog] button[type=submit]")
    check("yeni şifreler eşleşmezse uyarır", pg6.locator("[role=dialog] [role=alert]:has-text('eşleşmiyor')").count() == 1)
    pg6.fill("#pw-new2", NEW_PASSWORD)
    pg6.click("[role=dialog] button[type=submit]")
    pg6.wait_for_selector("[role=dialog]", state="detached", timeout=5000)
    check("şifre değiştirildi, bu cihaz oturumda kalır", pg6.locator("button:has-text('Çıkış Yap')").count() == 1)

    # Diğer cihazda bir değişiklik yap: senkron 401 alır ve oturum kapanır
    pgA.goto(URL)
    pgA.wait_for_selector("#iban")
    pgA.fill("#iban", "TR15 0009 9001 2345 6789 0044 12")
    pgA.wait_for_timeout(2000)
    pgA.goto(URL + "#/profil")
    pgA.wait_for_selector("h1:has-text('Profil')")
    check(
        "şifre başka cihazda değişince eski oturum kendiliğinden kapanır",
        pgA.locator("text=Giriş Yap / Hesap Oluştur").count() == 1,
    )
    ctxA.close()

    ctx7 = b.new_context(viewport={"width": 393, "height": 852})
    pg7 = ctx7.new_page()
    login(pg7, EMAIL, PASSWORD)
    pg7.wait_for_selector("[role=alert]")
    check("eski şifreyle giriş artık reddedilir", pg7.locator("h1:has-text('Hesap')").count() == 1)
    pg7.fill("#acc-password", NEW_PASSWORD)
    pg7.click("button[type=submit]")
    pg7.wait_for_selector("h1:has-text('Profil')", timeout=5000)
    check("yeni şifreyle giriş yapılır", True)
    ctx7.close()

    # ---------- 7. Çok sayıda hatalı giriş geçici kilide yol açar ----------
    LOCK_EMAIL = f"kilit-{uuid.uuid4().hex[:6]}@ornek.com"
    ctx8 = b.new_context(viewport={"width": 393, "height": 852})
    pg8 = ctx8.new_page()
    pg8.goto(URL + "#/hesap")
    pg8.wait_for_selector("h1:has-text('Hesap')")
    pg8.click("button[role=tab]:has-text('Hesap Oluştur')")
    pg8.fill("#acc-name", "Kilit Test")
    pg8.fill("#acc-email", LOCK_EMAIL)
    pg8.fill("#acc-password", PASSWORD)
    pg8.click("button[type=submit]")
    pg8.wait_for_selector("h1:has-text('Profil')", timeout=5000)
    pg8.click("button:has-text('Kilit Test')")
    pg8.click("button:has-text('Çıkış Yap')")
    pg8.wait_for_selector("h1:has-text('Profil')")
    last = ""
    for i in range(5):
        login(pg8, LOCK_EMAIL, f"yanlis-{i}")
        pg8.wait_for_selector("[role=alert]")
        last = pg8.locator("[role=alert]").inner_text()
    check("5 hatalı denemeden sonra geçici kilit mesajı gösterilir", "dakika" in last, last)
    login(pg8, LOCK_EMAIL, PASSWORD)
    pg8.wait_for_selector("[role=alert]")
    check("kilit süresince doğru şifre de kabul edilmez", pg8.locator("h1:has-text('Hesap')").count() == 1)
    ctx8.close()

    # ---------- 8. Hesap silme ----------
    login(pg6, EMAIL, NEW_PASSWORD) if pg6.locator("button:has-text('Çıkış Yap')").count() == 0 else None
    pg6.click("button:has-text('Hesabı Sil')")
    pg6.fill("#del-password", "yanlis")
    pg6.click("[role=dialog] button[type=submit]")
    pg6.wait_for_selector("[role=dialog] [role=alert]")
    check("hesap silme yanlış şifreyle reddedilir", pg6.locator("[role=dialog]").count() == 1)
    pg6.fill("#del-password", NEW_PASSWORD)
    pg6.click("[role=dialog] button[type=submit]")
    pg6.wait_for_selector("h1:has-text('Profil')", timeout=5000)
    check("hesap silinince çıkış yapılmış olur", pg6.locator("text=Giriş Yap / Hesap Oluştur").count() == 1)
    pg6.goto(URL + "#/gecmis")
    pg6.wait_for_selector("h1:has-text('Geçmiş')")
    check("hesap silinince cihazdaki veriler yerinde kalır", pg6.locator("article").count() > 0)
    login(pg6, EMAIL, NEW_PASSWORD)
    pg6.wait_for_selector("[role=alert]")
    check("silinen hesapla giriş yapılamaz", pg6.locator("h1:has-text('Hesap')").count() == 1)
    ctx6.close()

    # ---------- 9. Şube adı (TCMB listesi biçimindeki test verisiyle) ----------
    ctx9 = b.new_context(viewport={"width": 393, "height": 852})
    pg9 = ctx9.new_page()
    pg9.goto(URL)
    pg9.wait_for_selector("#iban")
    pg9.fill("#iban", "TR76 0001 0005 1978 6457 8413 26")
    pg9.wait_for_timeout(800)
    line = pg9.locator("[data-testid=branch-line]").inner_text()
    check("Ana Sayfa'da şube adı ve yeri gösterilir", "Örnek Kadıköy Şubesi" in line and "İstanbul" in line, line)
    pg9.goto(URL + "#/iban/TR760001000519786457841326")
    pg9.wait_for_selector("[data-testid=branch-line]")
    check("IBAN detayında şube adı gösterilir", "Örnek Kadıköy Şubesi" in pg9.locator("[data-testid=branch-line]").inner_text())
    pg9.goto(URL)
    pg9.wait_for_selector("#iban")
    pg9.fill("#iban", "TR41 0006 2007 8410 0000 0090 84")
    pg9.wait_for_timeout(800)
    check(
        "listede olmayan şubede yalnızca 'Türkiye' gösterilir (uydurma yok)",
        pg9.locator("[data-testid=branch-line]").inner_text().strip() == "Türkiye",
    )
    ctx9.close()

    b.close()

fails = [n for ok, n in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} geçti")
if fails:
    print("BAŞARISIZ:", json.dumps(fails, ensure_ascii=False))
