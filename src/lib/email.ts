import nodemailer from "nodemailer";
import { PLAN_LABELS } from "./constants";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@heredia.app";

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
  const subject = "Acceso a su portal de seguimiento — Heredia";
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
      <p style="color: #999; font-size: 12px;">Heredia — Gestión post-mortem profesional</p>
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
        Heredia — Motor de plazos ISD. Este aviso se genera automaticamente; no respondas a este correo.
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
      <p style="color:#999;font-size:12px;">Heredia · Notificación automática de lead</p>
    </div>
  `;

  return sendEmail({
    to: notifyEmail,
    subject: `${isHotLead ? "🔥 " : ""}Nuevo lead demo — ${name}${company ? ` (${company})` : ""}`,
    html,
  });
}

/**
 * Notify an org owner that their trial is about to expire.
 */
export async function sendTrialExpiringNotification({
  orgName,
  ownerEmail,
  ownerName,
  plan,
  daysLeft,
  expiresAt,
}: {
  orgName: string;
  ownerEmail: string;
  ownerName: string;
  plan: string;
  daysLeft: number;
  expiresAt: Date;
}) {
  const expiresStr = expiresAt.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const subject =
    daysLeft <= 1
      ? `Tu trial de Heredia expira manana — ${orgName}`
      : `Tu trial de Heredia expira en ${daysLeft} dias — ${orgName}`;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <p style="background:#c2410c;color:white;padding:6px 12px;display:inline-block;border-radius:4px;font-size:12px;font-weight:700;">TRIAL EXPIRA PRONTO</p>
      <h2 style="color:#1a1a2e;margin-top:12px;">Hola ${ownerName},</h2>
      <p style="font-size:15px;color:#333;">
        Tu periodo de prueba del plan <strong>${plan}</strong> para <strong>${orgName}</strong>
        expira el <strong>${expiresStr}</strong> (${daysLeft === 1 ? "manana" : `en ${daysLeft} dias`}).
      </p>
      <p style="font-size:15px;color:#333;">
        Para seguir usando Heredia sin interrupcion, activa tu suscripcion desde el panel
        de facturacion o contacta con nuestro equipo.
      </p>
      <p style="text-align:center;margin:32px 0;">
        <a href="https://heredia.app/billing"
           style="background-color:#1e40af;color:white;padding:12px 32px;
                  border-radius:6px;text-decoration:none;font-weight:600;">
          Activar suscripcion
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin-top:32px;" />
      <p style="color:#999;font-size:12px;">Heredia — Gestion post-mortem profesional</p>
    </div>
  `;

  return sendEmail({ to: ownerEmail, subject, html });
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

  const subject = "Documentación pendiente — Heredia";
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
      <p style="color: #999; font-size: 12px;">Heredia — Gestión post-mortem profesional</p>
    </div>
  `;

  return sendEmail({ to: email, subject, html });
}

export async function sendWelcomeEmail({
  email,
  name,
  orgName,
  plan,
  trialDays,
}: {
  email: string;
  name: string;
  orgName: string;
  plan: string;
  trialDays: number;
}) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1e40af;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
        <h1 style="color:white;margin:0;font-size:24px;">Heredia</h1>
      </div>
      <div style="padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <h2 style="color:#1a1a2e;margin-top:0;">Bienvenido, ${name}</h2>
        <p style="font-size:15px;color:#333;">
          Tu cuenta para <strong>${orgName}</strong> esta lista.
          Tienes <strong>${trialDays} dias de prueba gratuita</strong> del plan
          <strong>${PLAN_LABELS[plan] ?? plan}</strong> para explorar todas las funcionalidades.
        </p>
        <div style="background:#f0f9ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:24px 0;">
          <p style="margin:0 0 8px;font-weight:600;color:#1e40af;">Primeros pasos:</p>
          <ol style="margin:0;padding-left:20px;font-size:14px;color:#333;line-height:1.8;">
            <li>Crea tu primer expediente desde el Dashboard</li>
            <li>Configura las categorias de tramites que gestionas</li>
            <li>Invita a tu equipo desde Usuarios</li>
            <li>Personaliza tu marca en Ajustes</li>
          </ol>
        </div>
        <p style="text-align:center;margin:32px 0;">
          <a href="https://heredia.app/dashboard"
             style="background-color:#1e40af;color:white;padding:12px 32px;
                    border-radius:6px;text-decoration:none;font-weight:600;">
            Ir al Dashboard
          </a>
        </p>
        <p style="font-size:13px;color:#666;">
          Si tienes dudas, responde a este email o escribe a
          <a href="mailto:soporte@heredia.app" style="color:#1e40af;">soporte@heredia.app</a>.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:32px;" />
        <p style="color:#999;font-size:12px;">Heredia — Gestion post-mortem profesional</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: `Bienvenido a Heredia — Tu trial de ${trialDays} dias ha comenzado`,
    html,
  });
}
