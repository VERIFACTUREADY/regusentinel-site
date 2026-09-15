/**
 * El flujo de invitacion TAL Y COMO LO VIVE EL USUARIO.
 *
 * POR QUE ESTA SUITE ES DISTINTA DE invitaciones.spec.ts
 * ------------------------------------------------------
 * Aquella saca el `magicToken` directamente de PostgreSQL. Eso demuestra que el
 * token existe, no que la persona invitada reciba un correo con un enlace que
 * funcione. Entre las dos cosas caben todos los fallos que de verdad ocurren:
 * que el correo no salga, que salga sin enlace, que el enlace apunte a otro
 * sitio, o que lleve un token distinto del que vale.
 *
 * Aqui no se toca la base de datos para obtener el enlace. Se lee del correo
 * recibido, como haria el invitado.
 *
 * El servidor SMTP es `e2e/smtp-de-pruebas.mjs`, que arranca `scripts/e2e.sh`.
 */
import { type Page, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { test, expect } from "./vigilancia";
import { E2E } from "./seed-e2e";

const prisma = new PrismaClient();
const BANDEJA = process.env.BANDEJA_URL ?? "http://127.0.0.1:8025";

test.afterAll(async () => {
  await prisma.$disconnect();
});

interface Mensaje {
  de: string;
  para: string[];
  asunto: string;
  cuerpo: string;
  recibidoEn: string;
}

async function esperarCorreo(
  api: APIRequestContext,
  destinatario: string,
  opciones: { minimo?: number; timeoutMs?: number } = {},
): Promise<Mensaje[]> {
  const minimo = opciones.minimo ?? 1;
  const limite = Date.now() + (opciones.timeoutMs ?? 20_000);

  while (Date.now() < limite) {
    const res = await api.get(`${BANDEJA}/mensajes?para=${encodeURIComponent(destinatario)}`);
    if (res.ok()) {
      const mensajes = (await res.json()) as Mensaje[];
      if (mensajes.length >= minimo) return mensajes;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(
    `No ha llegado ningun correo a ${destinatario} en el tiempo previsto ` +
      `(se esperaban al menos ${minimo}).`,
  );
}

/** Saca el enlace de creacion de contrasena del CUERPO del mensaje. */
function enlaceDelCorreo(mensaje: Mensaje): string {
  const m = mensaje.cuerpo.match(/https?:\/\/[^\s"'<>]*\/reset-password\?token=[A-Za-z0-9]+/);
  if (!m) {
    throw new Error(
      `El correo no contiene ningun enlace para crear la contrasena.\n` +
        `Asunto: ${mensaje.asunto}\nCuerpo:\n${mensaje.cuerpo.slice(0, 500)}`,
    );
  }
  return m[0];
}

async function login(page: Page, email: string, password = E2E.password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}

async function invitarDesdeLaInterfaz(page: Page, correo: string, rol?: string) {
  await page.goto("/users");
  await page.getByRole("button", { name: /Invitar miembro/ }).click();
  await page.fill('input[type="email"]', correo);
  if (rol) await page.selectOption("select", rol);
  await page.getByRole("button", { name: "Enviar invitacion", exact: true }).click();
  await expect(page.getByTestId(`estado-${correo}`)).toBeVisible({ timeout: 20_000 });
}

test.describe("Invitacion recibida por correo", () => {
  test.beforeEach(async ({ request }) => {
    await request.post(`${BANDEJA}/reparar`);
    await request.post(`${BANDEJA}/vaciar`);
  });

  test("el invitado recibe el correo, pincha el enlace, entra, y no puede repetirlo", async ({
    page,
    request,
  }) => {
    const correo = `porcorreo.${Date.now()}@ejemplo.test`;

    await login(page, E2E.owner);
    await page.waitForURL("**/dashboard", { timeout: 45_000 });
    await invitarDesdeLaInterfaz(page, correo, "MANAGER");

    // 1. Llega el correo.
    const [mensaje] = await esperarCorreo(request, correo);
    expect(mensaje.asunto).toContain("Invitacion");

    // 2. El enlace sale DEL MENSAJE, no de la base de datos.
    const enlace = enlaceDelCorreo(mensaje);

    // 3. Se abre en el navegador y se crea la contrasena.
    const clave = "ClaveRecibidaPorCorreo-2026!";
    await page.goto(enlace);
    await page.fill('input[name="new-password"]', clave);
    await page.fill('input[name="confirm-password"]', clave);
    await page.getByRole("button", { name: /Guardar contrase/i }).click();
    await expect(page.getByRole("link", { name: /Iniciar sesi/i })).toBeVisible({
      timeout: 30_000,
    });

    // 4. Entra.
    await login(page, correo, clave);
    await page.waitForURL("**/dashboard", { timeout: 45_000 });

    // 5. Con el rol y la organizacion correctos.
    const miembro = await prisma.membership.findFirst({
      where: { user: { email: correo } },
      select: { role: true, org: { select: { slug: true } } },
    });
    expect(miembro!.role).toBe("MANAGER");
    expect(miembro!.org.slug).toBe(E2E.orgSlug);

    // 6. El enlace no sirve dos veces.
    const token = new URL(enlace).searchParams.get("token")!;
    const repetido = await page.request.post("/api/auth/reset-password", {
      data: { token, password: "OtraDistinta-2026!" },
    });
    expect(repetido.status()).toBe(400);
  });

  test("si el SMTP esta caido no se anuncia el envio, y el reenvio posterior si llega", async ({
    page,
    request,
  }) => {
    const correo = `smtpcaido.${Date.now()}@ejemplo.test`;

    // El servidor de correo rechaza todo.
    await request.post(`${BANDEJA}/averiar`);

    await login(page, E2E.owner);
    await page.waitForURL("**/dashboard", { timeout: 45_000 });
    await invitarDesdeLaInterfaz(page, correo);

    // La interfaz lo dice en vez de dar el envio por bueno.
    await expect(page.getByText(/NO se ha podido enviar el correo/i)).toBeVisible({
      timeout: 20_000,
    });

    const bandeja = await (await request.get(`${BANDEJA}/mensajes?para=${correo}`)).json();
    expect(bandeja.length, "no debe haber salido ningun correo").toBe(0);

    // Se repara el servidor y se reenvia desde el boton de la interfaz.
    await request.post(`${BANDEJA}/reparar`);
    await page
      .locator("[data-testid='invitaciones-panel'] div", { hasText: correo })
      .getByRole("button", { name: "Reenviar invitacion" })
      .first()
      .click();

    await expect(page.getByText(/reenviada/i).first()).toBeVisible({ timeout: 20_000 });

    // Ahora si llega, y su enlace funciona.
    const [mensaje] = await esperarCorreo(request, correo);
    const enlace = enlaceDelCorreo(mensaje);

    const clave = "ClaveTrasReenvio-2026!";
    await page.goto(enlace);
    await page.fill('input[name="new-password"]', clave);
    await page.fill('input[name="confirm-password"]', clave);
    await page.getByRole("button", { name: /Guardar contrase/i }).click();
    await expect(page.getByRole("link", { name: /Iniciar sesi/i })).toBeVisible({
      timeout: 30_000,
    });

    await login(page, correo, clave);
    await page.waitForURL("**/dashboard", { timeout: 45_000 });
  });

  test("el reenvio anula el enlace del correo anterior", async ({ page, request }) => {
    const correo = `dosenlaces.${Date.now()}@ejemplo.test`;

    await login(page, E2E.owner);
    await page.waitForURL("**/dashboard", { timeout: 45_000 });
    await invitarDesdeLaInterfaz(page, correo);

    const [primero] = await esperarCorreo(request, correo);
    const enlaceViejo = enlaceDelCorreo(primero);

    await page
      .locator("[data-testid='invitaciones-panel'] div", { hasText: correo })
      .getByRole("button", { name: "Reenviar invitacion" })
      .first()
      .click();
    await expect(page.getByText(/reenviada/i).first()).toBeVisible({ timeout: 20_000 });

    const mensajes = await esperarCorreo(request, correo, { minimo: 2 });
    const enlaceNuevo = enlaceDelCorreo(mensajes[mensajes.length - 1]);
    expect(enlaceNuevo).not.toBe(enlaceViejo);

    // El primero, que puede haber acabado reenviado a un tercero, ya no sirve.
    await page.goto(enlaceViejo);
    await page.fill('input[name="new-password"]', "IntentoConElViejo-2026!");
    await page.fill('input[name="confirm-password"]', "IntentoConElViejo-2026!");
    await page.getByRole("button", { name: /Guardar contrase/i }).click();
    await expect(page.getByText(/invalido o expirado/i)).toBeVisible({ timeout: 20_000 });

    // El nuevo si.
    const clave = "ElEnlaceBueno-2026!";
    await page.goto(enlaceNuevo);
    await page.fill('input[name="new-password"]', clave);
    await page.fill('input[name="confirm-password"]', clave);
    await page.getByRole("button", { name: /Guardar contrase/i }).click();
    await expect(page.getByRole("link", { name: /Iniciar sesi/i })).toBeVisible({
      timeout: 30_000,
    });
  });
});
