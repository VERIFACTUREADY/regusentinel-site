/*
 * SIN TECHO DE CUERPO GLOBAL A PROPOSITO.
 *
 * Aqui habia `experimental.middlewareClientMaxBodySize = MAX_FILE_BYTES + 1 MiB`
 * (22 020 096 bytes) para que un multipart de 20 MiB cupiera en las rutas de
 * subida. Esas rutas ya no reciben archivos: el navegador escribe directamente
 * en el almacen con una politica POST y la aplicacion solo recibe JSON pequeno
 * (`upload-url` y `complete`). Mantener el techo ampliaba para TODAS las rutas
 * el cuerpo que Next acepta clonar, sin que ninguna lo necesitara.
 *
 * Inventario de rutas comprobado al retirarlo: ninguna llama a `formData()`,
 * `arrayBuffer()` ni `blob()`; la unica que lee el cuerpo en crudo es el webhook
 * de Stripe (`req.text()`, cuerpos de kilobytes). La mayor entrada JSON legitima
 * es la importacion de expedientes, acotada por la propia ruta a ~4 MB de
 * base64. Queda el valor por defecto de Next (10 MB) y, en Vercel, el limite de
 * 4,5 MB de la plataforma.
 *
 * `__tests__/file-policy.test.ts` falla si alguien vuelve a subir el techo o a
 * recibir archivos por una ruta de la aplicacion.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
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
