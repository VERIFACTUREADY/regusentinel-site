# 04 — Portfolio de producto y servicios: qué vender y qué dejar de vender

> **Fecha:** 22 de septiembre de 2026
> **Base:** inventario verificado en `01-AUDITORIA-PRODUCTO.md`; demanda y
> competencia en `02-MERCADO-Y-COMPETENCIA.md`; economía en `03` y `06`; riesgo
> en `07`.
>
> **Regla de este documento:** *"ya está desarrollado"* no es un argumento.
> Tampoco lo es *"el competidor lo tiene"*.

---

## 1. El criterio: qué problema se está comprando realmente

Antes de clasificar nada, hay que fijar qué se vende, porque de eso depende todo
lo demás.

Una herencia en España es, para el profesional que la tramita:

- **~6-12 meses de duración** con un plazo legal duro a los 6 meses y **una
  decisión crítica en el mes 5** (la prórroga).
- **>20 entidades** con las que hay que gestionar algo: bancos, Seguridad Social,
  hacienda autonómica, ayuntamiento, suministros, telecomunicaciones, seguros,
  suscripciones, plataformas digitales.
- **Entre 6 y 12 horas de trabajo** **[ESTIMADO, a medir]**, la mayor parte de las
  cuales **no es técnica**: es perseguir documentos a herederos que están de
  duelo, repartidos geográficamente y que no se hablan entre sí.
- **500-1.500 €** de facturación para una gestoría; **3.000-8.000 €** para un
  abogado **[CONFIRMADO]**.

**El trabajo caro no es calcular el impuesto. Es coordinar.** Ésa es la frase que
debería gobernar el portfolio, y es también la que separa a HEREDIA de
`a3ASESOR|her` (que gana en cálculo e integración) y de las aseguradoras (que
ganan en relación con la familia).

---

## 2. Tabla maestra del portfolio

Acciones posibles: **KEEP · IMPROVE · ADD · REMOVE · MERGE · MAKE ADD-ON ·
MOVE TO ENTERPRISE · TEST FIRST**

### 2.1 Núcleo del expediente

| Servicio / funcionalidad | Estado actual | Demanda | Valor cliente | Diferenciación | Riesgo | Coste | **Acción** |
|---|---|---|---|---|---|---|---|
| Gestión de expedientes (9 estados, ref. única) | IMPLEMENTADO | Alta | Alto | Baja (table stakes) | Bajo | Bajo | **KEEP** |
| Checklist automático por categoría | IMPLEMENTADO | Alta | **Alto** | Media | Bajo | Bajo | **KEEP** |
| Tareas, notas, dependencias, bloqueos | IMPLEMENTADO | Alta | Alto | Media | Bajo | Bajo | **KEEP** |
| **Motor de plazos ISD** | IMPLEMENTADO | **Alta** | **Muy alto** | **ALTA** | Medio (legal) | Medio | **KEEP + IMPROVE** ⭐ |
| → **Aviso del mes 5 (prórroga)** | Implementado en el motor, **no destacado comercialmente** | Alta | **Muy alto** | **MÁXIMA** | — | ~0 | **IMPROVE — convertirlo en el argumento central** |
| → Festivos autonómicos y locales | **NO IMPLEMENTADO** (`README.md:327`) | Media | Medio | Baja | **Medio** — los plazos salen optimistas | Medio | **TEST FIRST** — preguntar en entrevistas si bloquea |
| Radar ISD / detección de riesgos | IMPLEMENTADO | Media | Alto | **Alta** | Bajo | Bajo | **KEEP** |
| Kanban, vista Hoy, calendario | IMPLEMENTADO | Media | Medio | Baja | Bajo | Bajo | **KEEP** |
| Plantillas de expediente | IMPLEMENTADO | Media | Medio | Baja | Bajo | Bajo | **KEEP** |
| Salud del expediente / siguiente acción | IMPLEMENTADO | Baja (no se pide) | Medio | Media | Bajo | Bajo | **KEEP, no promocionar** |

### 2.2 Fiscal y documental

