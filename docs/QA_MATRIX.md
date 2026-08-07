# Matriz funcional

Estado real de cobertura por pantalla. **Este documento no describe lo que
debería estar probado: describe lo que lo está.** Una casilla vacía es un hueco
declarado, no un olvido.

Criterio, fijado a propósito: **una función no cuenta como cubierta porque
exista una prueba directa de su API.** Sólo cuenta si una prueba de navegador la
ejerce como la ejercería una persona. Las columnas que dicen «API» señalan
justamente eso — hay red de seguridad en el servidor, pero nadie ha comprobado
que el botón la llame.

Suites: `smoke`, `calendar`, `invitaciones`, `correo-real`, `estados-carga`,
`acciones-expedientes`, `sesion-y-roles` y `navegacion.responsive`. Todas corren
con el vigilante de `e2e/vigilancia.ts` activo (ver «Detección global»).

## Leyenda

| Símbolo | Significado |
|---|---|
| ✅ | Cubierto por prueba de navegador |
| 🟡 | Sólo prueba de API o de unidad — el camino de la interfaz **no** está probado |
| ❌ | Sin cobertura |
| — | No aplica |

---

## Pantallas

### `/calendar` — Calendario de plazos

| Elemento | Estado | Prueba |
|---|---|---|
| Navegación mes anterior / siguiente | ✅ | `calendar.spec.ts` — «cambia de mes y el boton Hoy…» |
| Cruce de año hacia atrás | ✅ | «navegar hacia atras cruzando enero…» |
| Botón «Hoy» (y su ausencia en el mes actual) | ✅ | «cambia de mes y el boton Hoy…» |
| Casilla de día → panel de detalle | ✅ | «una tarea aparece en la casilla de su dia…» |
| Enlace del detalle → expediente | ✅ | ídem |
| Filtro de asignado | ✅ | «el estado vacio… si es por el filtro» |
| Filtro de categoría | ✅ | «filtrar nunca deja la pantalla en blanco» |
| Botón «Quitar los filtros» | ✅ | «el estado vacio…» |
| Exportar `.ics` (coherente con el filtro) | ✅ | «la exportacion .ics entrega lo que se esta viendo» |
| Descarga `.ics` válida | ✅ | «el fichero .ics descargado es un calendario valido» |
| Estado vacío | ✅ | «el estado vacio dice que no hay plazos…» |
| Estado de error + «Reintentar» | ✅ | «si la API falla, muestra un error con Reintentar…» |
| Sesión caducada distinguida del 500 | ✅ | «una sesion caducada se distingue…» |
| Respuesta 200 con forma inesperada | ✅ | «una respuesta 200 con forma inesperada…» |
| Contadores en «—» al fallar | ✅ | «si la API falla…» |
| Roles autorizados | ❌ | Sólo probado como OWNER |

### `/users` — Usuarios e invitaciones

| Elemento | Estado | Prueba |
|---|---|---|
| Botón «Invitar miembro» → formulario | ✅ | `invitaciones.spec.ts` |
| Envío de invitación | ✅ | «al invitar se emite un token…» |
| Desplegable de rol | ✅ | `correo-real.spec.ts` (MANAGER) |
| Aviso honesto si el correo no sale | ✅ | «no se anuncia 'Invitacion enviada'…» |
| Panel de invitaciones + estado | ✅ | «una invitacion caducada se muestra como caducada» |
| Botón «Reenviar invitacion» | ✅ | «el boton Reenviar invitacion existe y rota el enlace» |
| Botón «Revocar» (+ confirmación) | ✅ | «Revocar quita el acceso y anula el enlace» |
| Estado vacío del panel | ❌ | |
| Error de carga + «Reintentar» del panel | ❌ | Implementado, sin prueba |
| Cambio de rol de un miembro | 🟡 | `smoke.spec.ts` vía API |
| No degradar al último OWNER | 🟡 | `smoke.spec.ts` vía API |
| OPERATOR no puede invitar | ✅ | «un OPERATOR no puede reenviar ni revocar» |
| Organización ajena → 404 | ✅ | «no se puede tocar una invitacion de otra organizacion» |

### `/login`, `/onboarding`, `/forgot-password`, `/reset-password`

