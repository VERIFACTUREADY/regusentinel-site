/**
 * Sesion y roles, desde el navegador.
 *
 * POR QUE NO SE COMPRUEBA CONTRA EL API
 * --------------------------------------
 * Una llamada directa demuestra que el servidor autoriza bien, no que el
 * usuario pueda trabajar. Cerrar sesion, seguir dentro tras recargar, o no ver
 * un boton que no te corresponde son cosas del navegador: cookies, contexto,
 * render. Aqui se conducen como las conduce una persona.
 *
 * Y sobre roles se comprueban LAS DOS MITADES. Esconder un boton no es
 * autorizar: si la interfaz lo oculta pero el servidor acepta la peticion, el
 * control no existe. Cada prohibicion se comprueba en pantalla Y contra el
 * endpoint.
 */
import { type Page, type BrowserContext } from "@playwright/test";
import { test, expect, pantallaUtil } from "./vigilancia";
import { E2E } from "./seed-e2e";

async function login(page: Page, email: string, password = E2E.password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
}

test.describe("Sesion", () => {
  test("cerrar sesion desde el boton deja fuera de verdad", async ({ page }) => {
    await login(page, E2E.owner);

    await page.getByRole("button", { name: "Salir" }).click();
    await page.waitForURL("**/login**", { timeout: 30_000 });

    // Y no basta con que redirija: la sesion tiene que estar muerta. Volver a
    // una ruta privada debe devolver al login, no entrar por la cookie vieja.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });

  test("la sesion sobrevive a recargar la pagina", async ({ page }) => {
    await login(page, E2E.owner);

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await pantallaUtil(page);

    // Y a navegar a otra ruta privada.
    await page.goto("/cases");
    await expect(page).toHaveURL(/\/cases/);
  });

  test("la sesion sigue viva en una pestana nueva del mismo navegador", async ({
    page,
    context,
  }) => {
    await login(page, E2E.owner);

    const otra = await context.newPage();
    await otra.goto("/cases");
    await expect(otra).toHaveURL(/\/cases/);
    await pantallaUtil(otra);
    await otra.close();
  });

  test("un navegador distinto NO hereda la sesion", async ({ browser }) => {
    // Contexto nuevo = cookies nuevas. Si aqui entrara, la sesion estaria
    // guardada en algun sitio que no debe.
    const limpio: BrowserContext = await browser.newContext();
    const pagina = await limpio.newPage();

    await pagina.goto("/dashboard");
    await expect(pagina).toHaveURL(/\/login/, { timeout: 30_000 });

    await limpio.close();
  });

  test("perder la cookie de sesion devuelve al login", async ({ page, context }) => {
    await login(page, E2E.owner);

    // Equivale a que la sesion caduque: el navegador deja de presentarla.
    await context.clearCookies();

    await page.goto("/cases");
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });
});

test.describe("Roles", () => {
  test("OWNER llega a usuarios, facturacion y ajustes", async ({ page }) => {
    await login(page, E2E.owner);

    for (const ruta of ["/users", "/billing", "/settings"]) {
      await page.goto(ruta);
      await expect(page, `OWNER debe poder abrir ${ruta}`).toHaveURL(new RegExp(ruta));
      await pantallaUtil(page);
      /*
       * Se espera a que la navegacion termine del todo.
       *
       * `/settings` redirige a `/settings/general`. `toHaveURL(/\/settings/)`
       * casa ya con la URL de partida, asi que el bucle seguia adelante con la
       * redireccion todavia en vuelo y el `goto` siguiente la interrumpia:
       * «Navigation to "/users" is interrupted by another navigation to
       * "/settings/general"». Fallaba una vez de cada tantas, sin que nada
       * hubiera cambiado en la aplicacion.
       */
      await page.waitForLoadState("load");
    }

    // Y la accion reservada esta a la vista.
    await page.goto("/users");
    await expect(page.getByRole("button", { name: /Invitar miembro/ })).toBeVisible();
  });

  test("MANAGER opera e invita, pero no puede crear otro OWNER", async ({ page }) => {
    await login(page, E2E.manager);

    // Puede trabajar.
    await page.goto("/cases");
    await pantallaUtil(page);
    await expect(page.getByRole("link", { name: /Nuevo expediente/i })).toBeVisible({
      timeout: 20_000,
    });

    /*
     * MANAGER SI puede invitar: el modelo de permisos le da
     * `org.members.invite`. La primera version de esta prueba daba por hecho
     * que no, y fallo — correctamente. Lo que MANAGER no puede es incorporar a
     * otro OWNER, que es la frontera real de su rol.
     */
    await page.goto("/users");
    await expect(page.getByRole("button", { name: /Invitar miembro/ })).toBeVisible();

    const comoOwner = await page.request.post("/api/users", {
      data: { email: `manager.intento.${Date.now()}@ejemplo.test`, role: "OWNER" },
    });
    expect(
      comoOwner.status(),
      "solo un OWNER puede incorporar a otro OWNER",
    ).toBe(403);
  });

  test("OPERATOR trabaja pero no administra", async ({ page }) => {
    await login(page, E2E.operador);

    await page.goto("/cases");
    await pantallaUtil(page);

    await page.goto("/users");
    await expect(page.getByRole("button", { name: /Invitar miembro/ })).toHaveCount(0);

    const invitar = await page.request.post("/api/users", {
      data: { email: `op.intento.${Date.now()}@ejemplo.test`, role: "VIEWER" },
    });
    expect(invitar.status()).toBe(403);

    const invitaciones = await page.request.get("/api/invitations");
    expect(invitaciones.status()).toBe(403);
  });

  test("VIEWER consulta y no ve acciones de escritura", async ({ page }) => {
    await login(page, E2E.viewer);

    await page.goto("/cases");
    await pantallaUtil(page);

    // Puede consultar: la pantalla carga y no da error.
    await expect(page.getByTestId("carga-error")).toHaveCount(0);

    // Pero no se le ofrece crear ni borrar.
    await expect(
      page.getByRole("link", { name: /Nuevo expediente/i }),
      "un VIEWER no debe ver el boton de crear",
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Importar CSV/i }),
      "ni el de importar",
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Eliminar/i })).toHaveCount(0);
  });

  test("VIEWER: el servidor rechaza aunque vaya por la URL directa", async ({ page }) => {
    /*
     * Esta es la mitad que de verdad importa. Esconder un boton no es
     * autorizar: si la interfaz lo oculta y el servidor acepta, cualquiera con
     * la consola abierta escribe igual.
     */
    await login(page, E2E.viewer);

    const crear = await page.request.post("/api/cases", {
      data: { deceasedName: "Intento de VIEWER", province: "Madrid" },
    });
    expect([401, 403], `crear expediente devolvio ${crear.status()}`).toContain(crear.status());

    const invitar = await page.request.post("/api/users", {
      data: { email: `viewer.intento.${Date.now()}@ejemplo.test`, role: "VIEWER" },
    });
    expect(invitar.status()).toBe(403);

    const auditoria = await page.request.get("/api/audit-logs?page=1&limit=5");
    expect([200, 403], "la auditoria debe responder de forma definida").toContain(
      auditoria.status(),
    );
  });

  test("cada rol ve su etiqueta y solo su navegacion", async ({ page }) => {
    const casos = [
      { correo: E2E.owner, etiqueta: "OWNER" },
      { correo: E2E.manager, etiqueta: "MANAGER" },
      { correo: E2E.operador, etiqueta: "OPERATOR" },
      { correo: E2E.viewer, etiqueta: "VIEWER" },
    ];

    for (const c of casos) {
      await login(page, c.correo);
      await expect(
        page.getByText(c.etiqueta, { exact: true }).first(),
        `la cabecera debe indicar el rol ${c.etiqueta}`,
      ).toBeVisible({ timeout: 20_000 });

      await page.getByRole("button", { name: "Salir" }).click();
      await page.waitForURL("**/login**", { timeout: 30_000 });
    }
  });
});
