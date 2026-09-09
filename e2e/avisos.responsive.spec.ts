/**
 * /messages, /notifications y /approvals en las tres pantallas.
 *
 * La que de verdad se juega algo en movil es /messages: tiene un panel
 * partido —lista de conversaciones a la izquierda, hilo a la derecha— que en
 * pantalla estrecha se convierte en dos vistas con un boton «Volver». Ese
 * boton solo existe por debajo de `sm`, asi que en escritorio no se prueba
 * nunca y puede romperse sin que nadie se entere.
 *
 * Ningun control se sustituye por `page.goto`: se pulsa lo que pulsaria el
 * usuario, incluido el menu hamburguesa.
 */
import { type Page } from "@playwright/test";
import { test, expect, pantallaUtil } from "./vigilancia";
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
  // En movil el primer pintado tarda mas: se espera a que haya pagina.
  await page.getByRole("heading", { name: "Dashboard", level: 1 }).waitFor({
    timeout: 30_000,
  });
}

/** Nada puede desbordar a lo ancho: es el sintoma numero uno de movil roto. */
async function sinDesbordeHorizontal(page: Page, donde: string) {
  const desborde = await page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });
  expect(desborde, `${donde} no debe desplazarse en horizontal`).toBeLessThanOrEqual(1);
}

const esEstrecha = (page: Page) => (page.viewportSize()?.width ?? 0) < 640;
const enMovil = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

async function navegarPorElMenu(page: Page, nombre: string) {
  if (enMovil(page)) {
    await page.getByRole("button", { name: "Abrir navegacion" }).click();
  }
  /*
   * SIN `exact: true`, a proposito.
   *
   * Los enlaces de «Mensajes portal» y «Aprobaciones» llevan una marca con el
   * numero de pendientes, asi que su nombre accesible real es «Mensajes
   * portal 3», no «Mensajes portal». Con coincidencia exacta no se encontraban
   * y las diez pruebas de esas dos pantallas se quedaban esperando a un
   * enlace que existia delante. «Notificaciones» no lleva marca y por eso
   * pasaba: el fallo parecia caprichoso hasta ver de donde salia la cifra.
   *
   * Se ancla al principio para no confundir un enlace con otro.
   */
  await page
    .getByRole("link", { name: new RegExp(`^${nombre}`) })
    .first()
    .click();
}

/** Deja los mensajes como los dejo el sembrado. */
async function restaurarMensajes({ page }: { page: Page }) {
  await page.waitForLoadState("networkidle").catch(() => {
    // La pagina puede estar ya cerrada.
  });
  await prisma.portalMessage.updateMany({
    where: {
      case: { org: { slug: E2E.avisos.slug } },
      fromFamily: true,
      content: { startsWith: E2E.avisos.textoSinLeer },
    },
    data: { readAt: null },
  });
  await prisma.portalMessage.deleteMany({
    where: { case: { org: { slug: E2E.avisos.slug } }, fromFamily: false },
  });
}