| Servicio / funcionalidad | Estado | Demanda | Valor | Difer. | Riesgo | Coste | **Acción** |
|---|---|---|---|---|---|---|---|
| Cálculo ISD 19 CCAA | IMPLEMENTADO | Alta | Alto | **Media** (WK y Ulpiano también) | **ALTO** (SAP Navarra) | **ALTO — mantenimiento normativo** | **KEEP + IMPROVE (versionado con fuente)** |
| Cálculo donaciones (651) | IMPLEMENTADO | **Baja** para el ICP de herencias | Medio | Baja | Alto | Medio | **TEST FIRST** — ¿lo pide alguien? |
| **Plusvalía municipal** | IMPLEMENTADO | Media-alta | Alto | **ALTA — corregido 22-sep: Ulpiano la marca "Próx.", no la tiene** | Alto | Alto (varía por municipio) | **KEEP + promocionar** ⭐ |
| Coste total de la herencia | IMPLEMENTADO | Media | Medio | Media | Medio | Bajo | **KEEP como herramienta de captación** |
| Borrador PDF 650/651 | IMPLEMENTADO | Alta | Alto | Baja | **MUY ALTO** (arts. 390/392 CP) | Bajo | **KEEP + IMPROVE urgente** — rediseño anti-falsedad, doc. 07 §2 |
| **Presentación telemática** | NO IMPLEMENTADO | Alta | Muy alto | — | — | — | **NO OFRECER NUNCA** — imposible, doc. 07 §4 |
| Plantillas de documentos | IMPLEMENTADO | Media | Medio | Baja | Medio | Bajo | **KEEP** |
| Versionado con aprobación | IMPLEMENTADO | Baja (sólo despachos grandes) | Medio | Media | Bajo | Medio | **MOVE TO PRO** |
| Gestor documental S3 + subida directa | IMPLEMENTADO | Alta | Alto | Baja | Medio | Medio | **KEEP** |
| Antivirus en subidas | **NO IMPLEMENTADO** | Media | Medio | Baja | **Alto** | Bajo | **ADD** — barato y elimina una objeción de seguridad |
| **Pack banco unificado** | IMPLEMENTADO | **Alta** | **Muy alto** | **ALTA** | Bajo | Bajo | **KEEP + IMPROVE** ⭐ |
| Deep links a Catastro | PARCIAL (enlace, no consulta) | Media | Medio | Baja | Bajo | Bajo | **KEEP** |
| **Cuaderno particional** | **NO IMPLEMENTADO** | **Alta** | Alto | — (Ulpiano lo tiene) | Medio | Alto | **TEST FIRST** |
| **Árbol genealógico / legítimas** | **NO IMPLEMENTADO** | Media-alta | Alto | — (Ulpiano lo tiene) | Medio | Alto | **TEST FIRST** |

### 2.3 Familia y comunicación

| Servicio / funcionalidad | Estado | Demanda | Valor | Difer. | Riesgo | Coste | **Acción** |
|---|---|---|---|---|---|---|---|
| **Portal familia con token** | IMPLEMENTADO | **Alta** | **Muy alto** | **ALTA vs WK** | Medio (RGPD) | Bajo | **KEEP** ⭐ |
| Mensajería con la familia | IMPLEMENTADO | Alta | Alto | Alta | Medio | Bajo | **KEEP** |
| Consentimiento RGPD del portal | IMPLEMENTADO | Media | Alto (para el comprador) | Media | Bajo | Bajo | **KEEP** |
| Email transaccional | IMPLEMENTADO | Alta | Alto | Baja | Bajo | Bajo | **KEEP** |
| Notificaciones con log y deduplicación | IMPLEMENTADO | Media | Alto | Media | Bajo | Bajo | **KEEP** |
| WhatsApp (deep link `wa.me`) | PARCIAL | **Alta** — es el canal real de las familias | Alto | Baja | Medio | Bajo ahora, alto si API | **KEEP como está + TEST FIRST** la API |
| Notificaciones en tiempo real | NO IMPLEMENTADO | Baja | Bajo | Baja | Bajo | Medio | **NO HACER** |
| Resumen para la familia en PDF | IMPLEMENTADO | Media | Alto | Media | Bajo | Bajo | **KEEP** |
| **Flujo art. 3 LOPDGDD** (acceso de familiares no clientes) | **NO IMPLEMENTADO** | Baja declarada, **obligatoria legalmente** | Alto (para el comprador con DPO) | Media | **Alto si falta** | Bajo | **ADD** — doc. 07 §6.1 |

### 2.4 Automatización e IA

