# Estado de la refactorización de seguridad — Heredia

> **Documento de continuidad.** Si la sesión se agota, la siguiente empieza leyendo
> este archivo. Refleja únicamente lo verificado en código, no intenciones.

- **Rama de trabajo:** `claude/heredia-security-hardening-v1`
- **Rama base auditada:** `claude/setup-baritur-pro-oOo9E` (tip real `23cfc08`)
- **Punto de partida elegido:** `71c5068` — ver "Decisión de base" más abajo
- **Última actualización:** las 10 fases completadas y verificadas

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


---

# Revisión final

## Comprobaciones exactas

| Comprobación | Comando | Resultado |
|---|---|---|
| Prisma | `prisma validate` | ✅ válido |
| TypeScript | `tsc --noEmit` | ✅ exit 0, sin errores |
| Unitarias / handler | `npm test` | ✅ **994/994** en 60 ficheros |
| Integración (PostgreSQL real) | `npm run test:integration` | ✅ **31/31** en 4 ficheros |
| Navegador (Playwright) | `npm run test:e2e` | ✅ **16/16** |
| Build | `npm run build` | ✅ exit 0 (sin `DATABASE_URL`, como Vercel) |

Punto de partida: 734 pruebas. Ahora **1.041** (994 + 31 + 16).

## Migraciones verificadas

| Escenario | Resultado |
|---|---|
| Base **vacía** → todas las migraciones | ✅ aplican limpias |
| Base con el **esquema anterior y datos reales** | ✅ aplican y conservan |

Verificado en el segundo escenario: dos expedientes con la misma `ref` quedan
`EXP-2026-0001` y `EXP-2026-0001-D2` (se conserva el más antiguo); el evento de
Stripe previo pasa a `PROCESSED` conservando su fecha; y el expediente que
tenía consentimiento recibe su fila heredada en `PortalConsent`.

## Revisión del diff

| Patrón buscado | Resultado |
|---|---|
| `getServerSession` fuera del módulo central | **0** en todo `src/` |
| Secretos en texto plano | Ninguno: se cifran al escribir; sin clave se rechaza con 503 |
| `GET` con escritura | Sólo 2 crons (`unblock-tasks`, `trial-expired`), excepción documentada |
| IDs sin validar | Todos pasan por `lib/tenancy.ts` |
| `as any` | 6, **todos preexistentes**, en cláusulas `where` dinámicas de Prisma; ninguno oculta validación de entrada del usuario ni afecta al aislamiento (el `orgId` va siempre dentro de las condiciones). No se ha añadido ninguno nuevo |

## Riesgos que quedan abiertos

1. **Sin antivirus.** Un PDF bien formado con contenido malicioso se acepta.
2. **Auditoría append-only a nivel de aplicación**, no inmutable en base de
   datos. Decisión consciente: un trigger chocaría con la anonimización
   legítima de la purga. El copy ya no promete inmutabilidad.
3. **Días hábiles sin festivos** ⇒ los plazos son optimistas.
4. **Reglas fiscales sin verificar a 2026**; se presentan como orientativas.
5. **Ventana teórica de DNS rebinding** en los webhooks salientes.
6. **Eventos de Stripe en `FAILED`** tras agotar los reintentos: quedan
   visibles con su error, pero no hay cron que los recupere.
7. **Sin integración real con MinIO** ni checkout de Stripe en navegador.
8. **Textos legales con marcadores** (`[DENOMINACION SOCIAL]`, `[NIF]`…).
9. Las acciones de workflow **no encadenan** (no es regresión).

## Pasos de despliegue

1. Generar y configurar `SECRETS_ENCRYPTION_KEY` (`openssl rand -base64 32`).
2. Desplegar. Las migraciones se aplican solas durante el build.
3. **Avisar si hay referencias duplicadas**: la migración las renombra a
   `-D2`, `-D3`… y eso es visible para el cliente.
4. Ejecutar `node scripts/encrypt-existing-secrets.mjs --dry-run` y, si informa
   valores en claro, sin `--dry-run`.
5. Añadir el cron `/api/cron/unblock-tasks` (ya está en `vercel.json`).
6. Revisar que `MAX_UPLOAD_MB` y `PROMPT_LOG_RETENTION_DAYS` encajan.
7. La IA queda **desactivada** en todas las organizaciones: reactivarla es una
   decisión informada del cliente.

## Plan de rollback

Las migraciones **no son reversibles sin pérdida**: `PromptLog.prompt` se
elimina y `StripeEvent.processedAt` se sustituye. Antes de desplegar, **copia
de seguridad de la base de datos**; el rollback es restaurar esa copia y
volver al commit anterior.

Reversibles sin restaurar: el resto de columnas son aditivas. Revertir sólo el
código con el esquema nuevo funciona salvo en Stripe y PromptLog.

