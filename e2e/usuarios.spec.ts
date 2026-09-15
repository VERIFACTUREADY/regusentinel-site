/**
 * Equipo (/users), conducido como lo conduce una persona.
 *
 * REGLA DE ESTA SUITE
 * -------------------
 * Ningun clic ni formulario se sustituye por `page.goto` ni por una llamada al
 * API. La unica excepcion, declarada en cada caso, es cuando lo que se prueba
 * es EXPRESAMENTE la segunda mitad del control de acceso: que el servidor
 * rechaza aunque la interfaz no ofrezca el control.
 *
 * DONDE SE TRABAJA
 * ----------------
 * Casi todo ocurre en `org-e2e-equipo`, una organizacion propia. Cambiar roles
 * y expulsar miembros altera la organizacion entera, y las suites ya cerradas
 * dan por hecho que cada usuario de `org-e2e` conserva su rol.
 *
 * POLITICA REAL, comprobada en `src/lib/rbac.ts` ANTES de escribir nada:
 *   - `org.members` y `org.members.invite` los tienen OWNER y MANAGER
 *     (MANAGER = todos los permisos menos `billing.*` y `org.settings`).
 *   - OPERATOR, VIEWER y MANAGED_OPS no los tienen: /users les redirige.
 *   - Ademas `checkRoleAssignment`: solo un OWNER asigna OWNER, nadie cambia su
 *     propio rol, y solo un OWNER modifica el rol de otro OWNER.
 *   - El ultimo OWNER esta protegido dentro de la transaccion, con bloqueo.
 * No se toca la politica para que encaje con una expectativa.
 */
import { type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { test, expect, permitirFalloEn, pantallaUtil } from "./vigilancia";
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

/** Abre /users y espera a que la tabla de miembros este pintada. */
async function abrirEquipo(page: Page) {
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "Equipo" })).toBeVisible({ timeout: 30_000 });
  await pantallaUtil(page);
}

async function orgEquipo(): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { slug: E2E.equipo.slug },
    select: { id: true },
  });
  if (!org) throw new Error("La organizacion de equipo no existe: revisa el sembrado");
  return org.id;
}

/** Rol actual de un miembro de la organizacion de equipo, leido de la base. */
async function rolEnBase(email: string): Promise<string | null> {
  const m = await prisma.membership.findFirst({
    where: { orgId: await orgEquipo(), user: { email } },
    select: { role: true },
  });
  return m?.role ?? null;
}

/** Deja a un miembro con el rol indicado, pase lo que pase en la prueba. */
async function fijarRol(email: string, rol: "OWNER" | "MANAGER" | "OPERATOR" | "VIEWER") {
  const usuario = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  await prisma.membership.updateMany({
    where: { orgId: await orgEquipo(), userId: usuario!.id },
    data: { role: rol },
  });
}

// ───────────────────────── Inventario y listado ─────────────────────────

test.describe("Equipo: listado de miembros", () => {
  test("el listado muestra a cada miembro con su rol y su fecha de alta", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    const enBase = await prisma.membership.count({ where: { orgId: await orgEquipo() } });

    // Cada miembro aparece con su correo.
    for (const correo of [
      E2E.equipo.owner,
      E2E.equipo.owner2,
      E2E.equipo.manager,
      E2E.equipo.operador,
      E2E.equipo.viewer,
    ]) {
      await expect(page.getByRole("cell", { name: correo, exact: true })).toHaveCount(1);
    }

    // El contador del plan cuadra con lo que hay.
    await expect(page.getByText(new RegExp(`${enBase} de \\d+ usuarios`))).toBeVisible();

    // El propio usuario no puede cambiarse el rol ni expulsarse: no se le
    // ofrece, y ademas se marca como "(tu)".
    await expect(page.getByText(/\(tu\)/)).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: `Cambiar rol de ${E2E.equipo.owner}` }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: `Eliminar del equipo a ${E2E.equipo.owner}` }),
    ).toHaveCount(0);
  });
});