test.describe("Mensajes en las tres pantallas", () => {
  test.afterEach(restaurarMensajes);

  test("no se desplaza en horizontal", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await navegarPorElMenu(page, "Mensajes portal");
    await page.waitForURL("**/messages");
    await pantallaUtil(page);

    await sinDesbordeHorizontal(page, "Mensajes del portal");
  });

  test("la lista de conversaciones se ve entera", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await navegarPorElMenu(page, "Mensajes portal");
    await page.waitForURL("**/messages");
    await pantallaUtil(page);

    const fila = page.getByTestId(`conversacion-${E2E.avisos.caseConDos}`);
    await expect(fila).toBeVisible();
    await expect(fila).toContainText(E2E.avisos.caseConDos);

    // La fila no se sale de su columna.
    const caja = await fila.boundingBox();
    const ancho = page.viewportSize()?.width ?? 0;
    expect(caja).not.toBeNull();
    expect(caja!.x + caja!.width, "la conversacion cabe en pantalla").toBeLessThanOrEqual(
      ancho + 1,
    );
  });

  test("se abre el hilo y se vuelve a la lista", async ({ page }) => {
    /*
     * El recorrido propio de movil: en estrecho se entra viendo la LISTA,
     * abrir una conversacion la sustituye por el hilo, y hay que poder volver.
     *
     * DEFECTO CORREGIDO POR EL CAMINO: la pantalla preseleccionaba sola la
     * primera conversacion tambien en movil, asi que el usuario entraba
     * directamente DENTRO de un hilo que no habia elegido y no llegaba a ver
     * la lista nunca. Ahora la preseleccion solo ocurre cuando los dos paneles
     * caben a la vez.
     */
    await login(page, E2E.avisos.owner);
    await navegarPorElMenu(page, "Mensajes portal");
    await page.waitForURL("**/messages");
    await pantallaUtil(page);

    await page.getByTestId(`conversacion-${E2E.avisos.caseConUno}`).click();
    await expect(page.getByTestId("hilo-mensajes")).toContainText(E2E.avisos.textoSinLeer);
    await sinDesbordeHorizontal(page, "El hilo de mensajes");

    const volver = page.getByRole("button", { name: "Volver" });
    if (esEstrecha(page)) {
      // En movil la lista se ha ido y el boton esta.
      await expect(volver).toBeVisible();
      await volver.click();
      await expect(page.getByTestId(`conversacion-${E2E.avisos.caseConDos}`)).toBeVisible();
    } else {
      // En pantalla ancha conviven los dos paneles y no hace falta volver.
      await expect(volver).toBeHidden();
      await expect(page.getByTestId(`conversacion-${E2E.avisos.caseConDos}`)).toBeVisible();
    }
  });

  test("se escribe y se envia una respuesta", async ({ page }) => {
    const texto = `Respuesta en pantalla estrecha ${Date.now()}`;

    await login(page, E2E.avisos.owner);
    await navegarPorElMenu(page, "Mensajes portal");
    await page.waitForURL("**/messages");
    await pantallaUtil(page);

    await page.getByTestId(`conversacion-${E2E.avisos.caseConDos}`).click();

    const campo = page.getByTestId("campo-respuesta");
    await expect(campo).toBeVisible();
    await campo.fill(texto);
    // El boton de enviar tiene que seguir alcanzable con el campo lleno: es
    // donde el teclado y el texto largo empujan el diseño.
    const boton = page.getByTestId("boton-enviar-mensaje");
    await expect(boton).toBeVisible();
    await boton.click();

    await expect(page.getByTestId("hilo-mensajes")).toContainText(texto);
    await sinDesbordeHorizontal(page, "El hilo con una respuesta enviada");
  });

  test("un texto muy largo no rompe el ancho", async ({ page }) => {
    const largo = `Palabra-sin-espacios-${"muylarga".repeat(20)}`;

    await login(page, E2E.avisos.owner);
    await navegarPorElMenu(page, "Mensajes portal");
    await page.waitForURL("**/messages");
    await pantallaUtil(page);

    await page.getByTestId(`conversacion-${E2E.avisos.caseConDos}`).click();
    await page.getByTestId("campo-respuesta").fill(largo);
    await page.getByTestId("boton-enviar-mensaje").click();

    await expect(page.getByTestId("hilo-mensajes")).toContainText("Palabra-sin-espacios");
    await sinDesbordeHorizontal(page, "El hilo con una palabra larguisima");
  });

  test("los filtros se pulsan y cambian la lista", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await navegarPorElMenu(page, "Mensajes portal");
    await page.waitForURL("**/messages");
    await pantallaUtil(page);

    await page.getByTestId("filtro-all").click();
    await expect(page.getByTestId(`conversacion-${E2E.avisos.caseLeido}`)).toBeVisible();
    await sinDesbordeHorizontal(page, "Mensajes con el filtro «Todos»");
  });
});

