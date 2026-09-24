/**
 * Traduce errores de infraestructura de Prisma a un mensaje accionable para
 * el usuario final. Devuelve null si el error no es de infraestructura
 * (esos se siguen tratando como "Error interno" genérico).
 */
export function dbUnavailableMessage(error: unknown): string | null {
  const code =
    (error as { code?: string })?.code ??
    (error as { errorCode?: string })?.errorCode;
  // P2021/P2022: tabla o columna inexistente → migraciones sin aplicar.
  if (code === "P2021" || code === "P2022") {
    return "La base de datos no está inicializada (faltan migraciones). Vuelve a desplegar la aplicación o ejecuta `npx prisma migrate deploy`.";
  }
  // P1000/P1001/P1002/P1003: credenciales, host inaccesible, timeout, DB inexistente.
  if (code === "P1000" || code === "P1001" || code === "P1002" || code === "P1003") {
    return "No se pudo conectar con la base de datos. Revisa la configuración de DATABASE_URL.";
  }
  return null;
}
