# Heredia

SaaS B2B multi-tenant para gestorías, funerarias y despachos que tramitan la
gestión administrativa posterior a un fallecimiento.

> **Estado.** El software funciona y está cubierto por pruebas, pero **no ha
> operado todavía con expedientes reales**. Antes de hacerlo hay pasos de
> configuración y legales que el software no puede resolver por sí solo: están
> listados en "Antes de operar con datos reales".

---

## Arquitectura

| Capa | Tecnología |
|---|---|
| Frontend y backend | Next.js 14 (App Router) + TypeScript |
| Base de datos | PostgreSQL vía Prisma 5 |
| Autenticación | NextAuth (credenciales + Google SSO opcional) |
| Autorización | Módulo propio verificado contra base de datos (`src/lib/session.ts`) |
| UI | Tailwind CSS + shadcn/ui |
| Almacenamiento | S3 compatible (AWS S3, Cloudflare R2, MinIO en local) |
| Email | Nodemailer (SMTP) |
| Pagos | Stripe (checkout + webhooks) |
| IA | Anthropic Claude, **opcional y desactivada por defecto** |
| Tareas programadas | Vercel Cron |

Aplicación única: rutas API en `src/app/api/`, páginas en `src/app/`.

---

## Seguridad

Lo que **sí** garantiza el software:

- **Autorización verificada en cada petición.** Rol, organización y estado de
  suscripción se releen de PostgreSQL; el JWT sólo aporta el identificador de
  usuario. Expulsar o degradar a alguien surte efecto de inmediato.
- **Aislamiento multi-tenant.** Todo identificador recibido del cliente se
  valida contra la organización y el expediente (`src/lib/tenancy.ts`).
- **Portal familiar cerrado por defecto.** Los documentos internos no son
  visibles para la familia salvo que se compartan explícitamente. El acceso
  exige consentimiento vigente y el enlace es rotable y revocable.
- **Política de archivos.** Tamaño máximo, lista de formatos permitidos y
  verificación del contenido real por *magic bytes* (un ejecutable renombrado
  a `.pdf` se rechaza). Claves de S3 aleatorias.
- **Protección SSRF** en los webhooks salientes, con validación de todas las
  IPs resueltas y revalidación en cada redirección.
- **Secretos cifrados** con AES-256-GCM (`SECRETS_ENCRYPTION_KEY`).
- **Minimización para IA.** Antes de enviar contexto se eliminan emails, DNI,
  teléfonos e IBAN y se pseudonimizan los nombres.
- **Retención con purga real:** borra las filas de PostgreSQL y los objetos de
  S3, no sólo marca `deletedAt`.

Lo que **no** garantiza, y conviene no dar por hecho:

- **No hay análisis antimalware.** Se valida tipo, tamaño y contenido
  declarado; no se busca contenido malicioso dentro de un PDF bien formado.
- **El registro de actividad es append-only a nivel de aplicación**, no
  inmutable a nivel de base de datos ni criptográficamente.
- **El cifrado en reposo y la ubicación de los datos** los aporta el proveedor
  que contrates al desplegar, no el código.
- **Los días hábiles se cuentan de lunes a viernes, sin calendario de
  festivos.** Los plazos calculados son por tanto optimistas.
- **Las reglas fiscales no están verificadas a 2026.** Los importes son
  estimaciones orientativas sujetas a revisión profesional.

Detalle completo del trabajo de seguridad: [`SECURITY_HARDENING_STATUS.md`](./SECURITY_HARDENING_STATUS.md).

---

## Planes y límites

Fuente única: `PLAN_PRICING` en `src/lib/stripe.ts`. Los topes son **duros**:
al alcanzarlos la operación se rechaza. No se factura por excedentes.

| Plan | Mensual | Anual | Alta | Expedientes/mes | Usuarios |
|---|---|---|---|---|---|
| Inicia | 149 € | 1.490 € | — | 15 | 2 |
| Despacho | 349 € | 3.490 € | 299 € | 50 | 5 |
| Firma | 749 € | 7.490 € | 990 € | 200 | 20 |

Precios sin IVA. Las integraciones salientes (Slack, Teams, webhook propio)
son del plan Firma y se comprueban también en el momento de enviar.

---

## Puesta en marcha local

Requisitos: Node.js 18+, Docker y npm.

```bash
git clone <repo-url> && cd heredia
cp .env.example .env

docker compose up -d          # PostgreSQL, Redis y MinIO
npm install --legacy-peer-deps
npx prisma generate
npx prisma migrate deploy     # crea el esquema desde las migraciones
npm run db:seed               # datos de ejemplo (opcional)
npm run dev
```

En `http://localhost:3000`. MinIO en `http://localhost:9001`.

> Usa los binarios locales (`./node_modules/.bin/prisma`, `./node_modules/.bin/tsc`).
> `npx` sin prefijo puede descargar Prisma 7 o TypeScript 6 y fallar con errores
> que no son del proyecto.

---

## Variables de entorno

