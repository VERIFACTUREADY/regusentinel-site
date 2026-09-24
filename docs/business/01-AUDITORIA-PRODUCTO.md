# 01 — Auditoría de producto: qué existe realmente

> **Fecha del análisis:** 21 de septiembre de 2026
> **Método:** inspección directa del repositorio `regusentinel-site`, rama
> `claude/heredia-security-hardening-v1`, commit `da998a9`. Todo lo que aparece
> aquí está verificado contra el código, no contra el material comercial.
>
> **Convención de etiquetas:**
> `[CÓDIGO]` = verificado leyendo el fichero fuente ·
> `[MARKETING]` = afirmado en una página pública ·
> `[CONTRADICCIÓN]` = lo uno no coincide con lo otro.

---

## 0. Estado del negocio — los cuatro hechos que condicionan todo lo demás

Antes de discutir precios o portfolio, hay que fijar el punto de partida real,
porque casi todas las decisiones posteriores dependen de él.

| # | Hecho | Evidencia |
|---|---|---|
| 1 | **Cero clientes, cero ingresos, cero expedientes reales.** | `README.md:6-9` lo dice explícitamente: *"no ha operado todavía con expedientes reales"*. No hay ningún modelo de cliente pagando en el esquema con datos, ni evidencia de facturación. |
| 2 | **El producto no está desplegado.** El dominio `heredia.app` (el que usa el código como `BASE_URL` en `src/app/layout.tsx:7`, `sitemap.ts:7` y `robots.ts:20`) **no resuelve en DNS**: Google DNS devuelve *Non-existent domain*. | Comprobación DNS directa, 21-sep-2026. |
| 3 | **El plan de lanzamiento se ha incumplido por ~1 mes.** `docs/PLAN-LANZAMIENTO.md` fija el lanzamiento el **22 de agosto de 2026**, con pilotos captados entre el 12 y 15 de agosto. Hoy es 21 de septiembre. | `docs/PLAN-LANZAMIENTO.md:152-175` |
| 4 | **El esfuerzo del último mes ha ido a endurecimiento técnico, no a mercado.** Los 15 commits más recientes son concurrencia, seguridad de subidas, dependencias y CI. `SECURITY_HARDENING_STATUS.md` pesa 136 KB. | `git log`, `git log --since="30 days ago" --name-only` |

**Lectura de negocio.** El proyecto lleva desde abril de 2026 (366 commits, ~5,5
meses) construyendo. El producto es sustancial y está bien probado. Lo que no
existe es **una sola línea de evidencia de mercado**: ni un cliente, ni un
piloto, ni una conversación de ventas registrada, ni una visita. El cuello de
botella de HEREDIA no es el producto. Es que el producto todavía no ha tocado a
un comprador.

Esto es lo que hace que la pregunta del megaprompt —"¿qué precio aguanta el
mercado?"— **no se pueda contestar con datos hoy**. Sólo se puede acotar con
comparables y diseñar el experimento que la conteste. Este documento y los
siguientes hacen eso, y marcan con claridad dónde acaba la evidencia.

---

## 1. Magnitud real de lo construido

Cifras objetivas del repositorio, para no infravalorar el activo:

| Métrica | Valor |
|---|---|
| Rutas de API (`route.ts`) | **121** |
| Modelos y enums Prisma | **44** (`schema.prisma`, 1.074 líneas) |
| Páginas públicas (fuera de `(app)`) | **46** |
| Ficheros de test (unit + integración + e2e) | **112** |
| Módulos de dominio en `src/lib` | **~80** |
| Artículos de blog precargados | 16 (`src/lib/blog-posts.ts`) |
| Fichas de contenido por CCAA | 19 (`src/lib/ccaa-content.ts`) |
| Commits | 366, desde 2026-04-06 |

Esto no es un prototipo. Es un producto de tamaño medio con cobertura de
pruebas por encima de lo normal en un pre-seed. El problema es de asignación de
esfuerzo, no de capacidad de ejecución técnica.

---

## 2. Inventario completo — estado real por funcionalidad

Estados: **IMPLEMENTADO** · **PARCIAL** · **NO IMPLEMENTADO** · **SÓLO MARKETING**

### 2.1 Núcleo operativo del expediente