| Servicio / funcionalidad | Estado | Demanda | Valor | Difer. | Riesgo | Coste | **Acción** |
|---|---|---|---|---|---|---|---|
| Motor de workflows | IMPLEMENTADO | Baja en 0-2 personas, media en despachos | Medio | Media | Medio | Medio | **MOVE TO PRO** |
| Crons (11 rutas) | IMPLEMENTADO | n/a (infraestructura) | Alto | — | Bajo | Bajo | **KEEP** |
| IA: análisis, chat, autopilot, tareas, respuestas | IMPLEMENTADO, **desactivado por defecto** | Media-alta (7 de cada 10 despachos ya usan IA) | Alto | Media | **Alto** (AEPD, art. 50 RIA) | **ALTO — único coste variable grande** | **MAKE ADD-ON (créditos)** |
| **Puerta única + minimización RGPD** | IMPLEMENTADO y testeado | Baja declarada, **alta ante un DPO** | Alto | **ALTA** | Bajo | Bajo | **KEEP + promocionar** — activo infrautilizado |
| **Etiquetado de output de IA** | **NO IMPLEMENTADO** | — | — | — | **Obligatorio desde 02-08-2026** | ~0 | **ADD urgente** — doc. 07 §6.4 |
| OCR de escrituras y certificados | PARCIAL | **Alta** | **Alto** | Media (Ulpiano lo tiene) | Medio | Medio | **TEST FIRST** |

### 2.5 Organización, seguridad y comercial

| Servicio / funcionalidad | Estado | Demanda | Valor | Difer. | Riesgo | Coste | **Acción** |
|---|---|---|---|---|---|---|---|
| Multi-tenant + aislamiento orgId | IMPLEMENTADO | n/a | Alto | Baja | Bajo | Bajo | **KEEP** |
| RBAC 5 roles | IMPLEMENTADO | Media | Medio | Baja | Bajo | Bajo | **KEEP** |
| **Auditoría inmutable** | IMPLEMENTADO | Media (alta en abogados) | Alto | **Media-alta** | Bajo | Bajo | **KEEP + promocionar a abogados** |
| Retención y purga con evidencia | IMPLEMENTADO | Baja declarada, alta en due diligence | Alto | **Alta** | Bajo | Bajo | **KEEP** |
| Invitaciones de usuario | IMPLEMENTADO | Alta | Medio | Baja | Bajo | Bajo | **KEEP** |
| Panel admin (métricas, funnel, mini-CRM) | IMPLEMENTADO | n/a (interno) | Alto para el fundador | — | Bajo | Bajo | **KEEP** |
| Importación CSV/Excel | IMPLEMENTADO | **Alta en migración** | Alto | Media | Bajo | Bajo | **KEEP — es un desbloqueador de venta** |
| Exportación CSV | IMPLEMENTADO | Media | Medio (reduce miedo al lock-in) | Baja | Bajo | Bajo | **KEEP** |
| White-label del portal | IMPLEMENTADO | **Alta en funerarias** | Alto | Media | Bajo | Bajo | **KEEP en PRO** |
| Billing Stripe (checkout, setup, webhooks) | IMPLEMENTADO | n/a | Alto | — | Medio (Verifactu) | Bajo | **KEEP + verificar Verifactu** |
| Trial 14 días self-service | IMPLEMENTADO | Alta | **Muy alto** | Media | Bajo | Bajo | **KEEP — y ENLAZARLO desde `/precios`** ⭐ |
| Onboarding guiado + expediente de ejemplo | IMPLEMENTADO | Alta | Alto | Media | Bajo | Bajo | **KEEP** |
| **Widget ISD embebible + API pública** | IMPLEMENTADO, **sin usar** | — | **Alto como canal** | **ALTA** | Bajo | Bajo | **KEEP + ACTIVAR** ⭐ |
| **SSO empresarial (SAML)** | **NO IMPLEMENTADO** — 0 referencias | Baja hoy | Medio | Baja | **Alto: se vende y no existe** | Alto | **REMOVE de la tarifa → MOVE TO ENTERPRISE** |
| **API de datos de cliente** | **NO IMPLEMENTADO** | Baja hoy | Medio | Baja | **Alto: se vende y no existe** | Alto | **REMOVE de la tarifa → MOVE TO ENTERPRISE** |
| Webhooks salientes (Slack/Teams/HTTP+HMAC) | IMPLEMENTADO | Baja | Medio | Media | Bajo | Bajo | **KEEP en ENTERPRISE** |
| **DPA publicado** | **NO IMPLEMENTADO** | **Alta — descalificatorio si falta** | Alto | Ninguna | **Muy alto** | Bajo | **ADD urgente** |
| **Testimonios sintéticos** | IMPLEMENTADO en `/portal-familia` | — | **Negativo** | — | **MUY ALTO** | ~0 | **REMOVE inmediato** ⭐ |
| **Módulo PBC / blanqueo** | **NO IMPLEMENTADO** | **Alta y creciente** | **Muy alto** | **MÁXIMA — hueco abierto para todos** | Bajo | Medio | **ADD — mejor oportunidad del análisis** ⭐ |

