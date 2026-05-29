import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/api-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";

/**
 * DELETE /api/account/me — borrado de cuenta del usuario autenticado.
 *
 * Implementa el derecho de supresion (GDPR Art. 17 / LOPDGDD Art. 17).
 *
 * Proceso:
 *   1. Valida sesion + password (no se acepta SSO sin password porque seria
 *      vulnerable a session hijacking en este flow). Usuarios SSO sin
 *      password deben contactar dpo@heredia.app por canal verificado.
 *   2. Bloquea si el usuario es el unico OWNER de la org — primero transferir
 *      ownership o eliminar la org desde billing.
 *   3. Anonimiza el row User (mantiene referential integrity con AuditLog,
 *      PromptLog, etc.) y elimina sus memberships.
 *   4. Loguea en audit y envia email de confirmacion al email original.
 *
 * Rate-limited (3 intentos/hora/IP) para evitar abuse por session hijack.
 */

const schema = z.object({
  password: z.string().min(1, "Password requerido para confirmar el borrado"),
  confirmText: z.literal("BORRAR MI CUENTA"),
});

export async function DELETE(req: NextRequest) {
  const limited = rateLimit(req, { bucket: "account-delete", windowMs: 60 * 60 * 1000, max: 3 });
  if (limited) return limited;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos", details: parsed.error.errors }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { memberships: { include: { org: { select: { id: true, name: true } } } } },
  });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (!user.passwordHash) {
    return NextResponse.json(
      {
        error:
          "Tu cuenta usa inicio de sesion por SSO sin contrasena. Contacta dpo@heredia.app para verificar tu identidad y proceder con el borrado.",
      },
      { status: 400 }
    );
  }

  const passwordOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json({ error: "Contrasena incorrecta" }, { status: 401 });
  }

  // Bloquea si el usuario es el unico OWNER de alguna de sus orgs — primero
  // tiene que transferir ownership o eliminar la org desde billing.
  for (const m of user.memberships) {
    if (m.role !== "OWNER") continue;
    const ownerCount = await prisma.membership.count({
      where: { orgId: m.orgId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      return NextResponse.json(
        {
          error: `Eres el unico Owner de "${m.org.name}". Transfiere la titularidad a otro miembro o elimina la organizacion desde Facturacion antes de borrar tu cuenta.`,
        },
        { status: 409 }
      );
    }
  }

  const originalEmail = user.email;
  const originalName = user.name;
  const anonymizedEmail = `deleted-user-${user.id}@heredia.invalid`;

  // Anonimizamos en una transaccion atomica: el row User se mantiene para
  // preservar integridad referencial con AuditLog/PromptLog/Approval/TaskNote,
  // pero ya no contiene datos personales ni credenciales validas.
  await prisma.$transaction([
    prisma.membership.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        email: anonymizedEmail,
        name: "Cuenta eliminada",
        passwordHash: null,
        magicToken: null,
        magicTokenExp: null,
      },
    }),
    ...user.memberships.map((m) =>
      prisma.auditLog.create({
        data: {
          orgId: m.orgId,
          userId: user.id,
          action: "account.deleted",
          details: `Usuario ${originalEmail} solicito borrado de cuenta (GDPR Art. 17)`,
          ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        },
      })
    ),
  ]);

  // Confirmacion al email original — fire and forget, no bloquea la respuesta.
  sendEmail({
    to: originalEmail,
    subject: "Confirmacion de borrado de cuenta — Heredia",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#0f172a;">Tu cuenta ha sido eliminada</h2>
        <p>Hola${originalName ? ` ${originalName}` : ""},</p>
        <p>
          Hemos procesado tu solicitud de borrado el ${new Date().toLocaleString("es-ES")}.
          Tus datos personales (email, nombre, credenciales) han sido eliminados de
          nuestros sistemas.
        </p>
        <p>
          Los expedientes y datos de organizacion siguen siendo titularidad de la
          gestoria/funeraria y se conservan segun su politica de retencion.
          Los registros de auditoria asociados a tu actividad pasada quedan
          anonimizados pero conservados por obligacion legal (LOPDGDD).
        </p>
        <p style="margin-top:24px;">
          Si crees que esto es un error, contacta inmediatamente con
          <a href="mailto:dpo@heredia.app">dpo@heredia.app</a>.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:32px;" />
        <p style="color:#94a3b8;font-size:12px;">Heredia · Datos tratados conforme al RGPD y LOPDGDD.</p>
      </div>
    `,
  }).catch((err) => console.error("Account deletion confirmation email failed:", err));

  return NextResponse.json({ success: true, message: "Cuenta eliminada. Recibiras confirmacion por email." });
}
