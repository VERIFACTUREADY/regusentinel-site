/**
 * Envío del archivo del NAVEGADOR al almacenamiento, sin pasar por la función.
 *
 * QUÉ SE ENVÍA
 * ------------
 * Un formulario POST con los campos firmados que devolvió la autorización y el
 * archivo al final. El almacén evalúa la política ANTES de guardar: si el
 * tamaño no es exactamente el autorizado, o la clave no es la firmada, rechaza
 * y no escribe nada. Ver `crearPoliticaDeSubida` en `s3.ts`.
 *
 * El `Content-Type` del formulario lo pone el navegador (`multipart/form-data`)
 * y no se añade ningún campo por cuenta propia: la política sólo admite los que
 * firmó el servidor, y cualquier otro se rechaza con `403`.
 *
 * POR QUÉ `XMLHttpRequest` Y NO `fetch`
 * -------------------------------------
 * `fetch` no informa del progreso de SUBIDA. Sin progreso, un archivo de 20 MiB
 * en una conexión lenta deja la pantalla parada varios minutos y la persona no
 * puede distinguir "va" de "se ha colgado". `XMLHttpRequest` sí publica
 * `upload.onprogress`, y es la única razón por la que se usa aquí.
 */

export interface DestinoDeSubida {
  url: string;
  fields: Record<string, string>;
}

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

/** Código de error S3 del cuerpo XML, si el navegador deja leerlo. */
function codigoDeError(texto: string): string | null {
  const m = /<Code>([^<]+)<\/Code>/.exec(texto);
  return m ? m[1] : null;
}

function mensajePara(estado: number, codigo: string | null): string {
  if (codigo === "EntityTooLarge" || codigo === "EntityTooSmall") {
    return "el archivo no tiene el tamaño que se autorizó; vuelve a seleccionarlo";
  }
  if (estado === 403) {
    return "el permiso de subida ha caducado o no es válido; vuelve a intentarlo";
  }
  return `el almacenamiento ha respondido ${estado}`;
}

export function subirAlAlmacen(
  destino: DestinoDeSubida,
  file: File,
  opciones: { onProgreso?: (porcentaje: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  const { onProgreso, signal } = opciones;

  return new Promise<void>((resolve, reject) => {
    const formulario = new FormData();
    for (const [nombre, valor] of Object.entries(destino.fields)) {
      formulario.append(nombre, valor);
    }
    // El archivo va el ÚLTIMO: el almacén ignora los campos que vienen detrás.
    formulario.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", destino.url, true);

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
      reject(new ErrorDeSubida(mensajePara(xhr.status, codigoDeError(xhr.responseText ?? ""))));
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

    xhr.send(formulario);
  });
}