| Funcionalidad | Estado | Evidencia en código |
|---|---|---|
| Gestión de expedientes (CRUD, referencia única por org, 9 estados) | **IMPLEMENTADO** | `model Case` (`schema.prisma:163`), enum `CaseStatus` con 9 estados, `CaseCounter` para referencia secuencial por org |
| Kanban de expedientes | **IMPLEMENTADO** | `src/app/(app)/cases/kanban`, `api/cases/kanban` |
| Checklist automático por categoría | **IMPLEMENTADO** | `src/lib/checklist-rules.ts`, reglas por `TaskCategory` |
| Tareas, notas, dependencias, bloqueos | **IMPLEMENTADO** | `model Task`, `model TaskNote`, `api/cron/unblock-tasks` |
| Motor de plazos (15 días hábiles certificados, 6 meses ISD, prórroga) | **IMPLEMENTADO** | `src/lib/deadline-engine.ts`, con plazos legales documentados en el propio módulo |
| Radar ISD / detección de riesgos | **IMPLEMENTADO** | `src/lib/isd-risk-detector.ts` (determinista) + `isd-risk-aggregator.ts` + `/radar-isd` + `api/cron/digest-isd` |
| Plantillas de expediente (case templates) | **IMPLEMENTADO** | `model CaseTemplate`, `CaseTemplateTask`, `api/case-templates/seed` |
| Salud del expediente / siguiente acción | **IMPLEMENTADO** | `src/lib/case-health.ts`, `src/lib/next-action.ts` |
| Vista "Hoy" y calendario | **IMPLEMENTADO** | `(app)/today`, `(app)/calendar`, `src/lib/calendar-export.ts` (deep links Google/ICS, **sin OAuth**) |

### 2.2 Fiscal y documental

| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Cálculo ISD por CCAA (19 fichas) | **IMPLEMENTADO** | `src/lib/isd-calculator.ts` + `ccaa-content.ts` + test propio |
| Cálculo donaciones (Modelo 651) | **IMPLEMENTADO** | `src/lib/donaciones-calculator.ts` |
| Plusvalía municipal (IIVTNU, método real vs objetivo) | **IMPLEMENTADO** | `src/lib/plusvalia-calculator.ts`, elige la cuota menor |
| Coste total de la herencia (ISD + plusvalía + notaría + registro + gestoría) | **IMPLEMENTADO** | `src/lib/herencia-cost.ts` |
| Borrador PDF Modelo 650 y 651 | **IMPLEMENTADO** | `src/lib/modelo650-pdf.ts`, `modelo651-pdf.ts`, con tests |
| **Presentación telemática ante la CCAA** | **NO IMPLEMENTADO** | `README.md:322` — *"Sin envíos reales a bancos ni administraciones"* |
| Plantillas de documentos pre-redactadas | **IMPLEMENTADO** | `src/lib/document-templates.ts`, `model Template` + `TemplateVersion` |
| Versionado de plantillas con aprobación | **IMPLEMENTADO** | `model Approval` + `ApprovalStatus` + `(app)/approvals` |
| Gestor documental (S3, subida directa navegador→almacenamiento) | **IMPLEMENTADO** | `src/lib/subida-directa.ts`, `s3.ts`, `PendingUpload`, `file-policy.ts` |
| **Antivirus en subidas** | **NO IMPLEMENTADO** | `README.md:328` lo lista como limitación conocida |
| Pack banco unificado (PDF único + índice + ZIP) | **IMPLEMENTADO** | `src/lib/bank-pack.ts`, `bank-pack-export.ts` |
| Deep links a Catastro | **PARCIAL** (enlace, no consulta) | `src/lib/catastro.ts` — el propio módulo dice que **no** hace lookup automático del valor de referencia |

### 2.3 Familia y comunicación

| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Portal familia con token | **IMPLEMENTADO** | `api/portal/[token]`, `src/lib/portal-access.ts`, `model PortalConsent` |
| Mensajería con la familia | **IMPLEMENTADO** | `model PortalMessage`, `(app)/messages` |
| Consentimiento del portal (RGPD) | **IMPLEMENTADO** | `src/lib/portal-consent.ts`, `model PortalConsent` |
| Email transaccional (SMTP) | **IMPLEMENTADO** | `src/lib/email.ts` (Nodemailer) |
| Notificaciones multicanal con log y deduplicación | **IMPLEMENTADO** | `model NotificationLog`, `notification-dedupe.ts`, `notif-prefs.ts` |
| WhatsApp | **PARCIAL** — sólo deep link `wa.me` | `src/lib/whatsapp.ts`: construye el enlace, **no** hay API de WhatsApp Business |
| **Notificaciones en tiempo real** | **NO IMPLEMENTADO** | `README.md:326` |
| Resumen para la familia en PDF | **IMPLEMENTADO** | `src/lib/family-summary-pdf.ts` |

### 2.4 Automatización e IA

| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Motor de workflows (reglas trigger→acción, log, entrega) | **IMPLEMENTADO** | `src/lib/workflow-engine.ts`, `model WorkflowRule/WorkflowLog/WorkflowDelivery`, enums `WorkflowTrigger`/`WorkflowAction` |
| Crons programados (11 rutas) | **IMPLEMENTADO** | `api/cron/*`: digest ISD, briefing diario, notificaciones, limpieza de retención, leads fríos, recuperación Stripe, trial expiring/expired, desbloqueo de tareas |
| IA: análisis de expediente, chat, autopilot, tareas sugeridas, respuesta al portal, relevo de turno, informes | **IMPLEMENTADO pero DESACTIVADO por defecto** | `src/lib/ai-gateway.ts` (puerta única con minimización RGPD), `aiEnabled Boolean @default(false)` en `Organization` |
| Minimización de datos antes de enviar al modelo | **IMPLEMENTADO y testeado** | `src/lib/ai-privacy.ts` + `__tests__/ai-minimization-sweep.test.ts` impide importar el SDK fuera de la puerta |

> **Nota de calidad.** La arquitectura de IA (una única puerta de salida que
> obliga a la minimización, con un test que impide saltársela) está por encima
> del estándar del sector. Es un activo comercial real frente a un comprador
> con DPO. Ver documento 07.

### 2.5 Organización, seguridad y administración

| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Multi-tenant con aislamiento por `orgId` | **IMPLEMENTADO** | `src/lib/tenancy.ts`, aislamiento en cada query |
| RBAC con 5 roles (OWNER, MANAGER, OPERATOR, VIEWER, MANAGED_OPS) | **IMPLEMENTADO** | `src/lib/rbac.ts`, enum `Role` |
| Auditoría inmutable | **IMPLEMENTADO** | `model AuditLog`, `src/lib/audit.ts`, `scripts/audit-gate.mjs` en CI |
| Invitaciones de usuario | **IMPLEMENTADO** | `model Invitation`, `src/lib/invitaciones.ts` |
| Retención y purga con evidencia | **IMPLEMENTADO** | `model PurgeEvidence`, `PurgeState`, `src/lib/retention.ts`, `retentionDays` configurable |
| Cifrado de secretos de cliente | **IMPLEMENTADO** | `src/lib/secret-crypto.ts` + `SECRETS_ENCRYPTION_KEY` |
| Protección SSRF en llamadas salientes | **IMPLEMENTADO** | `src/lib/ssrf-guard.ts` |
| Rate limiting de API | **IMPLEMENTADO** | `src/lib/api-rate-limit.ts` |
| Panel de administración (métricas, funnel, demo requests) | **IMPLEMENTADO** | `(app)/admin/metrics`, `/funnel`, `/demo-requests` |
| Importación CSV/Excel de expedientes | **IMPLEMENTADO** | `src/lib/case-import.ts`, `(app)/cases/import` |
| Exportación CSV | **IMPLEMENTADO** | `api/cases/export-csv`, `api/export` |
| White-label del portal familia | **IMPLEMENTADO** | Campos `brand*` en `Organization`; el comentario del esquema indica desbloqueo en DESPACHO/FIRMA |
| Facturación Stripe (checkout, portal, webhooks, setup fee, idempotencia) | **IMPLEMENTADO** | `src/lib/stripe.ts`, `model StripeEvent` + `StripeEventStatus` |
| Trial de 14 días al registrarse | **IMPLEMENTADO** | `src/app/api/register/route.ts:11` `TRIAL_DAYS = 14`, crea suscripción y envía email de bienvenida |
| Onboarding guiado de 5 pasos + expediente de ejemplo | **IMPLEMENTADO** | `src/lib/onboarding.ts`, `sample-case-seeder.ts`, `onboardingDismissedAt` |

### 2.6 Lo que se vende y **no** existe como se vende