## Revisión manual pendiente

- Rellenar los datos del responsable en las páginas legales.
- Redactar y publicar el contrato de encargado de tratamiento.
- Verificar región y contrato de cada proveedor contratado.
- Probar la restauración de las copias de seguridad.
- Revisar las reglas fiscales frente a la normativa vigente.

---

# Fase 10 — Remediación de auditoría independiente

Una auditoría independiente del código resultante de las fases 0–9 identificó
once bloqueos que impedían fusionar o desplegar la rama. Esta fase los corrige.
No añade funcionalidad: sólo cierra los hallazgos.

## Commits

| SHA | Título | Bloqueos |
|---|---|---|
| `ceb4140` | fix(migrations): restore incremental history and remove destructive deploy | 1 |
| `a6b70b7` | fix(auth): serialize owner policy and fail closed on subscription | 2, 3 |
| `63890c8` | fix(billing): recover Stripe events and correlate invoice subscriptions | 4 |
| `dd1e95e` | fix(integrations): pin validated outbound addresses and close SSRF gaps | 5 |
| `a4ba389` | fix(notifications): claim deliveries atomically across all channels | 6 |
| `0d51568` | fix(privacy): make retention recoverable and complete AI minimization | 7, 8 |
| `b11ff73` | fix(workflows): record per-recipient deliveries and close audit leftovers | 9 + menores |
| `64c65f0` | test(ci): execute Playwright and MinIO integration in Actions | 10, 11 |
| `631a8cd` | chore(repo): remove artifacts and close remaining audit findings | documentación |
| `6062ed3` | ci: ejecutar el workflow tambien en las ramas de trabajo | 10 |
| `cd48727` | fix(deps): eliminar las criticas de produccion y arreglar MinIO en CI | 10 |
| `13c7d76` | fix(test): hacer hermetica la suite unitaria | 10 |

Rama: `claude/heredia-security-hardening-v1`. Sin merge.

## GitHub Actions

Run **#4** (`13c7d76`) — los **seis jobs en verde**:
https://github.com/VERIFACTUREADY/regusentinel-site/actions/runs/31052444328

| Job | Resultado | Qué demuestra |
|---|---|---|
| Tipos, unitarias y build | ✅ | tsc, 1.044 unitarias, build sin `DATABASE_URL` |
| Migraciones (base vacía y actualización) | ✅ | los dos caminos + guarda de `--accept-data-loss` |
| Integración PostgreSQL | ✅ | 111 pruebas contra base real |
| Integración S3 (MinIO real) | ✅ | 9 pruebas contra MinIO, con guarda anti-omisión |
| E2E Playwright | ✅ | Chromium real contra la app construida |
| Auditoría de dependencias | ✅ | 0 críticas en producción |

### Los tres fallos que la CI destapó y el "verde en local" no

El workflow sólo se disparaba en `main` y en pull requests, así que la rama
acumuló 22 commits **sin ejecutarse ni una vez**. Al hacerlo por fin salieron
tres fallos reales:

1. **Críticas de producción**: `next@14.1.0` arrastraba un bypass de
   autorización en el middleware (`GHSA-f82v-jwr5-mffw`), dos SSRF y varias de
   envenenamiento de caché; `next-auth@4.24.5` no ligaba las cookies de
   `state`/`nonce`/PKCE al proveedor que las creó. Actualizados a 14.2.35 y
   4.24.15.
2. **MinIO no arrancaba**: `bitnami/minio:latest` dejó de publicarse.
3. **La suite unitaria abortaba**: los 62 ficheros pasaban y *después* el motor
   de Prisma tiraba el proceso (`exit 134`) por falta de `DATABASE_URL`. En
   local no se veía porque el entorno de desarrollo suele tenerla exportada.

## Hallazgos corregidos

### 1. Migraciones y deploy sin pérdida de datos

`scripts/migrate-deploy.mjs` ejecutaba `prisma db push --accept-data-loss
--skip-generate` cuando `migrate deploy` fallaba con P3005 — dentro del build,
contra producción y sin revisión humana. La causa raíz era que el historial de
migraciones había sido **reemplazado** por un baseline nuevo, borrando las 8
migraciones que una base existente ya tenía aplicadas.

- Restauradas las 7 migraciones históricas nombradas por la auditoría, más
  `20260524105000_notification_channel_prerequisites` (idempotente) porque la
  cadena original nunca había sido aplicable desde cero.
- `20260530000000_align_schema_with_models`: migración reconciliadora de 213
  líneas, **cero operaciones destructivas**, que cubre las 75 columnas que el
  historial había perdido.
- `npm run build` pasa a ser `prisma generate && next build`: no toca la base.
  El despliegue usa un paso separado, `npm run db:deploy`.
