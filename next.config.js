/*
 * LIMITE DEL CUERPO DE PETICION: EL MAXIMO DE SUBIDA TIENE QUE CABER.
 *
 * EL DEFECTO QUE CORRIGE
 * ----------------------
 * Next 15 trae un limite propio para el cuerpo de la peticion —10 MB— que
 * Next 14 no tenia (`DEFAULT_BODY_CLONE_SIZE_LIMIT` en
 * `next/dist/server/body-streams.js`). Al superarlo NO responde un error: TRUNCA
 * el cuerpo y sigue, avisando por consola «Request body exceeded 10MB. Only the
 * first 10MB will be available». `req.formData()` recibe entonces un multipart
 * cortado por la mitad y lanza «Failed to parse body as FormData».
 *
 * Consecuencia medida sobre las rutas reales, con la aplicacion construida:
 *   - 19,9 MiB → 500 «Error al subir archivo» (el parseo falla y no es
 *     cuestion de tamano, asi que la excepcion sigue su camino).
 *   - 20 MiB EXACTOS → 413 «El archivo supera el maximo de 20 MB», es decir,
 *     se rechazaba un archivo que esta JUSTO en el limite permitido.
 *
 * O sea: la aplicacion prometia 20 MB y en la practica no admitia nada por
 * encima de 10 MB. Entre 10 y 20 MB mentia con un 500 generico, y en el limite
 * exacto mentia con un 413.
 *
 * POR QUE AQUI Y NO EN LA RUTA
 * ----------------------------
 * El truncamiento ocurre ANTES de que el handler exista; desde la ruta no hay
 * nada que interceptar. Este es el unico punto donde se puede subir el techo.
 *
 * POR QUE ESTE VALOR Y NO «SIN LIMITE»
 * ------------------------------------
 * Se deja el maximo real de archivo MAS un margen de 1 MiB para el armazon del
 * multipart (cabeceras, separadores y nombre del campo), que viaja con el
 * archivo y no cuenta como archivo. Asi:
 *   - un archivo de exactamente el maximo cabe y se acepta;
 *   - uno por encima del maximo se sigue rechazando con 413 y su mensaje real,
 *     ya sea por la comprobacion de `file.size` o por lo declarado;
 *   - el techo sigue acotado: no se pasa a almacenar peticiones sin limite.
 *
 * La aritmetica replica a proposito la de `src/lib/file-policy.ts` (que es
 * TypeScript y no se puede importar desde aqui). `__tests__/file-policy.test.ts`
 * comprueba que ambos siguen de acuerdo; si alguien cambia uno y no el otro,
 * esa prueba falla.
 */
const MB = 1024 * 1024;
const maxSubidaMb = Number.parseInt(process.env.MAX_UPLOAD_MB ?? "", 10);
const MAX_ARCHIVO_BYTES =
  (Number.isFinite(maxSubidaMb) && maxSubidaMb > 0 && maxSubidaMb <= 200 ? maxSubidaMb : 20) * MB;

/** Techo del cuerpo: el archivo mas el armazon del multipart. */
const LIMITE_CUERPO_BYTES = MAX_ARCHIVO_BYTES + MB;

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    middlewareClientMaxBodySize: LIMITE_CUERPO_BYTES,
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async headers() {
    return [
      {
        // Aplica a todo salvo /embed/*, que necesita poder embeberse en sitios de terceros.
        source: "/((?!embed).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // Widgets embebibles: gestorias y funerarias deben poder embeber el iframe en su web.
        // Sin X-Frame-Options; usamos CSP frame-ancestors * para permitir cualquier origen.
        source: "/embed/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