| Elemento | Estado | Prueba |
|---|---|---|
| Login correcto | ✅ | `smoke.spec.ts` |
| Credenciales incorrectas | ✅ | `smoke.spec.ts` |
| Redirección sin sesión | ✅ | `smoke.spec.ts` |
| Registro de cuenta nueva | ✅ | `smoke.spec.ts` |
| Crear contraseña desde enlace de correo | ✅ | `correo-real.spec.ts` |
| Enlace caducado / reutilizado | ✅ | `invitaciones.spec.ts` |
| Enlace anterior anulado tras reenvío | ✅ | `correo-real.spec.ts` |
| `autoComplete` para gestores de contraseñas | 🟡 | Atributos puestos; sin prueba automática |
| Logout (botón «Salir») | ✅ | `sesion-y-roles.spec.ts` |
| Sesión sobrevive a recargar | ✅ | `sesion-y-roles.spec.ts` |
| Sesión viva en pestaña nueva | ✅ | `sesion-y-roles.spec.ts` |
| Navegador nuevo NO hereda sesión | ✅ | `sesion-y-roles.spec.ts` |
| Perder la cookie devuelve al login | ✅ | `sesion-y-roles.spec.ts` |

### `/portal/[token]` — Portal familiar

| Elemento | Estado | Prueba |
|---|---|---|
| Consentimiento obligatorio | ✅ | `smoke.spec.ts` |
| Evidencia del consentimiento | ✅ | `smoke.spec.ts` |
| Nunca expone documento interno | ✅ | `smoke.spec.ts` |
| Token revocado | ✅ | `smoke.spec.ts` |

### `/cases` — Expedientes

| Elemento | Estado | Prueba |
|---|---|---|
| Alta desde la interfaz | ✅ | `smoke.spec.ts` |
| Referencias únicas en altas simultáneas | ✅ | `smoke.spec.ts` |
| Listado | ✅ | `expedientes.spec.ts` |
| Búsqueda por referencia | ✅ | `expedientes.spec.ts` |
| Búsqueda por nombre del causante | ✅ | `expedientes.spec.ts` |
| Filtro de estado (llega al servidor) | ✅ | `expedientes.spec.ts` |
| Filtros de provincia / urgencia | ✅ | `expedientes.spec.ts` |
| Presets y limpiar | ✅ | `expedientes.spec.ts` |
| Abrir expediente desde la lista | ✅ | `expedientes.spec.ts` |
| Selección múltiple y «seleccionar todo» | ✅ | `expedientes.spec.ts` |
| Cambio de estado en lote (éxito) | ✅ | `expedientes.spec.ts` |
| Cambio de estado en lote (error) | ✅ | `acciones-expedientes.spec.ts` |
| Borrado en lote (error, sin spinner infinito) | ✅ | `acciones-expedientes.spec.ts` |
| Cambio de estado por fila (éxito y error) | ✅ | `acciones-expedientes.spec.ts` |
| Exportar CSV (con contenido comprobado) | ✅ | `expedientes.spec.ts` |
| Pantalla de importación CSV se abre | ✅ | `expedientes.spec.ts` |
| Kanban: carga y tarjeta → expediente | ✅ | `expedientes.spec.ts` |
| Validación del asistente (paso 1) | ✅ | `expedientes.spec.ts` |
| **Crear expediente (asistente completo)** | ❌ | El recorrido supera los pasos 1 y 2 pero no alcanza «Crear expediente»; no he identificado en qué paso se detiene |
| Edición | ❌ | |
| Eliminación individual | ❌ | |
| Paginación | ❌ | El seed tiene un solo expediente: no hay segunda página que probar |
| Importación CSV real y sus errores | ❌ | |
| Mover tarjeta en Kanban | ❌ | |
| Etiquetas `<label>` asociadas a sus campos | ❌ | **Defecto encontrado**: en el asistente de alta los `<label>` no tienen `htmlFor` ni envuelven el input, así que un lector de pantalla no anuncia el nombre del campo |
| Estado de carga / vacío / error + «Reintentar» | ✅ | `estados-carga.spec.ts` |
| Sesión caducada distinguida | ✅ | `estados-carga.spec.ts` |
| «Nuevo expediente» e «Importar CSV» ocultos a VIEWER | ✅ | `sesion-y-roles.spec.ts` |

### `/billing` — Facturación

| Elemento | Estado | Prueba |
|---|---|---|
| Suspensión visible y acceso a facturación | ✅ | `smoke.spec.ts` |
| APIs privadas devuelven 402 suspendido | ✅ | `smoke.spec.ts` |
| Cambio de plan, portal de Stripe | ❌ | |

### Sin cobertura de interfaz

**Con estados de carga probados** (carga, vacío, error y «Reintentar», vía
`estados-carga.spec.ts`), pero **sin sus interacciones propias probadas**:

`/tasks`, `/tasks/timeline`, `/documents`, `/notifications`, `/approvals`,
`/audit`, `/workflow-logs`, `/cases/kanban`.

Que la pantalla resista un fallo de carga no significa que sus botones estén
probados. Crear una tarea, subir un documento, aprobar o mover una tarjeta
siguen sin cobertura.

