/**
 * Envío del archivo del NAVEGADOR al almacenamiento, sin pasar por la función.
 *
 * POR QUÉ `XMLHttpRequest` Y NO `fetch`
 * -------------------------------------
 * `fetch` no informa del progreso de SUBIDA. Sin progreso, un archivo de 20 MiB
 * en una conexión lenta deja la pantalla parada varios minutos y la persona no
 * puede distinguir "va" de "se ha colgado", así que cierra la pestaña y pierde
 * el trabajo. `XMLHttpRequest` sí publica `upload.onprogress`, y es la única
 * razón por la que se usa aquí.
 *
 * NO SE MANDA `Content-Type` A PROPÓSITO
 * --------------------------------------
 * La URL se firma sin esa cabecera (ver `getPresignedUploadUrl`). Si el
 * navegador la enviara firmada de otra forma, la firma no cuadraría y el
 * usuario vería un error de almacenamiento que no puede entender ni arreglar.
 * El tipo real lo decide el servidor con los bytes, al confirmar.
 */

export class ErrorDeSubida extends Error {
  constructor(
    message: string,
    /** `true` si no hubo respuesta: red caída, CORS mal configurado, cancelada. */
    readonly sinRespuesta: boolean = false,
  ) {
    super(message);
    this.name = "ErrorDeSubida";
  }
}

export function subirAlAlmacen(
  url: string,
  file: File,
  opciones: { onProgreso?: (porcentaje: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  const { onProgreso, signal } = opciones;

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);

    if (onProgreso) {
      xhr.upload.onprogress = (e) => {
        // `lengthComputable` es falso en algunas configuraciones de proxy: en
        // ese caso no se inventa un porcentaje, simplemente no se actualiza.
        if (e.lengthComputable && e.total > 0) {
          onProgreso(Math.min(100, Math.round((e.loaded / e.total) * 100)));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(
        new ErrorDeSubida(
          `el almacenamiento ha respondido ${xhr.status}`,
        ),
      );
    };

    /*
     * Un error de red aquí es casi siempre CORS mal configurado en el bucket.
     * El navegador no deja ver el motivo por seguridad, así que el mensaje dice
     * lo que se sabe —no ha habido respuesta— y no inventa una causa.
     */
    xhr.onerror = () =>
      reject(new ErrorDeSubida("no se ha podido contactar con el almacenamiento", true));
    xhr.ontimeout = () =>
      reject(new ErrorDeSubida("el almacenamiento ha tardado demasiado", true));
    xhr.onabort = () => reject(new ErrorDeSubida("subida cancelada", true));

    if (signal) {
      if (signal.aborted) {
        reject(new ErrorDeSubida("subida cancelada", true));
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}
