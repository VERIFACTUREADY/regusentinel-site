# Estado de la refactorización de seguridad — Heredia

> **Documento de continuidad.** Si la sesión se agota, la siguiente empieza leyendo
> este archivo. Refleja únicamente lo verificado en código, no intenciones.

- **Rama de trabajo:** `claude/heredia-security-hardening-v1`
- **Rama base auditada:** `claude/setup-baritur-pro-oOo9E` (tip real `23cfc08`)
- **Punto de partida elegido:** `71c5068` — ver "Decisión de base" más abajo
- **Última actualización:** Fase 0 completada

---

## Decisión de base

El SHA indicado en el encargo (`23cfc088ae74d15ea1519d26e1fab65075bc3835`) **es**
el tip real de `claude/setup-baritur-pro-oOo9E` en el remoto. Sin embargo existen
dos commits posteriores que descienden de él en la rama
`claude/software-functionality-completion-u7ot0g`:

| Commit | Contenido |
|---|---|
| `ac397ac` | Arreglo del despliegue desde cero y flujos rotos de uso diario |
| `27c0c46` | Registro no bloqueado por nombre de compañía + migraciones automáticas en deploy |
| `71c5068` | Documentación (plan de lanzamiento) |

Ramificar desde `23cfc08` habría **regresado silenciosamente** esos arreglos de
despliegue. Se ramifica por tanto desde `71c5068`, que contiene `23cfc08` como
ancestro verificado (`git merge-base --is-ancestor` confirmado).

---

## Baseline (Fase 0) — resultados exactos

Ejecutado con los binarios **locales** del proyecto. `npx` sin prefijo resuelve
Prisma 7 / TypeScript 6 desde el registro y falla con errores irrelevantes
(`P1012 datasource url no soportado`, `TS5101 baseUrl deprecated`); no son
defectos del repositorio. Versiones reales: Prisma 5.22.0, TypeScript 5.9.3.

| Comprobación | Comando | Resultado |
|---|---|---|
| Prisma | `DATABASE_URL=… ./node_modules/.bin/prisma validate` | ✅ `The schema at prisma/schema.prisma is valid` |
| TypeScript | `./node_modules/.bin/tsc --noEmit` | ✅ exit 0, sin errores |
| Tests | `npm test` | ✅ 49 ficheros, **734/734** pasan |
| Build | `npm run build` | ✅ exit 0 |

Superficie: **110 rutas API** (`src/app/api/**/route.ts`).

---

## Mapa de riesgos verificado en código

Cada entrada está confirmada leyendo el fichero indicado. No son sospechas.

### P0 — explotables con impacto directo sobre datos reales

| # | Riesgo | Evidencia | Fase |
|---|---|---|---|
| P0-1 | **Rol y organización congelados 30 días en el JWT.** El callback `jwt` sólo recarga la membresía cuando `!token.orgId`; una vez fijada, el rol nunca se refresca. Un usuario expulsado o degradado conserva permisos hasta 30 días. | `src/lib/auth.ts:64-67,189-205`; `src/lib/rbac.ts:131-161` (`requirePermission` sólo mira el JWT) | 1 |
| P0-2 | **Escritura cross-tenant vía `taskId` en subida de documentos.** `manualTaskId` llega del `FormData` y se usa sin comprobar propiedad; después `findUnique({ where: { id: linkedTaskId } })` sin `orgId` permite marcar **READY una tarea de otra organización**. | `src/app/api/cases/[id]/documents/route.ts:51,60,81,93-98` | 2 |
| P0-3 | **El portal familia expone TODOS los documentos internos**, con URL de descarga prefirmada, sin filtro de visibilidad ni de origen. | `src/app/api/portal/[token]/documents/route.ts:19-33`; metadatos también en `src/app/api/portal/[token]/route.ts` | 3 |
| P0-4 | **Cobros perdidos en Stripe.** `stripeEvent.create` se ejecuta *antes* del `switch`. Si un handler lanza, el evento queda registrado; el reintento de Stripe detecta P2002 y responde `duplicate: true` sin volver a aplicar la mutación. La activación de suscripción se pierde de forma permanente. | `src/lib/stripe.ts:171-181` | 4 |
| P0-5 | **SSRF en webhooks outbound.** `fetch` directo sobre URL del cliente, sin validación de destino, sin bloqueo de redirecciones, sin límite de respuesta. Alcanza `169.254.169.254`, `localhost` y rangos privados. | `src/lib/outbound-integrations.ts:33-40` | 5 |
| P0-6 | **`customWebhookSecret` en texto plano** en la base de datos. | `prisma/schema.prisma:107` | 5 |

### P1 — aislamiento, integridad y privacidad

