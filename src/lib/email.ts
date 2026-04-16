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
 * Alert sent to the internal team when an ISD deadline approaches or is missed.
 */
export async function sendIsdDeadlineAlert({
  email,
  caseRef,
  deceasedName,
  daysRemaining,
  deadline,
  caseUrl,
}: {
  email: string;
  caseRef: string;
  deceasedName: string;
  daysRemaining: number; // negative if already passed
  deadline: Date;
  caseUrl: string;
}) {
  const deadlineStr = deadline.toLocaleDateString("es-ES", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const { subject, headline, color, urgency } = (() => {
    if (daysRemaining < 0) {
      return {
        subject: `[URGENTE] Plazo ISD VENCIDO — expediente ${caseRef}`,
        headline: `El plazo del Modelo 650 ha vencido hace ${Math.abs(daysRemaining)} dias`,
        color: "#b91c1c",
        urgency: "VENCIDO",
      };
    }
    if (daysRemaining <= 1) {
      return {
        subject: `[CRITICO] Plazo ISD manana — expediente ${caseRef}`,
        headline: "El plazo del Modelo 650 vence manana",
        color: "#b91c1c",
        urgency: "CRITICO",
      };
    }
    if (daysRemaining <= 7) {
      return {
        subject: `[ALERTA] Plazo ISD en ${daysRemaining} dias — expediente ${caseRef}`,
        headline: `Quedan ${daysRemaining} dias para el plazo del Modelo 650`,
        color: "#c2410c",
        urgency: "ALERTA",
      };
    }
    if (daysRemaining <= 30) {
      return {
        subject: `Plazo ISD en ${daysRemaining} dias — expediente ${caseRef}`,
        headline: `Quedan ${daysRemaining} dias para presentar el Modelo 650`,
        color: "#ca8a04",
        urgency: "AVISO",
      };
    }
    return {
      subject: `Plazo ISD en 60 dias — expediente ${caseRef}`,
      headline: "Quedan 60 dias para presentar el Modelo 650",
      color: "#1d4ed8",
      urgency: "RECORDATORIO",
    };
  })();

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <p style="background: ${color}; color: white; padding: 6px 12px; display: inline-block; border-radius: 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">
        ${urgency}
      </p>
      <h2 style="color: ${color}; margin-top: 12px;">${headline}</h2>
      <p style="font-size: 15px; color: #1a1a2e;">
        Expediente <strong>${caseRef}</strong> — ${deceasedName}.
      </p>
      <table style="border-collapse: collapse; margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Plazo:</td><td><strong>${deadlineStr}</strong></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Dias restantes:</td><td><strong>${daysRemaining < 0 ? `${daysRemaining} (vencido)` : daysRemaining}</strong></td></tr>
      </table>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${caseUrl}"
           style="background-color: ${color}; color: white; padding: 12px 32px;
                  border-radius: 6px; text-decoration: none; font-weight: 600;">
          Abrir expediente
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 32px;" />
      <p style="color: #999; font-size: 12px;">
        BARITUR PRO — Motor de plazos ISD. Este aviso se genera automaticamente; no respondas a este correo.
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, html });
}

/**
 * Notify the internal sales team when a new demo request arrives.
 * Gated by LEADS_NOTIFY_EMAIL env var.
 */
export async function sendNewLeadNotification({
  name,
  email,
  company,
  phone,
  message,
  source,
  adminUrl,
}: {
  name: string;
  email: string;
  company?: string | null;
  phone?: string | null;
  message?: string | null;
  source?: string | null;
  adminUrl: string;
}) {
  const notifyEmail = process.env.LEADS_NOTIFY_EMAIL;
  if (!notifyEmail) return;

  const sourceLabel: Record<string, string> = {
    landing_hero: "Landing (orgánico)",
    demo_banner: "Demo → Banner (alta intención)",
    demo_dashboard: "Demo → Dashboard",
    pricing: "Página de precios",
  };
  const sourceTxt = source ? (sourceLabel[source] ?? source) : "Desconocido";
  const isHotLead = source === "demo_banner" || source === "demo_dashboard";

  const rows = [
    ["Nombre", name],
    ["Email", `<a href="mailto:${email}">${email}</a>`],
    ["Empresa", company || "—"],
    ["Teléfono", phone || "—"],
    ["Mensaje", message || "—"],
    ["Source", sourceTxt],
  ]
    .map(
      ([k, v]) =>
        `<tr>
          <td style="padding:4px 16px 4px 0;color:#666;font-size:14px;white-space:nowrap;">${k}</td>
          <td style="padding:4px 0;font-size:14px;">${v}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      ${
        isHotLead
          ? `<p style="background:#d97706;color:white;padding:6px 12px;display:inline-block;border-radius:4px;font-size:12px;font-weight:700;letter-spacing:0.5px;">🔥 LEAD CALIENTE — viene de la demo</p>`
          : `<p style="background:#1e40af;color:white;padding:6px 12px;display:inline-block;border-radius:4px;font-size:12px;font-weight:700;letter-spacing:0.5px;">NUEVO LEAD</p>`
      }
      <h2 style="color:#1a1a2e;margin-top:12px;">Nueva solicitud de demo</h2>
      <table style="border-collapse:collapse;margin:16px 0;">
        ${rows}
      </table>
      <p style="text-align:center;margin:32px 0;">
        <a href="${adminUrl}"
           style="background-color:#1e40af;color:white;padding:12px 32px;
                  border-radius:6px;text-decoration:none;font-weight:600;">
          Ver todos los leads →
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin-top:32px;" />
      <p style="color:#999;font-size:12px;">BARITUR PRO · Notificación automática de lead</p>
    </div>
  `;

  return sendEmail({
    to: notifyEmail,
    subject: `${isHotLead ? "🔥 " : ""}Nuevo lead demo — ${name}${company ? ` (${company})` : ""}`,
    html,
  });
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