| Afirmación comercial | Realidad en código | Estado |
|---|---|---|
| Plan Firma: **"Roles y permisos avanzados, SSO"** (`pricing-table.tsx:46`) | Google OAuth vía NextAuth, activado por **variable de entorno global** (`src/lib/auth.ts:45`), **no** por plan y **no** configurable por inquilino (`GOOGLE_WORKSPACE_HD` es una sola variable para toda la instalación). **SAML: 0 referencias en todo el repositorio.** `README.md:325` lo admite: *"Sin SSO SAML empresarial"*. | **[CONTRADICCIÓN]** |
| Plan Firma: **"API / webhooks + integraciones"** (`pricing-table.tsx:47`) | Hay **webhooks salientes** (Slack, Teams, HTTP POST firmado con HMAC) — `src/lib/outbound-integrations.ts`, correctamente limitados a FIRMA en `notifications.ts:173`. **No existe API pública para clientes**: no hay modelo `ApiKey`, no hay emisión de credenciales, no hay documentación de endpoints. Las dos únicas coincidencias de "apiKey" son la clave de Stripe y la de Anthropic. | **[CONTRADICCIÓN parcial]** — "webhooks" es cierto; "API" no. |
| Plan Firma: **"DPA extendido + auditorías"** | La auditoría técnica existe (`AuditLog`). El **DPA no está publicado**: `README.md:308` lo lista como pendiente *antes de operar con datos reales*. | **[CONTRADICCIÓN]** |
| Textos legales (`/legal/privacidad`, `/terminos`, `/cookies`) | **Llevan marcadores de posición**, no la identidad real del responsable (`README.md:306`). | **[BLOQUEANTE LEGAL]** |
| `/precios`: *"Portal familia white-label"* en Despacho | Implementado. Correcto. | OK |
| Landing: *"Sin permanencia · 14 días gratis"* (`landing-client.tsx:701`) | Cierto **si el usuario se registra**. Pero ver §3.1: la página de precios no enlaza al registro. | **[FRICCIÓN]** |

---

## 3. Contradicciones entre código, precio, documentación y marketing

Ordenadas por impacto comercial.

### 3.1 La página de precios no deja comprar — y el autoservicio ya está construido

**El hallazgo más rentable de esta auditoría.**

- HEREDIA tiene registro self-service funcionando, con trial de 14 días,
  onboarding guiado de 5 pasos y un expediente de ejemplo sembrado
  automáticamente (`register/route.ts`, `onboarding.ts`, `sample-case-seeder.ts`).
- Y sin embargo, **los tres botones de los tres planes en `/precios` apuntan a
  `/#demo`** (`pricing-table.tsx:145`). No hay un solo enlace de `/precios` a
  `/register` — verificado por grep.

Se ha construido el motor de conversión de menor fricción del producto y luego
se ha cerrado la puerta con un formulario de demo. Cada visitante con intención
de compra se convierte en un lead que hay que trabajar a mano — con un fundador
en solitario, eso es el techo de crecimiento.

**Conecta con:** conversión, fricción de venta.
**Coste de arreglarlo:** una línea de `href`. Ver documento 08, experimento E1.

### 3.2 El modelo financiero asume un canal que no existe

`src/lib/financial-model.ts` proyecta desde `initialSeoVisits: 400` en el mes 1
(escenario conservador) creciendo al 28 % mensual. Pero:

- El dominio no resuelve. No hay sitio publicado, luego no hay indexación, luego
  el mes 1 de ese modelo **no ha empezado**.
- `cacPerNewCustomer: 0` en el escenario STRETCH, con el comentario *"100 %
  orgánico, asume contenido evergreen sin coste imputado"*. Un CAC de cero no es
  un escenario optimista; es un escenario imposible que invalida cualquier
  cálculo de payback derivado de él.
- El modelo no contiene **ninguna** línea del servicio `Heredia Managed`
  (490 €/expediente), que sí se vende en `/precios`. El modelo financiero y la
  oferta comercial no describen el mismo negocio.

**Conecta con:** riesgo de negocio (decisiones tomadas sobre un modelo que no
representa la realidad).

### 3.3 Existe un cuarto producto que nadie ha modelado: `Heredia Managed`

`pricing-table.tsx:171-192` vende **Heredia Managed a 490 €/expediente**
(330 €/exp a partir de 30/mes), descrito como *"operación administrativa
coordinada por expediente: intake, documentación, pack banco, plazos y
comunicación con familia. Sin asesoría legal/fiscal."*

Hay infraestructura para ello: el rol `MANAGED_OPS` existe en el enum y en
`rbac.ts:75`. Pero:

- No aparece en el modelo financiero.
- No aparece en el README ni en el plan de lanzamiento.
- No tiene página propia, ni proceso, ni definición de alcance, ni SLA.
- **Es un negocio de servicios con márgenes y riesgos distintos al SaaS**, y a
  490 €/expediente implica trabajo humano cuyo coste no está calculado en
  ninguna parte del repositorio.

Éste es el punto de portfolio más importante del análisis, y se trata a fondo en
el documento 04 (servicio vs software) y el 07 (riesgo de intrusismo).

### 3.4 Los topes duros pueden castigar precisamente al mejor cliente