- Ante P3005 el script **falla** e imprime el procedimiento manual. Nunca
  ejecuta `db push` ni `migrate reset`.
- `__tests__/migration-history.test.ts` congela las 20 migraciones por huella
  SHA-256 y falla si alguna se borra, se modifica, se añade sin registrar o
  contiene un `DROP`/`TRUNCATE` no justificado.

### 2. Último OWNER y límites con concurrencia real

El recuento de OWNER y la mutación viajaban en una transacción READ COMMITTED
normal: dos peticiones simultáneas leían ambas `ownerCount = 2` y la
organización se quedaba con **cero** titulares.

- `lockOrgForOwnership(orgId, tx)` — advisory lock por organización, aplicado
  antes de contar en las tres vías que pueden vaciar la titularidad.
- El alta de invitado (usuario + membresía + lectura del plan + tope) pasa a
  ser una sola transacción. Antes el `User` se creaba fuera: una invitación
  rechazada por el tope dejaba una cuenta con `magicToken` válido siete días.

### 3. Sesiones y suscripción fail-closed

- Una organización sin fila `Subscription` queda **suspendida**. Antes
  `isSuspended` empezaba con `if (!status) return false`.
- Los ocho estados de Stripe se enumeran con decisión explícita (lista blanca).
  `incomplete` y `paused` daban acceso completo; un estado desconocido también.
- Si el JWT nombra una organización sin membresía viva, la sesión se invalida
  (401 `ORG_CONTEXT_LOST`) en vez de cambiar en silencio a otra organización.

### 4. Stripe reintentable y correlacionado

- El webhook responde **409** cuando el evento no se ha aplicado, en vez de 200:
  el reintento de Stripe sigue vivo.
- Recuperador propio en `/api/cron/stripe-recovery` (cada 10 min): libera
  PROCESSING colgados, reprocesa FAILED, y al agotar 8 intentos pasa a
  `NEEDS_INTERVENTION` con aviso operativo. Reintento manual disponible.
- `invoice.payment_succeeded` exige `invoice.subscription`, correlaciona por
  `stripeSubId`, recupera la suscripción de Stripe y aplica **su** estado real.
  La misma corrección se extiende a los otros tres eventos de suscripción.

### 5. SSRF con la IP fijada

- `safeFetch` deja de usar `fetch` (que vuelve a resolver el nombre) y usa
  `http(s).request` con un `lookup` que devuelve la dirección ya validada. Se
  conservan `Host`, SNI y validación del certificado contra el nombre.
- Clasificación con `ipaddr.js` y lista blanca. Se cierran: todo `fe80::/10`
  (antes sólo `fe80::/16`), `fec0::/10`, IPv4 mapeada en sus tres
  representaciones, 6to4, Teredo y las formas equivalentes de los metadatos.
- Un único plazo cubre conexión, TLS, cabeceras y lectura del cuerpo.
- `/api/settings/integrations/test` comprueba el plan FIRMA en el momento del
  envío y añade una segunda ventana de límite por hora.

### 6. Notificaciones con reserva atómica

Máquina de estados PENDING → PROCESSING → SENT/FAILED. La fila se crea **antes**
de llamar al proveedor; sólo quien obtiene la reserva envía. Aplicada a los
cinco canales: cada email interno, el recordatorio a la familia, Slack, Teams y
el webhook propio — los tres últimos no pasaban por deduplicación en absoluto y
se reenviaban en cada pasada del cron.

### 7. Retención sin abandono silencioso

- Desaparece el tope `purgeAttempts < 5` que dejaba los datos personales
  abandonados para siempre. Ahora hay backoff creciente y, superado el umbral,
  reintento **diario** más aviso operativo de alta prioridad.
- Estados explícitos `PurgeState` y reintento manual por endpoint.
- Decisión coherente: la fila `Case` **se elimina**; `Case.purgedAt` queda
  marcado como obsoleto (nunca podía observarse) y la constancia pasa a
  `PurgeEvidence`, sin ningún dato personal, escrita en la misma transacción.

### 8. Minimización de IA completa

La minimización existía sólo en `case-analyzer.ts`; los otros siete puntos
enviaban el contexto en crudo. Se introduce `lib/ai-gateway.ts` como única
salida —es el único fichero que instancia el SDK— y la puerta lee de la base de
datos los nombres a sustituir, incluidos los de los empleados asignados
(`[RESPONSABLE_ASIGNADO]`). Un barrido estático falla si algún fichero vuelve a
importar el SDK por su cuenta.

### 9. Workflow con éxito parcial

Cada destinatario deja su fila `WorkflowDelivery`; el estado agregado es
SUCCESS / **PARTIAL** / FAILED. Antes bastaba con que uno de diez destinatarios
funcionara para registrar la ejecución como exitosa. Reintento individual de los
fallidos, sin duplicar el envío a quien ya lo recibió.