| # | Riesgo | Evidencia | Fase |
|---|---|---|---|
| P1-1 | `VIEWER` (comercialmente "solo lectura") tiene `autopilot.approve`, que muta datos. | `src/lib/rbac.ts:69-72` | 1 |
| P1-2 | Ningún control impide que un `MANAGER` invite o promueva a `OWNER`, ni que se auto-promueva; nada protege al último `OWNER`. | `src/lib/rbac.ts:43-47` (MANAGER tiene `org.members`) | 1 |
| P1-3 | Suspensión de suscripción no aplicada en la capa API. | pendiente de helper central | 1 |
| P1-4 | `assigneeId` no se valida contra la membresía: se puede asignar una tarea a un usuario de otra organización. | `src/app/api/cases/[id]/tasks/route.ts:48,77` | 2 |
| P1-5 | `dependsOnId` no se valida: dependencia hacia tarea de otro expediente/tenant, auto-dependencia y ciclos posibles. | `src/app/api/cases/[id]/tasks/route.ts:86` | 2 |
| P1-6 | `status`, `category`, `title` sin validación Zod; se aceptan valores arbitrarios para enums Prisma. | `src/app/api/cases/[id]/tasks/route.ts:41-51,73-92` | 2 |
| P1-7 | **`GET` con efectos secundarios.** Desbloqueo automático de tareas en el GET del expediente y marcado de mensajes como leídos. | `src/app/api/cases/[id]/route.ts:45-54`; `src/app/api/cases/[id]/portal-messages/route.ts` | 2 |
| P1-8 | **Referencia de expediente por `count + 1`** fuera de transacción y sin `@@unique([orgId, ref])`: dos creaciones concurrentes producen la misma `ref`. | `src/app/api/cases/route.ts:130-131`; `prisma/schema.prisma:153` | 2 |
| P1-9 | Consentimiento sin evidencia: booleano sobrescribible, sin versión de texto, hash, IP ni user-agent. Subida, descarga y mensajes del portal **no lo exigen**. | `prisma/schema.prisma:166-168`; `src/app/api/portal/[token]/consent/route.ts` | 3 |
| P1-10 | `portalToken` sin rotación, revocación ni expiración. | `prisma/schema.prisma:163` | 3 |
| P1-11 | **Sin política de archivos**: ni tamaño máximo, ni lista de formatos, ni verificación por magic bytes; nombre original crudo dentro de la clave S3; fichero completo en memoria; sin compensación si la DB falla tras subir a S3. | `src/app/api/cases/[id]/documents/route.ts:54-57`; `src/app/api/portal/[token]/documents/route.ts:53-56` | 3 |
| P1-12 | **Límites de plan sólo para INICIA** y con el número `15` escrito a mano en vez de `PLAN_PRICING`. DESPACHO y FIRMA no tienen tope pese a anunciar 50/200 expedientes. | `src/app/api/cases/route.ts:117-124` vs `src/lib/stripe.ts:23-48` | 4 |
| P1-13 | **Retención sin borrado real**: el cron sólo hace soft-delete (`deletedAt`), nunca purga PostgreSQL ni S3. | `src/app/api/cron/retention-cleanup/route.ts:22-30` | 7 |
| P1-14 | `PromptLog` guarda `prompt` y `response` íntegros, con PII, sin retención. | `prisma/schema.prisma:356-370` | 7 |
| P1-15 | **`addMonths` con bug de fin de mes**: `setMonth` convierte 31-ene + 1 mes en 3-mar. Afecta al plazo de 6 meses del ISD. | `src/lib/deadline-engine.ts:25-28` | 7 |
| P1-16 | Días hábiles sin calendario de festivos (correcto en el código) pero el producto afirma cubrir calendarios autonómicos. | `src/lib/deadline-engine.ts:9-19` | 7/8 |

### Datos personales que salen del sistema

| Destino | Qué sale hoy | Fase |
|---|---|---|
| Anthropic | Contexto de expediente sin minimizar; sin ajuste por organización | 7 |
| `PromptLog` | Prompt y respuesta completos con PII | 7 |
| `AuditLog.details` | Texto libre con nombres de tarea y de fichero | 7 |
| Emails | Nombre del fallecido y de contacto (necesario, revisar mínimos) | 6 |
| Webhooks outbound | `deceasedName` a destino no validado | 5 |
| S3 | Nombre de fichero original dentro de la clave | 3 |

### Rutas `GET` con escritura (verificado con parser de cuerpo de función)

| Ruta | Escritura | Veredicto |
|---|---|---|
| `api/cases/[id]` | `task.updateMany` (desbloqueo) | ❌ corregir (Fase 2) |
| `api/cases/[id]/portal-messages` | `portalMessage.updateMany` (marcar leído) | ❌ corregir (Fase 2) |
| `api/cron/retention-cleanup` | `case.updateMany` | ⚠️ aceptado: Vercel Cron sólo emite GET; protegido por `CRON_SECRET` |
| `api/cron/trial-expired` | `subscription.updateMany` | ⚠️ aceptado: mismo motivo |

---

## Fases

| Fase | Estado | Commit |
|---|---|---|
| 0 — Baseline y mapa de riesgos | ✅ completada | `chore(security): establish hardening baseline` |
| 1 — Sesiones, membresías y RBAC | ✅ completada | `fix(auth): enforce live membership and subscription authorization` |
| 2 — Aislamiento multi-tenant | ✅ completada | `fix(tenancy): enforce organization boundaries on all relations` |
| 3 — Portal, consentimiento y archivos | ✅ completada | `fix(portal): protect family access consent and document visibility` |
| 4 — Stripe y límites de plan | ✅ completada | `fix(billing): make Stripe processing retryable and enforce plan limits` |
| 5 — SSRF y secretos outbound | ✅ completada | `fix(integrations): prevent SSRF and encrypt outbound secrets` |
| 6 — Notificaciones y workflows | ✅ completada | `fix(notifications): make delivery idempotent retryable and preference-aware` |
| 7 — Retención, IA y plazos | ✅ completada | `fix(privacy): implement real retention AI minimization and unified deadlines` |
| 8 — Copy y documentación honesta | ✅ completada | `docs: align product claims with verified capabilities` |
| 9 — Tests reales y CI | ✅ completada | `test(ci): add real integration security and browser coverage` |

