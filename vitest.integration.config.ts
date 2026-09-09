import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Pruebas de integracion REALES: PostgreSQL efimero y MinIO.
 *
 * No mockean Prisma ni el cliente de S3. Comprueban lo que los mocks no pueden:
 * constraints de base de datos, transacciones, concurrencia y el comportamiento
 * real del almacenamiento de objetos.
 *
 * Requieren DATABASE_URL apuntando a una base DESECHABLE: el arranque borra y
 * recrea el esquema. Ver scripts/test-db.sh.
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
    include: ["__tests__/integration/**/*.test.ts"],
    // Comparten una unica base de datos: sin aislamiento por fichero se pisan.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