### 10. CI real

Seis jobs separados: `calidad`, `migraciones` (base vacía **y** actualización
desde el historial antiguo), `integracion-postgres`, `integracion-s3` (MinIO
real, con guarda que falla si las pruebas se saltan), `e2e` (Chromium instalado,
suite ejecutada, artefactos subidos) y `dependencias`.

### 11. Limpieza del repositorio

`a.out` eliminado; `.gitignore` ampliado a temporales, artefactos de Playwright,
volcados, credenciales e informes de CI. Barrido del árbol rastreado sin
binarios, dumps, bases locales, logs ni secretos.

### Pendientes menores

- `validateTaskDependency` es **fail-closed** al agotar la profundidad máxima
  (`too_deep`). Antes devolvía `{ ok: true }`: el único caso en el que la
  comprobación no había concluido era justamente el que se aceptaba.
- La referencia de expediente usa un contador numérico por organización y año
  (`CaseCounter`), no el orden lexicográfico de cadenas, que se rompía al pasar
  de 9.999 (`EXP-2026-10000` < `EXP-2026-9999`).

## Migraciones nuevas de esta fase

| Migración | Contenido | Destructiva |
|---|---|---|
| `20260524105000_notification_channel_prerequisites` | Tipos que faltaban en la cadena original | No |
| `20260530000000_align_schema_with_models` | Reconciliación de 75 columnas perdidas | No |
| `20260805120000_stripe_event_recovery` | `NEEDS_INTERVENTION`, `alertedAt`, índice | No |
| `20260805140000_notification_delivery_state` | Máquina de estados de entrega | No |
| `20260805160000_retention_states_and_evidence` | `PurgeState`, `PurgeEvidence` | No |
| `20260805180000_workflow_partial_deliveries` | `PARTIAL`, `WorkflowDelivery` | No |
| `20260805200000_case_counter` | `CaseCounter` sembrado desde el máximo real | No |

Todas aditivas. Ninguna borra ni reescribe datos.

## Variables de entorno nuevas

| Variable | Para qué | Si falta |
|---|---|---|
| `OPS_ALERT_EMAIL` | Avisos que exigen intervención humana: eventos de Stripe sin aplicar y purgas de retención bloqueadas | Cae a `LEADS_NOTIFY_EMAIL`; si tampoco, sólo queda en los logs |

## Pasos de despliegue (actualizados)

**El build ya no aplica migraciones.** El paso de esquema es explícito y
separado, y ése es el cambio que impide que un despliegue destruya datos.

1. **Copia de seguridad de la base de datos.** No es opcional.
2. `npm run db:check` — informa si hay migraciones pendientes, sin escribir.
3. `npm run db:deploy` — aplica sólo migraciones incrementales revisadas.
   Si sale P3005, **se detiene** e imprime el procedimiento manual; no
   improvisa.
4. Desplegar el código (`npm run build && npm start`, o la plataforma).
5. Configurar `OPS_ALERT_EMAIL`.
6. Comprobar que los crons nuevos están dados de alta: `/api/cron/stripe-recovery`
   (cada 10 min) ya está en `vercel.json`.
7. Verificar en el panel que no hay eventos en `NEEDS_INTERVENTION` ni
   expedientes con la purga bloqueada.

## Plan de rollback

Las migraciones de esta fase son **todas aditivas**, así que revertir el código
al commit anterior funciona sin restaurar la copia: las columnas y tablas nuevas
quedan sin usar. Es una diferencia importante respecto a las fases 0–9, donde
`PromptLog.prompt` y `StripeEvent.processedAt` sí se perdían.

Orden del rollback:

1. Revertir el despliegue de código al commit anterior.
2. **No** revertir las migraciones. Dejar las tablas nuevas.
3. Si aun así hay que volver al esquema previo, restaurar la copia del paso 1
   de despliegue: `migrate deploy` no deshace migraciones y no debe forzarse.

Riesgo conocido del rollback: los eventos de Stripe que hayan quedado en
`NEEDS_INTERVENTION` no serán reconocidos por el código antiguo, que no conoce
ese valor del enum. Deben resolverse antes de revertir.

## Riesgos que permanecen

1. **El texto libre del expediente sigue saliendo hacia Anthropic** con los
   identificadores directos sustituidos. Es el contenido sobre el que el modelo
   razona; sin él la función no existe. El tratamiento **no es anónimo** y no se
   presenta como tal: requiere activación expresa de la organización.
2. **Días hábiles sin festivos** en el cálculo de plazos: siguen siendo
   optimistas.
3. **Reglas fiscales sin verificar a 2026**; se presentan como orientativas.
4. **Textos legales con marcadores** (`[DENOMINACION SOCIAL]`, `[NIF]`…) y
   contrato de encargado de tratamiento pendiente de redactar y firmar.
