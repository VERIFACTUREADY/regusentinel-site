import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests de navegador.
 *
 * Estos SI son E2E: arrancan la aplicacion de verdad, con PostgreSQL real, y
 * conducen un Chromium. No mockean Prisma, ni NextAuth, ni la sesion. Cubren
 * lo que ni los handler tests ni las pruebas de integracion pueden demostrar:
 * que los flujos completos funcionan desde el navegador del usuario.
 *
 * Requieren DATABASE_URL apuntando a una base DESECHABLE. Usa
 * ./scripts/e2e.sh, que la prepara, siembra los datos y arranca el servidor.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // comparten una unica base de datos
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // En CI se genera ademas el informe HTML: es el artefacto que se sube al
  // fallar y sin el no hay forma de investigar un fallo remoto.
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",

    // El navegador debe comportarse como el de un usuario real de este
    // producto, que es espanol. Con el navegador en UTC —el valor por defecto de
    // un contenedor— se escapan justo los fallos de fecha: el calendario
    // calculaba las claves de dia con `toISOString()` y salia desplazado 24
    // horas para todo el mercado objetivo, mientras la CI lo daba por bueno.
    timezoneId: "Europe/Madrid",
    locale: "es-ES",
    // El navegador viene preinstalado en la imagen y su version puede no
    // coincidir con la que espera @playwright/test. Se apunta al binario que
    // existe en vez de descargar otro: PLAYWRIGHT_CHROMIUM_PATH lo fija de
    // forma explicita (ver scripts/e2e.sh).
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
        : {}),
      // Los proyectos de tablet y movil emulan un dispositivo tactil, y ese
      // arranque de Chromium se niega a correr como root sin esta bandera. Sin
      // ella los dos proyectos fallaban al lanzar el navegador, no por un
      // defecto de la aplicacion. El contenedor de CI ya esta aislado.
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },

  /**
   * Tres tamanos de pantalla.
   *
   * `escritorio` ejecuta la suite completa. Los otros dos ejecutan solo los
   * ficheros marcados como responsive: repetir toda la suite en tres tamanos
   * triplicaria el tiempo de CI sin encontrar nada nuevo en la mayoria de los
   * casos, mientras que lo que de verdad se rompe al estrechar la pantalla
   * —menus, tablas, rejillas— si se comprueba en los tres.
   */
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    {
      name: "tablet",
      testMatch: /.*\.responsive\.spec\.ts/,
      /*
       * Tamano de tablet sobre Chromium, definido a mano.
       *
       * `devices["iPad (gen 7)"]` trae `defaultBrowserType: "webkit"`, y aqui
       * solo hay Chromium instalado: el proyecto entero fallaba al lanzar el
       * navegador, no por un defecto de la aplicacion. Lo que se quiere
       * comprobar es el TAMANO, asi que se fija el tamano y se deja el motor
       * que existe.
       */
      use: {
        browserName: "chromium",
        viewport: { width: 820, height: 1180 },
        deviceScaleFactor: 2,
        isMobile: false,
        hasTouch: true,
      },
    },
    {
      name: "movil",
      testMatch: /.*\.responsive\.spec\.ts/,
      use: { ...devices["Pixel 5"] },
    },
  ],
});
