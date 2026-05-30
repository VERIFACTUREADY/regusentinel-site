import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Test policy: cualquier endpoint POST/PUT/PATCH/DELETE bajo src/app/api/
 * debe cumplir UNA de tres condiciones:
 *
 *   1. Esta en EXEMPT_ENDPOINTS porque es legitimamente publico
 *      (rate-limited en lugar de RBAC), parte del flow de auth, cron
 *      gated por CRON_SECRET, admin gated por isSuperAdmin, o accion
 *      sobre los propios datos del user.
 *
 *   2. Importa hasPermission o requirePermission desde "@/lib/rbac".
 *
 *   3. Es un webhook entrante con verificacion de firma propia
 *      (Stripe webhook), tambien listado en EXEMPT_ENDPOINTS.
 *
 * Si un endpoint nuevo no cumple ninguna, este test falla con un
 * mensaje claro. La intencion es prevenir regresiones del tipo "olvide
 * meter hasPermission en mi nuevo endpoint write", que en el pasado nos
 * ha costado 3 bugs cross-tenant.
 *
 * Si un endpoint nuevo es legitimamente sin RBAC, anadirlo a la lista
 * EXEMPT_ENDPOINTS con un comentario explicando por que.
 */

const API_ROOT = join(__dirname, "..", "src", "app", "api");

/**
 * Endpoints exentos de la regla hasPermission, con justificacion.
 * Path relativo desde src/app/api/, sin "/route.ts".
 */
const EXEMPT_ENDPOINTS: Record<string, string> = {
  // ─── Publicos (sin auth, rate-limited) ────────────────
  "public/isd-calc": "Endpoint publico documentado en /docs/api, rate-limited 60/min",
  "public/isd-compare": "Publico, rate-limited 120/min",
  "public/isd-risks": "Publico, rate-limited 60/min",
  "public/modelo650-preview": "Publico, rate-limited 8/min",
  "public/modelo651-preview": "Publico, rate-limited 8/min",
  "public/plantilla-documento": "Publico, rate-limited 12/min",
  "demo-request": "Captura de lead anonima, rate-limited 5/h/IP",
  "health": "Health check sin auth",
  "portal/[token]": "Acceso de familia por token CUID, rate-limited 60/min/IP",
  "portal/[token]/documents": "Sub-endpoint del portal familia, rate-limited 60 lectura / 10 upload por min",
  "portal/[token]/messages": "Sub-endpoint del portal familia, rate-limited 60 lectura / 20 write por min",
  "portal/[token]/consent": "Aceptacion de consentimiento en el portal, rate-limited 10/min",

  // ─── Auth (registro/reset son por definicion sin sesion) ─
  "auth/forgot-password": "No requiere sesion, rate-limited 5/h",
  "auth/reset-password": "No requiere sesion, valida magicToken",
  "auth/[...nextauth]": "Handler de NextAuth (callbacks de OAuth, etc.)",
  "register": "Crea cuenta nueva, sin sesion previa",

  // ─── Webhooks entrantes con firma propia ──────────────
  "billing/webhook": "Stripe webhook con stripe.webhooks.constructEvent + idempotencia StripeEvent",

  // ─── Crons (auth via CRON_SECRET timing-safe) ─────────
  "cron/analyze-all": "validateCronSecret",
  "cron/daily-briefing": "validateCronSecret",
  "cron/demo-reset": "validateCronSecret + DEMO_ENABLED gate",
  "cron/digest-isd": "validateCronSecret",
  "cron/notifications": "validateCronSecret",
  "cron/retention-cleanup": "validateCronSecret",
  "cron/stale-leads": "validateCronSecret",
  "cron/trial-expired": "validateCronSecret",
  "cron/trial-expiring": "validateCronSecret",

  // ─── Admin (whitelist isSuperAdmin) ───────────────────
  "admin/demo-requests/[id]": "isSuperAdmin (equipo Heredia)",
  "admin/orgs/[id]/trial": "isSuperAdmin (equipo Heredia)",

  // ─── Self-service: el user opera sobre SUS datos ──────
  "account/me": "Borrar mi propia cuenta, confirma con password + texto",
  "profile": "Editar mi propio perfil",
  "onboarding/create-organization": "Crear mi org si no tengo (idempotente, gated por membership existente)",
  "onboarding/dismiss": "Descartar mi banner de onboarding",
  "onboarding/seed-sample-case": "Cargar sample case en mi org (verifica ownership)",
  "notifications/dismiss": "Descartar mi notificacion (verificada por orgId)",
  "settings/notifications": "MIS preferencias de notificacion (en membership.notifPrefs)",
  "settings/integrations/test": "Test de ping de integracion outbound, ya valida billing.manage internamente",
};

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listRouteFiles(full));
    } else if (entry === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

function hasWriteMethod(content: string): boolean {
  return /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/.test(content)
    || /export\s+const\s+(POST|PUT|PATCH|DELETE)\s*=/.test(content);
}

function importsRbacGuard(content: string): boolean {
  // Busca importacion explicita de hasPermission o requirePermission desde @/lib/rbac.
  return /from\s+["']@\/lib\/rbac["']/.test(content)
    && /\b(hasPermission|requirePermission)\b/.test(content);
}

function endpointKey(filePath: string): string {
  const rel = relative(API_ROOT, filePath).replace(/\\/g, "/");
  return rel.replace(/\/route\.ts$/, "");
}

describe("RBAC policy: endpoints write requieren hasPermission o estar exentos", () => {
  const allRoutes = listRouteFiles(API_ROOT);
  const writeRoutes = allRoutes.filter((p) => hasWriteMethod(readFileSync(p, "utf8")));

  it("hay al menos 30 endpoints write detectados (sanity check)", () => {
    expect(writeRoutes.length).toBeGreaterThan(30);
  });

  for (const route of writeRoutes) {
    const key = endpointKey(route);
    it(`${key} cumple la policy`, () => {
      const content = readFileSync(route, "utf8");
      const exempt = key in EXEMPT_ENDPOINTS;
      const hasGuard = importsRbacGuard(content);

      if (!exempt && !hasGuard) {
        throw new Error(
          `Endpoint write "${key}" no importa hasPermission/requirePermission de @/lib/rbac ` +
            `y no esta en EXEMPT_ENDPOINTS. Anyade el RBAC check o, si es legitimamente sin RBAC, ` +
            `anyadelo a EXEMPT_ENDPOINTS en __tests__/rbac-policy.test.ts con justificacion.`
        );
      }
    });
  }

  it("no hay endpoints exentos huerfanos (entradas de EXEMPT cuyo route.ts no existe)", () => {
    // El orphan check considera TODAS las rutas (write y read), porque las
    // entradas de EXEMPT documentan endpoints completos — algunos solo tienen
    // GET hoy pero podrian anyadir POST en el futuro y queremos mantener la
    // justificacion.
    const allKeys = new Set(allRoutes.map(endpointKey));
    const orphans = Object.keys(EXEMPT_ENDPOINTS).filter((k) => !allKeys.has(k));
    expect(orphans, `Limpia EXEMPT_ENDPOINTS: ${orphans.join(", ")}`).toHaveLength(0);
  });
});
