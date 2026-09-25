import type { ReactNode } from "react";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { goBack } from "../lib/router";

const SORUMLU = import.meta.env.VITE_VERI_SORUMLUSU?.trim();
const EPOSTA = import.meta.env.VITE_ILETISIM_EPOSTA?.trim();
/** Veri sorumlusu bilgileri derleme sırasında verilmediyse metin taslak olarak işaretlenir. */
export const KVKK_TASLAK = !SORUMLU || !EPOSTA;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 font-heading text-base font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

/**
 * 6698 sayılı KVKK m.10 kapsamında aydınlatma metni. Uygulamanın gerçekte işlediği verilere göre yazılmış bir
 * taslaktır; yayına almadan önce bir hukukçuya kontrol ettirilmelidir.
 */
export default function PrivacyScreen() {
  const sorumlu = SORUMLU || "[Veri sorumlusunun adı/unvanı ve adresi]";
  const eposta = EPOSTA || "[başvuru e-posta adresi]";

  return (
    <div className="min-h-screen w-full bg-background pb-16 font-body text-foreground">
      <header className="px-5 pb-2 pt-12">
        <button
          type="button"
          onClick={() => goBack("/profil")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="Geri dön"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">6698 sayılı KVKK</p>
        <h1 className="mt-1.5 font-heading text-[26px] font-bold tracking-tight">Aydınlatma Metni</h1>
      </header>

      <main className="px-5">
        {KVKK_TASLAK && (
          <div className="mt-3 flex gap-2 rounded-theme border border-destructive/40 bg-destructive/10 p-3 text-xs leading-5 text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Taslak: veri sorumlusu bilgileri henüz girilmedi (VITE_VERI_SORUMLUSU, VITE_ILETISIM_EPOSTA).
          </div>
        )}

        <Section title="1. Veri sorumlusu">
          <p>
            Kişisel verileriniz, veri sorumlusu sıfatıyla <span className="text-foreground">{sorumlu}</span>{" "}
            tarafından aşağıda açıklanan kapsamda işlenir.
          </p>
        </Section>

        <Section title="2. Hesap açmadan kullanım">
          <p>
            Hesap açmadan kullandığınızda kontrol ettiğiniz IBAN&apos;lar, kayıtlı IBAN&apos;larınız, adınız ve
            tercihleriniz yalnızca kendi cihazınızda (tarayıcı depolamasında) tutulur ve sunucularımıza gönderilmez.
            IBAN doğrulaması cihazınızda yapılır.
          </p>
          <p>
            Şube adını gösterebilmek için yalnızca IBAN&apos;daki banka ve şube kodu sunucuya sorulur; IBAN&apos;ın
            tamamı ve hesap numarası gönderilmez.
          </p>
        </Section>

        <Section title="3. Hesap açtığınızda işlenen veriler">
          <ul className="list-disc space-y-1 pl-5">
            <li>Kimlik ve iletişim: ad soyad, e-posta adresi</li>
            <li>Hesap güvenliği: şifrenizin geri döndürülemez özeti (şifrenin kendisi saklanmaz)</li>
            <li>
              Senkronize edilen içerik: kontrol geçmişiniz, kayıtlı IBAN&apos;larınız ve verdiğiniz etiketler,
              uygulama tercihleri
            </li>
            <li>
              İşlem güvenliği: giriş denemelerinde IP adresi (hatalı girişleri sınırlamak için, kısa süreli ve
              bellekte) ve sunucu kayıtları
            </li>
          </ul>
        </Section>

        <Section title="4. İşleme amaçları ve hukuki sebepler">
          <p>
            Verileriniz; hesabınızın oluşturulması ve verilerinizin cihazlarınız arasında senkronize edilmesi,
            şifre sıfırlama e-postasının gönderilmesi ve hesabınızın güvenliğinin sağlanması amaçlarıyla işlenir.
          </p>
          <p>
            Hukuki sebepler: bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (KVKK m.5/2-c) ve
            temel hak ve özgürlüklerinize zarar vermemek kaydıyla veri sorumlusunun meşru menfaati (hesap
            güvenliği, KVKK m.5/2-f).
          </p>
        </Section>

        <Section title="5. Aktarım">
          <p>
            Verileriniz, uygulamanın çalışması için hizmet alınan barındırma, veritabanı ve e-posta gönderim
            sağlayıcılarının sunucularında saklanır. Bu sağlayıcıların sunucuları yurt dışında bulunabilir; bu
            durumda aktarım KVKK m.9&apos;da öngörülen şartlara uygun olarak yapılır. Verileriniz reklam veya
            pazarlama amacıyla üçüncü kişilerle paylaşılmaz.
          </p>
        </Section>

        <Section title="6. Toplama yöntemi ve saklama süresi">
          <p>
            Veriler, uygulama üzerinden elektronik ortamda sizin tarafınızdan girilerek toplanır. Hesabınız
            açık kaldığı sürece saklanır; hesabınızı sildiğinizde (Profil &gt; hesap &gt; Hesabı Sil) sunucudaki
            verileriniz silinir.
          </p>
        </Section>

        <Section title="7. Haklarınız">
          <p>
            KVKK m.11 uyarınca; verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, amacına uygun
            kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse
            düzeltilmesini, şartları oluştuğunda silinmesini isteme, bu işlemlerin aktarılan kişilere bildirilmesini
            isteme, otomatik sistemlerle analiz sonucu aleyhinize bir sonuç çıkmasına itiraz etme ve kanuna aykırı
            işleme nedeniyle zarara uğramanız halinde zararın giderilmesini talep etme haklarına sahipsiniz.
          </p>
          <p>
            Başvurularınızı <span className="text-foreground">{eposta}</span> adresine iletebilirsiniz.
          </p>
        </Section>
      </main>
    </div>
  );
}