---

## Fase 1 — decisiones técnicas

**Módulo central `src/lib/session.ts`.** Toda la autorización pasa por él:
`getVerifiedSession`, `getVerifiedUser`, `requireOrgPermission`,
`requireSession`, `requireBillingAccess`, `isOrgSuspended`.

**No se ha añadido versión de sesión ni lista de revocación**, y es deliberado:
el rol, la organización y el estado de suscripción se releen de PostgreSQL en
cada petición, así que el JWT queda reducido a un identificador de usuario.
Manipular el `role` del token no tiene efecto. La revocación es inmediata
porque el estado vive en la base de datos, no en el token. Coste: una consulta
indexada por petición autenticada (`Membership` ya tiene `@@unique([userId, orgId])`).

**Migración de rutas.** 102 de las 103 ocurrencias del patrón antiguo se
migraron con un codemod; las 14 rutas restantes (superadmin, onboarding,
perfil, campana de notificaciones) se revisaron a mano porque tienen
requisitos distintos. Ya no queda ningún `getServerSession` en `src/app/api`.

**Trampa detectada durante la migración:** el codemod dejó las rutas de
facturación bajo `requireOrgPermission`, lo que habría **encerrado a un OWNER
suspendido** sin forma de reactivar el plan. Se corrigió con
`requireBillingAccess`, que exime de la suspensión, y hay prueba de regresión.

**Suspensión.** Se aplica en la capa API (402), no sólo en el layout de React.
Estados que suspenden: `canceled`, `past_due`, `unpaid`, `incomplete_expired`,
y `trialing` con `currentPeriodEnd` vencido (la fecha manda sobre el estado
almacenado, por si el cron no ha corrido). La organización de demo está exenta.

**`x-pathname`.** El matcher del middleware enumeraba rutas concretas, así que
el header no existía en todas y la exención de `/billing` podía fallar. Ahora
el middleware corre en todo salvo estáticos.

**VIEWER** pierde `autopilot.approve`: era una mutación bajo una etiqueta de
"solo lectura". Los roles operativos la conservan.

**Última decisión relevante:** `AppShell` pasa de tipar su prop con `Session`
de next-auth a una interfaz estructural `ShellSession`. Fabricar un `expires`
sin significado para satisfacer el tipo habría sido peor.

### Riesgo residual de Fase 1

- La protección del último OWNER es correcta bajo la concurrencia que ofrece el
  nivel de aislamiento por defecto de PostgreSQL (`READ COMMITTED`) porque el
  recuento se hace dentro de la transacción, pero **no está verificada con dos
  transacciones reales simultáneas**. Esa prueba llega en la Fase 9.

---

## Fase 2 — decisiones técnicas

**Módulo `src/lib/tenancy.ts`.** Helpers de pertenencia que resuelven la
condición **en la consulta** (filtrando por `orgId` y `caseId`) en vez de leer
y comparar después. Aceptan tanto el cliente Prisma normal como el
transaccional, para poder usarse dentro de `$transaction`.

**P0-2 cerrado.** `manualTaskId` de la subida de documentos se valida contra
expediente + organización, y la escritura posterior (`task.update` a READY)
vuelve a filtrar en lugar de confiar en la validación previa.

**Ciclos de dependencias.** `validateTaskDependency` recorre la cadena
`dependsOn` hacia arriba con profundidad acotada (64) y conjunto de visitados,
así que detecta ciclos directos e indirectos y no se cuelga si la base ya
contiene una cadena circular.

**GET sin efectos secundarios.** Dos rutas escribían desde un GET:
- `cases/[id]`: el desbloqueo automático de tareas se ha movido al cron
  `unblock-tasks` (nuevo, en `vercel.json`, protegido por `CRON_SECRET`), que
  además audita y dispara los workflows que antes no se disparaban. El GET
  expone ahora un campo derivado `unblockDue` calculado al vuelo, sin persistir.
- `cases/[id]/portal-messages`: marcar como leído pasa a ser un `PUT` explícito
  que la interfaz invoca al abrir la pestaña del portal.

Los dos GET con escritura que quedan son crons (`retention-cleanup`,
`trial-expired`, más el nuevo `unblock-tasks`): Vercel Cron sólo emite GET. Es
la excepción documentada.

**Referencia de expediente.** `count + 1` fuera de transacción sustituido por
el máximo existente del año leído **dentro** de la transacción, más
`@@unique([orgId, ref])` y un reintento acotado ante P2002.

Verificado empíricamente contra PostgreSQL real: con la implementación antigua,
10 altas simultáneas producían **4 referencias y 6 colisiones**; con la nueva,
10 de 10 referencias distintas.

