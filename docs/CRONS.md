# Procesos programados: dónde se dispara cada uno

El proyecto está en el plan **Hobby** de Vercel, que sólo admite crons de
frecuencia diaria. Mientras `vercel.json` declaró uno cada 10 minutos, Vercel
**rechazaba el despliegue entero antes de compilar**: el estado
«Deployment failed.» llegaba 0–2 segundos después del push, cuando el build de
este proyecto tarda entre 70 y 90 segundos.

La solución no es apagar el proceso, sino cambiarle el disparador.

## Qué se dispara desde Vercel

Todo lo que se ejecuta **una vez al día o menos**. Vercel llama a estas rutas
con `Authorization: Bearer <CRON_SECRET>`.

| Ruta | Frecuencia | Qué hace |
|---|---|---|
| `/api/cron/demo-reset` | `0 3 * * *` — diaria | Reinicia los datos de la demostración |
| `/api/cron/unblock-tasks` | `0 5 * * *` — diaria | Desbloquea tareas cuya dependencia se completó |
| `/api/cron/analyze-all` | `0 6 * * *` — diaria | Análisis programado de expedientes |
| `/api/cron/notifications` | `0 7 * * *` — diaria | Avisos pendientes |
| `/api/cron/trial-expiring` | `0 8 * * *` — diaria | Aviso de prueba a punto de caducar |
| `/api/cron/stale-leads` | `0 9 * * *` — diaria | Contactos sin seguimiento |
| `/api/cron/trial-expired` | `0 10 * * *` — diaria | Prueba caducada |
| `/api/cron/daily-briefing` | `30 7 * * 1-5` — laborables | Resumen diario |
| `/api/cron/retention-cleanup` | `0 4 * * 0` — semanal | Purga por política de retención |
| `/api/cron/digest-isd` | `0 8 * * 1` — semanal | Boletín ISD |

## Qué se dispara desde GitHub Actions

Lo que necesita ejecutarse **más de una vez al día**, y que por tanto Hobby no
admite. Fichero: [`.github/workflows/crons.yml`](../.github/workflows/crons.yml).

| Ruta | Frecuencia | Por qué no puede bajarse a diaria |
|---|---|---|
| `/api/cron/stripe-recovery` | `*/10 * * * *` — cada 10 min | Reintenta los cobros fallidos antes de que la suscripción se cancele sola. A una vez al día, la ventana en la que un cobro recuperable se queda sin reintentar pasa de 10 minutos a 24 horas. |

**La frecuencia no se ha tocado**: sigue siendo cada 10 minutos, exactamente la
que tenía en `vercel.json`.

## Configuración necesaria en GitHub

En **Settings → Secrets and variables → Actions**:

| Nombre | Pestaña | Valor | Obligatorio |
|---|---|---|---|
| `CRON_SECRET` | **Secrets** | El mismo valor que la variable `CRON_SECRET` del proyecto en Vercel. Si no coinciden, la aplicación responde 401. | Sí |
| `APP_URL` | **Variables** | La URL pública, con `https://` y sin barra final. Ej.: `https://heredia.app` | Sí |

`CRON_SECRET` es un secreto y **nunca** debe estar en el repositorio. Viaja en
la cabecera `Authorization`, no como parámetro de consulta: los parámetros de
consulta acaban en los registros de acceso del servidor y de cualquier proxy
intermedio; las cabeceras no.

Si falta cualquiera de los dos, el workflow **falla en el primer paso con un
mensaje explícito**. Es deliberado: una variable mal puesta produciría un 401
silencioso y el proceso dejaría de ejecutarse sin que nadie se enterara. Un
cron que falla en silencio es peor que uno que no existe.

## Dos limitaciones que hay que conocer

1. **`schedule` sólo se ejecuta desde la rama por defecto.** Mientras este
   workflow viva en una rama de trabajo, no se dispara solo. Empieza a correr
   en cuanto se fusione a `main`. Hasta entonces se prueba con
   **Actions → Crons frecuentes → Run workflow**, que además permite elegir
   cualquiera de los once endpoints.

2. **GitHub no garantiza la puntualidad de `schedule`.** En horas de mucha carga
   los disparos se retrasan, y ocasionalmente se saltan. Para un reintento de
   cobro es aceptable, porque el siguiente disparo recoge lo que quedó
   pendiente. No debe usarse este mecanismo para nada que exija puntualidad
   estricta.

## Comprobar que funciona

1. **Actions → Crons frecuentes → Run workflow**, dejando
   `/api/cron/stripe-recovery`.
2. El job debe terminar en verde y mostrar `HTTP 200`.
3. Un `401` significa que el `CRON_SECRET` de GitHub no coincide con el de
   Vercel. Un `000` significa que `APP_URL` es incorrecta o el despliegue no
   responde.