---

## 3. Clasificación del portfolio

**CORE / MUST HAVE** — sin esto no hay producto
Expedientes · checklist · tareas y dependencias · motor de plazos · portal
familia · documentos · email · auditoría · roles · multi-tenant · billing ·
onboarding · trial

**DIFERENCIADORES** — la razón para cambiar de herramienta
**Aviso del mes 5** · **pack banco unificado** · **checklist de >20 entidades
incluyendo vida digital** · Radar ISD · **arquitectura de privacidad de IA** ·
cobertura de 19 CCAA · auditoría inmutable

**SALES ENABLERS** — desbloquean la venta aunque no se usen a diario
Importación CSV/Excel · expediente de ejemplo sembrado · **DPA publicado** ·
exportación (quita el miedo al lock-in) · **widget ISD embebible**

**RETENTION DRIVERS**
Portal familia (la familia ya está dentro) · pack banco · historial de auditoría ·
documentos acumulados

**UPSELL DRIVERS**
White-label · créditos de IA · almacenamiento · multi-sede · reporting · PBC

**ENTERPRISE REQUIREMENTS** (no existen todavía)
SSO SAML · API de datos · SLA · DPA extendido · revisión de seguridad ·
ISO 27001

**ADD-ON**
Créditos de IA · almacenamiento · PBC · migración · formación

**NICE TO HAVE**
Calendario, vista Hoy, salud del expediente, siguiente acción, calculadora de
coste total

**DISTRACCIÓN / REVISAR**
Calculadora de donaciones (Modelo 651) para un ICP de herencias · workflows
configurables en un cliente de 0-2 personas · notificaciones en tiempo real

**REMOVE**
Testimonios sintéticos · "SSO" y "API" en la tarifa pública · "DPA extendido"
mientras no exista

---

## 4. Análisis de huecos del recorrido del cliente

### ANTES de HEREDIA (hoy, sin el producto)

| Paso | Dónde ocurre hoy | ¿HEREDIA lo cubre? |
|---|---|---|
| Fallecimiento y funeral | Funeraria, su propio CRM | **No** — y no debe |
| Primera llamada del familiar | Teléfono, WhatsApp | **No** |
| Certificado de defunción | Registro Civil, papel | **No** — sólo checklist |
| Últimas voluntades y seguros (15 días hábiles) | Modelo 790-006, presencial o telemático | **Parcial** — plazo y checklist, no la solicitud |
| Decisión de a quién encargar la herencia | Boca a boca, recomendación de la funeraria | **No** — aquí está el canal |

### DURANTE (donde vive HEREDIA)

| Paso | Cobertura | Hueco |
|---|---|---|
| Apertura del expediente | **Completa** | — |
| Inventario de bienes | Parcial | **Sin OCR de escrituras; sin consulta automática de valor de referencia catastral** |
| Recogida documental con la familia | **Completa y diferencial** | — |
| Cálculo ISD orientativo | **Completa (19 CCAA)** | Versionado normativo con fuente |
| Plusvalía | Completa | Tipo municipal lo introduce el usuario |
| **Cuaderno particional y reparto** | **Ausente** | **Hueco real: es donde acaba el expediente** |
| Borrador Modelo 650 | Completa | **Rediseño anti-falsedad urgente** |
| **Presentación** | **Ausente por imposibilidad legal** | Se hace en el portal de la CCAA con el certificado del colegiado |
| Pack banco | **Completa y diferencial** | — |
| Comunicación con herederos | Completa | WhatsApp sólo por deep link |
| Seguimiento de >20 entidades | **Completa (8 categorías)** | — |

### DESPUÉS

| Paso | Cobertura | Hueco |
|---|---|---|
| Inscripción registral | **No** | Checklist únicamente |
| Cierre y archivo | Completa (retención y purga) | — |
| **Relación posterior con los herederos** | **Ausente** | **El mayor hueco de negocio: un heredero es un cliente futuro del despacho** |

### Qué huecos importan de verdad

