import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@baritur.pro";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send a generic email.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams) {
  return transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  });
}

/**
 * Send a portal access link to a case contact.
 */
export async function sendPortalLink({
  email,
  name,
  portalUrl,
}: {
  email: string;
  name: string;
  portalUrl: string;
}) {
  const subject = "Acceso a su portal de seguimiento — BARITUR PRO";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Hola ${name},</h2>
      <p>
        Le proporcionamos acceso a su portal de seguimiento donde podrá consultar
        el estado de su expediente y subir documentación.
      </p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${portalUrl}"
           style="background-color: #6366f1; color: white; padding: 12px 32px;
                  border-radius: 6px; text-decoration: none; font-weight: 600;">
          Acceder al portal
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        Si no solicitó este acceso, puede ignorar este correo.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 32px;" />
      <p style="color: #999; font-size: 12px;">BARITUR PRO — Gestión post-mortem profesional</p>
    </div>
  `;

  return sendEmail({ to: email, subject, html });
}

/**
 * Send a reminder to a contact about missing documents.
 */
export async function sendDocumentReminder({
  email,
  name,
  missingDocs,
  portalUrl,
}: {
  email: string;
  name: string;
  missingDocs: string[];
  portalUrl: string;
}) {
  const docList = missingDocs
    .map((doc) => `<li>${doc}</li>`)
    .join("\n");

  const subject = "Documentación pendiente — BARITUR PRO";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Hola ${name},</h2>
      <p>
        Le recordamos que necesitamos la siguiente documentación para continuar
        con la tramitación de su expediente:
      </p>
      <ul style="line-height: 1.8;">
        ${docList}
      </ul>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${portalUrl}"
           style="background-color: #6366f1; color: white; padding: 12px 32px;
                  border-radius: 6px; text-decoration: none; font-weight: 600;">
          Subir documentación
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        Si ya ha enviado estos documentos, puede ignorar este correo.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 32px;" />
      <p style="color: #999; font-size: 12px;">BARITUR PRO — Gestión post-mortem profesional</p>
    </div>
  `;

  return sendEmail({ to: email, subject, html });
}