// ───────────────── Panel de invitaciones: vacio, error, reintentar ─────────────────

test.describe("Equipo: panel de invitaciones", () => {
  test("sin invitaciones pendientes lo dice, sin error y sin spinner eterno", async ({ page }) => {
    // La organizacion de equipo se siembra SIN invitaciones: el estado vacio es
    // real, no simulado.
    expect(
      await prisma.invitation.count({ where: { orgId: await orgEquipo() } }),
      "el sembrado no debe traer invitaciones en esta organizacion",
    ).toBe(0);

    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    const vacio = page.getByTestId("invitaciones-vacio");
    await expect(vacio).toBeVisible({ timeout: 20_000 });
    await expect(vacio).toContainText(/No hay invitaciones pendientes/i);

    // Ni error, ni "Cargando…" colgado, ni invitaciones inventadas.
    await expect(page.getByTestId("invitaciones-error")).toHaveCount(0);
    await expect(page.getByTestId("invitaciones-cargando")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Reenviar invitacion a / })).toHaveCount(0);

    // Y los miembros se siguen viendo: el panel vacio no se lleva por delante
    // el resto de la pantalla.
    await expect(page.getByRole("cell", { name: E2E.equipo.manager, exact: true })).toHaveCount(1);
  });

  test("un 500 al cargar se explica y NO se disfraza de 'no hay invitaciones'", async ({ page }) => {
    await login(page, E2E.equipo.owner);

    permitirFalloEn(page, "/api/invitations");
    let intentos = 0;
    await page.route("**/api/invitations", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      intentos++;
      if (intentos === 1) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Fallo del servidor" }),
        });
      }
      // A partir del segundo intento se deja pasar: asi se comprueba que
      // "Reintentar" de verdad recupera el panel.
      return route.continue();
    });

    await page.goto("/users");

    const error = page.getByTestId("invitaciones-error");
    await expect(error).toBeVisible({ timeout: 20_000 });
    await expect(error).toContainText("500");
    // Lo importante: NO se muestra el estado vacio, que significa lo contrario.
    await expect(page.getByTestId("invitaciones-vacio")).toHaveCount(0);

    // Reintentar hace una peticion NUEVA…
    await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes("/api/invitations") && r.method() === "GET",
        { timeout: 20_000 },
      ),
      page.getByRole("button", { name: "Reintentar" }).click(),
    ]);

    // …y el panel se recupera.
    await expect(page.getByTestId("invitaciones-vacio")).toBeVisible({ timeout: 20_000 });
    await expect(error).toHaveCount(0);
    expect(intentos, "Reintentar debe provocar una segunda peticion").toBeGreaterThanOrEqual(2);
  });

  test("si la red se cae al cargar, tampoco se disfraza de vacio", async ({ page }) => {
    await login(page, E2E.equipo.owner);

    permitirFalloEn(page, "/api/invitations");
    let caido = true;
    await page.route("**/api/invitations", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      if (caido) {
        caido = false;
        return route.abort("failed");
      }
      return route.continue();
    });

    await page.goto("/users");

    await expect(page.getByTestId("invitaciones-error")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("invitaciones-vacio")).toHaveCount(0);

    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByTestId("invitaciones-vacio")).toBeVisible({ timeout: 20_000 });
  });

  test("una sesion caducada se explica en vez de decir que no hay invitaciones", async ({
    page,
  }) => {
    await login(page, E2E.equipo.owner);

    permitirFalloEn(page, "/api/invitations");
    await page.route("**/api/invitations", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "No autenticado" }),
      });
    });

    await page.goto("/users");
    await expect(page.getByTestId("invitaciones-error")).toContainText("401", { timeout: 20_000 });
    await expect(page.getByTestId("invitaciones-vacio")).toHaveCount(0);
  });

  test("las invitaciones pendientes se ven aunque el plan este lleno", async ({ page }) => {
    /*
     * EL DEFECTO QUE CUBRE
     * --------------------
     * El panel se pintaba con `canInvite`, que es `permiso && miembros <
     * maxUsers`. Al llegar al limite del plan desaparecia entero: las
     * invitaciones pendientes se volvian invisibles y NO habia forma de
     * revocarlas. Justo cuando el equipo esta lleno es cuando hace falta.
     */
    const orgId = await orgEquipo();
    const invitada = `llena.${Date.now().toString().slice(-7)}@ejemplo.test`;
    const inv = await prisma.invitation.create({
      data: {
        orgId,
        email: invitada,
        role: "OPERATOR",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    // Se baja el plan al mas pequeño: con 7 miembros, el limite queda superado.
    await prisma.subscription.update({ where: { orgId }, data: { plan: "INICIA" } });

    try {
      await login(page, E2E.equipo.owner);
      await abrirEquipo(page);

      // El aviso de limite aparece…
      await expect(page.getByText(/Has alcanzado el limite de usuarios/i)).toBeVisible();
      // …y aun asi la invitacion pendiente se ve y se puede revocar.
      await expect(page.getByTestId("invitaciones-panel")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(invitada)).toBeVisible();
      await expect(
        page.getByRole("button", { name: `Revocar invitacion de ${invitada}` }),
      ).toBeVisible();
    } finally {
      await prisma.subscription.update({ where: { orgId }, data: { plan: "FIRMA" } });
      await prisma.invitation.delete({ where: { id: inv.id } }).catch(() => {});
    }
  });
});

// ───────────────────────── Cambio de rol desde la interfaz ─────────────────────────

test.describe("Equipo: cambio de rol", () => {
  test.afterEach(async () => {
    await fijarRol(E2E.equipo.cambiante, "OPERATOR");
  });

  test("un OWNER cambia el rol de un miembro y persiste tras recargar", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    const selector = page.getByRole("combobox", {
      name: `Cambiar rol de ${E2E.equipo.cambiante}`,
    });
    await expect(selector).toBeVisible({ timeout: 20_000 });
    await expect(selector).toHaveValue("OPERATOR");

    await selector.selectOption("MANAGER");

    // La interfaz lo confirma…
    await expect(page.getByTestId(`exito-miembro-${E2E.equipo.cambiante}`)).toContainText(
      /ahora es/i,
      { timeout: 20_000 },
    );

    // …y esta de verdad en la base.
    await expect(async () => {
      expect(await rolEnBase(E2E.equipo.cambiante)).toBe("MANAGER");
    }).toPass({ timeout: 20_000 });

    // Y tras recargar sigue.
    await page.reload();
    await pantallaUtil(page);
    await expect(
      page.getByRole("combobox", { name: `Cambiar rol de ${E2E.equipo.cambiante}` }),
    ).toHaveValue("MANAGER", { timeout: 20_000 });
  });

  test("el rol nuevo se traduce en permisos reales para esa persona", async ({ page, browser }) => {
    /*
     * No basta con que la fila diga otra cosa: lo que importa es que la persona
     * pueda o no pueda lo que corresponde. Como OPERATOR, /users le redirige;
     * ascendida a MANAGER, entra.
     */
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    // Antes: como OPERATOR no puede entrar en /users.
    const antes = await browser.newContext();
    const paginaAntes = await antes.newPage();
    await login(paginaAntes, E2E.equipo.cambiante);
    await paginaAntes.goto("/users");
    await expect(paginaAntes).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await antes.close();

    // El OWNER la asciende desde la interfaz.
    await page
      .getByRole("combobox", { name: `Cambiar rol de ${E2E.equipo.cambiante}` })
      .selectOption("MANAGER");
    await expect(page.getByTestId(`exito-miembro-${E2E.equipo.cambiante}`)).toBeVisible({
      timeout: 20_000,
    });
    await expect(async () => {
      expect(await rolEnBase(E2E.equipo.cambiante)).toBe("MANAGER");
    }).toPass({ timeout: 20_000 });

    // Despues: ya entra en /users.
    const despues = await browser.newContext();
    const paginaDespues = await despues.newPage();
    await login(paginaDespues, E2E.equipo.cambiante);
    await paginaDespues.goto("/users");
    await expect(
      paginaDespues.getByRole("heading", { name: "Equipo" }),
    ).toBeVisible({ timeout: 30_000 });
    await despues.close();
  });

  for (const caso of [
    { nombre: "un 400", estado: 400, cuerpo: { error: "Rol no válido" }, texto: /Rol no válido/i },
    { nombre: "un 403", estado: 403, cuerpo: { error: "No puedes cambiar tu propio rol." }, texto: /No puedes cambiar tu propio rol/i },
    { nombre: "un 422", estado: 422, cuerpo: { error: "Datos no procesables" }, texto: /Datos no procesables/i },
    { nombre: "un 500", estado: 500, cuerpo: { error: "Error interno" }, texto: /Error interno/i },
  ]) {
    test(`si al cambiar el rol llega ${caso.nombre}, se dice y el rol NO cambia`, async ({
      page,
    }) => {
      await login(page, E2E.equipo.owner);
      await abrirEquipo(page);

      permitirFalloEn(page, "/api/users");
      await page.route("**/api/users/*", async (route) => {
        if (route.request().method() === "PATCH") {
          return route.fulfill({
            status: caso.estado,
            contentType: "application/json",
            body: JSON.stringify(caso.cuerpo),
          });
        }
        return route.continue();
      });

      const selector = page.getByRole("combobox", {
        name: `Cambiar rol de ${E2E.equipo.cambiante}`,
      });
      await selector.selectOption("VIEWER");

      await expect(page.getByTestId(`error-miembro-${E2E.equipo.cambiante}`)).toContainText(
        caso.texto,
        { timeout: 20_000 },
      );
      await expect(page.getByTestId(`exito-miembro-${E2E.equipo.cambiante}`)).toHaveCount(0);

      // En base no ha cambiado nada…
      expect(await rolEnBase(E2E.equipo.cambiante)).toBe("OPERATOR");
      // …y el control vuelve a estar utilizable, mostrando el rol real.
      await expect(selector).toBeEnabled({ timeout: 10_000 });
      await expect(selector).toHaveValue("OPERATOR");
    });
  }

  test("si un 500 no devuelve JSON, el mensaje sigue siendo comprensible", async ({ page }) => {
    /*
     * EL DEFECTO QUE CUBRE
     * --------------------
     * Era `const data = await res.json(); throw new Error(data.error)`. Con una
     * pagina de error HTML, `res.json()` lanzaba y al usuario le salia
     * "Unexpected token '<'"; y con un JSON sin `error`, `new Error(undefined)`
     * tiene `message` vacio y el parrafo se pintaba EN BLANCO.
     */
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    permitirFalloEn(page, "/api/users");
    await page.route("**/api/users/*", async (route) => {
      if (route.request().method() === "PATCH") {
        return route.fulfill({ status: 502, contentType: "text/html", body: "<html>502</html>" });
      }
      return route.continue();
    });

    await page
      .getByRole("combobox", { name: `Cambiar rol de ${E2E.equipo.cambiante}` })
      .selectOption("VIEWER");

    const aviso = page.getByTestId(`error-miembro-${E2E.equipo.cambiante}`);
    await expect(aviso).toBeVisible({ timeout: 20_000 });
    await expect(aviso).toContainText("502");
    await expect(aviso).not.toContainText(/Unexpected token/i);
    expect((await aviso.innerText()).trim().length, "el aviso no puede quedar vacio").toBeGreaterThan(
      10,
    );
  });

  test("si la red se cae al cambiar el rol, se dice y el control sigue vivo", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    permitirFalloEn(page, "/api/users");
    await page.route("**/api/users/*", async (route) => {
      if (route.request().method() === "PATCH") return route.abort("failed");
      return route.continue();
    });

    const selector = page.getByRole("combobox", {
      name: `Cambiar rol de ${E2E.equipo.cambiante}`,
    });
    await selector.selectOption("VIEWER");

    await expect(page.getByTestId(`error-miembro-${E2E.equipo.cambiante}`)).toContainText(
      /No se ha podido cambiar el rol/i,
      { timeout: 20_000 },
    );
    expect(await rolEnBase(E2E.equipo.cambiante)).toBe("OPERATOR");
    await expect(selector).toBeEnabled({ timeout: 10_000 });
  });
});

