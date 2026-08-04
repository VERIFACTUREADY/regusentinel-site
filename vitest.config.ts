import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Suite por defecto: unit / service / handler tests. No necesitan servicios
 * externos, asi que corren en cualquier maquina y en CI sin secretos.
 *
 * Las pruebas de integracion (PostgreSQL y MinIO reales) viven en
 * __tests__/integration/ y se ejecutan con `npm run test:integration`, que usa
 * vitest.integration.config.ts. Se excluyen aqui para que `npm test` no falle
 * en un entorno sin base de datos.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    exclude: ["**/node_modules/**", "**/dist/**", "__tests__/integration/**"],
  },
});