**Validación Zod** en crear/actualizar/lote de tareas: `status` y `category`
contra los enums reales, `title` acotado, fechas verificadas, ids con formato
cuid. Antes llegaban valores arbitrarios hasta Prisma.

### Riesgo residual de Fase 2

- La migración de deduplicación renombra los duplicados preexistentes a
  `<ref>-D2`, `-D3`… conservando el más antiguo. Se ha probado contra datos
  duplicados reales, pero **si producción tiene duplicados, sus referencias
  cambiarán** y eso es visible para el cliente. Está en los pasos de despliegue.

---

## Fase 3 — decisiones técnicas

**P0-3 cerrado.** `Document.visibleToFamily` (por defecto `false`). El portal
filtra por ese campo tanto en la descarga como en los metadatos del endpoint
principal. Los documentos que sube la familia se marcan visibles al crearse.

Matiz que evitó una regresión: la lista de "documentos pendientes" se calcula
sobre **todos** los documentos, no sólo los visibles. Si el equipo ya adjuntó
internamente el certificado, seguir pidiéndoselo a la familia sería un error —
y en la Fase 6 generaría recordatorios falsos. Es un hecho de la tarea; ningún
metadato del documento interno sale en la respuesta.

**Consentimiento con evidencia.** Modelo `PortalConsent`: versión del texto,
SHA-256 del texto exacto mostrado, finalidad, nombre declarado, IP,
user-agent, marca temporal y retirada. Nunca se sobrescribe: cada aceptación
es una fila. Si cambia `PORTAL_CONSENT_VERSION`, las aceptaciones anteriores
dejan de valer y se pide una nueva.

`resolvePortalAccess` centraliza token + revocación + caducidad + consentimiento.
Subir, descargar y escribir mensajes lo exigen; sólo el endpoint que presenta
el consentimiento y la vista principal responden sin él.

**Token del portal.** Rotación y revocación (`POST`/`DELETE`
`/api/cases/[id]/portal-token`), caducidad opcional, auditadas. El token nuevo
usa 32 bytes aleatorios en vez de un CUID.

**Política de archivos** (`src/lib/file-policy.ts`): 20 MB configurables por
`MAX_UPLOAD_MB`, lista de formatos permitidos, verificación por **magic bytes**
(un ejecutable renombrado a `.pdf` se rechaza aunque declare
`Content-Type: application/pdf`), rechazo de SVG y de HTML activo en ficheros
de texto, sanitizado del nombre, clave de S3 **aleatoria** (antes era
`${Date.now()}-${file.name}`: adivinable y con el nombre del usuario dentro de
la ruta), y cabeceras de descarga con `nosniff` y `attachment`.

**Consistencia S3 ↔ base de datos.** Si falla el `create` tras subir, se borra
el objeto de S3. Si falla el borrado en S3, la fila **no** se elimina y queda
marcada (`deletionState`) para reintento: antes `deleteFile(...).catch(() => {})`
se tragaba el error y borraba la referencia, dejando el fichero huérfano en el
bucket y diciéndole al usuario que estaba eliminado.

**NO HAY ANÁLISIS ANTIMALWARE** y así está documentado en el propio módulo. Se
valida tipo, tamaño y contenido declarado; no se busca contenido malicioso
dentro de un PDF bien formado. No debe describirse como "archivos analizados".

### Hallazgo durante la Fase 3 (corregido)

La prueba de integración de 10 altas concurrentes de la Fase 2 empezó a fallar
de forma intermitente: la restricción única evitaba los duplicados, pero los
reintentos volvían a colisionar en tropel y agotaban los intentos, devolviendo
errores al usuario. Corregido con `pg_advisory_xact_lock(hashtext(orgId))`, que
serializa la asignación de referencia **por organización** durante la
transacción. Verificado en tres ejecuciones consecutivas.

### Riesgo residual de Fase 3

- Sin antivirus. Un PDF bien formado con contenido malicioso se acepta.
- Los documentos internos **anteriores** a la migración quedan privados. Si
  alguna familia dependía de ver uno concreto, hay que compartirlo
  explícitamente desde la aplicación (`PATCH /api/documents/[id]`).

---

## Fase 4 — decisiones técnicas

**P0-4 cerrado.** `StripeEvent` pasa de "visto" a máquina de estados
(`RECEIVED` → `PROCESSING` → `PROCESSED` | `FAILED`) con `attempts`,
`lastError`, `startedAt`, `receivedAt` y `completedAt`. **Sólo `PROCESSED`
descarta un reintento.** Un evento fallido queda `FAILED` y el reintento de
Stripe vuelve a ejecutarlo.

**Reclamación sin bloqueo largo.** Se usa una actualización condicional atómica
(`updateMany` con el estado esperado en el `where`): si dos entregas del mismo
evento llegan a la vez, sólo una ve `count === 1`. No se mantiene una
transacción abierta durante las llamadas de red a Stripe, que son lentas.

**Ejecuciones colgadas.** Un `PROCESSING` con más de 5 minutos se considera
muerto y se puede volver a reclamar; si no, un proceso caído a mitad dejaría el
evento bloqueado para siempre.

