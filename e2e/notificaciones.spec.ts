/**
 * /notifications y la campana del encabezado.
 *
 * QUE VIGILA ESTA SUITE
 * ---------------------
 * La campana tenia dos defectos y ninguno se veia:
 *
 *   1. Con `/api/notifications/unread` caido guardaba el fallo en un estado
 *      que **no pintaba en ninguna parte**, asi que al abrirla se leia
 *      «Sin notificaciones pendientes» — cero avisos y «no he podido
 *      preguntar» eran la misma pantalla.
 *
 *   2. Descartar bajaba el contador DOS VECES: `setCount(c => c - 1)` y
 *      ademas el contador visible restaba `dismissed.size`. Con tres alertas,
 *      descartar una dejaba el contador en 1 en vez de 2.
 *
 * Ademas el descarte era un disparo al aire con `.catch(() => {})`: con un 403
 * o la red caida el aviso desaparecia igual y volvia al recargar.
 */
import { type Page } from "@playwright/test";
import { test, expect, pantallaUtil, permitirFalloEn } from "./vigilancia";
import { PrismaClient } from "@prisma/client";
import { E2E, CIFRAS_AVISOS } from "./seed-e2e";

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

/**
 * Sirve una respuesta controlada de la campana.
 *
 * El contenido real depende de tareas vencidas, plazos ISD y mensajes, que
 * cambian con la hora: para afirmar cifras exactas —y sobre todo para probar
 * el 99+ y el doble descuento— hace falta una respuesta fija.
 */
async function campanaCon(page: Page, unreadCount: number, alerts: unknown[]) {
  await page.route("**/api/notifications/unread", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ unreadCount, alerts }),
    }),
  );
}

function alertaFalsa(id: string, kind: string, ref: string | null = null) {
  return {
    id,
    kind,
    recipient: `${id}@ejemplo.test`,
    createdAt: new Date().toISOString(),
    case: ref ? { id: "caso-de-prueba", ref } : null,
  };
}

const campana = (page: Page) => page.getByTestId("campana-notificaciones");

test.describe("Campana: contador y desplegable", () => {
  test("tiene nombre accesible y dice cuantas hay", async ({ page }) => {
    await campanaCon(page, 3, [
      alertaFalsa("a1", "TASK_OVERDUE", "EXP-A"),
      alertaFalsa("a2", "ISD_30D", "EXP-B"),
      alertaFalsa("a3", "PORTAL_MESSAGE", "EXP-C"),
    ]);
    await login(page, E2E.avisos.owner);
    await pantallaUtil(page);

    // El nombre accesible no depende de `title`, que es una ayuda emergente.
    await expect(
      page.getByRole("button", { name: "Notificaciones: 3 sin leer" }),
    ).toBeVisible();
    await expect(page.getByTestId("campana-contador")).toHaveText("3");
    await page.unroute("**/api/notifications/unread");
  });

  test("se abre, lista las alertas y se cierra al pulsar fuera", async ({ page }) => {
    await campanaCon(page, 2, [
      alertaFalsa("a1", "TASK_OVERDUE", "EXP-A"),
      alertaFalsa("a2", "ISD_7D", "EXP-B"),
    ]);
    await login(page, E2E.avisos.owner);
    await pantallaUtil(page);

    await campana(page).click();
    await expect(page.getByRole("heading", { name: "Notificaciones" })).toBeVisible();
    await expect(page.getByText("Tarea vencida")).toBeVisible();
    await expect(page.getByText("ISD — vence en 7d")).toBeVisible();
    await expect(campana(page)).toHaveAttribute("aria-expanded", "true");

    // Un clic fuera lo cierra.
    //
    // Con coordenadas, no sobre el encabezado: el desplegable se despliega
    // justo encima y interceptaba el clic, asi que la prueba se colgaba
    // esperando a poder pulsar algo que estaba tapado.
    await page.mouse.click(30, 500);
    await expect(page.getByRole("heading", { name: "Notificaciones" })).toHaveCount(0);
    await page.unroute("**/api/notifications/unread");
  });

  test("marca cuantas son urgentes", async ({ page }) => {
    await campanaCon(page, 3, [
      alertaFalsa("a1", "TASK_OVERDUE"),
      alertaFalsa("a2", "ISD_1D"),
      alertaFalsa("a3", "ISD_60D"),
    ]);
    await login(page, E2E.avisos.owner);
    await campana(page).click();

    // TASK_OVERDUE e ISD_1D son urgentes; ISD_60D no.
    await expect(page.getByText("2 urgentes")).toBeVisible();
    await page.unroute("**/api/notifications/unread");
  });

  test("con mas de 99 muestra «99+»", async ({ page }) => {
    await campanaCon(page, 120, [alertaFalsa("a1", "TASK_OVERDUE")]);
    await login(page, E2E.avisos.owner);
    await pantallaUtil(page);

    await expect(page.getByTestId("campana-contador")).toHaveText("99+");
    await expect(
      page.getByRole("button", { name: "Notificaciones: 120 sin leer" }),
    ).toBeVisible();
    await page.unroute("**/api/notifications/unread");
  });

  test("el enlace de una alerta abre su expediente", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await pantallaUtil(page);
    await campana(page).click();

    // Se usa la alerta real que genera el sembrado, no una fabricada.
    const enlace = page.locator('a[href^="/cases/"]').filter({ hasText: "→" }).first();
    const hay = (await enlace.count()) > 0;
    test.skip(!hay, "El sembrado no ha generado ninguna alerta con expediente.");

    await enlace.click();
    await page.waitForURL("**/cases/**");
  });

  test("«Ver todas las notificaciones» lleva al historial", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await pantallaUtil(page);
    await campana(page).click();

    await page.getByRole("link", { name: "Ver todas las notificaciones" }).click();
    await page.waitForURL("**/notifications");
    await expect(
      page.getByRole("heading", { name: "Notificaciones enviadas" }),
    ).toBeVisible();
  });

  test("con cero alertas REALES dice que no hay ninguna", async ({ page }) => {
    await campanaCon(page, 0, []);
    await login(page, E2E.avisos.owner);
    await pantallaUtil(page);

    // Sin contador y con el nombre accesible correspondiente.
    await expect(page.getByTestId("campana-contador")).toHaveCount(0);
    await expect(page.getByTestId("campana-fallo")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Notificaciones: ninguna pendiente" }),
    ).toBeVisible();

    await campana(page).click();
    await expect(page.getByTestId("campana-vacia")).toBeVisible();
    await page.unroute("**/api/notifications/unread");
  });
});

