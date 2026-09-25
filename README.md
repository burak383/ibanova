# Ibanova

Türkiye IBAN doğrulama uygulaması. React 18 + TypeScript + Tailwind CSS 3.4 + Vite ön yüz, Express + PostgreSQL hesap sunucusu. Tek bir Render servisi olarak yayınlanır.

## Bilgisayarda çalıştırma (PowerShell)

```powershell
npm install
npm run dev:all   # ön yüz (http://localhost:5173) + hesap sunucusu birlikte
```

Diğer komutlar:

```powershell
npm run dev       # yalnızca ön yüz (hesapsız kullanım tam çalışır)
npm run server    # yalnızca hesap sunucusu
npm run build     # tip kontrolü + üretim derlemesi (dist/)
npm start         # derlenmiş uygulamayı ve API'yi tek serviste sunar (Render'daki gibi)
npm test          # birim ve sunucu testleri
```

Yerelde veritabanı gerekmez: `DATABASE_URL` yoksa hesaplar `server/data.json` dosyasında tutulur. Şifre sıfırlama e-postaları yerelde gönderilmez, terminale yazılır.

## Render'a yükleme

Render, uygulamayı bir GitHub deposundan kurar. Depodaki `render.yaml` web servisini ve PostgreSQL veritabanını birlikte oluşturur.

### 1. Projeyi GitHub'a gönderin

GitHub'da boş bir depo oluşturun (ör. `ibanova`, README eklemeden). Sonra proje klasöründe:

```powershell
git init
git add .
git commit -m "Ibanova ilk sürüm"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/ibanova.git
git push -u origin main
```

`.gitignore` yerel verileri (`server/data.json`, `node_modules`, `dist`) depoya göndermez.

### 2. Render'da Blueprint ile kurun