`src/lib/plan-limits.ts` aplica topes **duros** de expedientes/mes: al alcanzar
el límite, la creación de expedientes **se rechaza**. Sin facturación por exceso
(así lo confirma `README.md:74-75`).

La decisión está bien razonada en el comentario del módulo (antes el copy
prometía excedentes ambiguos). Pero el efecto de negocio es: el cliente que más
usa HEREDIA —el que mejor se está activando, el que menos va a irse— choca
contra un muro a mitad de mes y **no puede trabajar**. En un producto cuyo
argumento es "no pierdas plazos", bloquear la apertura de un expediente es el
peor momento posible para pedir un upgrade.

**Conecta con:** retención, expansión. Se analiza y se propone alternativa en el
documento 03, §9 y §10.

### 3.5 El nombre y el dominio son un riesgo de canal no resuelto

- `heredia.app` **no está registrado / no resuelve**. El código ya lo tiene
  cableado como URL canónica en tres sitios.
- `heredia.es` está registrado por un tercero.
- "Heredia" es un apellido español muy común y un topónimo (provincia de Costa
  Rica). Posicionar la marca en buscadores compite contra ese ruido — lo que
  ataca directamente al canal SEO sobre el que se ha construido todo el modelo
  financiero.

**Conecta con:** conversión, coste de adquisición. Decisión requerida antes de
publicar. Ver documento 05.

### 3.6 Deuda de arranque que bloquea cobrar

`README.md:304-318` enumera seis puntos que **el código no resuelve** y que hoy
impiden operar con datos reales: identidad legal en los textos legales, DPA
firmable, verificación de proveedores, restauración de backups probada, rotación
de secretos, y revisión de las reglas fiscales frente a normativa vigente.

El plan de lanzamiento fijaba el camino crítico correctamente (Stripe live
requiere entidad legal + KYC, que tarda días). Ese camino crítico sigue abierto
un mes después de la fecha de lanzamiento prevista.

---

## 4. Riesgo de producto que afecta al precio: la caducidad fiscal

Esto no es un bug; es una característica del negocio que hay que financiar.

HEREDIA contiene reglas fiscales de **19 comunidades autónomas** (`ccaa-content.ts`,
`isd-calculator.ts`), más plusvalía municipal (que varía por ayuntamiento, con
`tipoGravamenMunicipal` como entrada del usuario). El ISD autonómico se modifica
con frecuencia —bonificaciones, escalas, reducciones— y cada modificación
caduca una parte del producto.

`README.md:316` ya lo reconoce como tarea pendiente: *"Revisar las reglas
fiscales y los importes frente a la normativa vigente."*

**Implicación de pricing directa:** mantener contenido normativo actualizado en
19 CCAA es un **coste recurrente real**, no marginal cero. Eso:

1. justifica una suscripción (y no una licencia perpetua);
2. justifica un precio superior al de un mero gestor documental;
3. **pero también significa que el margen bruto no es el 85-90 % típico de SaaS**
   si el mantenimiento normativo lo hace una persona.

Se cuantifica en el documento 06.

---

## 5. Veredicto de la auditoría

**Lo que está bien:**

- El producto existe, funciona y está probado por encima de la media del sector
  en fase pre-seed.
- Las decisiones de seguridad y privacidad (puerta única de IA, minimización
  obligatoria, auditoría inmutable, purga con evidencia, aislamiento
  multi-tenant) son **argumentos de venta reales** ante un comprador que maneja
  datos de terceros.
- El motor de plazos ISD y el Radar ISD son genuinamente diferenciales: no son
  un CRM genérico con otra etiqueta.

**Lo que está mal:**

- Se ha optimizado durante meses la variable equivocada. El riesgo dominante del
  proyecto pasó de ser técnico a ser comercial hace tiempo, y la asignación de
  esfuerzo no lo ha seguido.
- Hay tres afirmaciones comerciales (SSO, API, DPA) que un comprador diligente
  puede desmontar en la primera llamada técnica. Eso no cuesta una venta: cuesta
  la credibilidad de todo lo demás que se afirma.
- Hay un cuarto producto (`Managed`, 490 €/exp) vendiéndose sin modelo económico,
  sin alcance definido y sin análisis de riesgo regulatorio.

**La pregunta que este documento deja abierta para el resto del análisis:** dado
que no hay ni un solo dato de comportamiento de cliente, ¿cuál es el precio y el
portfolio que **maximiza la velocidad a la que conseguimos ese dato**, en lugar
de maximizar un ingreso teórico que todavía no existe?

→ Continúa en `03-PRICING.md` y `04-PORTFOLIO-SERVICIOS.md`.