**Códigos de respuesta.** La ruta distingue firma inválida (400, permanente) de
fallo al procesar (500, transitorio → Stripe reintenta). Antes ambos eran 400
y además se devolvía el mensaje de error crudo.

**`invoice.payment_succeeded`** no estaba manejado: un pago que recuperaba una
suscripción en `past_due` sólo surtía efecto si además llegaba
`customer.subscription.updated`. Si no llegaba, la organización seguía
suspendida estando al corriente.

**Límites de plan** (`src/lib/plan-limits.ts`), fuente única `PLAN_PRICING`:
- Tope duro en **los tres planes**. Antes sólo INICIA, con el `15` a mano;
  DESPACHO y FIRMA anunciaban 50 y 200 y no tenían ningún tope.
- **Decisión: no se factura por excedentes.** El copy se alinea en la Fase 8.
- Recuento y creación en la **misma transacción**, serializados por
  organización con advisory lock.

Verificado con PostgreSQL real: la prueba `sin el lock, el mismo escenario
superaría el tope` demuestra que la implementación antigua permite pasarse, y
la de al lado que la nueva no.

### Riesgo residual de Fase 4

- Los eventos que queden en `FAILED` tras agotar los reintentos de Stripe (3
  días) **no se reprocesan solos**. Quedan visibles en la tabla con su
  `lastError`, pero no hay panel ni cron que los recupere: hay que mirarlos a
  mano. Anotado como revisión manual pendiente.

---

## Fase 5 — decisiones técnicas

**P0-5 cerrado** (`src/lib/ssrf-guard.ts`). `validateOutboundUrl` comprueba
esquema (HTTPS obligatorio en producción), credenciales embebidas, puerto
(80/443/8443), nombre y **todas** las direcciones que devuelve el DNS. Bloquea
loopback, privadas IPv4 e IPv6, CGNAT, link-local, multicast, reservadas,
IPv4 mapeada en IPv6 y los endpoints de metadatos conocidos (AWS, GCP, Azure,
Alibaba, ECS).

`safeFetch` usa `redirect: "manual"` y **revalida cada salto**: antes un
destino público podía responder `302` hacia `169.254.169.254` y `fetch` lo
seguía sin comprobar nada. Además limita a 3 redirecciones, aplica timeout,
lee como mucho 64 KB del cuerpo y **nunca devuelve ese cuerpo al llamador** —
las tres funciones de envío propagaban `text.slice(0, 200)` de la respuesta
remota, lo que convertía el webhook en una vía para leer servicios internos y
ver el resultado.

**Revalidación al enviar.** El plan se vuelve a comprobar en el momento del
envío, no sólo al guardar: una organización que configuró las integraciones con
plan Firma y luego bajó de plan seguía recibiéndolas indefinidamente. El
destino también se revalida en cada envío, porque el DNS puede cambiar entre
que se guarda la configuración y que se usa.

**P0-6 cerrado** (`src/lib/secret-crypto.ts`). AES-256-GCM con IV aleatorio de
12 bytes y tag de autenticación, formato versionado `v1.iv.tag.ciphertext`.
Clave en `SECRETS_ENCRYPTION_KEY`, **independiente de `NEXTAUTH_SECRET`** a
propósito: rotar la de sesiones no debe obligar a redescifrar secretos.

Si la clave no está configurada, guardar un secreto **se rechaza con 503** en
vez de guardarlo en claro sin avisar. Los valores heredados en texto plano se
siguen aceptando al leer para no romper integraciones ya configuradas;
`scripts/encrypt-existing-secrets.mjs` los reescribe cifrados (idempotente,
con `--dry-run`).

Manipular el ciphertext, el tag o el IV hace fallar el descifrado en vez de
devolver basura — es lo que aporta GCM frente a un cifrado sin autenticar.
`readSecret` devuelve `null` ante un fallo, nunca un valor corrupto.

**Rate limit** en el endpoint de prueba de integraciones (6/min): hace
peticiones salientes bajo demanda.

### Riesgo residual de Fase 5

- **DNS rebinding no está cerrado del todo.** Se valida la resolución y luego
  se conecta por nombre, así que existe una ventana teórica en la que el DNS
  cambie entre la comprobación y la conexión. Cerrarlo requiere conectar por IP
  con `Host` fijado o un agente HTTP propio. Se ha dejado documentado en el
  módulo; el riesgo es bajo porque el destino lo configura un OWNER autenticado
  del plan Firma, no un anónimo.

---

## Fase 6 — decisiones técnicas

**Deduplicación por entrega** (`src/lib/notification-dedupe.ts`). La unidad
pasa de (expediente, tipo) a **(expediente, tipo, canal, destinatario,
ventana)**, con `NotificationLog.dedupeKey` único en base de datos.

La clave **sólo se escribe en las entregas correctas**. Un fallo se registra
sin clave, así que el siguiente intento lo reintenta — para ese destinatario y
ese canal, sin tocar a los demás. Antes, si el email llegaba a uno y fallaba en
otro, la siguiente ejecución saltaba el expediente entero y el segundo no lo
recibía nunca; y un email enviado bloqueaba también Slack, Teams y el webhook.

