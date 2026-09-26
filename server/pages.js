/**
 * JavaScript gerektirmeyen, sunucunun doğrudan ürettiği sayfalar: /gizlilik ve /hesap-silme.
 * Google Play bu adresleri ister ve denetim araçları sayfayı betik çalıştırmadan okuyabilmelidir.
 */
import { SON_GUNCELLEME, deletionPage, privacyPolicy } from "../shared/policy.js";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Metindeki e-posta ve https adreslerini tıklanabilir yap (önce kaçışla, sonra bağla). */
function linkify(text) {
  return esc(text)
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:])/g, '<a href="$1">$1</a>')
    .replace(/([\w.+-]+@[\w-]+\.[\w.-]+[a-z])/gi, '<a href="mailto:$1">$1</a>');
}

const STYLE = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #0B1216; color: #E6EEF2; font: 16px/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 40px 20px 64px; }
  .eyebrow { color: #34C6B4; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; margin: 0; }
  h1 { font-size: 30px; line-height: 1.2; margin: 8px 0 4px; }
  h2 { font-size: 18px; margin: 32px 0 8px; }
  p, li { color: #B7C5CC; }
  ul { padding-left: 22px; }
  li { margin: 6px 0; }
  a { color: #34C6B4; }
  .meta { color: #7F9099; font-size: 14px; margin: 0 0 8px; }
  .warn { border: 1px solid #D93D4A66; background: #D93D4A1A; color: #FF9AA2; border-radius: 12px; padding: 12px 14px; margin: 20px 0; font-size: 14px; }
  nav { margin-top: 40px; padding-top: 20px; border-top: 1px solid #22313A; font-size: 14px; display: flex; gap: 20px; flex-wrap: wrap; }
`;

function render({ title, eyebrow, doc, nav }) {
  const body = doc.sections
    .map((s) => {
      const ps = (s.paragraphs ?? []).map((p) => `<p>${linkify(p)}</p>`).join("\n");
      const ul = s.items?.length ? `<ul>${s.items.map((i) => `<li>${linkify(i)}</li>`).join("")}</ul>` : "";
      return `<section><h2>${esc(s.title)}</h2>\n${ps}\n${ul}</section>`;
    })
    .join("\n");
  const warn = doc.taslak
    ? `<div class="warn">Taslak: geliştirici / veri sorumlusu bilgileri henüz girilmedi (VITE_VERI_SORUMLUSU, VITE_ILETISIM_EPOSTA).</div>`
    : "";
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(title)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>${STYLE}</style>
</head>
<body>
<main>
<p class="eyebrow">${esc(eyebrow)}</p>
<h1>${esc(title)}</h1>
<p class="meta">Son güncelleme: ${esc(SON_GUNCELLEME)}</p>
${warn}
${body}
<nav>${nav.map(([href, label]) => `<a href="${esc(href)}">${esc(label)}</a>`).join("")}</nav>
</main>
</body>
</html>`;
}

/** @param {{ sorumlu?: string, eposta?: string, appUrl?: string }} info */
export function privacyHtml(info) {
  return render({
    title: "Ibanova Gizlilik Politikası",
    eyebrow: "Gizlilik Politikası ve KVKK Aydınlatma Metni",
    doc: privacyPolicy(info),
    nav: [
      ["/hesap-silme", "Hesap ve veri silme"],
      ["/", "Ibanova'yı aç"],
    ],
  });
}

/** @param {{ sorumlu?: string, eposta?: string, appUrl?: string }} info */
export function deletionHtml(info) {
  return render({
    title: "Ibanova Hesap ve Veri Silme",
    eyebrow: "Hesap silme",
    doc: deletionPage(info),
    nav: [
      ["/gizlilik", "Gizlilik Politikası"],
      ["/", "Ibanova'yı aç"],
    ],
  });
}

/** App Store'un zorunlu tuttuğu destek sayfası (iletişim + sık sorulanlar). */
export function supportHtml({ sorumlu, eposta } = {}) {
  const mail = eposta || "[iletişim e-posta adresi]";
  return render({
    title: "Ibanova Destek",
    eyebrow: "Yardım ve iletişim",
    doc: {
      taslak: !sorumlu || !eposta,
      sections: [
        {
          title: "Bize ulaşın",
          paragraphs: [
            `Soru, öneri ve sorun bildirimleri için ${mail} adresine yazabilirsiniz. ` +
              "Mesajınızda telefon modelinizi ve sorunu kısaca belirtirseniz daha hızlı yardımcı olabiliriz. " +
              "Lütfen e-postanıza IBAN, şifre ya da banka bilgisi eklemeyin.",
          ],
        },
        {
          title: "Ibanova hesabın kime ait olduğunu doğrular mı?",
          paragraphs: [
            "Hayır. Ibanova, IBAN'ın yazım ve biçim doğruluğunu (MOD-97) kontrol eder; hesabın var olduğunu ya da " +
              "kime ait olduğunu doğrulamaz. Para göndermeden önce alıcı adını bankanızın uygulamasında kontrol edin.",
          ],
        },
        {
          title: "Hesap açmam gerekiyor mu?",
          paragraphs: [
            "Hayır. Tüm özellikler hesapsız çalışır ve verileriniz yalnızca cihazınızda kalır. Hesap yalnızca " +
              "verilerinizi cihazlarınız arasında senkronize etmek için gereklidir.",
          ],
        },
        {
          title: "Şifremi unuttum",
          paragraphs: [
            "Giriş ekranındaki \"Şifremi unuttum\" bağlantısını kullanın. Bu seçenek görünmüyorsa " +
              `${mail} adresine hesabınızın e-postasından yazın.`,
          ],
        },
        {
          title: "Hesabımı ve verilerimi nasıl silerim?",
          paragraphs: ["Adımlar için /hesap-silme sayfasına bakın. Gizlilik politikası: /gizlilik"],
        },
      ],
    },
    nav: [
      ["/gizlilik", "Gizlilik Politikası"],
      ["/hesap-silme", "Hesap ve veri silme"],
      ["/", "Ibanova'yı aç"],
    ],
  });
}