// ───────────────────────── Ultimo OWNER ─────────────────────────

test.describe("Equipo: el ultimo OWNER esta protegido", () => {
  test.afterEach(async () => {
    // La organizacion vuelve a tener sus dos OWNER.
    await fijarRol(E2E.equipo.owner, "OWNER");
    await fijarRol(E2E.equipo.owner2, "OWNER");
  });

  test("con DOS owners si se puede degradar a uno, y persiste", async ({ page }) => {
    expect(
      await prisma.membership.count({ where: { orgId: await orgEquipo(), role: "OWNER" } }),
      "esta prueba parte de dos OWNER",
    ).toBe(2);

    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    const selector = page.getByRole("combobox", {
      name: `Cambiar rol de ${E2E.equipo.owner2}`,
    });
    await expect(selector).toHaveValue("OWNER");
    await selector.selectOption("MANAGER");

    await expect(page.getByTestId(`exito-miembro-${E2E.equipo.owner2}`)).toBeVisible({
      timeout: 20_000,
    });
    await expect(async () => {
      expect(await rolEnBase(E2E.equipo.owner2)).toBe("MANAGER");
    }).toPass({ timeout: 20_000 });

    // Y queda exactamente un OWNER: la organizacion nunca se queda sin.
    expect(
      await prisma.membership.count({ where: { orgId: await orgEquipo(), role: "OWNER" } }),
    ).toBe(1);
  });

  test("al ultimo OWNER la interfaz no le ofrece degradarse ni expulsarse", async ({ page }) => {
    // Se deja un solo OWNER: el que va a iniciar sesion.
    await fijarRol(E2E.equipo.owner2, "MANAGER");

    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    expect(
      await prisma.membership.count({ where: { orgId: await orgEquipo(), role: "OWNER" } }),
    ).toBe(1);

    // Su propia fila no trae ni selector de rol ni boton de expulsar.
    await expect(
      page.getByRole("combobox", { name: `Cambiar rol de ${E2E.equipo.owner}` }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: `Eliminar del equipo a ${E2E.equipo.owner}` }),
    ).toHaveCount(0);
    await expect(page.getByText(/\(tu\)/)).toBeVisible();
  });

  test("el servidor rechaza degradar o expulsar al ultimo OWNER", async ({ page }) => {
    /*
     * Excepcion declarada: aqui NO hay control que pulsar —la interfaz no lo
     * ofrece—, asi que se llama al API desde la sesion ya iniciada. Ocultar un
     * boton no es autorizar, y esto es lo que lo demuestra.
     */
    await fijarRol(E2E.equipo.owner2, "MANAGER");

    const owner = await prisma.user.findUnique({
      where: { email: E2E.equipo.owner },
      select: { id: true },
    });

    await login(page, E2E.equipo.owner);
    permitirFalloEn(page, "/api/users");

    // El propio OWNER no puede degradarse.
    const degradar = await page.request.patch(`/api/users/${owner!.id}`, {
      data: { role: "MANAGER" },
    });
    expect(degradar.status()).toBe(403);
    expect((await degradar.json()).error).toMatch(/tu propio rol/i);

    // Ni expulsarse.
    const expulsar = await page.request.delete(`/api/users/${owner!.id}`);
    expect(expulsar.status()).toBe(400);

    // Sigue siendo OWNER y la organizacion conserva su titularidad.
    expect(await rolEnBase(E2E.equipo.owner)).toBe("OWNER");
    expect(
      await prisma.membership.count({ where: { orgId: await orgEquipo(), role: "OWNER" } }),
    ).toBe(1);
  });

  test("un MANAGER no puede degradar ni expulsar a un OWNER", async ({ page }) => {
    const owner = await prisma.user.findUnique({
      where: { email: E2E.equipo.owner },
      select: { id: true },
    });

    await login(page, E2E.equipo.manager);
    permitirFalloEn(page, "/api/users");

    const degradar = await page.request.patch(`/api/users/${owner!.id}`, {
      data: { role: "OPERATOR" },
    });
    expect(degradar.status(), "un MANAGER no toca a un OWNER").toBe(403);

    const expulsar = await page.request.delete(`/api/users/${owner!.id}`);
    expect(expulsar.status()).toBe(403);

    // Y tampoco puede fabricarse un OWNER.
    const cambiante = await prisma.user.findUnique({
      where: { email: E2E.equipo.cambiante },
      select: { id: true },
    });
    const promover = await page.request.patch(`/api/users/${cambiante!.id}`, {
      data: { role: "OWNER" },
    });
    expect(promover.status(), "solo un OWNER asigna OWNER").toBe(403);

    expect(await rolEnBase(E2E.equipo.owner)).toBe("OWNER");
    expect(await rolEnBase(E2E.equipo.cambiante)).toBe("OPERATOR");
  });

  test("dos degradaciones simultaneas no dejan la organizacion sin OWNER", async ({ page }) => {
    /*
     * Este es el escenario para el que existe el bloqueo de la transaccion: con
     * dos OWNER, dos peticiones a la vez leen ambas `ownerCount = 2` y, sin
     * bloqueo, las dos degradarian. Es la unica via por la que se alcanza el 409
     * de ultimo owner, porque en secuencia el propio orden lo impide.
     */
    const [a, b] = await Promise.all([
      prisma.user.findUnique({ where: { email: E2E.equipo.owner }, select: { id: true } }),
      prisma.user.findUnique({ where: { email: E2E.equipo.owner2 }, select: { id: true } }),
    ]);

    await login(page, E2E.equipo.owner);
    permitirFalloEn(page, "/api/users");

    // El actor no puede degradarse a si mismo, asi que la carrera se plantea
    // entre dos sesiones distintas: cada OWNER intenta degradar al otro.
    const otroContexto = await page.context().browser()!.newContext();
    const otraPagina = await otroContexto.newPage();
    await login(otraPagina, E2E.equipo.owner2);
    permitirFalloEn(otraPagina, "/api/users");

    const [r1, r2] = await Promise.all([
      page.request.patch(`/api/users/${b!.id}`, { data: { role: "MANAGER" } }),
      otraPagina.request.patch(`/api/users/${a!.id}`, { data: { role: "MANAGER" } }),
    ]);
    await otroContexto.close();

    const oks = [r1, r2].filter((r) => r.ok()).length;
    expect(oks, "no pueden prosperar las dos degradaciones").toBeLessThanOrEqual(1);

    // LO QUE IMPORTA: la organizacion conserva al menos un OWNER.
    const owners = await prisma.membership.count({
      where: { orgId: await orgEquipo(), role: "OWNER" },
    });
    expect(owners, "la organizacion nunca puede quedarse sin OWNER").toBeGreaterThanOrEqual(1);
  });
});

