/**
 * Portal familiar — primera visita: aceptar el consentimiento deja el portal
 * listo, sin recargar.
 *
 * QUE VIGILA ESTA PRUEBA
 * -----------------------
 * El defecto real, reproducido en el Preview: al aceptar el consentimiento la
 * pantalla pedia documentos y mensajes SIN mirar si el consentimiento ya
 * constaba. En la primera visita —antes de aceptar— esas dos peticiones
 * llegaban igual, el servidor las rechazaba con 403 (correcto: todavia no hay
 * consentimiento), y el error crudo se quedaba en el estado del componente.
 * Al aceptar, la puerta se cerraba pero nadie volvia a pedir los datos: el 403
 * de antes seguia ahi hasta que la familia recargaba la pagina a mano.
 *
 * Esta prueba reproduce el camino real de un familiar que abre el enlace por
 * primera vez: consentimiento pedido -> se acepta -> documentos y mensajes
 * aparecen en la MISMA carga, sin 403 visible en ningun momento y sin que la
 * prueba recargue la pagina.
 */
import { test, expect, pantallaUtil } from "./vigilancia";
import { E2E } from "./seed-e2e";

const PORTAL = E2E.portalConsentimiento;

test.describe("Portal familiar: primera visita y consentimiento", () => {
  test("aceptar el consentimiento carga documentos y mensajes sin recargar, y sin 403 visible", async ({
    page,
  }) => {
    // Vigilancia explicita de las dos llamadas que competian con la
    // persistencia del consentimiento. El detector global de vigilancia.ts
    // solo hace fallar la prueba por 5xx, no por 4xx (un 403 es una respuesta
    // legitima en otros escenarios), asi que este 403 concreto se comprueba
    // aqui a proposito.
    const llamadasProtegidas: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      const url = res.url();
      if (
        url.includes(`/api/portal/${PORTAL.token}/documents`) ||
        url.includes(`/api/portal/${PORTAL.token}/messages`)
      ) {
        llamadasProtegidas.push({ url, status: res.status() });
      }
    });

    await page.goto(`/portal/${PORTAL.token}`);
    await pantallaUtil(page);

    // Primera visita real: la puerta del consentimiento tiene que aparecer.
    const casilla = page.getByRole("checkbox", { name: /He le[ií]do y acepto/ });
    await expect(casilla).toBeAttached({ timeout: 30_000 });

    // Se pulsa la ETIQUETA, que es donde pulsa una persona: el input real va
    // con `sr-only` y el recuadro visible es lo que intercepta el puntero.
    await page.getByText(/He le[ií]do y acepto el tratamiento/).click();
    await expect(casilla).toBeChecked();
    await page.getByRole("button", { name: /Aceptar y acceder al portal/ }).click();

    // Sin recargar: todo lo que sigue se comprueba dentro de la MISMA carga
    // de pagina que acepto el consentimiento.
    await expect(page.getByText(PORTAL.documento)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Mensaje previo de la gestoria/)).toBeVisible({
      timeout: 15_000,
    });

    // El error crudo que antes se veia no debe aparecer en ningun momento.
    await expect(page.getByTestId("portal-docs-error")).toHaveCount(0);

    // Y, mirando la red directamente: ninguna llamada a documentos o mensajes
    // debe haber recibido un 403 en todo el flujo, ni antes ni despues de
    // aceptar.
    const rechazadas = llamadasProtegidas.filter((l) => l.status === 403);
    expect(
      rechazadas,
      `Llamadas a documentos/mensajes rechazadas con 403: ${JSON.stringify(rechazadas)}`,
    ).toEqual([]);
  });

  test("una segunda visita, ya con consentimiento, carga documentos y mensajes de una vez", async ({
    page,
  }) => {
    // La primera prueba de este fichero ya acepto el consentimiento para este
    // token: esta comprueba la otra mitad, que una visita SIN puerta tambien
    // carga bien.
    await page.goto(`/portal/${PORTAL.token}`);
    await pantallaUtil(page);

    await expect(page.getByRole("checkbox", { name: /He le[ií]do y acepto/ })).toHaveCount(0);
    await expect(page.getByText(PORTAL.documento)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("portal-docs-error")).toHaveCount(0);
  });
});
