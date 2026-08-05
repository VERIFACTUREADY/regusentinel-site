/**
 * Smoke tests de navegador. E2E de verdad: aplicacion real, PostgreSQL real,
 * Chromium real. No se mockea Prisma, ni NextAuth, ni la sesion.
 *
 * Cubren los flujos que sostienen las correcciones de seguridad: que expulsar
 * a alguien surte efecto de inmediato, que el portal no filtra documentos
 * internos y que una cuenta suspendida sigue pudiendo llegar a facturacion.
 */
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E } from "./seed-e2e";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function login(page: Page, email: string, password = E2E.password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}

test.describe("Autenticacion", () => {
  test("un usuario con credenciales validas entra al panel", async ({ page }) => {
    await login(page, E2E.owner);
    await page.waitForURL("**/dashboard", { timeout: 45_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("unas credenciales incorrectas no dan acceso", async ({ page }) => {
    await login(page, E2E.owner, "contrasena-incorrecta");
    await page.waitForTimeout(3000);
    expect(page.url()).not.toContain("/dashboard");
  });

  test("sin sesion, el panel redirige a login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login**", { timeout: 30_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Expulsion: perdida inmediata de acceso", () => {
  test("un usuario expulsado deja de tener acceso en la siguiente peticion", async ({ page }) => {
    // Este es el flujo que la implementacion anterior no cumplia: el rol y la
    // organizacion vivian en el JWT durante 30 dias, asi que expulsar a
    // alguien no surtia efecto hasta que su token caducaba.
    await login(page, E2E.expulsado);
    await page.waitForURL("**/dashboard", { timeout: 45_000 });

    const usuario = await prisma.user.findUniqueOrThrow({
      where: { email: E2E.expulsado },
    });
    await prisma.membership.deleteMany({ where: { userId: usuario.id } });

    // La cookie de sesion sigue siendo criptograficamente valida, pero la
    // autorizacion relee la membresia: el acceso se corta en la siguiente
    // peticion, no cuando caduque el token dentro de 30 dias.
    const casos = await page.request.get("/api/cases");
    expect(casos.status()).toBe(401);

    const tareas = await page.request.get("/api/tasks/batch", { failOnStatusCode: false });
    expect([401, 404, 405]).toContain(tareas.status());

    // En la interfaz deja de ver los datos de la organizacion. Sigue
    // autenticado como persona (el usuario existe), asi que el layout lo lleva
    // al alta de organizacion en vez de al panel con datos ajenos.
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    expect(await page.getByText(E2E.caseRef).count()).toBe(0);
  });
});

test.describe("Suspension por impago", () => {
  test("un OWNER suspendido ve la pantalla de suspension pero llega a facturacion", async ({ page }) => {
    await login(page, E2E.ownerSuspendido);
    await page.waitForURL("**/dashboard", { timeout: 45_000 });

    // Fuera de facturacion: pantalla de cuenta suspendida.
    await expect(page.getByText(/cuenta suspendida/i)).toBeVisible({ timeout: 20_000 });

    // Facturacion SI es accesible: es la unica via de reactivacion. Si esto
    // fallara, el cliente quedaria encerrado sin poder pagar.
    await page.goto("/billing");
    await expect(page.getByText(/cuenta suspendida/i)).toHaveCount(0);
  });

  test("las APIs privadas responden 402 con la suscripcion suspendida", async ({ page }) => {
    await login(page, E2E.ownerSuspendido);
    await page.waitForURL("**/dashboard", { timeout: 45_000 });

    const casos = await page.request.get("/api/cases");
    expect(casos.status()).toBe(402);

    // Facturacion sigue respondiendo.
    const billing = await page.request.get("/api/billing");
    expect(billing.ok()).toBeTruthy();
  });
});

test.describe("Expedientes", () => {
  test("se puede crear un expediente desde la interfaz", async ({ page }) => {
    await login(page, E2E.owner);
    await page.waitForURL("**/dashboard", { timeout: 45_000 });

    const respuesta = await page.request.post("/api/cases", {
      data: {
        deceasedName: "Nuevo Causante E2E",
        contactName: "Nuevo Contacto",
        contactEmail: "nuevo.e2e@ejemplo.test",
        categories: ["BANCOS"],
        consentAccepted: true,
      },
    });
    expect(respuesta.status()).toBe(201);

    const creado = await respuesta.json();
    expect(creado.ref).toMatch(/^EXP-\d{4}-\d{4}$/);

    await page.goto("/cases");
    // La referencia aparece mas de una vez en la fila; basta con la primera.
    await expect(page.getByText(creado.ref).first()).toBeVisible({ timeout: 20_000 });
  });

  test("dos altas simultaneas obtienen referencias distintas", async ({ page }) => {
    await login(page, E2E.owner);
    await page.waitForURL("**/dashboard", { timeout: 45_000 });

    const alta = (n: number) =>
      page.request.post("/api/cases", {
        data: {
          deceasedName: `Concurrente ${n}`,
          contactName: `Contacto ${n}`,
          contactEmail: `c${n}.e2e@ejemplo.test`,
          categories: ["BANCOS"],
          consentAccepted: true,
        },
      });

    const respuestas = await Promise.all([alta(1), alta(2), alta(3)]);
    for (const r of respuestas) expect(r.status()).toBe(201);

    const refs = await Promise.all(respuestas.map(async (r) => (await r.json()).ref));
    expect(new Set(refs).size).toBe(3);
  });
});

test.describe("Gestion de miembros", () => {
  test("un OPERATOR no puede invitar ni cambiar roles", async ({ page }) => {
    await login(page, E2E.operador);
    await page.waitForURL("**/dashboard", { timeout: 45_000 });

    const invitacion = await page.request.post("/api/users", {
      data: { email: "intruso.e2e@ejemplo.test", role: "OWNER" },
    });
    expect(invitacion.status()).toBe(403);
  });

  test("un OWNER invita y cambia el rol de un miembro", async ({ page }) => {
    await login(page, E2E.owner);
    await page.waitForURL("**/dashboard", { timeout: 45_000 });

    const email = `invitado-${Date.now()}@ejemplo.test`;
    const invitacion = await page.request.post("/api/users", {
      data: { email, role: "VIEWER" },
    });
    expect(invitacion.status()).toBe(201);
    const { userId } = await invitacion.json();

    const cambio = await page.request.patch(`/api/users/${userId}`, {
      data: { role: "OPERATOR" },
    });
    expect(cambio.ok()).toBeTruthy();

    // Un rol inventado se rechaza antes de tocar la base de datos.
    const invalido = await page.request.patch(`/api/users/${userId}`, {
      data: { role: "SUPERUSUARIO" },
    });
    expect(invalido.status()).toBe(400);
  });

  test("no se puede degradar al ultimo OWNER", async ({ page }) => {
    await login(page, E2E.owner);
    await page.waitForURL("**/dashboard", { timeout: 45_000 });

    const propio = await prisma.user.findUniqueOrThrow({ where: { email: E2E.owner } });
    const respuesta = await page.request.patch(`/api/users/${propio.id}`, {
      data: { role: "VIEWER" },
    });
    // Nadie cambia su propio rol, y ademas es el ultimo OWNER.
    expect([403, 409]).toContain(respuesta.status());
  });
});

test.describe("Portal familiar", () => {
  test("sin consentimiento no se accede a los documentos", async ({ page }) => {
    const respuesta = await page.request.get(`/api/portal/${E2E.portalToken}/documents`);
    expect(respuesta.status()).toBe(403);
    expect((await respuesta.json()).consentRequired).toBe(true);
  });

  test("tras aceptar el consentimiento, queda evidencia y el portal abre", async ({ page }) => {
    const aceptacion = await page.request.post(`/api/portal/${E2E.portalToken}/consent`, {
      data: { authorName: "Familiar E2E" },
    });
    expect(aceptacion.ok()).toBeTruthy();

    // La vista principal ya responde (antes daba 403 por falta de consentimiento).
    const principal = await page.request.get(`/api/portal/${E2E.portalToken}`);
    expect(principal.ok()).toBeTruthy();
    expect((await principal.json()).consentAccepted).toBe(true);

    // Y queda evidencia con version y hash del texto aceptado.
    const caso = await prisma.case.findFirstOrThrow({ where: { ref: E2E.caseRef } });
    const evidencia = await prisma.portalConsent.findFirstOrThrow({
      where: { caseId: caso.id },
    });
    expect(evidencia.textHash).toHaveLength(64);
    expect(evidencia.declaredName).toBe("Familiar E2E");
  });

  test("el portal NUNCA expone un documento interno", async ({ page }) => {
    // Se comprueba sobre la vista principal, que devuelve los metadatos de los
    // documentos SIN firmar URLs. El listado con descarga necesita un
    // almacenamiento de objetos real, que este entorno no tiene; su filtro
    // esta cubierto en __tests__/integration/portal-db.test.ts.
    const principal = await page.request.get(`/api/portal/${E2E.portalToken}`);
    expect(principal.ok()).toBeTruthy();

    const cuerpo = await principal.text();
    expect(cuerpo).not.toContain("INFORME-INTERNO-CONFIDENCIAL");
    expect(cuerpo).toContain("certificado-compartido.pdf");
  });

  test("un token revocado deja de funcionar de inmediato", async ({ page }) => {
    const caso = await prisma.case.findFirstOrThrow({ where: { ref: E2E.caseRef } });
    await prisma.case.update({
      where: { id: caso.id },
      data: { portalTokenRevokedAt: new Date() },
    });

    const respuesta = await page.request.get(`/api/portal/${E2E.portalToken}/documents`);
    expect(respuesta.status()).toBe(403);
    expect((await respuesta.json()).error).toMatch(/revocado/i);

    // Se restaura para no afectar a otras ejecuciones.
    await prisma.case.update({
      where: { id: caso.id },
      data: { portalTokenRevokedAt: null },
    });
  });
});

test.describe("Registro", () => {
  test("una cuenta nueva se registra y puede iniciar sesion", async ({ page }) => {
    // No hay pagina /register: el alta se hace contra /api/register. Se
    // ejercita esa ruta y despues el login real desde el navegador.
    const email = `registro-${Date.now()}@ejemplo.test`;

    const alta = await page.request.post("/api/register", {
      data: {
        email,
        password: E2E.password,
        name: "Persona de prueba",
        orgName: `Nueva Gestoria ${Date.now()}`,
        acceptTerms: true,
      },
    });
    expect(alta.ok(), `registro devolvio ${alta.status()}: ${await alta.text()}`).toBeTruthy();

    const creado = await prisma.user.findUnique({ where: { email } });
    expect(creado).not.toBeNull();

    await login(page, email);
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 45_000 });
  });
});
