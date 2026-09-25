"""Uçtan uca duman testi (Playwright, Python).  Kullanım: npm run build && npx vite preview --port 4173 & python3 e2e/smoke.py"""
import json, os, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get("E2E_URL", "http://localhost:4173/")
SHOTS = "/tmp/claude-0/shots"
results = []
console_errors = []

def check(name, cond, extra=""):
    results.append((bool(cond), name))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))

def new_page(browser, w=393, h=852, touch=False, perms=True, demo=True):
    ctx = browser.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=touch,
                              permissions=["clipboard-read", "clipboard-write"] if perms else [])
    if demo:  # bu testler örnek verilerle çalışır (gerçek kullanıcılar boş başlar)
        ctx.add_init_script("try{localStorage.setItem('ibanova:demo','1')}catch(e){}")
    pg = ctx.new_page()
    pg.on("console", lambda m: console_errors.append((m.type, m.text)) if m.type == "error" and "ERR_TUNNEL" not in m.text and "Failed to load resource" not in m.text else None)
    pg.on("pageerror", lambda e: console_errors.append(("pageerror", str(e))))
    return ctx, pg

def overflow_x(pg):
    return pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")

def toast_text(pg, timeout_ms=2500):
    """Toast'un görünmesini bekler (asenkron kopyalama/paylaşma).
    Not: page.wait_for_function sayfada eval kullanır; uygulamanın CSP'si eval'i engellediği için
    burada evaluate ile yoklama yapılır (CSP testlerde de açık kalır)."""
    import time as _t
    end = _t.time() + timeout_ms / 1000
    while _t.time() < end:
        t = pg.evaluate("(() => { const e = document.querySelector('[role=status]'); return e ? e.innerText.trim() : '' })()")
        if t:
            return t
        pg.wait_for_timeout(50)
    return ""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"])

    # ---------- 1. Yatay taşma: her ekran, küçük telefonlarda ----------
    for w in (320, 360, 393, 430, 480):
        ctx, pg = new_page(b, w, 780)
        pg.goto(URL); pg.wait_for_selector("#iban")
        for path, sel in [("/", "#iban"), ("/gecmis", "h1:has-text('Geçmiş')"), ("/kayitli", "h1:has-text('Kayıtlı')"),
                          ("/profil", "h1:has-text('Profil')"),
                          ("/iban/TR760001000519786457841326", "#detail-title"),
                          ("/qr/TR760001000519786457841326", "img[alt='IBAN QR kodu']")]:
            pg.evaluate(f"location.hash='#{path}'"); pg.wait_for_selector(sel)
            check(f"no x-overflow {w}px {path}", overflow_x(pg) <= 0, overflow_x(pg))
        # input metni kırpılmıyor mu
        pg.evaluate("location.hash='#/'"); pg.wait_for_selector("#iban")
        sw = pg.evaluate("(()=>{const i=document.querySelector('#iban');return i.scrollWidth-i.clientWidth})()")
        check(f"iban input not clipped {w}px", sw <= 1, sw)
        ctx.close()

    # ---------- 2. Ana Sayfa ----------
    ctx, pg = new_page(b)
    pg.goto(URL); pg.wait_for_selector("#iban")
    check("başlangıçta biçimli örnek IBAN", pg.input_value("#iban") == "TR76 0001 0005 1978 6457 8413 26")
    check("geçerli sonuç", pg.locator("h3:has-text('IBAN doğrulandı')").count() == 1)
    check("QR butonu var", pg.locator("button:has-text('QR Kod Oluştur')").count() == 1)

    def type_iban(v):
        pg.click('button[aria-label="Alanı temizle"]'); pg.type("#iban", v)

    type_iban("")
    check("boş → bekleniyor", pg.locator("text=IBAN bekleniyor").count() == 1)
    check("boş → sonuç kartı yok", pg.locator("h3:has-text('IBAN')").count() == 0)
    pg.type("#iban", "TR76 0001")
    check("eksik → ilerleme", pg.locator("text=8 / 26 karakter").count() == 1)
    type_iban("760001000519786457841326")
    check("TR öneki otomatik", pg.input_value("#iban").startswith("TR76 0001"))
    type_iban("tr76-0001.0005 1978*6457/8413!26abc")
    check("özel karakter/harf kırpılır", pg.input_value("#iban") == "TR76 0001 0005 1978 6457 8413 26", pg.input_value("#iban"))
    type_iban("DE89370400440532013000")
    pg.type("#iban", "0000")
    check("TR dışı ülke mesajı", pg.locator("text=yalnızca Türkiye").count() == 1)
    type_iban("TR15 0009 9001 2345 6789 0044 12")
    check("MOD-97 hatası", pg.locator("h3:has-text('IBAN geçersiz')").count() == 1)
    check("geçersizde QR/Kaydet yok", pg.locator("button:has-text('QR Kod Oluştur')").count() == 0 and pg.locator("main button:has-text(\"IBAN'ı Kaydet\")").count() == 0)
    check("geçersizde bilgi kutuları yok", pg.locator("text=Banka Kodu").count() == 0)

    # imleç ortada düzenleme
    type_iban("TR76 0001 0005 1978 6457 8413 26")
    pg.evaluate("document.querySelector('#iban').setSelectionRange(9,9)")
    pg.keyboard.type("9")
    caret = pg.evaluate("document.querySelector('#iban').selectionStart")
    val = pg.input_value("#iban")
    check("ortaya yazınca imleç eklenen karakterin sonunda", caret == 11 and val == "TR76 0001 9000 5197 8645 7841 32", f"{caret} {val}")
    pg.keyboard.press("Backspace")
    check("geri silince aralar temiz (26. karakter 27. olarak kırpılmıştı)", pg.input_value("#iban") == "TR76 0001 0005 1978 6457 8413 2", pg.input_value("#iban"))
    check("geri silince imleç doğru yerde", pg.evaluate("document.querySelector('#iban').selectionStart") == 9)
    type_iban("TR76 0001 0005 1978 6457 8413 26")

    # kopyala / pano
    pg.click("button:has-text('Kopyala')")
    check("kopyala toast", "IBAN kopyalandı" in toast_text(pg))
    check("pano içeriği", pg.evaluate("navigator.clipboard.readText()") == "TR76 0001 0005 1978 6457 8413 26")
    pg.evaluate("navigator.clipboard.writeText('TR41 0006 2007 8410 0000 0090 84')")
    type_iban("")
    pg.click("button:has-text('Panodan Yapıştır')"); pg.wait_for_timeout(300)
    check("panodan yapıştır", pg.input_value("#iban") == "TR41 0006 2007 8410 0000 0090 84", pg.input_value("#iban") + " | toast=" + toast_text(pg))
    check("garanti", pg.locator("h3:has-text('IBAN doğrulandı')").count() == 1 and pg.locator("p:has-text('Garanti BBVA')").count() >= 1)
    pg.evaluate("navigator.clipboard.writeText('rastgele metin')")
    pg.click("button:has-text('Panodan Yapıştır')"); pg.wait_for_timeout(300)
    check("saçma pano → eksik durumda", pg.locator("text=Yazmaya devam edin").count() == 1 or pg.locator("text=IBAN bekleniyor").count() == 1)
    # paylaş (share yok → kopyalar)
    type_iban("TR76 0001 0005 1978 6457 8413 26")
    pg.click("button:has-text('Paylaş')")
    check("paylaş fallback toast", "kopyaland" in toast_text(pg))
    # zaten kayıtlı
    check("kayıtlı IBAN butonu pasif", pg.locator("main button:has-text('Kayıtlı IBAN')").is_disabled())
    # bildirim
    pg.click('button[aria-label="Bildirimler"]'); check("bildirim toast", "bildirim" in toast_text(pg).lower())
    # avatar → profil
    pg.click('button[aria-label="Profil"]'); pg.wait_for_selector("h1:has-text('Profil')")
    check("avatar profile gider", pg.url.endswith("#/profil"))
    pg.go_back(); pg.wait_for_selector("#iban")
    check("tarayıcı geri → ana sayfa", pg.locator("#iban").count() == 1)
    pg.click('button[aria-label="Geçmiş IBAN ara"]'); pg.wait_for_selector("h1:has-text('Geçmiş')")
    check("arama ikonu geçmişe gider", pg.url.endswith("#/gecmis"))
    # durum korunuyor
    pg.click("nav >> text=Ana Sayfa")
    check("ekran değişince input korunur", pg.input_value("#iban") == "TR76 0001 0005 1978 6457 8413 26")
    ctx.close()

    # ---------- 3. Kaydetme akışı + geçmiş kaydı ----------
    ctx, pg = new_page(b)
    pg.goto(URL); pg.wait_for_selector("#iban")
    pg.click('button[aria-label="Alanı temizle"]'); pg.type("#iban", "TR140009900123456789004412")
    pg.click("main button:has-text(\"IBAN'ı Kaydet\")")
    pg.fill('input[aria-label="Etiket"]', "Test Hesabı"); pg.keyboard.press("Enter")
    check("Enter ile kaydet", "kaydedildi" in toast_text(pg))
    check("kaydedince buton pasif", pg.locator("main button:has-text('Kayıtlı IBAN')").is_disabled())
    pg.click('button[aria-label="Alanı temizle"]'); pg.type("#iban", "TR140009900123456789004412")
    # boş etiket → banka adı
    pg.click("nav >> text=Geçmiş")
    check("geçmişte en üstte ING", pg.locator("article").first.inner_text().startswith("ING"))
    pg.click("button[role=tab]:has-text('Geçerli')")
    check("aynı IBAN tekrar → tek kayıt", pg.locator("article:has-text('4412')").count() == 1)
    pg.click("nav >> text=Kayıtlı IBAN'lar")
    check("etiketli kart", pg.locator("h3:has-text('Test Hesabı')").count() == 1)
    check("özet sayısı 3", pg.locator("text=3 kayıtlı IBAN").count() == 1)
    # kopyala kart
    pg.click('button[aria-label="Test Hesabı IBAN\'ını kopyala"]')
    check("kart kopyala", pg.evaluate("navigator.clipboard.readText()") == "TR14 0009 9001 2345 6789 0044 12")
    # düzenle
    pg.click('button[aria-label="Test Hesabı adını düzenle"]')
    pg.fill('input[aria-label="Etiket"]', "  ")
    check("boş adla kaydet pasif", pg.locator("button:has-text('Kaydet'):visible >> nth=-1").is_disabled())
    pg.fill('input[aria-label="Etiket"]', "Yeni Ad"); pg.keyboard.press("Enter")
    check("ad güncellendi", pg.locator("h3:has-text('Yeni Ad')").count() == 1)
    # ekle sheet doğrulama
    pg.click('button[aria-label="Yeni IBAN ekle"]')
    pg.fill("#new-iban", "TR15 0009 9001 2345 6789 0044 12")
    check("ekle: geçersiz mesaj", pg.locator("text=MOD-97").count() >= 1)
    check("ekle: geçersizde pasif", pg.locator("button:has-text('Kaydet'):visible >> nth=-1").is_disabled())
    pg.fill("#new-iban", "TR76 0001 0005 1978 6457 8413 26")
    pg.click("button:has-text('Kaydet'):visible >> nth=-1")
    check("ekle: mükerrer engellenir", "zaten kayıtlı" in toast_text(pg))
    pg.fill("#new-iban", "TR64 0006 4000 0011 2345 6789 01")  # geçerli mi bilinmiyor: aşağıda kontrol
    ok_valid = pg.locator("text=Geçerli ·").count() == 1
    if not ok_valid:
        pg.fill("#new-iban", "TR41 0006 2007 8410 0000 0090 84")  # Garanti (zaten kayıtlı)
    pg.keyboard.press("Escape")
    check("Esc ile sheet kapanır", pg.locator("[role=dialog]").count() == 0)
    check("sheet kapanınca scroll kilidi kalkar", pg.evaluate("document.body.style.overflow") in ("", "visible"))
    # menü → QR
    pg.click('button[aria-label="Yeni Ad seçenekleri"]'); pg.click("text=QR kod oluştur")
    pg.wait_for_selector("img[alt='IBAN QR kodu']")
    check("kart menüsü → QR", "/qr/TR140009900123456789004412" in pg.url)
    pg.click('button[aria-label="Geri dön"]'); pg.wait_for_selector("h1:has-text('Kayıtlı')")
    # menü → sil, iptal
    pg.click('button[aria-label="Yeni Ad seçenekleri"]'); pg.click("text=Kayıtlılardan sil")
    pg.click("button:has-text('Vazgeç'):visible"); check("silme iptal", pg.locator("h3:has-text('Yeni Ad')").count() == 1)
    pg.click('button[aria-label="Yeni Ad seçenekleri"]'); pg.click("text=Kayıtlılardan sil")
    pg.click("button:has-text('Sil'):visible >> nth=-1")
    check("silindi", pg.locator("h3:has-text('Yeni Ad')").count() == 0 and pg.locator("text=2 kayıtlı IBAN").count() == 1)
    # hepsini sil → boş durum
    ctx.close()

    # ---------- 4. Uzun basma ile çoklu seçim (dokunmatik) ----------
    ctx, pg = new_page(b, touch=True)
    pg.goto(URL + "#/kayitli"); pg.wait_for_selector("article")
    cards = pg.locator("article")
    box = cards.nth(0).bounding_box()
    cdp = ctx.new_cdp_session(pg)
    def touch(x, y, hold):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
        pg.wait_for_timeout(hold)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    touch(box["x"] + 60, box["y"] + 70, 700)
    check("uzun bas → seçim modu", pg.locator("text=1 seçili").count() == 1)
    box2 = cards.nth(1).bounding_box()
    touch(box2["x"] + 60, box2["y"] + 70, 60)
    check("seçimde dokun → 2 seçili", pg.locator("text=2 seçili").count() == 1)
    touch(box2["x"] + 60, box2["y"] + 70, 60)
    check("tekrar dokun → seçim kalkar", pg.locator("text=1 seçili").count() == 1)
    pg.screenshot(path=f"{SHOTS}/20-select.png")
    pg.click("button:has-text('Sil'):visible"); pg.click("button:has-text('Sil'):visible >> nth=-1")
    check("seçilen silindi", pg.locator("article").count() == 1 and pg.locator("text=1 IBAN").count() >= 1)
    # son kaydı da sil → boş durum
    pg.click('button[aria-label*="seçenekleri"]'); pg.click("text=Kayıtlılardan sil"); pg.click("button:has-text('Sil'):visible >> nth=-1")
    check("boş durum", pg.locator("text=Henüz kayıtlı IBAN yok").count() == 1)
    pg.screenshot(path=f"{SHOTS}/21-saved-empty.png")
    ctx.close()

    # ---------- 5. Geçmiş ----------
    ctx, pg = new_page(b)
    pg.goto(URL + "#/gecmis"); pg.wait_for_selector("article")
    check("Bugün/Dün bölümleri", pg.locator("h2:has-text('Bugün')").count() == 1 and pg.locator("h2:has-text('Dün')").count() == 1)
    pg.fill("input[type=search]", "9084"); check("IBAN sonu ara", pg.locator("article").count() == 1)
    pg.fill("input[type=search]", "GARANTİ")  # Türkçe büyük İ
    check("Türkçe büyük/küçük harf", pg.locator("article").count() == 1, pg.locator("article").count())
    pg.fill("input[type=search]", "zzz"); check("sonuç yok durumu", pg.locator("text=Eşleşen IBAN bulunamadı").count() == 1)
    pg.click("text=Filtreyi temizle"); check("filtre temizle", pg.locator("article").count() == 3)
    pg.click("button[role=tab]:has-text('Geçersiz')"); check("geçersiz filtre", pg.locator("article").count() == 1)
    check("geçersizde Kaydet yok", pg.locator("article button:has-text('Kaydet')").count() == 0)
    pg.click("button[role=tab]:has-text('Geçerli')"); check("geçerli filtre", pg.locator("article").count() == 2)
    pg.click("button[role=tab]:has-text('Tümü')")
    # kaydet (garanti kayıtlı, ziraat kayıtlı → 'Kayıtlı')
    check("kayıtlılar 'Kayıtlı' gösterir", pg.locator("article:has-text('Kayıtlı')").count() >= 2)
    # tek kaydı kaldır
    pg.locator('article button[aria-label*="geçmişten kaldır"]').first.click()
    check("geçmişten kaldır", pg.locator("article").count() == 2)
    # detay (geçersiz)
    pg.locator("article:has-text('Geçersiz') button[aria-label*='incele']").click()
    pg.wait_for_selector("#detail-title")
    check("geçersiz detay", pg.locator("h1:has-text('IBAN geçersiz')").count() == 1 and pg.locator("text=Doğrulanmış banka eşleşmesi").count() == 0)
    check("geçersiz detayda QR yok", pg.locator("button:has-text('QR Kod Oluştur')").count() == 0)
    pg.click('button[aria-label="Geri dön"]'); pg.wait_for_selector("h1:has-text('Geçmiş')")
    # ⋯ menü → temizle
    pg.click('button[aria-label="Geçmiş ayarları"]'); pg.click("text=Tüm geçmişi temizle")
    pg.click("button:has-text('Vazgeç'):visible"); check("temizle iptal", pg.locator("article").count() == 2)
    pg.click('button[aria-label="Geçmiş ayarları"]'); pg.click("text=Tüm geçmişi temizle"); pg.click("button:has-text('Temizle')")
    check("geçmiş boş durum", pg.locator("text=Henüz kontrol yok").count() == 1)
    pg.click("button:has-text('IBAN doğrula')"); pg.wait_for_selector("#iban"); check("boş durum → ana sayfa", True)
    ctx.close()

    # ---------- 6. Detay / QR / derin bağlantılar ----------
    ctx, pg = new_page(b)
    pg.goto(URL + "#/iban/TR760001000519786457841326"); pg.wait_for_selector("#detail-title")
    check("derin bağlantı detay", pg.locator("h1:has-text('IBAN doğrulandı')").count() == 1)
    check("bileşenler", all(pg.locator(f"text={t}").count() >= 1 for t in ("00010", "0519", "786457841326")))
    pg.click('button[aria-label="Banka Kodu değerini kopyala"]')
    check("bileşen kopyala", pg.evaluate("navigator.clipboard.readText()") == "00010")
    pg.click("button:has-text('QR Kod Oluştur')"); pg.wait_for_selector("img[alt='IBAN QR kodu']")
    pg.click('button[aria-label="Geri dön"]'); pg.wait_for_selector("#detail-title")
    pg.click('button[aria-label="Geri dön"]')
    pg.wait_for_selector("h1:has-text('Geçmiş')", timeout=3000)
    check("derin bağlantıda geri → sayfadan çıkmaz, yedek sayfaya gider", pg.url.startswith(URL) and pg.url.endswith("#/gecmis"), pg.url)
    # küçük harfli / boşluklu / URL kodlu bağlantı
    pg.goto(URL + "#/iban/tr76%200001%200005%201978%206457%208413%2026"); pg.reload(); pg.wait_for_selector("#detail-title")
    check("kodlanmış bağlantı çözülür", pg.locator("h1:has-text('IBAN doğrulandı')").count() == 1)
    # bozuk bağlantılar
    for h in ("#/qr/TR00", "#/qr/", "#/iban/", "#/olmayan/sayfa", "#/qr/%E0%A4%A"):
        pg.goto(URL + h); pg.reload(); pg.wait_for_timeout(200)
        check(f"bozuk bağlantı çökmez {h}", pg.locator("#root *").count() > 3)
    # QR içeriği: indirilen PNG'yi çöz
    pg.goto(URL + "#/qr/TR760001000519786457841326"); pg.wait_for_selector("img[alt='IBAN QR kodu']")
    with pg.expect_download() as d:
        pg.click("button:has-text('Görsel Olarak Kaydet')")
    d.value.save_as(f"{SHOTS}/qr-with-text.png")
    pg.click('button[role=switch]')  # metni kapat
    with pg.expect_download() as d2:
        pg.click("button:has-text('Görsel Olarak Kaydet')")
    d2.value.save_as(f"{SHOTS}/qr-no-text.png")
    check("QR indirme adı", d.value.suggested_filename == "iban-qr-1326.png")
    pg.click("button:has-text('Paylaş')"); pg.wait_for_timeout(300)
    check("QR paylaş fallback", "kopyaland" in toast_text(pg).lower())
    pg.click('button[aria-label="Daha fazla seçenek"]'); pg.click("text=IBAN detayını aç"); pg.wait_for_selector("#detail-title")
    check("QR menüsü → detay", True)
    ctx.close()

    # ---------- 7. Profil ----------
    ctx, pg = new_page(b)
    pg.goto(URL + "#/profil"); pg.wait_for_selector("h1:has-text('Profil')")
    check("istatistik: kayıtlı 2", pg.locator("p:has-text('kayıtlı IBAN')").count() == 1 and pg.locator("p.tabular-nums >> nth=1").inner_text() == "2")
    sw = pg.locator("button[role=switch]")
    n = sw.count(); print("  switch count", n)
    for i in range(3):
        before = sw.nth(i).get_attribute("aria-checked"); sw.nth(i).click()
        check(f"ayar {i} değişir", sw.nth(i).get_attribute("aria-checked") != before)
    pg.reload(); pg.wait_for_selector("h1:has-text('Profil')")
    check("ayarlar kalıcı", all(pg.locator("button[role=switch]").nth(i).get_attribute("aria-checked") == "false" for i in range(3)))
    # bildirim kapalı → zil noktası
    pg.goto(URL); pg.wait_for_selector("#iban")
    check("bildirim kapalı → nokta yok", pg.locator('button[aria-label="Bildirimler"] span').count() == 0)
    pg.goto(URL + "#/profil"); pg.wait_for_selector("h1:has-text('Profil')")
    # ad düzenle
    pg.click('button[aria-label="Adı düzenle"]'); pg.fill('input[aria-label="Ad Soyad"]', "burak yılmaz"); pg.keyboard.press("Enter")
    check("ad güncellendi", pg.locator("h2:has-text('burak yılmaz')").count() == 1)
    pg.goto(URL); pg.wait_for_selector("#iban")
    check("selamlama adı", pg.locator("h1:has-text('Merhaba, burak')").count() == 1)
    pg.goto(URL + "#/profil")
    pg.click("text=Tercihleri yönet"); pg.wait_for_timeout(600)
    pg.click("text=IBAN doğrulama nasıl çalışır?"); check("yardım açılır", pg.locator("text=MOD-97 algoritması").count() == 1)
    pg.click("text=IBAN doğrulama nasıl çalışır?"); check("yardım kapanır", pg.locator("text=MOD-97 algoritması").count() == 0)
    pg.screenshot(path=f"{SHOTS}/22-profile.png", full_page=True)
    # sıfırla
    pg.click('button[aria-label="Daha fazla seçenek"]'); pg.click("text=Verileri sıfırla"); pg.click("button:has-text('Sıfırla')")
    check("sıfırla: ad ve ayarlar geri", pg.locator("h2:has-text('Ayşe Demir')").count() == 1 and pg.locator("button[role=switch]").first.get_attribute("aria-checked") == "true")
    ctx.close()

    # ---------- 8. Cihaz kilidi (WebAuthn sanal doğrulayıcı) ----------
    ctx, pg = new_page(b)
    cdp = ctx.new_cdp_session(pg)
    cdp.send("WebAuthn.enable")
    auth = cdp.send("WebAuthn.addVirtualAuthenticator", {"options": {"protocol": "ctap2", "transport": "internal", "hasResidentKey": True, "hasUserVerification": True, "isUserVerified": True, "automaticPresenceSimulation": True}})
    pg.goto(URL + "#/profil"); pg.wait_for_selector("h1:has-text('Profil')"); pg.wait_for_timeout(300)
    bio = pg.locator('button[role=switch][aria-label*="Face ID"]')
    check("kilit anahtarı görünür", bio.count() == 1)
    bio.click(); pg.wait_for_timeout(800)
    check("kilit açıldı", bio.get_attribute("aria-checked") == "true", toast_text(pg))
    pg.reload(); pg.wait_for_timeout(1200)
    check("yenileyince doğrulayıp açılır", pg.locator("h1:has-text('Profil')").count() == 1)
    # doğrulama başarısız → kilit ekranı
    cdp.send("WebAuthn.setUserVerified", {"authenticatorId": auth["authenticatorId"], "isUserVerified": False})
    pg.reload(); pg.wait_for_selector("text=Ibanova kilitli"); pg.wait_for_timeout(600)
    check("doğrulama başarısız → kilitli", pg.locator("text=Ibanova kilitli").count() == 1 and pg.locator("text=Tekrar deneyin").count() == 1)
    pg.screenshot(path=f"{SHOTS}/23-lock.png")
    cdp.send("WebAuthn.setUserVerified", {"authenticatorId": auth["authenticatorId"], "isUserVerified": True})
    pg.click("button:has-text('Kilidi aç')"); pg.wait_for_selector("h1:has-text('Profil')")
    check("tekrar dene → açılır", True)
    # kapatmak için doğrulama gerekir
    bio.click(); pg.wait_for_timeout(800)
    check("kilit kapatıldı", bio.get_attribute("aria-checked") == "false")
    # kaçış yolu
    bio.click(); pg.wait_for_timeout(800)
    cdp.send("WebAuthn.setUserVerified", {"authenticatorId": auth["authenticatorId"], "isUserVerified": False})
    pg.reload(); pg.wait_for_selector("text=Ibanova kilitli")
    pg.click("text=Erişemiyor musun?"); pg.wait_for_selector("h1:has-text('Profil')")
    check("kilit sıfırlama kaçış yolu", pg.locator("text=Ibanova kilitli").count() == 0)
    ctx.close()
    # desteklenmeyen cihaz
    ctx, pg = new_page(b)
    pg.add_init_script("delete window.PublicKeyCredential")
    pg.goto(URL + "#/profil"); pg.wait_for_selector("h1:has-text('Profil')"); pg.wait_for_timeout(300)
    check("desteklenmiyor etiketi", pg.locator("text=Desteklenmiyor").count() == 1)
    ctx.close()

    # ---------- 9. Pano algılama (odak olayı) ----------
    ctx, pg = new_page(b)
    pg.goto(URL); pg.wait_for_selector("#iban")
    pg.evaluate("navigator.clipboard.writeText('TR41 0006 2007 8410 0000 0090 84')")
    pg.evaluate("window.dispatchEvent(new Event('focus'))"); pg.wait_for_timeout(300)
    check("panoda IBAN bulundu bandı", pg.locator("text=Panoda IBAN bulundu").count() == 1)
    pg.click("text=Kontrol et"); check("banttan kontrol", pg.input_value("#iban") == "TR41 0006 2007 8410 0000 0090 84" and pg.locator("text=Panoda IBAN bulundu").count() == 0)
    ctx.close()

    # ---------- 10. Kalıcılık ve bozuk depolama ----------
    ctx, pg = new_page(b)
    pg.goto(URL); pg.wait_for_selector("#iban")
    pg.evaluate("localStorage.setItem('ibanova:v1','{bozuk json')"); pg.reload(); pg.wait_for_selector("#iban")
    check("bozuk localStorage → çökmez, örnek veri", pg.locator("h3:has-text('IBAN doğrulandı')").count() == 1)
    pg.evaluate("localStorage.setItem('ibanova:v1', JSON.stringify({history:[{id:'1',iban:'TR76',at:'x'}],saved:[]}))")
    pg.reload(); pg.goto(URL + "#/gecmis"); pg.reload(); pg.wait_for_selector("h1:has-text('Geçmiş')"); pg.wait_for_timeout(200)
    check("bozuk kayıt (geçersiz tarih) çökmez", pg.locator("#root *").count() > 5)
    ctx.close()

    # ---------- 11. Masaüstü + görseller ----------
    ctx, pg = new_page(b, 1280, 800)
    pg.goto(URL); pg.wait_for_selector("#iban"); pg.screenshot(path=f"{SHOTS}/24-desktop.png")
    ctx.close()
    b.close()

fails = [n for ok, n in results if not ok]
print(f"\n{len(results)-len(fails)}/{len(results)} geçti")
print("Konsol hataları:", json.dumps(console_errors, ensure_ascii=False)[:800])
sys.exit(1 if fails else 0)