**Sin ninguna cobertura de interfaz:**

`/dashboard`, `/today`, `/messages`, `/reports` (+ `isd`, `pipeline`, `portal`,
`team`), `/templates`, `/templates/[id]`, `/case-templates`, `/workflow-rules`,
`/settings` (+ `general`, `branding`, `integrations`, `notifications`,
`users`), `/profile`, `/cases/import`, `/cases/[id]`, `/cases/[id]/isd`,
`/admin/*`.

Varias tienen pruebas de API o de unidad, que por el criterio de arriba no
cuentan como cobertura funcional.

---

## Roles y tamaños

| Dimensión | Estado |
|---|---|
| OWNER | ✅ usuarios, facturación y ajustes + acción reservada visible |
| MANAGER | ✅ opera e invita; **no** puede crear otro OWNER (403 del servidor) |
| OPERATOR | ✅ trabaja; sin administración, y el servidor lo rechaza (403) |
| VIEWER | ✅ consulta; sin botones de escritura, y el servidor lo rechaza |
| Escritorio | ✅ proyecto `escritorio`, suite completa |
| Tablet | ✅ `navegacion.responsive.spec.ts` — 10 pruebas (820×1180, Chromium táctil) |
| Móvil | ✅ `navegacion.responsive.spec.ts` — 10 pruebas (Pixel 5) |

Tablet y móvil ejecutan `e2e/navegacion.responsive.spec.ts`: panel, expedientes,
tareas, calendario (con panel de día), usuarios, documentos, navegación,
formulario de invitación y tabla ancha. Cada una comprueba además que la página
**no se desplaza en horizontal**, que es el síntoma número uno de una pantalla
rota en móvil.

Dos hallazgos del montaje, ya corregidos: `devices["iPad (gen 7)"]` arrastra
WebKit, que no está instalado, y el proyecto entero fallaba al lanzar el
navegador sin que eso dijera nada de la aplicación; y Chromium táctil no arranca
como root sin `--no-sandbox`.

---

## Detección global de fallos

Activa en **todas** las suites, vía `e2e/vigilancia.ts`. Hace fallar la prueba
aunque las aserciones pasen, ante:

`pageerror` · errores de consola · HTTP 5xx · peticiones de red fallidas ·
página de error de Next · pantalla en blanco · carga infinita (`pantallaUtil()`).

Allowlist: cinco entradas, cada una con su motivo escrito en el fichero.
Verificada inyectando una excepción: la aserción pasa y la prueba falla igual.

---

## Errores silenciosos

`src/components/ui/carga-remota.tsx` centraliza los cuatro estados —cargando,
listo, vacío, error con Reintentar— porque el fallo era idéntico en las catorce
pantallas y repetir la corrección a mano garantiza que la próxima nazca rota.

### Corregidas y probadas

| Pantalla | `response.ok` | Error visible | Reintentar | Prueba |
|---|---|---|---|---|
| `calendar` | ✅ | ✅ | ✅ | `calendar.spec.ts` |
| `cases` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` |
| `tasks` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` |
| `approvals` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` |
| `notifications` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` |
| `search-modal` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` |
| `users` (panel de invitaciones) | ✅ | ✅ | ✅ | ❌ sin prueba de navegador |
| `documents` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` |
| `cases/kanban` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` |
| `tasks/timeline` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` |
| `messages` | ✅ | ✅ | ✅ | ❌ sin prueba de navegador |
| `usage-widget` | ✅ | ✅ | ✅ | ❌ sin prueba de navegador |
| `notification-bell` | ✅ | ✅ | — | ❌ sin prueba de navegador |
| `cases/[id]` (análisis) | ✅ | ✅ | — | ❌ sin prueba de navegador |
| `audit` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` |
| `workflow-logs` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` (vía filtro) |

`workflow-logs` y `documents` reciben la primera página del componente de
servidor y sólo llaman al API al filtrar o buscar. Sus pruebas provocan la
petición como lo haría una persona (`disparar`), no interceptando una carga
inicial que no existe.

Cada una se comprueba en los tres estados, y en el de error se exige **además
que el estado vacío NO aparezca**: confundirlos es exactamente el defecto.

### Pendientes

**Ninguna pendiente.** Los catorce casos originales están corregidos.

Hallazgo colateral de esta fase: `/cases` mostraba «Nuevo expediente» e
«Importar CSV» a un VIEWER, que al pulsarlos recibía un 403. Corregido con
`RolProvider` — cortesía con el usuario, no control de acceso: quien decide
sigue siendo el servidor, y hay prueba de las dos mitades.