| Hueco | ¿Bloquea? |
|---|---|
| Rediseño del PDF borrador | **BLOQUEA LANZAMIENTO** (riesgo penal) |
| DPA publicado + textos legales reales | **BLOQUEA LA PRIMERA VENTA** |
| Enlace de `/precios` a `/register` | **BLOQUEA CONVERSIÓN** |
| Etiquetado de IA | **BLOQUEA CUMPLIMIENTO** (ya exigible) |
| Cuaderno particional | **BLOQUEA ADOPCIÓN** en despachos que cierran el reparto — **validar** |
| OCR de escrituras | Bloquea adopción parcial — **validar** |
| Festivos autonómicos | Probablemente **no bloquea** — validar |
| Módulo PBC | No bloquea hoy; **bloquea expansión** y desbloquea precio |
| Presentación telemática | **No es un hueco: es una frontera** |
| Notificaciones en tiempo real | **No importa** |

---

## 5. Servicio o software: la decisión que define la empresa

### 5.1 El problema, en una cifra

| Comparación | Resultado |
|---|---|
| Un expediente Managed (490 €) | **3,3 meses** de Inicia o **1,4 meses** de Despacho |
| 30 expedientes/mes a 330 € | **9.900 €/mes de un solo cliente** |
| El mejor plan de software (Firma) | 749 €/mes |
| **Ratio** | **×13** |

Un solo cliente Managed de volumen medio factura más que trece clientes del plan
de software más caro. Y el umbral de cobertura de costes del documento 06 —**entre
6 y 12 clientes sin sueldo de fundador, 20-50 con estructura mínima**— se
alcanzaría con **un único** cliente Managed de 15-20 expedientes al mes.
*(Cifra corregida el 22-sep-2026: antes decía "24 clientes".)*

### 5.2 Por qué no es la respuesta obvia

| | SaaS puro | Servicio gestionado |
|---|---|---|
| Margen bruto | **81 %** (mediana de suscripción) | **30 %** (mediana de servicios profesionales) **[CONFIRMADO]** |
| Escala | Marginal ≈ 0 | Lineal con plantilla |
| Tiempo del fundador | Producto y canal | **Operar expedientes** |
| Riesgo regulatorio | Bajo | **Alto** — intrusismo, doc. 07 §5 |
| Conflicto de canal | Ninguno | **Compite con los clientes a quienes vende software** |
| Velocidad a los primeros ingresos | Lenta | **Rápida** |

Y un umbral documentado: **cuando los servicios superan el 15-20 % de los
ingresos totales, el margen bruto agregado cae por debajo de la mediana del
77 %** **[CONFIRMADO]**. A 490 €/expediente con trabajo humano detrás, Managed
cruza ese umbral con muy pocos clientes.

### 5.3 Recomendación

**Mantener Managed, pero reestructurarlo como BPO puro y sacarlo de la página de
precios pública.**

| Decisión | Razón |
|---|---|
| **El cliente es siempre la gestoría o el abogado, nunca la familia** | Elimina el riesgo de intrusismo (no hay relación profesional-cliente) y elimina el conflicto de canal: deja de competir con sus propios clientes |
| **Fuera de `/precios`; página propia detrás de "contactar"** | Un comprador colegiado que ve "Managed 490 €/exp" junto a "Despacho 349 €/mes" entiende, correctamente, que el proveedor es también un competidor |
| **No fijar el precio hasta cronometrar 3 expedientes reales** | Hoy no existe un modelo de costes. Rango de hipótesis: **390-690 €/expediente** |
| **Límite explícito: máximo 3-5 clientes Managed** mientras el fundador esté solo | Managed consume el tiempo que necesita el producto y el canal. Es un puente de caja y una máquina de aprendizaje del dominio, no el negocio |
| **Usarlo deliberadamente como investigación** | Operar expedientes reales responde de una vez a las tres incógnitas: horas reales, coste real de IA, y qué funcionalidad falta |

**Clasificación del resto del portfolio en este eje:**

| Elemento | Debería ser |
|---|---|
| Expedientes, plazos, portal, pack banco, cálculo | **SELF-SERVICE SOFTWARE** |
| Onboarding y configuración inicial | **ASSISTED SOFTWARE** (incluido, 45 min) |
| Migración de datos desde Excel | **PROFESSIONAL SERVICE** facturable |
| Formación del equipo | **PROFESSIONAL SERVICE** facturable |
| Tramitación completa del expediente | **PARTNER-DELIVERED** (BPO para un colegiado) |
| Asesoramiento fiscal o legal | **NOT OFFERED** — nunca |

---