1. [dashboard.render.com](https://dashboard.render.com) > **New** > **Blueprint**
2. GitHub deponuzu seçin. Render `render.yaml` dosyasını okuyup `ibanova` web servisini ve `ibanova-db` veritabanını gösterir.
3. İstenen değerleri girin:
   - `VITE_VERI_SORUMLUSU`: KVKK aydınlatma metnindeki veri sorumlusu (ad/unvan ve adres)
   - `VITE_ILETISIM_EPOSTA`: KVKK başvuruları için e-posta
   - `SMTP_*` ve `MAIL_FROM`: "Şifremi unuttum" için (bkz. aşağıda). Boş bırakırsanız bu özellik gizlenir, gerisi çalışır.
4. **Apply**. İlk kurulum birkaç dakika sürer; bitince adres `https://ibanova-xxxx.onrender.com` gibi olur.

`IBANOVA_JWT_SECRET` Render tarafından otomatik üretilir, `DATABASE_URL` veritabanına otomatik bağlanır. Sonraki güncellemeler için yalnızca `git push` yeterli; Render kendiliğinden yeniden kurar.

### 3. "Şifremi unuttum" için e-posta (isteğe bağlı)

Herhangi bir SMTP hizmeti çalışır. Render > ibanova > **Environment** bölümünde:

| Değişken | Örnek |
| --- | --- |
| `SMTP_HOST` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | hizmetin verdiği kullanıcı adı |
| `SMTP_PASS` | hizmetin verdiği SMTP anahtarı/şifresi |
| `MAIL_FROM` | `Ibanova <no-reply@alanadiniz.com>` |

Gmail kullanacaksanız normal şifre değil, Google hesabında oluşturulan "uygulama şifresi" gerekir. E-postadaki bağlantılar Render'ın verdiği adresle (`RENDER_EXTERNAL_URL`) oluşturulur; kendi alan adınızı bağlarsanız `APP_URL` değişkenine yazın.

### Render ücretsiz planıyla ilgili bilinmesi gerekenler

- **Veritabanı ücretli planda (`basic-256mb`, yaklaşık 6 $/ay, 1 GB).** Render'ın ücretsiz PostgreSQL'i 30 gün sonra silindiği için kalıcı kullanımda ücretli plan seçildi. Ücretsiz denemek isterseniz `render.yaml`'da `plan: free` yapabilirsiniz; ya da süresiz ücretsiz bir PostgreSQL hizmetinin (ör. Neon) bağlantı adresini `DATABASE_URL` olarak girebilirsiniz.
- Ücretsiz web servisi 15 dakika istek almazsa uyur; ilk açılış yaklaşık 1 dakika sürer. Veriler etkilenmez (veritabanında durur).
- Ücretsiz servisin dosya sistemi kalıcı değildir; bu yüzden sunucu yayında `DATABASE_URL` olmadan başlamayı reddeder.

## Güvenlik ve yayın ayarları

- Yayında (`NODE_ENV=production`) sunucu, `IBANOVA_JWT_SECRET` (en az 32 karakter) ve `DATABASE_URL` olmadan başlamaz.
- Şifreler bcrypt ile saklanır, en az 8 karakterdir. Şifre değişince ya da sıfırlanınca diğer cihazlardaki oturumlar kapanır.
- Aynı e-posta ve IP'den 15 dakikada 5 hatalı girişte giriş 15 dakika kilitlenir. Render proxy'si arkasında gerçek istemci IP'si kullanılır (`trust proxy`).
- Şifre sıfırlama bağlantıları tek kullanımlıktır, 1 saat geçerlidir; e-posta başına saatte en çok 3 bağlantı gönderilir ve yanıt hesabın var olup olmadığını belli etmez.
- Güvenlik başlıkları: Content-Security-Policy (harici betik yok), X-Frame-Options, nosniff, HTTPS'de HSTS.
- Ön yüz ile API aynı adresten sunulduğu için CORS kapalıdır; başka bir alan adından erişim gerekirse `CORS_ORIGINS=https://a.com,https://b.com`.

## KVKK

Profil > "Veri gizliliği ve KVKK" ve kayıt ekranı, uygulamanın gerçekte işlediği verilere göre yazılmış bir aydınlatma metni taslağını gösterir (`src/screens/Gizlilik.tsx`). Veri sorumlusu bilgileri girilmezse sayfada "Taslak" uyarısı görünür. Metin hukuki danışmanlık değildir; yayına almadan önce bir hukukçuya kontrol ettirin. Özellikle sunucuların yurt dışında olması durumunda KVKK m.9 kapsamındaki aktarım şartları ayrıca değerlendirilmelidir.

## Nasıl çalışır

- **Hesap isteğe bağlıdır.** Hesapsız kullanımda tüm veriler yalnızca cihazda kalır. Hesap açılınca geçmiş, kayıtlı IBAN'lar, ayarlar ve ad sunucuyla senkronize edilir; aynı hesapla başka cihazda giriş yapınca veriler oraya da gelir. Çıkış yapmak ya da hesabı silmek cihazdaki veriyi silmez.
- Yeni kullanıcı boş bir uygulamayla başlar. Profil > ⋯ > "Verileri sıfırla" cihazdaki (ve giriş yapıldıysa hesaptaki) verileri temizler.
- Banka kodu tablosu en yaygın bankaları kapsar; listede olmayan kodlar "Bilinmeyen banka" görünür. Banka görselleri harici bir kaynağa bağlı değildir.
- Cihaz kilidi (Face ID / parmak izi / Windows Hello) yalnızca bu cihazda uygulamayı açarken kimlik sorar; HTTPS gerektirir (Render adresi HTTPS'dir).
- **Şube adı:** Sunucu TCMB'nin eski şube listesi adreslerini dener; Eylül 2026 itibarıyla bu adresler açık internette çözümlenmiyor, bu yüzden şube adı görünmez, yalnızca şube kodu gösterilir. Aynı biçimde bir liste dosyası olursa `server/bankaSubeTumListe.xml` olarak koymak (ya da yolunu `IBANOVA_SUBE_XML` ile vermek) yeterli. Listede olmayan şube için uygulama bir şey uydurmaz.

## Testler

`npm test`: birim testleri ve sunucu testleri (hem dosya deposu hem PostgreSQL uyumlu bellek içi veritabanıyla). Gerçek bir PostgreSQL'e karşı da çalıştırmak için `TEST_DATABASE_URL` tanımlayın.

Uçtan uca testler (Playwright, Python), `npm run build` sonrası sunucu çalışırken; adres `E2E_URL` ile verilir (varsayılan `http://localhost:4173/`):

- `e2e/smoke.py`: genel akış, 135 kontrol
- `e2e/fixes.py`: hedefli regresyon kontrolleri, 9 kontrol
- `e2e/hesap.py`: hesap, şifre değişimi, kilit, silme, şube adı, 25 kontrol (sunucuyu `IBANOVA_SUBE_XML=e2e/fixtures/subeler-ornek.xml` ile başlatın)
- `e2e/yayin.py`: boş ilk açılış, harici kaynak yok, KVKK, şifre kuralı, şifremi unuttum, 24 kontrol (sunucu çıktısını `SERVER_LOG` ile verin)

Testler örnek verilerle çalışmak için tarayıcıda `localStorage["ibanova:demo"] = "1"` ayarlar; gerçek kullanıcılar bu modla karşılaşmaz.

## Yapı

- `src/screens/`: Ana Sayfa, Geçmiş, Kayıtlı IBAN'lar, Profil, Hesap, Şifre Sıfırlama, Gizlilik (KVKK), IBAN Detayı, QR Kod
- `src/lib/iban.ts`: MOD-97 doğrulama, biçimlendirme, banka kodu tablosu
- `src/lib/router.ts`: hash tabanlı yönlendirme (`#/gecmis`, `#/iban/<IBAN>`, `#/hesap`, `#/gizlilik`, `#/sifre-sifirla/<jeton>` …)
- `src/store.tsx`: yerel veriler (localStorage) ve isteğe bağlı hesap/senkron durumu
- `src/lib/api.ts`: sunucu istemcisi
- `server/app.js`: API (kayıt/giriş/JWT, şifre değiştirme/sıfırlama, hesap silme, giriş sınırı, şube sorgusu, güvenlik başlıkları, ön yüzü sunma)
- `server/store.js`: kullanıcı deposu (PostgreSQL ya da yerel JSON dosyası)
- `server/mailer.js`: SMTP e-posta gönderimi
- `server/subeler.js`: şube listesi ayrıştırma ve önbellekleme
- `server/index.js`: yapılandırma ve başlatma
- `render.yaml`: Render Blueprint
