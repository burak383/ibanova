"""Bu turda düzeltilen dört hatayı hedefleyen ek testler.
Kullanım: npm run build && npx vite preview --port 4173 (arka planda) çalışırken python3 e2e/fixes.py
"""
import json
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get("E2E_URL", "http://localhost:4173/")
results = []


def check(name, cond, extra=""):
    results.append((bool(cond), name))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"])

    # ---------- 1. Bozuk localStorage kaydı sessizce kaybolmuyor ----------
    ctx = b.new_context(viewport={"width": 393, "height": 852})
    ctx.add_init_script("try{localStorage.setItem('ibanova:demo','1')}catch(e){}")
    pg = ctx.new_page()
    pg.goto(URL)
    pg.wait_for_selector("#iban")
    pg.evaluate(
        """() => localStorage.setItem('ibanova:v1', JSON.stringify({
            history: [
                {id:'ok1', iban:'TR760001000519786457841326', at:new Date().toISOString()},
                {id:'bad1', iban:'TR410006200784100000009084', at:'gecersiz-tarih'},
                {id:'bad2', at:new Date().toISOString()},
            ],
            saved: [],
            settings: {clipboard:true,haptics:true,notifications:true,biometric:false},
            profileName: 'Test Kullanıcı',
        }))"""
    )
    pg.goto(URL + "#/gecmis")
    pg.reload()
    pg.wait_for_selector("h1:has-text('Geçmiş')")
    pg.wait_for_timeout(200)
    check("geçerli kayıt korunur, bozuk kayıtlar sessizce ayıklanır", pg.locator("article").count() == 1)
    check("geçerli kayıt Ziraat gösterir", pg.locator("h3:has-text('Ziraat Bankası')").count() == 1)
    ctx.close()

    # ---------- 2. "Yeni IBAN ekle" alanında imleç ortada düzenlemede sona atlamıyor ----------
    ctx = b.new_context(viewport={"width": 393, "height": 852})
    ctx.add_init_script("try{localStorage.setItem('ibanova:demo','1')}catch(e){}")
    pg = ctx.new_page()
    pg.goto(URL + "#/kayitli")
    pg.wait_for_selector("h1:has-text('Kayıtlı')")
    pg.click('button[aria-label="Yeni IBAN ekle"]')
    pg.fill("#new-iban", "TR76 0001 0005 1978 6457 8413 26")
    # 6 alnum karakter sonrasına ("TR7600|010005...") imleç koy ve bir rakam ekle
    pg.evaluate("document.querySelector('#new-iban').setSelectionRange(6,6)")
    pg.keyboard.type("9")
    val = pg.input_value("#new-iban")
    caret = pg.evaluate("document.querySelector('#new-iban').selectionStart")
    # Asıl doğrulanan davranış: imleç eklemeden sonra ortada ("9" rakamından hemen sonra)
    # kalmalı, sona atlamamalı. Tam metindeki boşluk yerleşimi bir uygulama ayrıntısı
    # olduğundan, yalnızca alnum dizisinin doğru yerde "9" içerdiğini, 26 karaktere
    # kesildiğini ve imlecin o eklenen karakterden hemen sonra durduğunu doğruluyoruz.
    alnum = val.replace(" ", "")
    alnum_before_caret = val[:caret].replace(" ", "")
    check(
        "yeni IBAN alanında ortaya ekleme imleci sona atlatmaz",
        len(alnum) == 26 and alnum[5] == "9" and alnum_before_caret.endswith("9") and caret < len(val),
        f"val={val!r} caret={caret}",
    )
    ctx.close()

    # ---------- 3. Sheet: klavye odağı dışarı kaçmaz (odak tuzağı) ----------
    ctx = b.new_context(viewport={"width": 393, "height": 852})
    ctx.add_init_script("try{localStorage.setItem('ibanova:demo','1')}catch(e){}")
    pg = ctx.new_page()
    pg.goto(URL + "#/kayitli")
    pg.wait_for_selector("h1:has-text('Kayıtlı')")
    pg.click('button[aria-label*="seçenekleri"] >> nth=0')
    pg.wait_for_selector("[role=dialog]")
    active_tag = pg.evaluate("document.activeElement && document.activeElement.tagName")
    inside = pg.evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)")
    check("sheet açılınca odak içeri taşınır", inside, active_tag)
    # Tab ile ileri git, son öğeden sonra tekrar ilk öğeye dönmeli (dışarı kaçmamalı)
    n = pg.locator("[role=dialog] button, [role=dialog] input").count()
    for _ in range(n + 2):
        pg.keyboard.press("Tab")
    still_inside = pg.evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)")
    check("Tab ile ardışık gezinmede odak sheet içinde kalır", still_inside)
    pg.keyboard.press("Escape")
    check("Esc ile kapanır", pg.locator("[role=dialog]").count() == 0)
    ctx.close()

    # ---------- 4. QR oluşturma başarısız olursa sonsuz yükleniyor yerine hata + tekrar dene ----------
    ctx = b.new_context(viewport={"width": 393, "height": 852})
    ctx.add_init_script("try{localStorage.setItem('ibanova:demo','1')}catch(e){}")
    pg = ctx.new_page()
    # canvas.getContext'i geçici olarak bozarak QR render'ının başarısız olmasını simüle et
    pg.add_init_script(
        """
        HTMLCanvasElement.prototype.getContext = function () { return null; };
        """
    )
    pg.goto(URL + "#/qr/TR760001000519786457841326")
    pg.wait_for_selector("h1:has-text('QR Kod')")
    pg.wait_for_timeout(600)
    # Not: "Oluşturulamadı" hem hata düğmesinin etiketinde hem de toast bildiriminde
    # geçtiğinden (Playwright'ın text= eşleşmesi alt dizeyi büyük/küçük harf duyarsız
    # arar), en az bir eşleşme yeterli — tam sayı uygulama ayrıntısına bağlıdır.
    check(
        "QR üretimi başarısız → sonsuz yükleniyor değil, hata durumu görünür",
        pg.locator("text=Oluşturulamadı").count() >= 1,
    )
    check("yükleniyor animasyonu kalmaz", pg.locator(".animate-pulse").count() == 0)
    check("kaydet/paylaş butonları devre dışı kalır", pg.locator("button:has-text('Görsel Olarak Kaydet')").is_disabled())
    pg.screenshot(path="/tmp/claude-0/shots/40-qr-error.png")
    b.close()

fails = [n for ok, n in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} geçti")
if fails:
    print("BAŞARISIZ:", json.dumps(fails, ensure_ascii=False))