## 6. Ingresos adyacentes: add-ons ordenados por atractivo

| Add-on | Valor cliente | Disposición a pagar | Margen | Escalabilidad | Carga de soporte | **Veredicto** |
|---|---|---|---|---|---|---|
| **Módulo PBC/blanqueo** | **Muy alto** | **Alta** — es obligación legal suya | **Alto** | **Alta** | Baja | **HACER** ⭐ |
| **Créditos de IA** | Alto | Media | Medio (~50 %) | Alta | Baja | **HACER** |
| Almacenamiento adicional | Medio | Media | **Muy alto** | Alta | Nula | **HACER** |
| Migración de datos | Alto en el momento de comprar | **Alta** | Bajo (30 %) | **Baja** | Alta | **HACER, con precio y tope de horas** |
| White-label | Alto en funerarias | Alta | Muy alto | Alta | Baja | **YA EXISTE — mover a PRO** |
| Multi-sede | Alto en grupos | Alta | Alto | Alta | Media | **PRO / ENTERPRISE** |
| Formación | Medio | Media | Bajo | Baja | Alta | **Sólo a petición** |
| Soporte premium | Medio | Media | Alto | Media | **Alta** | **Sólo en ENTERPRISE** |
| Reporting avanzado | Medio | Baja | Alto | Alta | Baja | **Incluir en PRO, no vender aparte** |
| API access | Bajo hoy | Baja | Alto | Alta | Media | **ENTERPRISE, cuando exista** |
| Workflows a medida | Bajo | Baja | Bajo | Baja | Alta | **NO** |

### El módulo PBC, en detalle — por qué es la mejor oportunidad

**El cliente de HEREDIA es sujeto obligado; HEREDIA no.** Un expediente típico
—inmueble, cuentas, reparto entre herederos— activa el art. 2.1.m) para el asesor
fiscal y el 2.1.ñ) para el abogado de la Ley 10/2010. **[CONFIRMADO]**

Lo que tendría que hacer: identificación con documento fehaciente, registro del
propósito de la relación, determinación y documentación del **titular real**
(>25 %), **retención 10 años con acceso restringido a partir del quinto**, y
expediente de diligencia debida exportable ante inspección del SEPBLAC.

**Tres razones para priorizarlo:**

1. **Ningún competidor lo destaca** — ni Ulpiano ni `a3ASESOR|her`.
2. **Da la base legal que hoy falta** para custodiar los DNI del portal familia
   (la AEPD considera excesivo pedir copia del DNI sin habilitación normativa;
   la Ley 10/2010 es esa habilitación). **Dos problemas con una función.**
3. **La infraestructura ya existe**: `retention.ts`, `PurgeEvidence`, `AuditLog`,
   `file-policy.ts`, `portal-consent.ts`.

---

## 7. Simplificación: qué sobra

| Pregunta | Respuesta honesta |
|---|---|
| ¿Hay funcionalidades que confunden la propuesta? | **Sí.** La calculadora de donaciones (651) y el comparador de donaciones pertenecen a otro producto: planificación patrimonial en vida, no tramitación post-mortem |
| ¿Hay módulos que nadie pagará? | **Sí.** Workflows configurables en un negocio de 0-2 personas. Y notificaciones en tiempo real, que ni siquiera existen |
| ¿Se atienden demasiados segmentos? | **Sí, y es el problema estratégico principal** — ver §7.1 |
| ¿Hay features con riesgo jurídico sin retorno suficiente? | **Sí.** El borrador del Modelo 650 servido por **API pública sin autenticación** concentra el máximo riesgo penal en el punto de menor control |
| ¿Hay funcionalidad enterprise demasiado pronto? | **Sí.** Webhooks salientes, roles avanzados y aprobaciones antes del primer cliente |
| ¿Podría venderse un producto más pequeño y más claro? | **Sí. Ver §7.2** |

### 7.1 Tres ICP simultáneos es uno de más (o dos)

`vertical-landings.ts` mantiene tres landings completas: **funerarias**,
**gestorías** y **abogados**. Tres propuestas de valor, tres recorridos, tres
lenguajes, tres ciclos de venta — con un fundador en solitario y cero clientes.

Peor: **para funerarias, HEREDIA no es un ahorro, es una línea de ingresos
nueva**. Es una venta distinta en naturaleza (hay que convencerles de entrar en
un negocio en el que no están), más lenta, y con una incógnita que nadie ha
medido: qué porcentaje de familias contrataría el servicio post-mortem.

