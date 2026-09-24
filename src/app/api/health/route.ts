import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/health — comprobación de vida del servicio.
 *
 * POR QUÉ ESTÁ FORZADA A DINÁMICA
 * --------------------------------
 * Sin estas dos líneas, Next 14 considera este manejador estáticamente
 * generable: no lee cabeceras, ni cookies, ni parámetros. Y lo ejecuta durante
 * `next build`, dentro de «Generating static pages».
 *
 * Eso rompe dos cosas a la vez:
 *
 *   1. El build abre una conexión a la base de datos de producción desde la
 *      máquina que compila. En Vercel `DATABASE_URL` está definida durante el
 *      build, así que el intento es real: si la base sólo admite conexiones
 *      desde la red de ejecución (lista de IP permitidas, red privada,
 *      límite de conexiones del pooler), el build se queda esperando hasta
 *      agotar su tiempo y el despliegue falla. Un despliegue no debe depender
 *      de que la base de datos sea alcanzable desde la red de compilación.
 *
 *   2. Aunque conectara, el resultado quedaría congelado en el artefacto. Una
 *      comprobación de salud que responde `{"status":"ok"}` desde una copia
 *      cacheada del día del despliegue no comprueba nada: seguiría diciendo
 *      que todo va bien con la base de datos caída. Es peor que no tenerla,
 *      porque la monitorización la daría por buena.
 *
 * `force-dynamic` la saca de la generación estática y `revalidate = 0` impide
 * que la respuesta se cachee.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.4.0",
    });
  } catch {
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
