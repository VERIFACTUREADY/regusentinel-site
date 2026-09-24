/**
 * Equipo (/users) en las tres pantallas.
 *
 * La pantalla tiene DOS maquetas: una tabla en escritorio (`hidden md:block`) y
 * tarjetas en movil (`md:hidden`). No es un detalle de estilo: son controles
 * distintos, y una prueba que solo mire la tabla deja la mitad movil sin cubrir.
 *
 * Ningun control roto se sustituye por `page.goto`.
 */
import { type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { test, expect, pantallaUtil } from "./vigilancia";
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

/** Nada puede desbordar a lo ancho: es el sintoma numero uno de movil roto. */
async function sinDesbordeHorizontal(page: Page) {
  const desborde = await page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });
  expect(desborde, "la pagina no debe desplazarse en horizontal").toBeLessThanOrEqual(1);
}

async function orgEquipo(): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { slug: E2E.equipo.slug },
    select: { id: true },
  });
  if (!org) throw new Error("La organizacion de equipo no existe: revisa el sembrado");
  return org.id;
}

async function rolEnBase(email: string): Promise<string | null> {
  const m = await prisma.membership.findFirst({
    where: { orgId: await orgEquipo(), user: { email } },
    select: { role: true },
  });
  return m?.role ?? null;
}

async function abrirEquipo(page: Page) {
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "Equipo" })).toBeVisible({ timeout: 30_000 });
  await pantallaUtil(page);
}

test.describe("Equipo en las tres pantallas", () => {
  test.afterEach(async () => {
    const usuario = await prisma.user.findUnique({
      where: { email: E2E.equipo.cambiante },
      select: { id: true },
    });
    await prisma.membership.updateMany({
      where: { orgId: await orgEquipo(), userId: usuario!.id },
      data: { role: "OPERATOR" },
    });
  });

  test("el listado se abre, se lee y no desborda", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    /*
     * El correo de cada miembro se ve en la maqueta que toque.
     *
     * `.first()` no vale: la tabla de escritorio es `hidden md:block`, asi que
     * en movil SIGUE en el DOM aunque no se vea, y `.first()` cogia justo esa
     * celda oculta. Se pide el elemento VISIBLE, sea la fila de la tabla o la
     * tarjeta del movil.
     */
    await expect(
      page.getByText(E2E.equipo.manager).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(/\d+ de \d+ usuarios/).filter({ visible: true }).first(),
    ).toBeVisible();
    await sinDesbordeHorizontal(page);
  });

  test("el formulario de invitacion se abre y se rellena con el dedo", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    await page.getByRole("button", { name: "Invitar miembro" }).click();

    const correo = page.getByLabel("Email de la persona invitada");
    await expect(correo).toBeEditable({ timeout: 20_000 });
    await correo.fill("movil.invitado@ejemplo.test");
    await page.getByLabel("Rol de la persona invitada").selectOption("OPERATOR");
    await expect(correo).toHaveValue("movil.invitado@ejemplo.test");

    // El boton de enviar cabe y se puede pulsar (no se envia: aqui se comprueba
    // la maqueta, el envio tiene sus propias pruebas).
    await expect(page.getByRole("button", { name: "Enviar invitacion" })).toBeEnabled();
    await sinDesbordeHorizontal(page);
  });

  test("el panel de invitaciones se ve entero", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    await expect(
      page.getByTestId("invitaciones-vacio").filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await sinDesbordeHorizontal(page);
  });

  test("se cambia el rol de un miembro desde el control que toque", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    /*
     * En escritorio el selector vive en la tabla; en movil, en la tarjeta. Los
     * dos llevan el MISMO nombre accesible, asi que la prueba no necesita saber
     * en que maqueta esta: pide el control por su nombre y lo usa.
     */
    const selector = page
      .getByRole("combobox", { name: `Cambiar rol de ${E2E.equipo.cambiante}` })
      .filter({ visible: true })
      .first();
    await expect(selector).toBeVisible({ timeout: 20_000 });
    await selector.selectOption("VIEWER");

    await expect(
      page.getByTestId(`exito-miembro-${E2E.equipo.cambiante}`).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(async () => {
      expect(await rolEnBase(E2E.equipo.cambiante)).toBe("VIEWER");
    }).toPass({ timeout: 20_000 });
    await sinDesbordeHorizontal(page);
  });

  test("el boton de expulsar se puede pulsar y pide confirmacion", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    const boton = page
      .getByRole("button", { name: `Eliminar del equipo a ${E2E.equipo.cambiante}` })
      .filter({ visible: true })
      .first();
    await expect(boton).toBeVisible({ timeout: 20_000 });

    // Se cancela: aqui se comprueba que el control es alcanzable y avisa, no el
    // borrado, que tiene su propia prueba.
    let mensaje = "";
    page.once("dialog", (d) => {
      mensaje = d.message();
      d.dismiss();
    });
    await boton.click();
    await expect(async () => {
      expect(mensaje).toContain("Eliminar");
    }).toPass({ timeout: 10_000 });
    expect(await rolEnBase(E2E.equipo.cambiante)).toBe("OPERATOR");
    await sinDesbordeHorizontal(page);
  });
});