Todas en `.env.example`. Las que conviene destacar:

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | Sí | PostgreSQL |
| `NEXTAUTH_SECRET` | Sí | Firma de sesiones (mín. 32 caracteres) |
| `NEXTAUTH_URL` / `APP_URL` | Sí | URL pública |
| `S3_*` | Sí | Almacenamiento de documentos |
| `SMTP_*`, `EMAIL_FROM` | Sí | Envío de correo |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Para cobrar | Stripe |
| `STRIPE_PRICE_*` | Para cobrar | 8 precios: 3 planes × 2 intervalos + 2 altas |
| `CRON_SECRET` | Sí | Autoriza los cron de Vercel **y los de GitHub Actions**; el mismo valor en los dos sitios |
| `LEGAL_ENTITY_NAME` | **Sí en Production** | Denominación social. Sin ella el build de producción falla |
| `LEGAL_ENTITY_NIF` | **Sí en Production** | NIF de la entidad |
| `LEGAL_ENTITY_ADDRESS` | **Sí en Production** | Domicilio social |
| `LEGAL_PRIVACY_EMAIL` | **Sí en Production** | Dirección para el ejercicio de derechos (RGPD art. 13) |
| `LEGAL_DPO_CONTACT` | No | Sólo si se ha designado delegado (RGPD art. 37) |
| `ADMIN_EMAILS` | Recomendada | Panel interno. Vacío ⇒ inaccesible |
| `SECRETS_ENCRYPTION_KEY` | Si usas webhooks propios | AES-256-GCM, 32 bytes (`openssl rand -base64 32`). Sin ella no se pueden guardar secretos |
| `MAX_UPLOAD_MB` | No (20) | Tamaño máximo por archivo |
| `PROMPT_LOG_RETENTION_DAYS` | No (90) | Retención de los registros de IA |
| `ANTHROPIC_API_KEY` | No | Sin ella, la IA usa el modo determinista local |
| `DEMO_ENABLED` | No | Demo pública y su reseteo diario |

Las cuatro `LEGAL_*` obligatorias las comprueba `scripts/check-legal-config.mjs`
al empezar el build: en Production **detienen el despliegue** si falta alguna;
en Preview y en local sólo avisan, y los textos legales muestran
«[Entidad responsable pendiente de constituir e inscribir]». **No las rellenes
con datos provisionales**: mientras la sociedad no esté constituida e inscrita,
lo correcto es no desplegar a producción.

### Configuración fuera de `.env`: GitHub Actions

`.github/workflows/crons.yml` dispara la recuperación de cobros de Stripe cada
10 minutos, porque el plan Hobby de Vercel sólo admite crons diarios. Necesita
dos ajustes **en el repositorio**, en *Settings → Secrets and variables →
Actions*:

| Dónde | Nombre | Valor |
|---|---|---|
| Pestaña **Variables** | `APP_URL` | URL pública del despliegue de producción |
| Pestaña **Secrets** | `CRON_SECRET` | **El mismo valor** que `CRON_SECRET` en Vercel |

Si no coinciden, el endpoint responde 401 y el workflow falla con un mensaje
que lo dice; el workflow comprueba antes que las dos existan, para que una
variable mal puesta no produzca un cron que falla en silencio.

**El workflow no se ejecuta hasta que llegue a `main`**: GitHub sólo lanza
`schedule` desde la rama por defecto, y el botón «Run workflow» tampoco aparece
antes. Configura las dos entradas antes o después del merge, pero comprueba tras
el merge que el primer disparo sale verde.

---

## Migraciones

**Sólo migra un despliegue de PRODUCCIÓN de Vercel.** El último paso de
`npm run build` es `scripts/migrar-en-produccion.mjs`, que decide así:

| Contexto | `VERCEL_ENV` | Qué hace |
|---|---|---|
| Local, CI, contenedor | *(sin `VERCEL`)* | no toca ninguna base |
| Preview de Vercel | `preview` | **no migra**: un PR no cambia el esquema de producción |
| Producción de Vercel | `production` | aplica las pendientes con `prisma migrate deploy` |

Va **después** de `next build`, así que una aplicación que no compila no mueve
el esquema; y Vercel promueve el despliegue cuando el build termina, así que
migrar ahí es migrar **antes de que la versión nueva quede operativa**. Si una
migración falla, el script sale con error, el build falla y Vercel **no**
promueve: sigue sirviendo el despliegue anterior. `prisma migrate deploy` sólo
aplica lo pendiente y toma un bloqueo de aviso en PostgreSQL, así que dos builds
simultáneos se serializan y cada migración se aplica **una vez**.

En producción, **la falta de `DATABASE_URL` detiene el despliegue**: publicar
sin migrar dejaría la versión nueva contra un esquema viejo.

Nunca se ejecuta `db push`, `migrate reset` ni `--accept-data-loss`; ver
`scripts/migrate-deploy.mjs`.

> **Antes de esta versión el README decía que las migraciones se aplicaban
> solas durante el build, y no era cierto:** `npm run build` ejecutaba
> `check-legal-config`, `prisma generate` y `next build`, y nada más. Un
> despliegue podía publicar código nuevo contra un esquema viejo.