test.describe("Campana: el fallo NO se disfraza de «sin avisos»", () => {
  for (const codigo of [401, 500] as const) {
    test(`con un HTTP ${codigo} lo dice al abrirla`, async ({ page }) => {
      await login(page, E2E.avisos.owner);
      permitirFalloEn(page, "/api/notifications/unread");
      await page.route("**/api/notifications/unread", (route) =>
        route.fulfill({ status: codigo, contentType: "application/json", body: "{}" }),
      );
      await page.reload();
      await pantallaUtil(page);

      // El boton avisa con un «!», no con un cero que seria inventado.
      await expect(page.getByTestId("campana-fallo")).toBeVisible();
      await expect(page.getByTestId("campana-contador")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Notificaciones: no se han podido consultar" }),
      ).toBeVisible();

      await campana(page).click();
      const aviso = page.getByTestId("fallo-campana");
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText("No se han podido cargar las notificaciones");
      await expect(aviso).toContainText(String(codigo));
      // Lo que de verdad importa: el mensaje tranquilizador NO esta.
      await expect(page.getByTestId("campana-vacia")).toHaveCount(0);
      await expect(page.getByText("Sin notificaciones pendientes")).toHaveCount(0);

      await page.unroute("**/api/notifications/unread");
    });
  }

  test("un fallo de red se trata igual", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    permitirFalloEn(page, "/api/notifications/unread");
    await page.route("**/api/notifications/unread", (route) => route.abort("failed"));
    await page.reload();
    await pantallaUtil(page);

    await campana(page).click();
    await expect(page.getByTestId("fallo-campana")).toBeVisible();
    await expect(page.getByTestId("campana-vacia")).toHaveCount(0);
    await page.unroute("**/api/notifications/unread");
  });

  test("«Reintentar» recupera la campana", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    permitirFalloEn(page, "/api/notifications/unread");
    await page.route("**/api/notifications/unread", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await page.reload();
    await pantallaUtil(page);
    await campana(page).click();
    await expect(page.getByTestId("fallo-campana")).toBeVisible();

    // Se arregla el servidor y se reintenta desde el propio desplegable.
    await page.unroute("**/api/notifications/unread");
    await campanaCon(page, 1, [alertaFalsa("a1", "TASK_OVERDUE")]);
    await page.getByTestId("fallo-campana").getByRole("button", { name: "Reintentar" }).click();

    await expect(page.getByTestId("fallo-campana")).toHaveCount(0);
    await expect(page.getByText("Tarea vencida")).toBeVisible();
    await page.unroute("**/api/notifications/unread");
  });
});