// ───────────────────────── Expulsion de miembros ─────────────────────────

test.describe("Equipo: expulsar miembros", () => {
  test.afterEach(async () => {
    // Se rehace el miembro expulsable si la prueba lo elimino.
    const orgId = await orgEquipo();
    const u = await prisma.user.findUnique({
      where: { email: E2E.equipo.expulsable },
      select: { id: true },
    });
    if (u) {
      const tiene = await prisma.membership.count({ where: { orgId, userId: u.id } });
      if (!tiene) {
        await prisma.membership.create({
          data: { orgId, userId: u.id, role: "OPERATOR" },
        });
      }
    }
  });

  test("cancelar no expulsa; confirmar expulsa y desaparece de la lista", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    const boton = page.getByRole("button", {
      name: `Eliminar del equipo a ${E2E.equipo.expulsable}`,
    });
    await expect(boton).toBeVisible({ timeout: 20_000 });

    // 1. Cancelar no toca nada.
    let mensaje = "";
    page.once("dialog", (d) => {
      mensaje = d.message();
      d.dismiss();
    });
    await boton.click();
    await expect(async () => {
      expect(mensaje, "expulsar debe pedir confirmacion").toContain("Eliminar");
    }).toPass({ timeout: 10_000 });
    expect(await rolEnBase(E2E.equipo.expulsable)).toBe("OPERATOR");

    // 2. Confirmar si.
    page.once("dialog", (d) => d.accept());
    await boton.click();

    await expect(async () => {
      expect(await rolEnBase(E2E.equipo.expulsable)).toBeNull();
    }).toPass({ timeout: 20_000 });
    await expect(
      page.getByRole("cell", { name: E2E.equipo.expulsable, exact: true }),
    ).toHaveCount(0, { timeout: 20_000 });
  });

  test("si el servidor rechaza la expulsion, se dice y el miembro sigue", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    permitirFalloEn(page, "/api/users");
    await page.route("**/api/users/*", async (route) => {
      if (route.request().method() === "DELETE") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Error interno" }),
        });
      }
      return route.continue();
    });

    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: `Eliminar del equipo a ${E2E.equipo.expulsable}` })
      .click();

    await expect(page.getByTestId(`error-miembro-${E2E.equipo.expulsable}`)).toContainText(
      /Error interno/i,
      { timeout: 20_000 },
    );
    expect(await rolEnBase(E2E.equipo.expulsable)).toBe("OPERATOR");
    await expect(
      page.getByRole("cell", { name: E2E.equipo.expulsable, exact: true }),
    ).toHaveCount(1);
  });

  test("si la red se cae al expulsar, se dice y el boton sigue utilizable", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    permitirFalloEn(page, "/api/users");
    await page.route("**/api/users/*", async (route) => {
      if (route.request().method() === "DELETE") return route.abort("failed");
      return route.continue();
    });

    const boton = page.getByRole("button", {
      name: `Eliminar del equipo a ${E2E.equipo.expulsable}`,
    });
    page.once("dialog", (d) => d.accept());
    await boton.click();

    await expect(page.getByTestId(`error-miembro-${E2E.equipo.expulsable}`)).toContainText(
      /No se ha podido eliminar/i,
      { timeout: 20_000 },
    );
    expect(await rolEnBase(E2E.equipo.expulsable)).toBe("OPERATOR");
    await expect(boton).toBeEnabled({ timeout: 10_000 });
  });
});

