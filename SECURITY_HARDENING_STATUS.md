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
| 1 — Sesiones, membresías y RBAC | ⬜ pendiente | — |
| 2 — Aislamiento multi-tenant | ⬜ pendiente | — |
| 3 — Portal, consentimiento y archivos | ⬜ pendiente | — |
| 4 — Stripe y límites de plan | ⬜ pendiente | — |
| 5 — SSRF y secretos outbound | ⬜ pendiente | — |
| 6 — Notificaciones y workflows | ⬜ pendiente | — |
| 7 — Retención, IA y plazos | ⬜ pendiente | — |
| 8 — Copy y documentación honesta | ⬜ pendiente | — |
| 9 — Tests reales y CI | ⬜ pendiente | — |

## Migraciones creadas

Ninguna todavía.

## Variables de entorno nuevas

Ninguna todavía.

## Pendientes conocidos

- Nada omitido en Fase 0: es sólo inventario, no modifica código de producción.
