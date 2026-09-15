/**
 * Invitación de miembros.
 *
 * El flujo estaba roto en dos sitios a la vez, y ninguno se veía desde fuera:
 *
 *   1. Se generaba un `magicToken` de siete días para el invitado y NO se le
 *      enviaba a ninguna parte. El correo decía "Accede con tu email" y
 *      enlazaba a /login. Para una cuenta recién creada eso es un callejón sin
 *      salida: no tiene contraseña y nadie le ha dado forma de ponerla.
 *
 *   2. El fallo de envío se tragaba con un `catch {}` comentado como
 *      "best-effort", el endpoint devolvía 201 y la interfaz anunciaba
 *      "Invitación enviada" aunque el servidor de correo estuviera caído.
 *
 * En esta suite el correo NO sale —no hay SMTP— así que el segundo caso es el
 * comportamiento por defecto y se puede comprobar tal cual.
 */
import { type Page, type APIRequestContext } from "@playwright/test";
import { test, expect } from "./vigilancia";
import { PrismaClient } from "@prisma/client";
import { E2E } from "./seed-e2e";

const prisma = new PrismaClient();
const BANDEJA = process.env.BANDEJA_URL ?? "http://127.0.0.1:8025";

/**
 * Comprueba que un enlace de creacion de contrasena ya no sirve.
 *
 * Se afirma que la peticion NO tiene exito, no que devuelva un 400 concreto: el
 * endpoint esta limitado por IP y en una suite que lo ejerce varias veces puede
 * responder 429. Un 429 tampoco deja usar el token, pero no demuestra que este
 * muerto, asi que la prueba de verdad es la de la base de datos: `magicToken`
 * en null.
 */