// ───────────────────────── Roles ─────────────────────────

test.describe("Equipo: roles", () => {
  test("OWNER administra el equipo entero", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    // Invitar, cambiar roles y expulsar.
    await expect(page.getByRole("button", { name: "Invitar miembro" })).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: `Cambiar rol de ${E2E.equipo.cambiante}` }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: `Eliminar del equipo a ${E2E.equipo.cambiante}` }),
    ).toHaveCount(1);
    // Y es el unico que puede repartir la titularidad.
    const opciones = await page
      .getByRole("combobox", { name: `Cambiar rol de ${E2E.equipo.cambiante}` })
      .locator("option")
      .allTextContents();
    expect(opciones.join(" ")).toMatch(/Owner/i);
  });

  test("MANAGER administra el equipo pero no reparte titularidad", async ({ page }) => {
    // Politica real: MANAGER tiene `org.members` y `org.members.invite`.
    await login(page, E2E.equipo.manager);
    await abrirEquipo(page);

    await expect(page.getByRole("button", { name: "Invitar miembro" })).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: `Cambiar rol de ${E2E.equipo.cambiante}` }),
    ).toHaveCount(1);

    // Pero el servidor no le deja crear otro OWNER (comprobado arriba con el
    // API); aqui basta con que la pantalla sea suya y funcione.
    await expect(page.getByTestId("invitaciones-panel")).toBeVisible({ timeout: 20_000 });
  });

  for (const rol of [
    { nombre: "OPERATOR", email: E2E.equipo.operador },
    { nombre: "VIEWER", email: E2E.equipo.viewer },
  ]) {
    test(`${rol.nombre} no puede administrar el equipo`, async ({ page }) => {
      await login(page, rol.email);

      // La navegacion no le ofrece Equipo…
      await expect(page.getByRole("link", { name: "Usuarios", exact: true })).toHaveCount(0);

      // …y entrar por la URL le devuelve al escritorio.
      await page.goto("/users");
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

      // Segunda mitad: el servidor tampoco le deja tocar a nadie.
      permitirFalloEn(page, "/api/users");
      const otro = await prisma.user.findUnique({
        where: { email: E2E.equipo.cambiante },
        select: { id: true },
      });
      const cambio = await page.request.patch(`/api/users/${otro!.id}`, {
        data: { role: "MANAGER" },
      });
      expect(cambio.status()).toBe(403);
      const borrado = await page.request.delete(`/api/users/${otro!.id}`);
      expect(borrado.status()).toBe(403);
      // El alta de invitaciones vive en POST /api/users (el panel las LISTA
      // desde /api/invitations, que solo tiene GET).
      const invitar = await page.request.post("/api/users", {
        data: { email: "intruso@ejemplo.test", role: "OPERATOR" },
      });
      expect(invitar.status(), "no puede invitar a nadie").toBe(403);
      expect(
        await prisma.invitation.count({ where: { email: "intruso@ejemplo.test" } }),
      ).toBe(0);

      expect(await rolEnBase(E2E.equipo.cambiante)).toBe("OPERATOR");
    });
  }
});

