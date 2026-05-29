/**
 * Whitelist de superadmins (equipo de Heredia) por email.
 *
 * Los endpoints bajo /api/admin/* sirven al equipo interno (gestionar leads,
 * extender trials a clientes, etc.). Antes se protegian solo con
 * `session.user.role === "OWNER"`, lo cual era cross-tenant escalation:
 * cualquier OWNER de cualquier despacho podia dar trial gratuito a otra org.
 *
 * ADMIN_EMAILS env var: lista separada por comas, p.ej.
 *   ADMIN_EMAILS="adrian@heredia.app,otro@heredia.app"
 *
 * Cuando ADMIN_EMAILS no esta definida, el helper devuelve false
 * (fail-closed) y los endpoints admin son inaccesibles. Esto es deliberado:
 * en dev tienes que listar tu email para usarlos.
 */

function parseAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0)
  );
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = parseAdminEmails();
  return allowed.has(email.toLowerCase());
}
