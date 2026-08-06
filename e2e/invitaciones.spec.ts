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
import { type Page } from "@playwright/test";
import { test, expect } from "./vigilancia";
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
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
}

test.describe("Invitaciones", () => {
  test("al invitar se emite un token con el que el invitado puede crear su contrasena", async ({
    page,
  }) => {
    const correo = `invitado.${Date.now()}@ejemplo.test`;

    await login(page, E2E.owner);
    await page.goto("/users");
    await page.getByRole("button", { name: /Invitar miembro/ }).click();
    await page.fill('input[type="email"]', correo);
    await page.getByRole("button", { name: "Enviar invitacion" }).click();

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
  }) => {
    const correo = `sincorreo.${Date.now()}@ejemplo.test`;

    await login(page, E2E.owner);
    await page.goto("/users");
    await page.getByRole("button", { name: /Invitar miembro/ }).click();
    await page.fill('input[type="email"]', correo);
    await page.getByRole("button", { name: "Enviar invitacion" }).click();

    // En esta suite no hay SMTP, así que el envío falla. La interfaz debe
    // decirlo en vez de dar el envío por bueno.
    await expect(page.getByText(/NO se ha podido enviar el correo/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Invitacion enviada/)).toHaveCount(0);
  });

  test("el fallo de correo queda escrito en la auditoria", async ({ page }) => {
    const correo = `auditoria.${Date.now()}@ejemplo.test`;

    await login(page, E2E.owner);
    await page.goto("/users");
    await page.getByRole("button", { name: /Invitar miembro/ }).click();
    await page.fill('input[type="email"]', correo);
    await page.getByRole("button", { name: "Enviar invitacion" }).click();
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