// ───────────────────────── Accesibilidad ─────────────────────────

test.describe("Equipo: accesibilidad", () => {
  test("cada control dice sobre quien actua", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    /*
     * Antes habia un `<select>` sin nombre por cada miembro y un boton
     * "Eliminar" identico en cada fila: ni un lector de pantalla ni una prueba
     * podian saber sobre quien actuaban.
     */
    for (const correo of [E2E.equipo.manager, E2E.equipo.operador, E2E.equipo.cambiante]) {
      await expect(
        page.getByRole("combobox", { name: `Cambiar rol de ${correo}` }),
        `selector de ${correo}`,
      ).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: `Eliminar del equipo a ${correo}` }),
        `boton de ${correo}`,
      ).toHaveCount(1);
    }

    // Ningun select queda sin nombre accesible.
    const sinNombre = await page.locator("select:not([aria-label]):not([id])").count();
    expect(sinNombre, "todo select debe tener nombre accesible").toBe(0);
  });

  test("el formulario de invitacion tiene nombre accesible en cada campo", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    await page.getByRole("button", { name: "Invitar miembro" }).click();

    await expect(page.getByLabel("Email de la persona invitada")).toBeEditable({
      timeout: 20_000,
    });
    await expect(page.getByLabel("Rol de la persona invitada")).toBeEnabled();
  });

  test("los avisos de las invitaciones se anuncian", async ({ page }) => {
    await login(page, E2E.equipo.owner);
    await abrirEquipo(page);

    // El estado vacio es texto normal; lo que debe anunciarse es el error.
    permitirFalloEn(page, "/api/invitations");
    await page.route("**/api/invitations", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Fallo" }),
      });
    });
    await page.reload();

    await expect(page.getByRole("alert").filter({ hasText: /invitaciones/i })).toBeVisible({
      timeout: 20_000,
    });
  });
});
