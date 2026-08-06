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
| `/api/cron/stripe-recovery` | `17 2 * * *` — diaria | **Respaldo.** El proceso corre cada 10 minutos desde GitHub Actions; esta ejecución diaria es la que sobrevive si GitHub desactiva el workflow por inactividad (ver limitación 3). |

## Qué se dispara desde GitHub Actions

Lo que necesita ejecutarse **más de una vez al día**, y que por tanto Hobby no
admite. Fichero: [`.github/workflows/crons.yml`](../.github/workflows/crons.yml).

| Ruta | Frecuencia | Por qué no puede bajarse a diaria |
|---|---|---|
| `/api/cron/stripe-recovery` | `3-59/10 * * * *` — cada 10 min | Reintenta los cobros fallidos antes de que la suscripción se cancele sola. A una vez al día, la ventana en la que un cobro recuperable se queda sin reintentar pasa de 10 minutos a 24 horas. |

**La frecuencia no se ha tocado**: sigue siendo cada 10 minutos. Lo que cambia
es el minuto de arranque —3, 13, 23, 33, 43, 53 en vez de 0, 10, 20…—, porque el
minuto en punto es donde se acumulan casi todos los `schedule` de GitHub y es
justo cuando más se retrasan o se descartan disparos.

El disparo manual sólo sirve para este proceso: no hay selector de endpoints. Un
botón capaz de lanzar los once convertiría la pestaña Actions en un mando a
distancia para ejecutar purgas de retención o envíos masivos cuando a alguien le
apeteciera.

**Los registros no muestran el cuerpo de la respuesta**, sólo la ruta y el
código HTTP. Los registros de Actions de un repositorio público los lee
cualquiera, y la respuesta de un endpoint de cobros puede traer importes,
identificadores de cliente o mensajes de error de Stripe. El detalle queda en
los registros del servidor, que es donde corresponde.

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

## Tres limitaciones que hay que conocer

### 1. El workflow no hace nada hasta que llegue a `main`

GitHub sólo ejecuta `schedule` desde la **rama por defecto**. Y
`workflow_dispatch` no es una vía de escape: el botón **Run workflow** sólo
aparece cuando el workflow existe en la rama por defecto. Mientras este fichero
viva únicamente en `claude/heredia-security-hardening-v1`, **no puede
dispararse ni solo ni a mano**.

Es decir: hasta la fusión, la recuperación de cobros corre sólo una vez al día,
la del respaldo de Vercel. Recuperar la cadencia de 10 minutos es una razón para
fusionar, no algo que pueda probarse antes.

### 2. GitHub no garantiza la puntualidad de `schedule`

En horas de mucha carga los disparos se retrasan, y ocasionalmente se saltan.
Por eso el horario evita el minuto en punto. Para un reintento de cobro es
aceptable, porque el siguiente disparo recoge lo que quedó pendiente. No debe
usarse este mecanismo para nada que exija puntualidad estricta.

### 3. GitHub desactiva los workflows programados por inactividad

En **repositorios públicos** —éste lo es—, GitHub **desactiva automáticamente
los workflows con `schedule` tras 60 días sin actividad en el repositorio**, y
avisa por correo al propietario. No falla nada a la vista: simplemente dejan de
dispararse.

Aplicado a esto: un repositorio parado dos meses dejaría de reintentar cobros en
silencio, que es justo el fallo que nadie detecta hasta que hay suscripciones
canceladas.

Por eso `/api/cron/stripe-recovery` **también está en `vercel.json`, una vez al
día** (`17 2 * * *`). Vercel no se desactiva por inactividad, así que en el peor
caso el proceso sigue corriendo a diario. Se pierde cadencia, no el proceso.

Para reactivarlo: **pestaña Actions → el aviso de workflows deshabilitados →
Enable**.

## Comprobar que funciona

Sólo es posible **una vez fusionado a `main`** (ver limitación 1).

1. **Actions → Crons frecuentes → Run workflow**.
2. El job debe terminar en verde y mostrar `HTTP 200`. No muestra el cuerpo de
   la respuesta, y es deliberado.
3. Un `401` significa que el `CRON_SECRET` de GitHub no coincide con el de
   Vercel. Un `000` significa que `APP_URL` es incorrecta o el despliegue no
   responde.

Antes de fusionar, lo que sí puede comprobarse es el respaldo: en Vercel,
**Settings → Cron Jobs**, donde debe aparecer `/api/cron/stripe-recovery` a las
02:17.