async function enlaceMuerto(api: APIRequestContext, token: string, email: string) {
  const res = await api.post("/api/auth/reset-password", {
    data: { token, password: "IntentoDeReuso-2026!" },
  });
  expect(res.ok(), "el enlace no puede seguir sirviendo").toBeFalsy();

  const usuario = await prisma.user.findUnique({
    where: { email },
    select: { magicToken: true },
  });
  expect(usuario!.magicToken, "el token debe estar anulado").not.toBe(token);
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function login(page: Page, email: string, password = E2E.password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
}

test.afterEach(async ({ request }) => {
  // El estado "averiado" es global al servidor de pruebas: dejarlo puesto haria
  // fallar a la siguiente prueba por un motivo que no es suyo.
  await request.post(`${BANDEJA}/reparar`);
});

test.describe("Invitaciones", () => {
  test("al invitar se emite un token con el que el invitado puede crear su contrasena", async ({
    page,
  }) => {
    const correo = `invitado.${Date.now()}@ejemplo.test`;

    await login(page, E2E.owner);
    await page.goto("/users");
    await page.getByRole("button", { name: /Invitar miembro/ }).click();
    await page.fill('input[type="email"]', correo);
    await page.getByRole("button", { name: "Enviar invitacion", exact: true }).click();

    // El alta se completa aunque el correo no salga: la membresía es correcta.
    await expect(page.locator(`text=${correo}`).first()).toBeVisible({ timeout: 20_000 });

    const invitado = await prisma.user.findUnique({
      where: { email: correo },
      select: { magicToken: true, magicTokenExp: true, passwordHash: true },
    });

    expect(invitado, "el invitado debe existir").not.toBeNull();
    // Sin contraseña: por eso hace falta el token.
    expect(invitado!.passwordHash).toBeNull();
    expect(invitado!.magicToken, "debe emitirse un token de invitacion").toBeTruthy();
    expect(invitado!.magicTokenExp!.getTime()).toBeGreaterThan(Date.now());

    // Y ese token tiene que servir de verdad para entrar. Es el paso que la
    // invitación no ofrecía: el correo no lo llevaba a ninguna parte.
    const contrasena = "ContrasenaDelInvitado-2026!";
    await page.goto(`/reset-password?token=${invitado!.magicToken}`);
    await page.fill('input[name="new-password"]', contrasena);
    await page.fill('input[name="confirm-password"]', contrasena);
    await page.getByRole("button", { name: /Guardar contrase/i }).click();

    // La pantalla confirma el cambio antes de mandar a iniciar sesión.
    await expect(page.getByRole("link", { name: /Iniciar sesi/i })).toBeVisible({
      timeout: 30_000,
    });

    // Y el token queda consumido: un enlace de invitación no es reutilizable.
    const tras = await prisma.user.findUnique({
      where: { email: correo },
      select: { magicToken: true, passwordHash: true },
    });
    expect(tras!.magicToken).toBeNull();
    expect(tras!.passwordHash).not.toBeNull();

    // Entra, y entra dentro de la organización que lo invitó.
    await login(page, correo, contrasena);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("no se anuncia 'Invitacion enviada' cuando el correo no ha salido", async ({
    page,
    request,
  }) => {
    const correo = `sincorreo.${Date.now()}@ejemplo.test`;

    // Se averia el SMTP a proposito. Antes esta prueba dependia de que no
    // hubiera ninguno, lo cual dejo de ser cierto al montar el de pruebas: una
    // prueba no puede apoyarse en que falte una pieza del entorno.
    await request.post(`${BANDEJA}/averiar`);

    await login(page, E2E.owner);
    await page.goto("/users");
    await page.getByRole("button", { name: /Invitar miembro/ }).click();
    await page.fill('input[type="email"]', correo);
    await page.getByRole("button", { name: "Enviar invitacion", exact: true }).click();

    // En esta suite no hay SMTP, así que el envío falla. La interfaz debe
    // decirlo en vez de dar el envío por bueno.
    await expect(page.getByText(/NO se ha podido enviar el correo/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Invitacion enviada/)).toHaveCount(0);
  });

  test("el fallo de correo queda escrito en la auditoria", async ({ page, request }) => {
    const correo = `auditoria.${Date.now()}@ejemplo.test`;

    await request.post(`${BANDEJA}/averiar`);

    await login(page, E2E.owner);
    await page.goto("/users");
    await page.getByRole("button", { name: /Invitar miembro/ }).click();
    await page.fill('input[type="email"]', correo);
    await page.getByRole("button", { name: "Enviar invitacion", exact: true }).click();
    await expect(page.getByText(/NO se ha podido enviar el correo/i)).toBeVisible({
      timeout: 20_000,
    });

    // Quien revise el registro más tarde tiene que poder saber que esa persona
    // nunca recibió el aviso.
    const registro = await prisma.auditLog.findFirst({
      where: { action: "user.invited", details: { contains: correo } },
      orderBy: { createdAt: "desc" },
      select: { details: true },
    });

    expect(registro).not.toBeNull();
    expect(registro!.details).toContain("EL CORREO NO SE PUDO ENVIAR");
  });

  test("el token de invitacion no se devuelve nunca a quien invita", async ({ page }) => {
    // Entregárselo permitiría a un OWNER fijar la contraseña de la cuenta de
    // otra persona y entrar como ella.
    await login(page, E2E.owner);

    const respuesta = await page.request.post("/api/users", {
      data: { email: `fuga.${Date.now()}@ejemplo.test`, role: "OPERATOR" },
    });
    expect(respuesta.status()).toBe(201);

    const cuerpo = await respuesta.json();
    expect(cuerpo).toHaveProperty("emailSent");
    expect(JSON.stringify(cuerpo)).not.toMatch(/magicToken|token/i);
  });
});

test.describe("Ciclo de vida de la invitacion", () => {
  test("reinvitar a quien existe SIN contrasena le emite un enlace nuevo", async ({ page }) => {
    /*
     * Este es el caso que quedaba fuera. Alguien invitado antes que nunca entro
     * sigue en la base de datos sin `passwordHash`. La condicion original era
     * "el usuario es nuevo", asi que a esa persona no se le emitia token: se le
     * daba de alta en la organizacion y se quedaba fuera para siempre.
     */
    const correo = `sinclave.${Date.now()}@ejemplo.test`;

    // Existe, sin contrasena y sin token vivo.
    const usuario = await prisma.user.create({
      data: { email: correo, name: "Sin clave" },
      select: { id: true },
    });
    expect(
      (await prisma.user.findUnique({ where: { id: usuario.id } }))!.magicToken,
    ).toBeNull();

    await login(page, E2E.owner);
    await page.goto("/users");
    await page.getByRole("button", { name: /Invitar miembro/ }).click();
    await page.fill('input[type="email"]', correo);
    await page.getByRole("button", { name: "Enviar invitacion", exact: true }).click();
    // El panel esta siempre en la pagina: la senal de que el alta ha terminado
    // es el mensaje del formulario, no que el panel exista.
    await expect(page.getByText(/ya es miembro|Invitacion enviada/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId(`estado-${correo}`)).toBeVisible({ timeout: 20_000 });

    const tras = await prisma.user.findUnique({
      where: { id: usuario.id },
      select: { magicToken: true, magicTokenExp: true },
    });
    expect(tras!.magicToken, "debe emitirse un enlace nuevo").toBeTruthy();
    expect(tras!.magicTokenExp!.getTime()).toBeGreaterThan(Date.now());

    // Y sirve de verdad.
    const clave = "ClaveDelReinvitado-2026!";
    await page.goto(`/reset-password?token=${tras!.magicToken}`);
    await page.fill('input[name="new-password"]', clave);
    await page.fill('input[name="confirm-password"]', clave);
    await page.getByRole("button", { name: /Guardar contrase/i }).click();
    await expect(page.getByRole("link", { name: /Iniciar sesi/i })).toBeVisible({ timeout: 30_000 });

    await login(page, correo, clave);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("el boton Reenviar invitacion existe y rota el enlace", async ({ page }) => {
    // El aviso de fallo de correo decia "usa Reenviar invitacion" y ese boton
    // no existia en ninguna parte.
    const correo = `reenvio.${Date.now()}@ejemplo.test`;

    await login(page, E2E.owner);
    await page.goto("/users");
    await page.getByRole("button", { name: /Invitar miembro/ }).click();
    await page.fill('input[type="email"]', correo);
    await page.getByRole("button", { name: "Enviar invitacion", exact: true }).click();

    await expect(page.getByText(/ya es miembro|Invitacion enviada/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId(`estado-${correo}`)).toBeVisible({ timeout: 20_000 });

    const antes = (await prisma.user.findUnique({
      where: { email: correo },
      select: { magicToken: true },
    }))!.magicToken;

    await page
      .locator("[data-testid='invitaciones-panel'] div", { hasText: correo })
      .getByRole("button", { name: "Reenviar invitacion" })
      .first()
      .click();

    await expect(page.getByText(/enlace nuevo|reenviada/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const despues = (await prisma.user.findUnique({
      where: { email: correo },
      select: { magicToken: true },
    }))!.magicToken;

    expect(despues, "debe emitirse un token nuevo").toBeTruthy();
    expect(despues, "el enlace anterior debe quedar anulado").not.toBe(antes);

    // El enlace viejo ya no sirve.
    await enlaceMuerto(page.request, antes!, correo);
  });

  test("Revocar quita el acceso y anula el enlace", async ({ page }) => {
    const correo = `revocado.${Date.now()}@ejemplo.test`;

    await login(page, E2E.owner);
    await page.goto("/users");
    await page.getByRole("button", { name: /Invitar miembro/ }).click();
    await page.fill('input[type="email"]', correo);
    await page.getByRole("button", { name: "Enviar invitacion", exact: true }).click();
    // El panel esta siempre en la pagina: la senal de que el alta ha terminado
    // es el mensaje del formulario, no que el panel exista.
    await expect(page.getByText(/ya es miembro|Invitacion enviada/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId(`estado-${correo}`)).toBeVisible({ timeout: 20_000 });

    const token = (await prisma.user.findUnique({
      where: { email: correo },
      select: { magicToken: true },
    }))!.magicToken;
    expect(token).toBeTruthy();

    page.once("dialog", (d) => d.accept());
    await page
      .locator("[data-testid='invitaciones-panel'] div", { hasText: correo })
      .getByRole("button", { name: "Revocar" })
      .first()
      .click();

    await expect(page.getByText(/revocada/i).first()).toBeVisible({ timeout: 20_000 });

    // 1. Sin membresia: el acceso se va de verdad.
    const usuario = await prisma.user.findUnique({
      where: { email: correo },
      select: { id: true, magicToken: true },
    });
    const membresias = await prisma.membership.count({ where: { userId: usuario!.id } });
    expect(membresias, "la membresia debe haberse borrado").toBe(0);

    // 2. El enlace deja de servir, por si acabo en un correo reenviado.
    expect(usuario!.magicToken).toBeNull();
    await enlaceMuerto(page.request, token!, correo);

    // 3. Queda el estado.
    const inv = await prisma.invitation.findFirst({ where: { email: correo } });
    expect(inv!.status).toBe("REVOKED");
    expect(inv!.revokedAt).not.toBeNull();
  });

  test("una invitacion caducada se muestra como caducada y se puede reenviar", async ({
    page,
  }) => {
    const correo = `caducada.${Date.now()}@ejemplo.test`;

    await login(page, E2E.owner);
    const alta = await page.request.post("/api/users", {
      data: { email: correo, role: "OPERATOR" },
    });
    expect(alta.status()).toBe(201);

    // Se envejece la invitacion y su enlace.
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.invitation.updateMany({ where: { email: correo }, data: { expiresAt: ayer } });
    await prisma.user.updateMany({ where: { email: correo }, data: { magicTokenExp: ayer } });

    await page.goto("/users");
    await expect(page.getByTestId(`estado-${correo}`)).toHaveText("Caducada", {
      timeout: 20_000,
    });

    // Reenviar la revive.
    await page
      .locator("[data-testid='invitaciones-panel'] div", { hasText: correo })
      .getByRole("button", { name: "Reenviar invitacion" })
      .first()
      .click();
    await expect(page.getByTestId(`estado-${correo}`)).toHaveText("Pendiente", {
      timeout: 20_000,
    });
  });

  test("aceptar la invitacion la marca aceptada y el token no se reutiliza", async ({
    page,
  }) => {
    const correo = `aceptada.${Date.now()}@ejemplo.test`;

    await login(page, E2E.owner);
    const alta = await page.request.post("/api/users", {
      data: { email: correo, role: "OPERATOR" },
    });
    expect(alta.status()).toBe(201);

    const token = (await prisma.user.findUnique({
      where: { email: correo },
      select: { magicToken: true },
    }))!.magicToken!;

    const clave = "ClaveAceptada-2026!";
    await page.goto(`/reset-password?token=${token}`);
    await page.fill('input[name="new-password"]', clave);
    await page.fill('input[name="confirm-password"]', clave);
    await page.getByRole("button", { name: /Guardar contrase/i }).click();
    await expect(page.getByRole("link", { name: /Iniciar sesi/i })).toBeVisible({ timeout: 30_000 });

    const inv = await prisma.invitation.findFirst({ where: { email: correo } });
    expect(inv!.status).toBe("ACCEPTED");
    expect(inv!.acceptedAt).not.toBeNull();

    // El mismo enlace no puede volver a usarse.
    await enlaceMuerto(page.request, token, correo);
  });

  test("un OPERATOR no puede reenviar ni revocar", async ({ page }) => {
    await login(page, E2E.operador);

    const listado = await page.request.get("/api/invitations");
    expect(listado.status()).toBe(403);

    const inv = await prisma.invitation.findFirst({ select: { id: true } });
    if (inv) {
      const reenvio = await page.request.post(`/api/invitations/${inv.id}/resend`);
      expect(reenvio.status()).toBe(403);
      const revoca = await page.request.delete(`/api/invitations/${inv.id}`);
      expect(revoca.status()).toBe(403);
    }
  });

  test("no se puede tocar una invitacion de otra organizacion", async ({ page }) => {
    await login(page, E2E.owner);

    const ajena = await prisma.invitation.create({
      data: {
        org: { connect: { slug: E2E.orgSuspendidaSlug } },
        email: `ajena.${Date.now()}@ejemplo.test`,
        role: "OPERATOR",
        expiresAt: new Date(Date.now() + 86400000),
      },
      select: { id: true },
    });

    // Mismo 404 que si no existiera: distinguirlos confirmaria su existencia.
    const reenvio = await page.request.post(`/api/invitations/${ajena.id}/resend`);
    expect(reenvio.status()).toBe(404);
    const revoca = await page.request.delete(`/api/invitations/${ajena.id}`);
    expect(revoca.status()).toBe(404);

    const sigue = await prisma.invitation.findUnique({ where: { id: ajena.id } });
    expect(sigue!.status).toBe("PENDING");
  });
});
