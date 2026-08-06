/**
 * Deteccion global de fallos en las pruebas de navegador.
 *
 * POR QUE HACE FALTA
 * -------------------
 * Una prueba de Playwright solo falla si una asercion falla. Todo lo demas pasa
 * desapercibido: una excepcion de React que deja media pantalla sin pintar, un
 * 500 de una API secundaria, un `fetch` que no llega, la pagina de error de
 * Next. La prueba busca su boton, lo encuentra, y da la pantalla por buena
 * mientras el usuario real ve algo roto.
 *
 * Este fichero convierte todo eso en fallo. Se aplica a TODA prueba que importe
 * `test` desde aqui en vez de desde `@playwright/test`.
 *
 * LA ALLOWLIST
 * ------------
 * Cada excepcion esta escrita abajo con su motivo. Es deliberadamente corta: en
 * cuanto se admite "los errores de esta libreria son normales", la red de
 * seguridad deja de existir. Si algo hay que anadir, se anade con su razon.
 */
import { test as base, expect, type Page } from "@playwright/test";

/**
 * Ruido conocido del navegador y del entorno de pruebas, no de la aplicacion.
 *
 * Cada entrada necesita motivo. No vale "sale mucho".
 */
const RUIDO_ADMITIDO: { patron: RegExp; motivo: string }[] = [
  {
    patron: /favicon\.ico/i,
    motivo:
      "El navegador pide el favicon por su cuenta en cada navegacion y la app " +
      "no lo sirve en todas las rutas. No lo provoca el codigo bajo prueba.",
  },
  {
    patron: /Download the React DevTools/i,
    motivo: "Aviso informativo que React imprime en desarrollo. No es un error.",
  },
  {
    patron: /\[Fast Refresh\]/i,
    motivo: "Mensajes del recargado en caliente de Next. Solo en modo desarrollo.",
  },
  {
    patron: /Failed to fetch RSC payload for .*Falling back to browser navigation/i,
    motivo:
      "Next prefetch los enlaces de navegacion al vuelo. Cuando la prueba cambia " +
      "de pagina o termina, esas peticiones se abortan y Next lo anuncia. El " +
      "propio mensaje dice que recurre a la navegacion normal: se recupera solo " +
      "y el usuario no ve nada. No indica ningun fallo de la aplicacion.",
  },
  {
    patron: /Failed to load resource: the server responded with a status of/i,
    motivo:
      "Mensaje generico que emite el NAVEGADOR por cada respuesta de error, sin " +
      "distinguir cual ni de donde. Es un duplicado del evento de red, que si " +
      "trae la URL: el detector de respuestas de abajo es el que decide, marcando " +
      "los 5xx y respetando permitirFalloEn(). Contarlo dos veces solo anadiria " +
      "ruido sin cubrir nada nuevo, y ademas ocultaria los 4xx legitimos —401, " +
      "403, 404— que la aplicacion devuelve a proposito.",
  },
  {
    patron: /ResizeObserver loop/i,
    motivo:
      "Aviso del propio navegador cuando un ResizeObserver reordena en el mismo " +
      "frame. No rompe nada visible y lo emite Chromium, no la aplicacion.",
  },
];

function esRuido(texto: string): boolean {
  return RUIDO_ADMITIDO.some((r) => r.patron.test(texto));
}

/** Rutas cuyo 4xx/5xx forma parte de lo que la prueba esta comprobando. */
const RUTAS_CON_FALLO_ESPERADO = new Set<string>();

/**
 * Marca una ruta para que sus errores HTTP no hagan fallar la prueba.
 *
 * Se usa en las pruebas que simulan una API caida a proposito: ahi el 500 es el
 * escenario, no el defecto.
 */
export function permitirFalloEn(page: Page, patron: string) {
  RUTAS_CON_FALLO_ESPERADO.add(patron);
  page.once("close", () => RUTAS_CON_FALLO_ESPERADO.delete(patron));
}