test.describe("Campana: descartar", () => {
  test("el contador baja UNA sola vez", async ({ page }) => {
    /*
     * El defecto: `setCount(c => c-1)` mas `displayCount = count -
     * dismissed.size` restaban dos veces. Con tres alertas, descartar una
     * dejaba el contador en 1 cuando debia quedarse en 2.
     */
    await campanaCon(page, 3, [
      alertaFalsa("alerta-1", "TASK_OVERDUE"),
      alertaFalsa("alerta-2", "ISD_30D"),
      alertaFalsa("alerta-3", "PORTAL_MESSAGE"),
    ]);
    await page.route("**/api/notifications/dismiss", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      }),
    );
    await login(page, E2E.avisos.owner);
    await pantallaUtil(page);

    await expect(page.getByTestId("campana-contador")).toHaveText("3");
    await campana(page).click();

    await page.getByRole("button", { name: "Descartar: Tarea vencida" }).click();

    // Dos, no uno.
    await expect(page.getByTestId("campana-contador")).toHaveText("2");
    await expect(page.getByText("Tarea vencida")).toHaveCount(0);
    // Las otras dos siguen.
    await expect(page.getByText("ISD — vence en 30d")).toBeVisible();

    // Y un segundo descarte deja 1, no -1 ni 0.
    await page.getByRole("button", { name: "Descartar: ISD — vence en 30d" }).click();
    await expect(page.getByTestId("campana-contador")).toHaveText("1");

    await page.unroute("**/api/notifications/unread");
    await page.unroute("**/api/notifications/dismiss");
  });

  test("cada boton de descartar dice QUE alerta descarta", async ({ page }) => {
    await campanaCon(page, 2, [
      alertaFalsa("a1", "TASK_OVERDUE", "EXP-2026-0001"),
      alertaFalsa("a2", "ISD_7D", "EXP-2026-0002"),
    ]);
    await login(page, E2E.avisos.owner);
    await campana(page).click();

    // Antes todos se llamaban «Descartar» y eran indistinguibles.
    await expect(
      page.getByRole("button", { name: "Descartar: Tarea vencida (EXP-2026-0001)" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Descartar: ISD — vence en 7d (EXP-2026-0002)" }),
    ).toBeVisible();
    await page.unroute("**/api/notifications/unread");
  });

  test("se puede descartar con el teclado y el boton se ve al enfocarlo", async ({
    page,
  }) => {
    await campanaCon(page, 1, [alertaFalsa("a1", "TASK_OVERDUE")]);
    await page.route("**/api/notifications/dismiss", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      }),
    );
    await login(page, E2E.avisos.owner);
    await campana(page).click();

    const boton = page.getByRole("button", { name: "Descartar: Tarea vencida" });
    await boton.focus();
    // `opacity-0` sin `focus:opacity-100` lo dejaba enfocable pero invisible.
    await expect(boton).toHaveCSS("opacity", "1");
    await boton.press("Enter");
    await expect(page.getByText("Tarea vencida")).toHaveCount(0);

    await page.unroute("**/api/notifications/unread");
    await page.unroute("**/api/notifications/dismiss");
  });

  for (const [codigo, esperado] of [
    [403, "No tienes permiso para descartar avisos"],
    [404, "El aviso ya no existe"],
    [500, "No se ha podido descartar (500)"],
  ] as const) {
    test(`un HTTP ${codigo} al descartar devuelve la alerta a su sitio`, async ({ page }) => {
      await campanaCon(page, 2, [
        alertaFalsa("a1", "TASK_OVERDUE"),
        alertaFalsa("a2", "ISD_30D"),
      ]);
      await login(page, E2E.avisos.owner);
      permitirFalloEn(page, "/api/notifications/dismiss");
      await page.route("**/api/notifications/dismiss", (route) =>
        route.fulfill({ status: codigo, contentType: "application/json", body: "{}" }),
      );
      await campana(page).click();

      await page.getByRole("button", { name: "Descartar: Tarea vencida" }).click();

      await expect(page.getByTestId("error-descartar-aviso")).toContainText(esperado);
      // La alerta VUELVE: no se finge que se ha descartado.
      await expect(page.getByText("Tarea vencida")).toBeVisible();
      // Y el contador se queda como estaba.
      await expect(page.getByTestId("campana-contador")).toHaveText("2");

      await page.unroute("**/api/notifications/unread");
      await page.unroute("**/api/notifications/dismiss");
    });
  }

  test("un fallo de red al descartar tambien se deshace", async ({ page }) => {
    await campanaCon(page, 1, [alertaFalsa("a1", "TASK_OVERDUE")]);
    await login(page, E2E.avisos.owner);
    permitirFalloEn(page, "/api/notifications/dismiss");
    await page.route("**/api/notifications/dismiss", (route) => route.abort("failed"));
    await campana(page).click();

    await page.getByRole("button", { name: "Descartar: Tarea vencida" }).click();
    await expect(page.getByTestId("error-descartar-aviso")).toContainText("error de red");
    await expect(page.getByText("Tarea vencida")).toBeVisible();
    await expect(page.getByTestId("campana-contador")).toHaveText("1");

    await page.unroute("**/api/notifications/unread");
    await page.unroute("**/api/notifications/dismiss");
  });

  test("el doble clic no descarta dos veces", async ({ page }) => {
    let llamadas = 0;
    await campanaCon(page, 2, [
      alertaFalsa("a1", "TASK_OVERDUE"),
      alertaFalsa("a2", "ISD_30D"),
    ]);
    await page.route("**/api/notifications/dismiss", async (route) => {
      llamadas++;
      await new Promise((r) => setTimeout(r, 1200));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
    await login(page, E2E.avisos.owner);
    await campana(page).click();

    const boton = page.getByRole("button", { name: "Descartar: Tarea vencida" });
    await boton.click();
    // El segundo clic entra mientras el primero vuela: no debe repetir.
    await boton.click({ force: true, timeout: 2000 }).catch(() => {
      // Que el elemento ya no exista tambien es un resultado valido.
    });

    await expect(page.getByTestId("campana-contador")).toHaveText("1", { timeout: 15_000 });
    expect(llamadas).toBe(1);

    await page.unroute("**/api/notifications/unread");
    await page.unroute("**/api/notifications/dismiss");
  });

  test("descartar un aviso ALMACENADO persiste tras recargar", async ({ page }) => {
    /*
     * Sin sustituir la respuesta: se descarta un aviso guardado de verdad y se
     * comprueba que el servidor lo ha marcado como leido y ya no vuelve.
     *
     * SE ELIGE POR ID, NO EL PRIMERO DE LA LISTA
     * ------------------------------------------
     * La campana mezcla dos clases de aviso: los ALMACENADOS —filas de
     * `NotificationLog`, con un cuid normal— y los SINTETICOS, que se calculan
     * en cada peticion a partir de tareas vencidas, plazos ISD y mensajes sin
     * leer, y llevan un id con prefijo (`portal:`, `overdue:`, `isd:`…).
     * Descartar uno sintetico no puede persistir: no hay fila que marcar, y en
     * la siguiente carga se vuelve a calcular. Es el comportamiento previsto
     * —el propio API responde `{ ok: true, synthetic: true }`—, pero significa
     * que esta prueba solo tiene sentido sobre un aviso almacenado. Cogiendo
     * «el primero» pillaba uno sintetico y afirmaba algo que el producto no
     * promete.
     */
    const almacenado = await prisma.notificationLog.findFirstOrThrow({
      where: { org: { slug: E2E.avisos.slug }, status: "sent" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    await login(page, E2E.avisos.owner);
    await pantallaUtil(page);
    await campana(page).click();

    const boton = page.getByTestId(`descartar-${almacenado.id}`);
    await expect(boton).toBeVisible();
    await boton.click();
    await expect(page.getByTestId("error-descartar-aviso")).toHaveCount(0);

    // El servidor lo ha guardado como leido.
    await expect(async () => {
      const fila = await prisma.notificationLog.findUniqueOrThrow({
        where: { id: almacenado.id },
        select: { status: true },
      });
      expect(fila.status).toBe("read");
    }).toPass({ timeout: 10_000 });

    // Y al recargar no vuelve.
    await page.reload();
    await pantallaUtil(page);
    await campana(page).click();
    await expect(page.getByTestId(`descartar-${almacenado.id}`)).toHaveCount(0);
  });
});

test.describe("Historial de notificaciones", () => {
  test("lista los registros con su tipo, canal, destinatario y estado", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await page.goto("/notifications");
    await pantallaUtil(page);

    await expect(page.getByTestId("recuento-notificaciones")).toContainText(
      `${CIFRAS_AVISOS.notificaciones} notificaciones`,
    );

    const tabla = page.locator("table");
    await expect(tabla).toContainText("Email interno");
    await expect(tabla).toContainText("avisos-01@ejemplo.test");
    await expect(tabla).toContainText("Enviado");
    await expect(tabla).toContainText("Fallido");
    // Enlaza al expediente.
    await expect(
      tabla.getByRole("link", { name: new RegExp(E2E.avisos.caseConDos) }).first(),
    ).toBeVisible();
  });

  test("los tres filtros tienen etiqueta ASOCIADA y se localizan por ella", async ({
    page,
  }) => {
    await login(page, E2E.avisos.owner);
    await page.goto("/notifications");
    await pantallaUtil(page);

    // Si alguien vuelve a dejar los `<label>` sueltos, esto falla.
    await expect(page.getByLabel("Tipo")).toBeVisible();
    await expect(page.getByLabel("Canal")).toBeVisible();
    await expect(page.getByLabel("Estado")).toBeVisible();

    // Y la asociacion es REAL: `for` apuntando al `id` del control, no un
    // rotulo colocado al lado.
    const etiquetas = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("label"))
        .filter((l) => ["Tipo", "Canal", "Estado"].includes(l.textContent?.trim() ?? ""))
        .map((l) => ({
          texto: l.textContent?.trim(),
          existe: Boolean(
            l.getAttribute("for") && document.getElementById(l.getAttribute("for")!),
          ),
        }));
    });
    expect(etiquetas.length, "deben existir las tres etiquetas").toBe(3);
    for (const e of etiquetas) {
      expect(e.existe, `la etiqueta «${e.texto}» debe apuntar a un control real`).toBe(true);
    }
  });

  test("el filtro de Estado reduce la lista a las fallidas", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await page.goto("/notifications");
    await pantallaUtil(page);

    await page.getByLabel("Estado").selectOption("failed");
    await expect(page.getByTestId("recuento-notificaciones")).toContainText(
      `${CIFRAS_AVISOS.notificacionesFallidas} notificaciones (filtrado)`,
    );
    await expect(page.locator("table")).not.toContainText("Enviado");
  });

  test("el filtro de Canal reduce la lista a las de la familia", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await page.goto("/notifications");
    await pantallaUtil(page);

    await page.getByLabel("Canal").selectOption("EMAIL_FAMILY");
    await expect(page.getByTestId("recuento-notificaciones")).toContainText(
      `${CIFRAS_AVISOS.notificacionesFamilia} notificaciones (filtrado)`,
    );
    await expect(page.locator("table")).not.toContainText("Email interno");
  });

  test("el filtro de Tipo funciona y se combina con los demas", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await page.goto("/notifications");
    await pantallaUtil(page);

    /*
     * Las cifras se afirman EXACTAS, no «menos que el total».
     *
     * La primera version leia el texto con `innerText()` —una sola foto, sin
     * reintentos— y lo pillaba antes de que llegara la respuesta filtrada,
     * asi que comparaba contra el recuento sin filtrar. Con `toContainText`
     * la espera reintenta hasta que el numero es el que debe ser.
     */
    await page.getByLabel("Tipo").selectOption("ISD_7D");
    await expect(page.getByTestId("recuento-notificaciones")).toContainText(
      `${CIFRAS_AVISOS.notificacionesIsd7d} notificaciones (filtrado)`,
    );
    expect(CIFRAS_AVISOS.notificacionesIsd7d).toBeLessThan(CIFRAS_AVISOS.notificaciones);

    // Combinado con el estado, se estrecha mas todavia.
    await page.getByLabel("Estado").selectOption("failed");
    await expect(page.getByTestId("recuento-notificaciones")).toContainText(
      `${CIFRAS_AVISOS.notificacionesIsd7dFallidas} notificacion`,
    );
    expect(CIFRAS_AVISOS.notificacionesIsd7dFallidas).toBeLessThanOrEqual(
      CIFRAS_AVISOS.notificacionesIsd7d,
    );
  });

  test("«Limpiar» quita los filtros y vuelve el total", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await page.goto("/notifications");
    await pantallaUtil(page);

    // El boton no existe hasta que hay algun filtro.
    await expect(page.getByTestId("limpiar-filtros")).toHaveCount(0);
    await page.getByLabel("Estado").selectOption("failed");
    await page.getByTestId("limpiar-filtros").click();

    await expect(page.getByTestId("recuento-notificaciones")).toContainText(
      `${CIFRAS_AVISOS.notificaciones} notificaciones`,
    );
    await expect(page.getByTestId("recuento-notificaciones")).not.toContainText("filtrado");
    await expect(page.getByLabel("Estado")).toHaveValue("");
  });

  test("una combinacion sin resultados lo dice, sin fingir que no hay historial", async ({
    page,
  }) => {
    await login(page, E2E.avisos.owner);
    await page.goto("/notifications");
    await pantallaUtil(page);

    await page.getByLabel("Canal").selectOption("EMAIL_FAMILY");
    await page.getByLabel("Tipo").selectOption("ISD_PASSED");
    await page.getByLabel("Estado").selectOption("failed");

    await expect(
      page.getByText("No hay notificaciones con los filtros seleccionados").first(),
    ).toBeVisible();
    // Y se distingue del vacio absoluto: el texto dice que es por los filtros.
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
  });

  test("la paginacion existe y navega de verdad", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await page.goto("/notifications");
    await pantallaUtil(page);

    // 34 registros con paginas de 30: dos paginas.
    await expect(page.getByText("Pagina 1 de 2")).toBeVisible();
    expect(await page.locator("tbody tr").count()).toBe(30);

    await expect(page.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByText("Pagina 2 de 2")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(CIFRAS_AVISOS.notificaciones - 30);
    await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();

    // Y se vuelve.
    await page.getByRole("button", { name: "Anterior" }).click();
    await expect(page.getByText("Pagina 1 de 2")).toBeVisible();
  });

  test("filtrar vuelve a la primera pagina", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await page.goto("/notifications");
    await pantallaUtil(page);

    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("Pagina 2 de 2")).toBeVisible();

    await page.getByLabel("Estado").selectOption("failed");
    // Con 4 resultados no hay paginacion, y no se queda en una pagina 2 vacia.
    await expect(page.locator("tbody tr")).toHaveCount(CIFRAS_AVISOS.notificacionesFallidas);
  });

  test("el error del envio se conserva en las fallidas", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await page.goto("/notifications");
    await pantallaUtil(page);

    await page.getByLabel("Estado").selectOption("failed");
    const fallida = page.locator("tbody tr").first();
    await expect(fallida).toContainText("Fallido");
    // El motivo va en el `title` de la etiqueta.
    await expect(fallida.locator('[title*="SMTP"]')).toHaveCount(1);
  });

  test("no aparece ni un registro de la organizacion vecina", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await page.goto("/notifications");
    await pantallaUtil(page);

    await expect(page.getByTestId("recuento-notificaciones")).toContainText(
      `${CIFRAS_AVISOS.notificaciones} notificaciones`,
    );
    await expect(page.locator("body")).not.toContainText("NO-DEBE-VERSE-destinatario");
  });
});

test.describe("Historial: roles", () => {
  /*
   * Politica REAL, leida de `src/lib/rbac.ts`: `/notifications` exige
   * `audit.read`, que tienen los CUATRO roles (OWNER, MANAGER, OPERATOR y
   * VIEWER). No hay rol denegado que probar entre los estandar, y no se
   * inventa ninguno.
   */
  for (const rol of ["owner", "manager", "operador", "viewer"] as const) {
    test(`un ${rol.toUpperCase()} entra al historial`, async ({ page }) => {
      await login(page, E2E.avisos[rol]);
      await page.goto("/notifications");
      await pantallaUtil(page);

      await expect(
        page.getByRole("heading", { name: "Notificaciones enviadas" }),
      ).toBeVisible();
      await expect(page.getByTestId("recuento-notificaciones")).toBeVisible();
    });
  }

  test("sin sesion, /notifications lleva al login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/notifications");
    await page.waitForURL(/\/login/);
  });
});
