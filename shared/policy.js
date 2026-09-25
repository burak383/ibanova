/**
 * Gizlilik politikası ve hesap silme sayfalarının metni: tek kaynak.
 * Hem sunucu (JavaScript'siz, Google Play'in okuyabileceği /gizlilik ve /hesap-silme sayfaları) hem de
 * uygulama içindeki Gizlilik ekranı bu metni kullanır; ikisi birbirinden sapamaz.
 *
 * Uygulamanın gerçekte işlediği verilere göre yazılmış bir taslaktır; hukuki danışmanlık değildir.
 * Yayına almadan önce bir hukukçuya kontrol ettirin. Metni değiştirince SON_GUNCELLEME'yi de güncelleyin.
 */

export const SON_GUNCELLEME = "25 Eylül 2026";

/**
 * @param {{ sorumlu?: string, eposta?: string, appUrl?: string }} info
 * @returns {{ taslak: boolean, sections: { title: string, paragraphs?: string[], items?: string[] }[] }}
 */
export function privacyPolicy({ sorumlu, eposta, appUrl } = {}) {
  const taslak = !sorumlu || !eposta;
  const kim = sorumlu || "[Geliştiricinin / veri sorumlusunun adı ve adresi]";
  const mail = eposta || "[iletişim e-posta adresi]";
  const site = (appUrl || "").replace(/\/+$/, "");
  const silmeSayfasi = site ? `${site}/hesap-silme` : "/hesap-silme";

  return {
    taslak,
    sections: [
      {
        title: "1. Geliştirici ve veri sorumlusu",
        paragraphs: [
          `Ibanova uygulaması ve web sitesi ${kim} tarafından sunulur. Bu kişi, 6698 sayılı Kişisel Verilerin ` +
            `Korunması Kanunu (KVKK) kapsamında veri sorumlusudur. Gizlilikle ilgili tüm sorularınız ve talepleriniz ` +
            `için: ${mail}.`,
          "Bu metin hem Gizlilik Politikası hem de KVKK m.10 kapsamında Aydınlatma Metni yerine geçer.",
        ],
      },
      {
        title: "2. Hesap açmadan kullanım",
        paragraphs: [
          "Hesap açmadan kullandığınızda kontrol ettiğiniz IBAN'lar, kayıtlı IBAN'larınız, adınız ve tercihleriniz " +
            "yalnızca kendi cihazınızda (tarayıcı/uygulama depolamasında) tutulur ve sunucularımıza gönderilmez. " +
            "IBAN doğrulaması cihazınızda yapılır.",
          "Şube adı gösterilebildiği durumlarda sunucuya yalnızca IBAN'daki banka ve şube kodu sorulur; " +
            "IBAN'ın tamamı ve hesap numarası gönderilmez.",
        ],
      },
      {
        title: "3. Hesap açtığınızda toplanan veriler",
        items: [
          "Kimlik ve iletişim: ad soyad, e-posta adresi.",
          "Hesap güvenliği: şifrenizin geri döndürülemez bir özeti (şifrenin kendisi saklanmaz).",
          "Senkronize edilen içerik: kontrol geçmişiniz, kayıtlı IBAN'larınız ve bunlara verdiğiniz etiketler, uygulama tercihleriniz.",
          "İşlem güvenliği: giriş denemelerinde IP adresiniz (hatalı girişleri sınırlamak için, yalnızca sunucu belleğinde ve en çok 30 dakika) ve barındırma sağlayıcısının teknik sunucu kayıtları.",
        ],
      },
      {
        title: "4. Toplamadığımız veriler ve kullanmadığımız izinler",
        items: [
          "Konum, rehber, kamera, mikrofon, fotoğraf veya dosyalarınıza erişmeyiz.",
          "Reklam göstermeyiz; reklam, analiz ya da izleme (tracking) araçları kullanmayız.",
          "Banka hesaplarınıza erişmeyiz; Ibanova yalnızca IBAN'ın yazım doğruluğunu (MOD-97) kontrol eder.",
          "Parmak izi / yüz tanıma kilidi cihazınızın kendi güvenlik sistemiyle çalışır; biyometrik veriniz cihazınızdan çıkmaz ve bize ulaşmaz.",
          "Panodan IBAN algılama yalnızca ayarı açıksa ve cihazınızda çalışır; pano içeriği sunucuya gönderilmez.",
        ],
      },
      {
        title: "5. Kullanım amaçları ve hukuki sebepler",
        paragraphs: [
          "Verilerinizi yalnızca şu amaçlarla kullanırız: hesabınızın oluşturulması ve yönetilmesi, verilerinizin " +
            "cihazlarınız arasında senkronize edilmesi, şifre sıfırlama e-postasının gönderilmesi ve hesabınızın " +
            "güvenliğinin sağlanması.",
          "Hukuki sebepler: bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (KVKK m.5/2-c) ve temel " +
            "hak ve özgürlüklerinize zarar vermemek kaydıyla meşru menfaat (hesap güvenliği, KVKK m.5/2-f).",
        ],
      },
      {
        title: "6. Paylaşım ve yurt dışına aktarım",
        paragraphs: [
          "Verilerinizi satmayız, reklam veya pazarlama amacıyla kimseyle paylaşmayız. Yalnızca uygulamanın " +
            "çalışması için hizmet aldığımız şu sağlayıcıların sunucularında işlenir:",
        ],
        items: [
          "Render Services, Inc. (ABD): uygulamanın ve veritabanının barındırılması; sunucular Frankfurt, Almanya bölgesindedir.",
          "E-posta gönderim sağlayıcısı: yalnızca şifre sıfırlama istediğinizde, e-posta adresiniz ve sıfırlama bağlantısı için.",
        ],
      },
      {
        title: "7. Güvenlik",
        items: [
          "Uygulama ile sunucu arasındaki tüm trafik HTTPS ile şifrelenir.",
          "Şifreler bcrypt ile tek yönlü özet olarak saklanır; oturumlar süreli ve imzalı jetonlarla yönetilir, şifre değişince diğer cihazlardaki oturumlar kapanır.",
          "Art arda hatalı girişler geçici olarak engellenir; şifre sıfırlama bağlantıları tek kullanımlıktır ve 1 saat geçerlidir.",
          "Veritabanına internetten doğrudan erişilemez; yalnızca uygulama sunucusu erişebilir.",
        ],
      },
      {
        title: "8. Saklama süresi ve silme",
        paragraphs: [
          "Hesap verileriniz hesabınız açık kaldığı sürece saklanır. Hesabınızı istediğiniz zaman silebilirsiniz: " +
            "uygulamada Profil > hesap kartı > Hesabı Sil. Uygulamaya erişemiyorsanız " +
            `${silmeSayfasi} sayfasındaki adımları izleyin ya da ${mail} adresine yazın.`,
          "Hesap silindiğinde hesabınız ve sunucudaki tüm senkron verileriniz (ad, e-posta, şifre özeti, geçmiş, " +
            "kayıtlı IBAN'lar, tercihler) veritabanından hemen silinir. Barındırma sağlayıcısının otomatik " +
            "yedeklerindeki kopyalar, yedeklerin kendi saklama süresi dolduğunda kendiliğinden silinir. " +
            "Cihazınızdaki yerel veriler cihazınızda kalır; uygulamada Profil > ⋯ > Verileri sıfırla ile silebilirsiniz.",
        ],
      },
      {
        title: "9. Haklarınız",
        paragraphs: [
          "KVKK m.11 uyarınca; verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, amacına uygun " +
            "kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse " +
            "düzeltilmesini, şartları oluştuğunda silinmesini isteme, bu işlemlerin aktarılan kişilere bildirilmesini " +
            "isteme, otomatik sistemlerle analiz sonucu aleyhinize bir sonuca itiraz etme ve kanuna aykırı işleme " +
            "nedeniyle zarara uğramanız halinde zararın giderilmesini talep etme haklarına sahipsiniz. " +
            `Başvurularınızı ${mail} adresine iletebilirsiniz.`,
        ],
      },
      {
        title: "10. Çocuklar",
        paragraphs: [
          "Ibanova çocuklara yönelik değildir ve bilerek 13 yaşından küçük çocuklardan kişisel veri toplamaz.",
        ],
      },
      {
        title: "11. Değişiklikler",
        paragraphs: [
          `Bu politikada değişiklik olursa güncel metin bu sayfada yayımlanır. Son güncelleme: ${SON_GUNCELLEME}.`,
        ],
      },
    ],
  };
}

