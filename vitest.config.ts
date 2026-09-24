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

    // ENTORNO FIJO PARA QUE LA SUITE SEA HERMETICA.
    //
    // La cabecera de este fichero promete que estas pruebas "corren en
    // cualquier maquina y en CI sin secretos". No era cierto: en la CI, sin
    // `DATABASE_URL` en el entorno, el motor de consultas de Prisma abortaba el
    // proceso ENTERO al final de la ejecucion —despues de que los 62 ficheros
    // hubieran pasado— con:
    //
    //     Failed to deserialize constructor options ... data_model, log_level
    //     thread caused non-unwinding panic. aborting.
    //     Aborted (core dumped)  ->  exit code 134
    //
    // En local pasaba porque el desarrollador suele tener la variable
    // exportada, asi que el fallo solo aparecia en CI. Estas son las dos cosas
    // que la auditoria pedia separar: "verde en local" no es "verde".
    //
    // El valor no apunta a ninguna base real y NINGUNA prueba de esta suite
    // consulta nada: todas mockean Prisma. Solo existe para que construir el
    // cliente no reviente. Las pruebas que SI hablan con PostgreSQL viven en
    // __tests__/integration/ y exigen su propia DATABASE_URL.
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://sin-usar:sin-usar@127.0.0.1:5432/sin-usar?schema=public",
    },

    // e2e/ son pruebas de Playwright: tienen su propio runner y no deben
    // recogerse aqui (vitest incluye *.spec.ts por defecto).
    exclude: ["**/node_modules/**", "**/dist/**", "__tests__/integration/**", "e2e/**"],
  },
});