**Recomendación: elegir gestorías y asesorías como ICP inicial único.** Razones:

- Ya tramitan herencias: no hay que crear la demanda, sólo capturarla.
- **83 % son de 0-2 personas** → decisión inmediata, sin comité. **[WEAK
  INFERENCE — datos DIRCE de 2021, pendientes de refrescar]**
- Población enumerable y pública (Registro de Gestores Administrativos).
- Su dolor declarado —**64 % señala la sobrecarga normativa**— es exactamente lo
  que alivia el motor de plazos **[CONFIRMADO]**.
- **Estamos en su mejor ventana de compra del año** (septiembre-noviembre) —
  ver documento 05.

Funerarias y abogados: **mantener las landings** (ya están hechas, cuestan cero y
capturan SEO), **pero no dedicarles esfuerzo comercial activo** hasta tener 10
clientes de gestoría.

### 7.2 HEREDIA — Producto Mínimo Vendible

No es un MVP técnico. Es **la versión más pequeña por la que una gestoría
española pagaría hoy**:

> **Un expediente de herencia que no se te pasa de plazo y cuyos documentos
> llegan solos.**
>
> 1. Expediente con checklist de las >20 entidades
> 2. **Motor de plazos con aviso del mes 5 para la prórroga**
> 3. **Portal familia**: los herederos suben documentos sin que haya que
>    perseguirlos
> 4. Cálculo ISD orientativo por CCAA + borrador de trabajo del 650
> 5. **Pack banco unificado en un ZIP**
> 6. Export completo del expediente

Eso es **todo**. Está íntegramente construido y probado. Y se puede explicar en
una frase, que es la prueba de que el producto tiene foco.

Todo lo demás —workflows, aprobaciones, webhooks, donaciones, IA— es **profundidad
para después de la primera venta**, no argumento para conseguirla.

---

## 8. Rediseño del portfolio

**No conservar INICIA / DESPACHO / FIRMA.** La estructura recomendada:

```
NIVEL GRATUITO ────────────  1 expediente activo, 1 usuario
                             Núcleo completo: plazos, portal familia, cálculo ISD
                             Sin tarjeta, permanente
                             Objetivo: que prueben con un caso REAL

CORE · 149 €/mes ──────────  5 usuarios · 3 expedientes activos · 50 GB
                             + Modelo 650/651, pack banco, plantillas,
                               importación, 25 expedientes con IA/mes
                             Sin setup
                             ICP: gestoría de 1-5 personas

PRO · 349 €/mes ───────────  15 usuarios · 15 expedientes activos · 250 GB
                             + white-label, aprobaciones, reporting, workflows,
                               multi-sede, 100 expedientes con IA/mes,
                               soporte prioritario
                             Setup 299 € OPCIONAL, bonificado con anual
                             ICP: gestoría media y especialista en sucesiones

ENTERPRISE · contactar ────  SSO, API, SLA, DPA extendido, PBC, revisión de
                             seguridad, onboarding dedicado
                             ICP: grupos funerarios, aseguradoras, multisede

ADD-ONS ───────────────────  Créditos de IA · almacenamiento · módulo PBC ·
                             migración · formación

BPO (fuera de tarifa) ─────  "Operaciones gestionadas" — sólo para clientes
                             colegiados, máximo 3-5 cuentas, precio a medida
```

---

## 9. Las cuatro listas obligatorias

### SERVICE PORTFOLIO — ACTUAL (lo que se vende hoy)

1. Inicia 149 €/mes — 2 usuarios, 15 expedientes/mes
2. Despacho 349 €/mes + 299 € setup — 5 usuarios, 50 expedientes/mes
3. Firma 749 €/mes + 990 € setup — 20 usuarios, 200 expedientes/mes, "SSO", "API", "DPA extendido"
4. Heredia Managed 490 €/expediente (330 € a partir de 30/mes)

### SERVICE PORTFOLIO — RECOMENDADO

1. **Gratuito** — 1 expediente activo
2. **Core 149 €/mes** — sin setup
3. **Pro 349 €/mes** — setup opcional bonificable
4. **Enterprise** — sin precio público
5. **Add-ons** — IA, almacenamiento, PBC, migración
6. **BPO para colegiados** — fuera de tarifa, cupo limitado

### FEATURES TO REMOVE OR DE-EMPHASIZE