5. **Restauración de copias de seguridad sin probar** en un entorno real.
6. **Las acciones de workflow no encadenan** (no es una regresión).
7. El aviso operativo depende del correo saliente: si el proveedor de email
   está caído, el aviso de "purga bloqueada" también lo está. Queda constancia
   en auditoría y en los logs del servidor.

---

# Parche final — reserva antes de enviar, reintento operativo y despliegue

Auditoría independiente sobre `1e5a23f`. Tres bloqueos, más el despliegue de
Vercel en rojo y la protección de rama.

## Commits

| SHA | Título |
|-----|--------|
| `e5e02d2` | `fix(workflows): claim deliveries before external send` |
| `f8d6e4c` | `feat(workflows): expose secure retry for failed deliveries` |
| `24e6811` | `fix(deploy): resolve Vercel deployment failure` |
| (este)    | `docs(security): record final verified deployment state` |

## 1. Reserva antes de enviar

`SEND_EMAIL_TEAM` llamaba al proveedor y **después** escribía `WorkflowLog` y
`WorkflowDelivery`. Eso no es idempotencia: entre el envío y la escritura no hay
nada que impida que otra ejecución envíe lo mismo, y si el proceso muere justo
después de enviar, la fila nunca llega a existir y el reintento vuelve a enviar.

El orden ahora es:

1. `claveEjecucion(evento, regla)` — SHA-256 de organización, regla,
   expediente, tipo de evento, estado origen, estado destino, tarea y ventana.
   Sólo identificadores: ningún dato personal entra en la clave.
2. `reclamarEjecucion()` — `create` de `WorkflowLog` en `PROCESSING` con esa
   clave sobre un índice único. El `P2002` del segundo lo convierte en
   `"ya_ejecutado"`.
3. `reclamarEntrega()` — una fila `WorkflowDelivery` en `PROCESSING` por
   destinatario, **antes de llamar al proveedor**. `SENT` → no se envía;
   `PENDING`/`FAILED`/`PROCESSING` caducado → `updateMany` condicional, y sólo
   el que ve `count === 1` puede enviar.
4. `SENT` al terminar bien, `FAILED` al fallar, por destinatario. El fallo de
   uno no bloquea a los demás.
5. `PROCESSING` abandonado se vuelve reclamable a los 10 minutos
   (`ENTREGA_WORKFLOW_COLGADA_MS`).

`planificarAccion()` no llama a ningún proveedor: devuelve el plan de entregas
o un efecto. La reserva es del motor, no de una acción, así que **todas** las
acciones con entrega externa quedan protegidas, no sólo `SEND_EMAIL_TEAM`.

Efecto colateral que hubo que corregir: al reservar antes, un
`CHANGE_CASE_STATUS` que se negaba a escribir por un cambio de estado
concurrente quedaba registrado como `SUCCESS`. `efecto` devuelve ahora
`{ aplicado, reason }` y se registra `SKIPPED`.

## 2. Reintento operativo