/**
 * Google Play'in istediği, uygulama dışından erişilebilen hesap silme sayfası.
 * @param {{ sorumlu?: string, eposta?: string, appUrl?: string }} info
 */
export function deletionPage({ sorumlu, eposta, appUrl } = {}) {
  const kim = sorumlu || "[Geliştiricinin adı]";
  const mail = eposta || "[iletişim e-posta adresi]";
  const site = (appUrl || "").replace(/\/+$/, "") || "";
  return {
    taslak: !sorumlu || !eposta,
    sections: [
      {
        title: "Ibanova hesabınızı nasıl silersiniz?",
        paragraphs: [`Ibanova, ${kim} tarafından geliştirilmiştir. Hesabınızı iki yoldan silebilirsiniz:`],
      },
      {
        title: "1. Uygulamadan ya da web sitesinden (hemen)",
        items: [
          `Ibanova uygulamasını ya da ${site || "web sitesini"} açın ve hesabınıza giriş yapın.`,
          "Alttaki menüden Profil'e dokunun, ardından adınızın ve e-postanızın yazdığı hesap kartına dokunun.",
          "Hesabı Sil'e dokunun, şifrenizi girip Kalıcı Olarak Sil ile onaylayın.",
        ],
      },
      {
        title: "2. E-postayla",
        paragraphs: [
          `Uygulamaya erişemiyorsanız, hesabınızın kayıtlı olduğu e-posta adresinden ${mail} adresine ` +
            `"Hesap silme talebi" konulu bir e-posta gönderin. Talebiniz, hesabın size ait olduğu doğrulandıktan ` +
            "sonra en geç 30 gün içinde yerine getirilir ve size bildirilir.",
        ],
      },
      {
        title: "Neler silinir, neler kalır?",
        items: [
          "Silinir: hesabınız, adınız, e-posta adresiniz, şifre özetiniz, senkronize edilen kontrol geçmişiniz, kayıtlı IBAN'larınız ve tercihleriniz. Silme işlemi veritabanında hemen gerçekleşir.",
          "Kısa süre kalabilir: barındırma sağlayıcısının otomatik yedeklerindeki kopyalar; yedeklerin kendi saklama süresi dolunca kendiliğinden silinir.",
          "Cihazınızda kalır: hesap açmadan da kullanılabilen, yalnızca cihazınızda tutulan yerel veriler. Bunları uygulamada Profil > ⋯ > Verileri sıfırla ile silebilirsiniz.",
        ],
      },
    ],
  };
}