| Elemento | Acción | Razón |
|---|---|---|
| **Testimonios sintéticos** | **ELIMINAR HOY** | Práctica desleal prohibida en la UE + riesgo de credibilidad total |
| **"SSO" en la tarifa Firma** | Eliminar | No existe SAML en el repositorio |
| **"API" en la tarifa Firma** | Reformular a "webhooks salientes" | Sólo hay salida, no API de datos |
| **"DPA extendido"** | Eliminar hasta publicar el DPA | Hoy no existe |
| **Managed en `/precios`** | Sacar a página propia | Conflicto de canal con el comprador |
| **Tope de expedientes/mes** | Sustituir por expedientes activos | Nunca se alcanza; no segmenta |
| Calculadora y comparador de donaciones | Despriorizar (mantener por SEO) | Otro producto, otro momento vital |
| Landings de funerarias y abogados | Mantener, **sin esfuerzo comercial** | Foco en un ICP |
| Workflows configurables | Despriorizar en marketing | Nadie de 0-2 personas los configurará |
| API pública del borrador 650 **sin autenticación** | **Revisar** | Máximo riesgo penal en el punto de menor control |

### FEATURES TO BUILD NEXT

**Sólo lo que tiene impacto directo demostrable en venta, activación, retención o
ingreso.** Ordenado por (impacto ÷ esfuerzo):

| # | Qué | Impacto en | Esfuerzo | Evidencia |
|---|---|---|---|---|
| 1 | **Enlazar `/precios` → `/register`** | **Conversión** | **1 línea** | El embudo self-service existe y está desconectado (doc. 01 §3.1) |
| 2 | **Eliminar testimonios sintéticos** | **Riesgo** | 10 min | Doc. 07 §1 |
| 3 | **Etiquetar output de IA** | **Riesgo** | 1 hora | Art. 50 RIA, exigible desde 02-08-2026 |
| 4 | **Rediseño anti-falsedad del PDF 650/651** | **Riesgo** | 1 día | Arts. 390/392 CP; caso Alcalá jul-2025 |
| 5 | **Publicar DPA + textos legales reales** | **Venta** (hoy descalificatorio) | 2-3 días | `README.md:304-318` |
| 6 | **Nivel gratuito con 1 expediente activo** | **Conversión** | 2-3 días | Ulpiano lo tiene y es su puerta de entrada |
| 7 | **Métrica = expedientes activos** | **Retención, expansión** | 3-5 días | Doc. 03 §5 |
| 8 | **SEPA Direct Debit para el anual** | **Margen** (~98 €/cliente/año) | 1 día | Doc. 03 §12 |
| 9 | **Disclaimer + registro de aceptación en cálculos** | **Riesgo** | 1 día | SAP Navarra 17/03/2021 |
| 10 | **Versionado normativo por CCAA con fuente visible** | **Riesgo + diferenciación** | 1 semana | Defensa probatoria + argumento comercial |
| 11 | **Flujo art. 3 LOPDGDD** | **Riesgo** | 2-3 días | Obligación legal |
| 12 | **Antivirus en subidas** | **Venta** (objeción de seguridad) | 1 día | Limitación conocida |
| 13 | **Módulo PBC** | **Ingreso (add-on) + diferenciación** | 2-3 semanas | Doc. 07 §7 |
| 14 | **Activar el widget ISD embebible** | **Adquisición** | 2-3 días | Ya construido, sin usar |

**Lo que NO se construye todavía**, por falta de evidencia directa: cuaderno
particional, árbol genealógico, OCR de escrituras, festivos autonómicos,
API de WhatsApp, SSO SAML, API de datos. **Todos entran en las entrevistas como
preguntas, no en el backlog como tareas.**

---

## 10. Resumen

**Lo que HEREDIA debe vender:** un expediente de herencia que no se pasa de plazo
y cuyos documentos llegan solos, a gestorías españolas de 1-10 personas, por
149 o 349 €/mes, con un nivel gratuito de entrada y sin cuota de alta obligatoria.

**Lo que debe dejar de vender:** SSO y API que no existen, un DPA no publicado,
testimonios que nadie dijo, y un servicio gestionado que compite con sus propios
compradores desde la misma página de precios.

**Lo que debe añadir:** el nivel gratuito, la métrica de expedientes activos, el
módulo PBC — y, antes que todo eso, un enlace de la página de precios al registro.

**Lo que ya tiene y no está usando:** el aviso del mes 5, el pack banco, la
arquitectura de privacidad de IA y un widget embebible con atribución de partner.
Cuatro activos construidos, probados y apagados.