`dedupeKey` es nullable a propósito: en PostgreSQL un índice único admite
múltiples `NULL`, así que las filas anteriores y las fallidas conviven sin
colisionar. El backfill usa `DISTINCT ON` porque el histórico puede contener
duplicados de la misma entrega (el bug permitía reintentos parciales).

**Preferencias.** `internalRecipientsFor` respeta ya `Membership.notifPrefs`;
antes se ignoraba por completo y quien desactivaba una categoría la seguía
recibiendo. Los valores ausentes toman el defecto de `DEFAULT_PREFS`.

**Recordatorios a la familia.** Ya no se envían cuando: no hay consentimiento
vigente; el enlace del portal está revocado o caducado; el email de contacto no
es sintácticamente plausible; o **las tareas ya tienen documento adjunto**
(antes se contaban todas las tareas con `docTag`, así que se seguía pidiendo a
la familia lo que el equipo ya había subido). Ventana semanal ISO.

**Workflows.** `conditions` y `actionConfig` se validan con Zod (`.strict()`);
antes se casteaban con `as` y `newStatus` llegaba como string arbitrario hasta
`prisma.case.update`. El expediente se carga **filtrando por la organización
del evento** — antes `findUnique({ id })` sin `orgId`. `SEND_EMAIL_TEAM` ya no
se registra como SUCCESS si fallan todos los envíos. El cambio de estado es
condicional al estado leído, se omite si ya está en el destino, y hay contador
de profundidad (`MAX_WORKFLOW_DEPTH`). Las ejecuciones omitidas se registran
como `SKIPPED` con su motivo.

### Riesgo residual de Fase 6

- Las acciones **no encadenan**: `CHANGE_CASE_STATUS` escribe directamente y no
  vuelve a disparar workflows. Es el comportamiento actual, no una regresión, y
  por eso hoy no puede haber bucles. El contador de profundidad queda listo por
  si se añade el encadenamiento.
- La validación de email es sintáctica: no comprueba que el buzón exista.

---

## Fase 7 — decisiones técnicas

**Retención real** (`src/lib/retention.ts`). El cron hacía
`case.updateMany({ deletedAt })` y lo llamaba "limpieza": el expediente seguía
íntegro en PostgreSQL y todos sus documentos en S3, mientras la política de
privacidad afirmaba que los datos se eliminaban.

Ciclo con fases explícitas: cierre → `deletedAt` → `purgeScheduledAt` (30 días
de gracia) → purga → `purgedAt`. La purga borra **primero S3 y después la base
de datos**: al revés se perderían las claves de los objetos y quedarían
huérfanos para siempre. **Si S3 falla, la fila NO se borra** y queda con
`purgeError` y `purgeAttempts` para reintento — decir "eliminado" con el
fichero aún almacenado sería falso. Es idempotente.

La auditoría **se conserva anonimizada**, no se borra: se desvincula del
expediente y se le retira el texto libre (que contenía nombres de fichero y de
tarea) y la IP.

**IA.** `Organization.aiEnabled`, **desactivado por defecto**. Antes bastaba
con que Heredia tuviera `ANTHROPIC_API_KEY` para que los datos de cualquier
cliente salieran hacia un tercero sin que el responsable del tratamiento lo
hubiera decidido. Cuando está desactivado, los módulos caen al comportamiento
determinista local que ya existía.

