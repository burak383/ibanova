/**
 * E-posta gönderimi (şifre sıfırlama için).
 *  - SMTP_HOST tanımlıysa gerçek SMTP ile gönderir (Brevo, Resend SMTP, Gmail uygulama şifresi vb.)
 *  - Tanımlı değilse ve yayında değilsek: e-postayı konsola yazar (geliştirme kolaylığı)
 *  - Tanımlı değilse ve yayındaysak: özellik kapalıdır; uygulama "Şifremi unuttum"u göstermez
 */
export async function createMailer({ env = process.env, production = env.NODE_ENV === "production", log = console } = {}) {
  const from = env.MAIL_FROM || env.SMTP_USER || "Ibanova <no-reply@localhost>";

  if (env.SMTP_HOST) {
    const nodemailer = (await import("nodemailer")).default;
    const port = Number(env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
    return {
      available: true,
      kind: "smtp",
      send: (msg) => transport.sendMail({ from, ...msg }),
    };
  }

  if (!production) {
    return {
      available: true,
      kind: "console",
      async send(msg) {
        log.log(`\n[e-posta → ${msg.to}] ${msg.subject}\n${msg.text}\n`);
      },
    };
  }

  return {
    available: false,
    kind: "none",
    async send() {
      throw new Error("E-posta gönderimi yapılandırılmamış");
    },
  };
}