`POST /api/workflow-logs/[id]/retry`. Exige `workflow.manage`; busca el log
filtrando por la organización de la sesión (mismo 404 para "no existe" y "es de
otra organización"); reintenta sólo `FAILED` y `PROCESSING` colgadas; reclama
antes de enviar; recalcula `SUCCESS`/`PARTIAL`/`FAILED`; deja auditoría
(`workflow.retry`); devuelve el resultado por destinatario; 10 peticiones por
minuto e IP.

**El cuerpo de la petición se ignora por completo.** Asunto, cuerpo y
destinatarios se reconstruyen desde la regla y el expediente. Si no fuera así,
esto sería un relé de correo autenticado saliendo con el dominio de la
organización.

En la interfaz, botón "Reintentar fallidas" en el registro de automatizaciones,
visible sólo cuando la ejecución está en `PARTIAL` o `FAILED`.

## 3. Pruebas

`__tests__/integration/workflow-claim-db.test.ts` (16) y
`__tests__/integration/workflow-retry-endpoint-db.test.ts` (12), con PostgreSQL
real. **Cuentan las llamadas al proveedor**, no sólo las filas: el mock de
`src/lib/email` acumula cada destinatario en un array y las pruebas exigen
exactamente uno.

Comprobado que 5 de las 16 pruebas de reserva fallan si se anula la reserva
(forzando `reclamarEntrega` a devolver siempre `"reclamada"` y aleatorizando la
clave de idempotencia).

## 4. Despliegue de Vercel — causa concreta y corrección

### Causa

El build ejecutaba una consulta a la base de datos. `/api/health` no lee
cabeceras, ni cookies, ni parámetros, así que Next 14 la consideraba
estáticamente generable y la ejecutaba durante `next build`:

```
Generating static pages (0/352) ...
prisma:error
Invalid `prisma.$queryRaw()` invocation:
error: Environment variable not found: DATABASE_URL.
  -->  schema.prisma:7
```

Instrumentando el cliente de Prisma (`$queryRaw`, `$executeRaw` y un middleware
`$use`) durante un build completo se confirma que es el **único** acceso a la
base de datos de toda la compilación, y que la pila procede de
`.next/server/app/api/health/route.js`.

En local no hay `DATABASE_URL`: Prisma falla al instante, el `catch` devuelve
503 y el build sale con código 0. En Vercel `DATABASE_URL` **sí** está definida
durante el build, así que el intento es real contra la base de producción desde
la máquina que compila. Si esa base sólo admite conexiones desde la red de
ejecución —lista de IP permitidas, red privada, límite de conexiones del
pooler— la consulta no falla rápido: espera, y el build agota su tiempo.

### Corrección

`export const dynamic = "force-dynamic"` y `export const revalidate = 0` en
`src/app/api/health/route.ts`.

Aparte de desbloquear el despliegue, corrige la comprobación de salud en sí: si
se generaba estáticamente, respondía `{"status":"ok"}` desde una copia cacheada
del día del despliegue, también con la base de datos caída.

### Puerta de regresión

El paso «Build» de la CI afirmaba en un comentario que comprobaba que el build
no tocaba la base de datos. No lo comprobaba: `npm run build` sale con código 0
aunque Prisma imprima el fallo. `scripts/build-sin-base-de-datos.sh` compila sin
`DATABASE_URL` y falla si aparece ese error. Verificado: falla al quitar las dos
líneas de `/api/health` y pasa con ellas.

### Lo que NO se ha podido comprobar desde este entorno

**El check de Vercel no se ha podido leer ni verificar en verde.** No es una
suposición sobre su estado: es que este entorno no tiene acceso.

- `https://vercel.com` y `https://api.vercel.com` → código `000`: bloqueadas por
  la política de salida de la sesión.
- `https://api.github.com/repos/.../check-runs` → `403`: *"GitHub access is not
  enabled for this session. An org admin must connect the Claude GitHub App"*.
- El servidor MCP de GitHub disponible no expone estado de commits ni listado de
  check runs (`get_check_run` exige un id numérico que sólo llega por webhook).

Por tanto: **el despliegue no queda declarado terminado.** La causa concreta
descrita arriba está probada con el registro del build y corregida; que el check
pase a verde debe comprobarlo el propietario en el panel de Vercel sobre el
commit `24e6811` o posterior.

### Si el despliegue sigue en rojo: variables de entorno

Todas se configuran en **Vercel → Project → Settings → Environment Variables**.
"Entorno" indica en cuáles debe existir.

| Variable | Entorno | ¿Obligatoria? | Cómo verificarla |
|---|---|---|---|
| `DATABASE_URL` | Production, Preview | Sí | `psql "$DATABASE_URL" -c "select 1"` desde fuera de la red de la base. Si sólo funciona desde dentro, hay que permitir las IP de Vercel o usar el pooler. |
| `NEXTAUTH_SECRET` | Production, Preview | Sí | ≥ 32 caracteres. Si falta, NextAuth falla en ejecución, no en el build. |
| `NEXTAUTH_URL` | Production, Preview | Sí | Debe ser la URL pública exacta con `https://`. Un valor distinto rompe el retorno del login. |
| `APP_URL` | Production, Preview | Sí | Igual que `NEXTAUTH_URL`. Se usa en los enlaces de los correos. |
| `SECRETS_ENCRYPTION_KEY` | Production, Preview | Sí | 32 bytes en base64: `openssl rand -base64 32`. **Cambiarla inutiliza los secretos ya cifrados.** |
| `CRON_SECRET` | Production | Sí | Vercel la envía como `Authorization: Bearer`. Sin ella los crons responden 401. |
| `STRIPE_SECRET_KEY` | Production, Preview | Sí para facturación | `curl -u "$STRIPE_SECRET_KEY:" https://api.stripe.com/v1/balance` |
| `STRIPE_WEBHOOK_SECRET` | Production | Sí para facturación | Debe ser el `whsec_…` del endpoint concreto de este proyecto. |
| `ANTHROPIC_API_KEY` | Production | Sólo si se usa el análisis con IA | Sin ella la función se desactiva; no rompe el build. |
| `S3_*` / `AWS_*` | Production | Sí para adjuntos | Subir y descargar un fichero de prueba. |
| `EMAIL_*` / `RESEND_API_KEY` | Production | Sí para avisos | Sin ella los workflows registran `FAILED` y ahora sí se pueden reintentar. |

Ninguna de estas variables se lee durante el build después de esta corrección:
si el build vuelve a fallar, el registro de Vercel dirá la ruta concreta y
`scripts/build-sin-base-de-datos.sh` la reproduce en local.

Punto secundario a revisar en el panel, no comprobable desde aquí:
`vercel.json` declara **11 crons**, uno de ellos cada 10 minutos
(`/api/cron/stripe-recovery`). Los planes Hobby limitan el número de crons y su
frecuencia. Si el proyecto está en Hobby, el despliegue se rechaza por eso y no
por el código.

## 5. Protección de rama

**No está configurada y no se ha podido configurar desde esta sesión**: la API
de GitHub responde `403` (la Claude GitHub App no está conectada para la
organización) y el servidor MCP disponible no expone la API de protección de
ramas.

Mientras la protección figure desactivada, **los seis jobs de Actions no son
obligatorios**: son informativos y una fusión puede saltárselos.

Pasos exactos para el propietario, en
`https://github.com/VERIFACTUREADY/regusentinel-site/settings/rules`:

1. **New ruleset → New branch ruleset**.
2. Nombre: `main protegida`. **Enforcement status: Active**.
3. **Target branches → Add target → Include default branch**.
4. Marcar **Require a pull request before merging** (1 aprobación; *Dismiss
   stale approvals* activado).
5. Marcar **Require status checks to pass** y, dentro, **Require branches to be
   up to date before merging**.
6. En **Add checks**, añadir por nombre exacto:
   - `Tipos, unitarias y build`
   - `Migraciones (base vacia y actualizacion)`
   - `Integracion PostgreSQL`
   - `Integracion S3 (MinIO real)`
   - `E2E Playwright`
   - `Auditoria de dependencias`
   - `Vercel` *(aparece en el buscador una vez Vercel haya publicado al menos
     un check en un commit del repositorio)*
7. Marcar **Block force pushes** y **Restrict deletions**.
8. **Create**.

Comprobación de que ha quedado hecho: abrir un PR de prueba; el botón de fusión
debe aparecer bloqueado con "Required statuses must pass before merging" hasta
que los siete checks estén en verde.

## Estado de verificación de este parche

| Comprobación | Resultado |
|---|---|
| `npx prisma validate` | Correcto |
| `npx tsc --noEmit` | Sin errores |
| `npm test` | 1.046 pruebas, 62 ficheros |
| `npm run test:integration` | 139 pruebas con PostgreSQL real (9 de S3 omitidas sin MinIO local) |
| `bash scripts/build-sin-base-de-datos.sh` | Correcto y sin acceso a la base de datos |
| GitHub Actions | Ejecución 7 sobre `24e6811` y ejecución 8 sobre `8689bd6`: los **seis jobs en verde**, incluido el nuevo paso «Build sin base de datos» |
| Despliegue de Vercel | **No verificable desde este entorno** (ver arriba) |
| Protección de rama | **Desactivada**; pasos entregados al propietario |

No se ha hecho merge a la rama base.

## Vercel — segunda comprobación, tras seguir en rojo

Reproducción sobre el HEAD real de la rama (`4d63e8d`), clonando de cero desde
GitHub y compilando como lo hace Vercel:

| Comprobación | Resultado |
|---|---|
| `git clone` de la rama + `npm install` | Código 0 |
| `NODE_ENV=production npm run build` | Código 0 |
| Accesos a la base de datos durante el build | **0** (antes de la corrección: 1) |
| Tamaño de la función más pesada, sumando su traza `.nft.json` | **19,3 MB** sobre 208 rutas (límite de Vercel: 250 MB sin comprimir) |
| Rutas de `vercel.json → crons` que no existen entre las funciones construidas | Ninguna |

Es decir: **el código compila y despliega**. Lo que queda como posible causa
está fuera del repositorio.

### Lo que NO puede comprobarse desde esta sesión

El proxy de salida rechaza Vercel de forma explícita. Registro del propio
proxy (`$HTTPS_PROXY/__agentproxy/status`):

```
{"kind":"connect_rejected",
 "detail":"gateway answered 403 to CONNECT (policy denial or upstream failure)",
 "host":"vercel.com:443"}
{"kind":"connect_rejected",
 "detail":"gateway answered 403 to CONNECT (policy denial or upstream failure)",
 "host":"api.vercel.com:443"}
```

`api.github.com` responde `403` ("An org admin must connect the Claude GitHub
App"), y el servidor MCP disponible sólo permite leer un check run por id
numérico, que llega por webhook y aquí no llega ninguno.

**Por tanto el estado del check de Vercel no se conoce y no se declara verde.**

### Tres causas posibles, en orden de probabilidad

**1. El check rojo es el despliegue de producción de `main`, no el de esta
rama.** `origin/main` está en `de08852` y **no contiene ninguna de estas
correcciones**: esta rama va 83 commits por delante. Si Vercel tiene `main`
como rama de producción, ese despliegue seguirá en rojo hasta que se fusione,
y la instrucción vigente es no fusionar. Comprobación: en el panel de Vercel,
mirar de qué commit es el despliegue fallido. Si empieza por `de08852` o es
anterior a esta rama, la corrección todavía no ha llegado a él.

**2. Límites del plan.** `vercel.json` declara 11 crons y uno cada 10 minutos
(`/api/cron/stripe-recovery`). El plan Hobby permite 2 crons y sólo con
frecuencia diaria: con esa configuración el despliegue se rechaza antes de
compilar, y ninguna corrección de código lo arregla. Comprobación: si el
registro dice algo como *"Your plan allows a maximum of N Cron Jobs"* o
*"Hobby accounts are limited to daily cron jobs"*, es esto.

**3. Variables de entorno.** La tabla de la sección anterior indica, para cada
una, en qué entorno debe existir, si es obligatoria y cómo verificarla.

### Qué hace falta para cerrarlo

El registro del despliegue fallido: en el panel de Vercel, *Deployments* → el
despliegue rojo → *Building* / *Deployment Summary*. Las primeras líneas de
error y el SHA del commit desplegado bastan para identificar cuál de las tres
causas es.

## Vercel — el despliegue se rechaza ANTES de compilar

Al abrir el PR #2 se pudo por fin leer el estado real, que hasta entonces era
inaccesible desde el entorno de trabajo. El estado que Vercel publica en el
commit `54e38ee`:

```
context:     Vercel
state:       failure
description: Deployment failed.
created_at:  2026-08-05T23:26:43Z
```

Y la cronología del mismo commit:

| Hora (UTC) | Suceso |
|---|---|
| 23:26:38 | Fecha del commit |
| 23:26:41 | GitHub recibe el push y crea la ejecución 10 de Actions |
| **23:26:43** | **Vercel publica «Deployment failed.»** |

**Dos segundos.** Este proyecto genera 352 páginas estáticas y su build tarda
entre 70 y 90 segundos en la CI y en local. Un fallo dos segundos después del
push no puede venir de la compilación: **Vercel rechaza el despliegue antes de
empezar a construir.**

De ahí se siguen dos conclusiones firmes:

1. **Ningún cambio de código va a arreglarlo.** Concuerda con la reproducción
   ya registrada: clonando la rama de cero, `npm install` y
   `NODE_ENV=production npm run build` terminan en 0.
2. **La corrección de `/api/health` era un defecto real —el build consultaba
   la base de datos de producción— pero no era la causa de este check rojo.**
   Queda igualmente, porque una comprobación de salud servida desde una copia
   cacheada no comprueba nada.

### Corrección de dos hipótesis anteriores

Este documento afirmaba antes que el check rojo podía ser el despliegue de
producción de `main` y que quizá Vercel no estuviera construyendo la rama. **Las
dos son falsas.** Vercel construye esta rama y publica su estado en estos
commits; lo que falla es este commit, no `main`.

### Qué se rechaza en dos segundos

Sólo la validación previa a la compilación. Por orden de probabilidad:

1. **Límites de crons del plan.** `vercel.json` declara 11 crons y uno cada 10
   minutos (`/api/cron/stripe-recovery`). El plan Hobby admite 2 crons y sólo
   con frecuencia diaria. El mensaje sería del estilo *"Your plan allows a
   maximum of 2 Cron Jobs"* o *"Cron jobs on the Hobby plan can only run once
   per day"*. Es la única particularidad de la configuración de este
   repositorio, y encaja con un rechazo instantáneo.
2. **Bloqueo de la cuenta**: método de pago rechazado, límite de gasto
   alcanzado o cuota de despliegues agotada. También rechaza al instante.
3. **`vercel.json` inválido.** Descartado en lo comprobable desde aquí: el
   esquema es correcto y las 11 rutas declaradas existen entre las funciones
   construidas.

### Cómo confirmarlo en diez segundos

El enlace del propio estado —`https://vercel.link/3Fpeeb1`— lleva al
despliegue rechazado y muestra el motivo. No puede abrirse desde este entorno
(el proxy de salida rechaza los dominios de Vercel con 403), pero desde un
navegador da la respuesta directamente.

Si es lo primero, hay dos salidas y **la elección es del propietario**, porque
supone o gastar dinero o apagar automatizaciones:

- subir el proyecto a un plan que admita 11 crons y frecuencias sub-diarias; o
- recortar `vercel.json` a lo que permita el plan, aceptando que las
  automatizaciones recortadas dejan de ejecutarse solas. La recuperación de
  cobros de Stripe (`*/10 * * * *`) es la que más se degrada.