`src/lib/ai-privacy.ts` elimina emails, DNI/NIE, teléfonos e IBAN, y
pseudonimiza nombres (completo y apellidos sueltos, porque las notas dicen "la
Sra. Pérez"). **`PromptLog.prompt` desaparece**: guardaba el contexto íntegro
con PII, duplicando el dato y conservándolo sin plazo. Se sustituye por
`contextHash`, y hay retención (`PROMPT_LOG_RETENTION_DAYS`, 90 por defecto).

Esto **no convierte el tratamiento en anónimo** — un expediente sigue siendo
identificable por su contexto — pero cumple la minimización del art. 5.1.c.

**Plazos: fuente única.** `addMonths` usaba `setMonth`, que desborda: 31-ene
+ 1 mes daba el 3 de marzo. En el plazo de 6 meses del ISD, un fallecimiento el
31 de agosto daba el 3 de marzo en vez del 28 de febrero — **tres días de más
en un plazo legal**, en el sentido peligroso. Corregido según el criterio de
fecha a fecha con recorte al último día del mes.

Se han unificado los cálculos duplicados de 9 ficheros: `setMonth(+6)` suelto,
`180 * 24 * 60 * 60 * 1000` como aproximación de seis meses y `22` días
naturales como aproximación de los 15 hábiles. Todos usan ya
`isdDeadlineFor` / `getCaseDeadlines`.

**Prórroga fuera de plazo.** `case-analyzer` recomendaba solicitarla cuando
quedaban menos de 30 días para el plazo de 6 meses — momento en que la ventana
de los 5 meses **ya está cerrada**. Ahora se comprueba con
`canStillRequestIsdExtension` y, si venció, el mensaje lo dice y sugiere
presentar en plazo con datos provisionales.

**Días hábiles.** El motor cuenta lunes a viernes **sin calendario de
festivos**, y así está documentado. El copy se corrige en la Fase 8.

### Riesgo residual de Fase 7

- **La auditoría NO es inmutable a nivel de base de datos.** La aplicación no
  expone edición ni borrado, pero usa el mismo usuario de PostgreSQL para todo,
  así que técnicamente puede escribir sobre `AuditLog` — de hecho lo hace, para
  anonimizar en la purga. No se ha añadido trigger ni usuario restringido
  porque entraría en conflicto con esa anonimización legítima. **La decisión es
  cambiar el lenguaje comercial** a "registro de actividad append-only a nivel
  de aplicación" (Fase 8), no afirmar inmutabilidad que no existe.
- Los días hábiles siguen sin festivos: los plazos calculados son optimistas.
- Las reglas fiscales no están verificadas a 2026; se presentan como estimación
  orientativa (Fase 8).

---

## Fase 8 — afirmaciones corregidas

| Afirmación anterior | Por qué no se sostiene | Cómo queda |
|---|---|---|
| "Audit trail inmutable" (4 páginas) | La aplicación no expone edición, pero usa el mismo usuario de PostgreSQL y de hecho escribe sobre `AuditLog` al anonimizar en la purga | "Registro de actividad append-only a nivel de aplicación" |
| "Válido en juicio" | El valor probatorio lo decide un tribunal, no el proveedor | "Exportable con el expediente y las evidencias registradas" |
| "Hosting en la UE" / "datacenters de Frankfurt y Dublín" | Depende de dónde se despliegue; el código no lo impone | "Ubicación configurable del despliegue", con la advertencia de contratar todo en el EEE |
| "Cifrado en reposo AES-256 / SSE-S3" | Lo aporta el proveedor contratado, no el software | "Cifrado en reposo del proveedor", con aviso de verificar la instalación |
| "Mantenemos el RAT actualizado" | El registro de actividades es del responsable, y el responsable es el cliente | Se explica que cada cliente mantiene el suyo |
| "DPA con cada cliente" | No consta firmado con nadie | "Ponemos a tu disposición un contrato de encargado para que lo firmes" |
| "RGPD compliant" | No es una certificación | "Diseñado para RGPD y LOPDGDD" |
| "17 calendarios autonómicos" (6 sitios) | El motor calcula el plazo estatal de 6 meses y ni siquiera aplica festivos | "Vigilancia del plazo del Modelo 650", con la limitación explícita |
| "RPO 1 hora, RTO 4 horas, testado mensualmente" | No hay procedimiento ni pruebas | "Las copias dependen del proveedor; los objetivos deben acordarse por instalación" |
| 6 testimonios de clientes | No consta ninguno real ni autorizado | **Eliminados**. Los escenarios se conservan etiquetados como hipotéticos |
| "de 60 a 150 expedientes/año" | Cifra inventada presentada como resultado | "cifras hipotéticas, no medidas en clientes reales" |
| "HEREDIA TECHNOLOGIES S.L." | La entidad no consta constituida | Marcadores explícitos `[DENOMINACION SOCIAL]`, `[NIF]`, `[DOMICILIO]` con aviso destacado de que la política no es válida hasta rellenarlos |

**Corrección de fondo en la política de privacidad:** decía que el proveedor es
el responsable del tratamiento de todo. Respecto de los datos de los
expedientes el proveedor es **encargado**; el responsable es la gestoría o
funeraria que decide las finalidades. Es la distinción que determina quién
responde ante un interesado.

**README reescrito** con arquitectura, seguridad (separando lo que garantiza el
software de lo que depende del despliegue), planes reales, variables de
entorno, migraciones, pruebas, CI, IA, portal, Stripe, retención, y una lista
de "antes de operar con datos reales".

No existe `HANDOFF.md` en el repositorio, así que no había nada que corregir
ahí; su función la cumple este documento.

---

## Fase 9 — pruebas reales y CI

**Separación de suites.** `npm test` son unit / service / **handler tests**: no
se llaman E2E, porque importan el handler y mockean Prisma, Stripe, S3 y
NextAuth. `npm run test:integration` usa **PostgreSQL real y efímero**, sin
mocks, y comprueba lo que un mock no puede: constraints, transacciones,
concurrencia, aislamiento y cascadas de borrado.

31 pruebas de integración reales en 4 ficheros: aislamiento multi-tenant y
concurrencia de referencias, visibilidad documental y consentimiento,
StripeEvent y topes de plan, retención y purga.

Dos de ellas demuestran el fallo original en lugar de sólo comprobar el
arreglo: `sin el lock, el mismo escenario superaría el tope` y la
reproducción de `count + 1` con 10 altas simultáneas.

**CI** (`.github/workflows/ci.yml`): `npm ci`, `prisma validate`, migraciones
sobre base vacía, **comprobación de deriva entre esquema y migraciones**,
TypeScript, unitarias, integración contra PostgreSQL de servicio, build sin
`DATABASE_URL` (como las previews de Vercel) y auditoría de dependencias que
sólo bloquea por vulnerabilidades críticas. Sin secretos reales.

El comprobador de deriva **ya encontró un problema real** al escribirlo: una de
mis migraciones creaba un índice (`Case_purgeScheduledAt_idx`) que no estaba
declarado en el esquema. Corregido.

El test estático de imports RBAC se mantiene, pero con su alcance escrito
dentro: comprueba que el fichero **importa** un guard, no que lo llame, ni con
qué permiso, ni que valide los IDs. Un endpoint puede pasarlo y seguir siendo
vulnerable.

**Pruebas de navegador (Playwright): 16/16 en verde.** Son E2E de verdad —
aplicación construida en modo producción, PostgreSQL real, Chromium real, sin
mockear Prisma ni NextAuth. `npm run test:e2e`.

Cubren: login correcto e incorrecto, redirección sin sesión, **expulsión con
pérdida inmediata de acceso**, suspensión (pantalla + 402 en API + billing
accesible), alta de expediente, tres altas concurrentes con referencias
distintas, RBAC de invitación, cambio de rol, rol inválido, protección del
último OWNER, portal sin consentimiento, evidencia tras aceptarlo, **documento
interno nunca expuesto**, token revocado y registro con login posterior.

#### Dos fallos reales que encontraron estas pruebas

**1. Los server components seguían leyendo la organización del JWT.** Migré las
110 rutas API en la Fase 1, pero **no las 21 páginas**. Un usuario expulsado
recibía 401 de la API y, aun así, el panel renderizado en servidor le seguía
mostrando los expedientes de su antigua organización. Corregido: ya no queda
ningún `getServerSession` en `src/app`.

**2. El arnés daba resultados falsos.** Un `next-server` de una ejecución
anterior seguía escuchando en el puerto 3000 y la suite corría contra un build
antiguo; y el `DROP DATABASE` fallaba silenciosamente por conexiones abiertas,
dejando estado residual entre ejecuciones. `scripts/e2e.sh` ahora **falla
rápido** si el puerto está ocupado y cierra las conexiones antes del reset.
Sin esto, la suite habría dado por bueno código que no lo era.

### Riesgo residual de Fase 9

- **No hay integración real con MinIO.** El almacenamiento se mockea incluso en
  las pruebas de integración; lo verificado de S3 es la lógica de compensación,
  no el cliente contra un servidor de objetos real. Por eso el smoke test del
  portal comprueba la exclusión de documentos internos sobre el endpoint que no
  firma URLs.
- **El checkout de Stripe no se ejercita en navegador**: requiere claves de
  prueba reales, que la CI no debe tener. Está cubierto a nivel de handler.

## Migraciones creadas

| Migración | Contenido | Probada |
|---|---|---|
| `20260805000000_case_ref_unique_per_org` | Deduplica refs existentes y crea `@@unique([orgId, ref])` | Sí: sobre base vacía y sobre base con 3 duplicados reales |
| `20260804225123_portal_consent_document_visibility` | `Document.visibleToFamily` + estado de borrado, `PortalConsent`, rotación/revocación/caducidad del token. Backfill: documentos del portal → visibles; consentimientos previos → fila heredada | Sí: aplicada sobre base vacía y sobre base ya migrada |
| `20260804234500_retention_ai_privacy` | `Organization.aiEnabled`, fases de purga en `Case`, `PromptLog.prompt` → `contextHash`. Los prompts históricos se descartan a propósito | Sí: aplicada y verificada con 11 pruebas de integración |
| `20260804232000_notification_delivery_dedupe` | `NotificationLog.dedupeKey` único + índice por (caso, tipo, canal, destinatario). Backfill con `DISTINCT ON` de las entregas correctas ya registradas | Sí |
| `20260804230440_stripe_event_retryable` | `StripeEvent` a máquina de estados. Migración **sin pérdida**: las filas existentes pasan a `PROCESSED` conservando su fecha (la generada por Prisma borraba `processedAt`) | Sí: verificada con 2 eventos previos reales |

## Variables de entorno nuevas

| Variable | Obligatoria | Por defecto | Para qué |
|---|---|---|---|
| `MAX_UPLOAD_MB` | No | `20` | Tamaño máximo por archivo subido (tope duro de 200) |
| `SECRETS_ENCRYPTION_KEY` | Sí, si se usan webhooks propios | — | Clave AES-256-GCM (32 bytes en base64 o hex) para cifrar `customWebhookSecret`. Sin ella, guardar un secreto se rechaza con 503 |
| `PROMPT_LOG_RETENTION_DAYS` | No | `90` | Días que se conservan los registros de IA antes de purgarse |

## Pendientes conocidos

- Fase 0: nada omitido (sólo inventario).
- Fase 1: ver "Riesgo residual" arriba.
- Fase 2: ver "Riesgo residual" arriba (renombrado de refs duplicadas).
- Fase 3: sin antivirus; documentos internos previos quedan privados.
- Fase 4: los eventos que agoten los reintentos de Stripe quedan en `FAILED` sin recuperación automática.
- Fase 5: ventana teórica de DNS rebinding (se conecta por nombre tras validar la resolución).
- Fase 6: las acciones de workflow no encadenan; validación de email sólo sintáctica.
- Fase 7: auditoría append-only a nivel de aplicación, **no** inmutable en base de datos; días hábiles sin festivos.
- Fase 8: los textos legales llevan marcadores; hay que rellenarlos antes de operar.
- Fase 9: sin integración real con MinIO ni checkout de Stripe en navegador; el resto está hecho y verde.