function falloEsperado(url: string): boolean {
  return Array.from(RUTAS_CON_FALLO_ESPERADO).some((p) => url.includes(p));
}

interface Incidencia {
  tipo: string;
  detalle: string;
}

export const test = base.extend<{ vigilante: void }>({
  vigilante: [
    async ({ page }, use, testInfo) => {
      const incidencias: Incidencia[] = [];

      // 1. Excepciones no capturadas: lo que deja media pantalla sin pintar.
      page.on("pageerror", (err) => {
        if (esRuido(err.message)) return;
        incidencias.push({ tipo: "pageerror", detalle: `${err.name}: ${err.message}` });
      });

      // 2. Errores de consola.
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const texto = msg.text();
        if (esRuido(texto)) return;
        if (falloEsperado(texto)) return;
        incidencias.push({ tipo: "console.error", detalle: texto });
      });

      // 3. Respuestas 5xx. Un 500 en una llamada secundaria no rompe la
      //    asercion pero si el producto.
      page.on("response", (res) => {
        if (res.status() < 500 || res.status() > 599) return;
        if (falloEsperado(res.url())) return;
        incidencias.push({ tipo: `HTTP ${res.status()}`, detalle: res.url() });
      });

      // 4. Peticiones que ni siquiera llegan.
      page.on("requestfailed", (req) => {
        const motivo = req.failure()?.errorText ?? "desconocido";
        // Abortar al cambiar de pagina o al cancelar un fetch es normal.
        if (/ERR_ABORTED|NS_BINDING_ABORTED/.test(motivo)) return;
        if (esRuido(req.url()) || falloEsperado(req.url())) return;
        incidencias.push({ tipo: "peticion fallida", detalle: `${req.url()} (${motivo})` });
      });

      await use();

      // Una prueba que ya ha fallado no necesita mas ruido encima.
      if (testInfo.status !== testInfo.expectedStatus) return;

      if (incidencias.length > 0) {
        const resumen = incidencias
          .map((i, n) => `  ${n + 1}. [${i.tipo}] ${i.detalle}`)
          .join("\n");
        throw new Error(
          `La pagina ha funcionado mal aunque las aserciones pasaran.\n` +
            `${incidencias.length} incidencia(s):\n${resumen}\n\n` +
            `Si alguna es esperada por la prueba, usa permitirFalloEn(page, "...").\n` +
            `Si es ruido del navegador, anadela a RUIDO_ADMITIDO con su motivo.`,
        );
      }
    },
    { auto: true },
  ],
});

/**
 * Comprueba que una pantalla esta REALMENTE cargada.
 *
 * Las tres formas de fallar sin que falle ninguna asercion:
 *
 *   - la pagina de error de Next, que responde 200 con "Application error";
 *   - la pantalla en blanco, que tiene DOM pero nada visible;
 *   - la carga infinita, que ensena el "Cargando..." para siempre.
 */
export async function pantallaUtil(page: Page, opciones: { esperaMs?: number } = {}) {
  const espera = opciones.esperaMs ?? 15_000;

  // Pagina de error de Next / React.
  const textoError = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  for (const marca of [
    "Application error: a client-side exception",
    "Application error: a server-side exception",
    "This page could not be found",
    "Internal Server Error",
  ]) {
    expect(textoError, `La pagina muestra el error de Next: "${marca}"`).not.toContain(marca);
  }

  // Pantalla en blanco: hay DOM pero el usuario no ve nada.
  const visible = textoError.replace(/\s+/g, " ").trim();
  expect(visible.length, "La pantalla esta practicamente vacia").toBeGreaterThan(20);

  // Carga infinita: el indicador sigue ahi cuando ya deberia haberse ido.
  const cargando = page.getByText(/^\s*(Cargando|Loading)\.{0,3}\s*$/i);
  if ((await cargando.count()) > 0) {
    await expect(
      cargando.first(),
      "El indicador de carga sigue visible: la pantalla se ha quedado cargando",
    ).toBeHidden({ timeout: espera });
  }
}

export { expect };
