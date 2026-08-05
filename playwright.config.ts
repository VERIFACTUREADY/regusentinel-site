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
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // El navegador viene preinstalado en la imagen y su version puede no
    // coincidir con la que espera @playwright/test. Se apunta al binario que
    // existe en vez de descargar otro: PLAYWRIGHT_CHROMIUM_PATH lo fija de
    // forma explicita (ver scripts/e2e.sh).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