```bash
npx prisma migrate deploy     # aplicar a mano
npm run db:check              # ¿queda algo pendiente? (sale con 2 si sí)
```

### Lo que este repositorio NO puede garantizar por sí solo

El paso automático depende de dos cosas que viven en el panel de Vercel y que
**no se pueden verificar desde el repositorio**:

1. Que `DATABASE_URL` esté definida en el entorno **Production**. Si falta, el
   build falla con un mensaje explícito — así que este caso está cubierto.
2. Que el proyecto **no** tenga un *Ignored Build Step* que se salte el build de
   producción. Si el build no corre, no hay migración **y tampoco hay código
   nuevo**, así que no se puede publicar una versión sin migrar; pero conviene
   comprobarlo.

Comprobación manual inequívoca antes de dar por buena una publicación:

```bash
DATABASE_URL="<la de produccion>" npm run db:check   # debe decir "al dia"
```

Si eso no dice «al día» **después** de un despliegue de producción, el paso
automático no se ha ejecutado y el release no está completo.

Una migración (`20260805000000_case_ref_unique_per_org`) **renombra las
referencias de expediente duplicadas** que puedan existir, añadiendo `-D2`,
`-D3`… y conservando la más antigua. Si tu base tiene duplicados, esas
referencias cambiarán y es visible para el cliente.

---

## Pruebas

```bash
npm test                  # unit / service / handler tests, sin servicios externos
npm run test:integration  # PostgreSQL real y efímero
npm run test:all
```

Las pruebas de integración necesitan PostgreSQL y **borran y recrean el
esquema**: apunta `TEST_DATABASE_URL` a una base desechable.

Las que mockean Prisma, Stripe, S3 o NextAuth **no se llaman E2E**: son
*handler tests*. Lo que un mock no puede comprobar —constraints, transacciones,
concurrencia— vive en `__tests__/integration/`.

---

## Integración continua

`.github/workflows/ci.yml` ejecuta en cada pull request: instalación
reproducible (`npm ci`), `prisma validate`, comprobación de que las migraciones
aplican sobre una base vacía, TypeScript, pruebas unitarias, pruebas de
integración contra PostgreSQL de servicio, build y auditoría de dependencias.
No usa secretos reales.

---

## Tratamiento con IA

Desactivado por defecto. Se activa por organización (`Organization.aiEnabled`),
y sólo funciona si además hay `ANTHROPIC_API_KEY`. Sin ambas cosas, los módulos
usan el análisis determinista local.

Cuando está activo, antes de enviar nada se eliminan emails, DNI/NIE, teléfonos
e IBAN y se pseudonimizan los nombres del causante y del contacto. **No se
envían documentos completos.** No se guarda el prompt: sólo su hash, la
respuesta, el modelo y los tokens, con retención configurable.

Esto minimiza, **no anonimiza**: un expediente sigue siendo identificable por
su contexto. Actívalo sólo si tu contrato con el cliente lo contempla.

---

## Portal familiar

Enlace por token de 32 bytes aleatorios, rotable y revocable, con caducidad
opcional. Todas las acciones (subir, descargar, escribir) exigen consentimiento
vigente, registrado en `PortalConsent` con versión del texto, hash, IP y
user-agent. Si cambia el texto legal, se pide de nuevo.

La familia sólo ve los documentos marcados `visibleToFamily`. Los internos son
privados por defecto.

---

## Stripe

El webhook es **reintentable**: el evento sólo se marca `PROCESSED` cuando su
lógica termina bien. Un fallo queda `FAILED` y el reintento de Stripe lo vuelve
a ejecutar. Firma inválida devuelve 400 (permanente); fallo al procesar, 500
(para que Stripe reintente).

---

## Retención

Ciclo: cierre → borrado lógico → periodo de gracia (30 días) → **purga real**.
La purga borra los objetos de S3 y después las filas. Si S3 falla, el
expediente **no** se marca como purgado y se reintenta. La auditoría se
conserva anonimizada, por obligación legítima.

---

## Antes de operar con datos reales

Estos puntos **no los resuelve el código**:

1. Rellenar los datos reales del responsable en `/legal/privacidad`,
   `/legal/terminos` y `/legal/cookies` — hoy llevan marcadores.
2. Publicar un contrato de encargado de tratamiento (art. 28 RGPD) y firmarlo
   con cada cliente.
3. Verificar la región y el contrato de cada proveedor contratado.
4. Configurar y **probar la restauración** de las copias de seguridad.
5. Generar `SECRETS_ENCRYPTION_KEY` y rotar cualquier secreto que haya pasado
   por un canal no seguro.
6. Revisar las reglas fiscales y los importes frente a la normativa vigente.

---

## Limitaciones conocidas

- Sin envíos reales a bancos ni administraciones: se preparan los documentos y
  se registra el envío por el canal que corresponda.
- Sin integraciones con APIs de bancos, telecomunicaciones o suministros.
- Sin SSO SAML empresarial (sí Google Workspace).
- Sin notificaciones en tiempo real.
- Sólo español.
- Días hábiles sin festivos.
- Sin antivirus en las subidas.