test.describe("Notificaciones en las tres pantallas", () => {
  test("el historial no se desplaza en horizontal", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await navegarPorElMenu(page, "Notificaciones");
    await page.waitForURL("**/notifications");
    await pantallaUtil(page);

    await sinDesbordeHorizontal(page, "El historial de notificaciones");
  });

  test("el estado del envio se lee sin depender del color", async ({ page }) => {
    /*
     * En movil la tabla se cambia por tarjetas y el estado se pintaba con un
     * punto verde o rojo A SECAS. Quien no distingue esos dos colores —o usa
     * un lector de pantalla— no tenia forma de saber si el aviso se envio.
     * Ahora el texto va en `sr-only`: invisible, pero presente en el arbol de
     * accesibilidad y localizable por las pruebas.
     */
    await login(page, E2E.avisos.owner);
    await navegarPorElMenu(page, "Notificaciones");
    await page.waitForURL("**/notifications");
    await pantallaUtil(page);

    // En cualquier tamaño debe poder leerse «Enviado» y «Fallido» como texto.
    await expect(page.getByText("Enviado").first()).toBeAttached();
    await expect(page.getByText("Fallido").first()).toBeAttached();
  });

  test("los filtros se localizan por su etiqueta y funcionan", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await navegarPorElMenu(page, "Notificaciones");
    await page.waitForURL("**/notifications");
    await pantallaUtil(page);

    await expect(page.getByLabel("Estado")).toBeVisible();
    await page.getByLabel("Estado").selectOption("failed");
    await expect(page.getByTestId("recuento-notificaciones")).toContainText("(filtrado)");
    await sinDesbordeHorizontal(page, "El historial filtrado");
  });

  test("la paginacion se pulsa", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await navegarPorElMenu(page, "Notificaciones");
    await page.waitForURL("**/notifications");
    await pantallaUtil(page);

    const siguiente = page.getByRole("button", { name: "Siguiente" });
    await expect(siguiente).toBeVisible();
    await siguiente.click();
    await expect(page.getByText("Pagina 2 de 2")).toBeVisible();
    await sinDesbordeHorizontal(page, "El historial en la segunda pagina");
  });
});

test.describe("Aprobaciones en las tres pantallas", () => {
  test.afterEach(async () => {
    await prisma.approval.updateMany({
      where: {
        case: { org: { slug: E2E.avisos.slug } },
        OR: [
          { action: E2E.avisos.accionAprobar, details: E2E.avisos.detalleAprobacion },
          { action: E2E.avisos.accionRechazar, details: E2E.avisos.detalleConHtml },
          { action: "generate_checklist" },
        ],
      },
      data: { status: "PENDING", reviewerId: null, reviewedAt: null },
    });
  });

  test("la cola no se desplaza en horizontal", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await navegarPorElMenu(page, "Aprobaciones");
    await page.waitForURL("**/approvals");
    await pantallaUtil(page);

    await sinDesbordeHorizontal(page, "La cola de aprobaciones");
  });

  test("las pestañas se pulsan y filtran", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await navegarPorElMenu(page, "Aprobaciones");
    await page.waitForURL("**/approvals");
    await pantallaUtil(page);

    await page.getByTestId("pestana-APPROVED").click();
    await expect(page.getByTestId("recuento-aprobaciones")).toContainText("aprobacion");
    await sinDesbordeHorizontal(page, "La pestaña «Aprobadas»");
  });

  test("se aprueba desde una pantalla estrecha", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await navegarPorElMenu(page, "Aprobaciones");
    await page.waitForURL("**/approvals");
    await pantallaUtil(page);

    const boton = page.getByRole("button", {
      name: `Aprobar: Enviar borrador (${E2E.avisos.caseConDos})`,
    });
    await expect(boton).toBeVisible();
    await boton.click();

    await expect(page.getByTestId("exito-accion-aprobacion")).toBeVisible();
    await sinDesbordeHorizontal(page, "La cola despues de aprobar");
  });

  test("el detalle se despliega sin romper el ancho", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await navegarPorElMenu(page, "Aprobaciones");
    await page.waitForURL("**/approvals");
    await pantallaUtil(page);

    await page
      .getByRole("button", {
        name: `Ver detalle de Enviar borrador (${E2E.avisos.caseConDos})`,
      })
      .click();

    await expect(page.getByText("Estimada familia")).toBeVisible();
    await sinDesbordeHorizontal(page, "La aprobacion con el detalle abierto");
  });
});
