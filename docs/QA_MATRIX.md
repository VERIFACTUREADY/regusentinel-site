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
`expedientes`, `acciones-expedientes`, `sesion-y-roles` y
`navegacion.responsive`. Todas corren con el vigilante de `e2e/vigilancia.ts`
activo (ver «Detección global»).

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
| **Crear expediente: asistente completo de 5 pasos** | ✅ | `expedientes.spec.ts` — abre desde el listado, rellena por `getByLabel`, recorre los 5 pasos, pulsa «Crear expediente», espera la navegación, comprueba la fila en base y que aparece en el listado |
| Asistente: validación del paso 1 (nombre) | ✅ | `expedientes.spec.ts` |
| Asistente: validación del paso 2 (teléfono o email) | ✅ | `expedientes.spec.ts` |
| Asistente: validación del paso 3 (categoría obligatoria) | ✅ | `expedientes.spec.ts` |
| Asistente: el servidor rechaza el alta | ✅ | `expedientes.spec.ts` — se avisa, no se navega y no queda nada en base |
| Etiquetas `<label>` asociadas a sus campos | ✅ | `expedientes.spec.ts` — prueba dedicada que falla si un campo del asistente pierde su nombre accesible |
| Listado | ✅ | `expedientes.spec.ts` |
| Búsqueda por referencia | ✅ | `expedientes.spec.ts` |
| Búsqueda por nombre del causante | ✅ | `expedientes.spec.ts` |
| Filtro de estado (petición **y** resultados) | ✅ | `expedientes.spec.ts` |
| Filtro de categoría (petición **y** resultados) | ✅ | `expedientes.spec.ts` |
| Filtro de provincia (petición **y** resultados) | ✅ | `expedientes.spec.ts` |
| Preset «Mis expedientes» | ✅ | `expedientes.spec.ts` |
| Preset «Urgentes» | ✅ | `expedientes.spec.ts` |
| Preset «ISD < 30d» | ✅ | `expedientes.spec.ts` |
| Preset «ISD < 60d» | ✅ | `expedientes.spec.ts` |
| Preset «Docs pendientes» | ✅ | `expedientes.spec.ts` |
| Preset «En curso» | ✅ | `expedientes.spec.ts` |
| Preset «Nuevos» | ✅ | `expedientes.spec.ts` |
| Preset «Listos para enviar» | ✅ | `expedientes.spec.ts` |
| Preset «Cerrados» | ✅ | `expedientes.spec.ts` |
| Paginación: siguiente, anterior, última, sin repetidos ni perdidos | ✅ | `expedientes.spec.ts` — el sembrado E2E crea 30 expedientes ficticios para tener más de una página |
| Paginación coherente al filtrar | ✅ | `expedientes.spec.ts` |
| Abrir expediente desde la lista | ✅ | `expedientes.spec.ts` |
| Edición del fallecido (guardar, avisar, persistir) | ✅ | `expedientes.spec.ts` |
| Edición del solicitante (guardar y persistir) | ✅ | `expedientes.spec.ts` |
| Edición: HTTP 422 y HTTP 500 | ✅ | `expedientes.spec.ts` — avisa, no falsea, formulario utilizable |
| Edición: fallo de red | ✅ | `expedientes.spec.ts` — sin «Guardando…» eterno |
| Eliminación individual: confirmar, cancelar, confirmar | ✅ | `expedientes.spec.ts` |
| Eliminación individual: fallo de servidor y de red | ✅ | `expedientes.spec.ts` — nunca se anuncia éxito si el expediente sigue existiendo |
| Eliminación individual: oculta a VIEWER y rechazada por el servidor | ✅ | `expedientes.spec.ts` |
| Selección múltiple y «seleccionar todo» | ✅ | `expedientes.spec.ts` |
| Cambio de estado en lote (éxito) | ✅ | `expedientes.spec.ts` |
| Cambio de estado en lote (error) | ✅ | `acciones-expedientes.spec.ts` |
| Borrado en lote (error, sin spinner infinito) | ✅ | `acciones-expedientes.spec.ts` |
| Cambio de estado por fila (éxito y error) | ✅ | `acciones-expedientes.spec.ts` |
| Exportar CSV: cabeceras, filas, valores, BOM y tildes | ✅ | `expedientes.spec.ts` |
| Exportar CSV: respeta el filtro de estado | ✅ | `expedientes.spec.ts` |
| Exportar CSV: respeta la búsqueda | ✅ | `expedientes.spec.ts` |
| Importar CSV válido y ver los expedientes creados | ✅ | `expedientes.spec.ts` |
| Importar: cabeceras incorrectas | ✅ | `expedientes.spec.ts` |
| Importar: fichero que no es una tabla | ✅ | `expedientes.spec.ts` |
| Importar: filas con datos inválidos | ✅ | `expedientes.spec.ts` — se listan fila a fila y no se importa nada |
| Importar: fichero vacío | ✅ | `expedientes.spec.ts` |
| Importar: extensión no admitida | ✅ | `expedientes.spec.ts` — se rechaza sin llegar a enviarse |
| Importar: error de servidor y fallo de red | ✅ | `expedientes.spec.ts` |
| Kanban: carga y tarjeta → expediente | ✅ | `expedientes.spec.ts` |
| Kanban: arrastrar tarjeta, petición real, cambio visual y persistencia | ✅ | `expedientes.spec.ts` |
| Kanban: fallo de servidor y de red al mover | ✅ | `expedientes.spec.ts` — la tarjeta se queda y el error se ve |
| Estado de carga / vacío / error + «Reintentar» | ✅ | `estados-carga.spec.ts` |
| Sesión caducada distinguida | ✅ | `estados-carga.spec.ts` |
| «Nuevo expediente» e «Importar CSV» ocultos a VIEWER | ✅ | `sesion-y-roles.spec.ts` |

**Funciones que no existen en el producto** (no se inventa comportamiento para
probarlas):

| Elemento | Por qué no está |
|---|---|
| Botón «última página» | La paginación ofrece «Anterior» y «Siguiente». La prueba llega igualmente a la última página encadenando «Siguiente» y comprueba que ahí el botón se apaga. |
| Ordenar el listado por columna | Las cabeceras de la tabla no son botones: el orden lo fija el servidor (urgentes primero, luego por fecha). |

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
`/audit`, `/workflow-logs`.

Que la pantalla resista un fallo de carga no significa que sus botones estén
probados. Crear una tarea, subir un documento o aprobar siguen sin cobertura.

`/cases/kanban` ya no está en esta lista: mover tarjetas se prueba entero
—arrastre, petición real, persistencia y los dos caminos de fallo— en
`expedientes.spec.ts`.

**Sin ninguna cobertura de interfaz:**

`/dashboard`, `/today`, `/messages`, `/reports` (+ `isd`, `pipeline`, `portal`,
`team`), `/templates`, `/templates/[id]`, `/case-templates`, `/workflow-rules`,
`/settings` (+ `general`, `branding`, `integrations`, `notifications`,
`users`), `/profile`, `/cases/[id]/isd`, `/admin/*`.

`/cases/import` y `/cases/[id]` salen de esta lista: la importación se prueba
entera —fichero válido, cabeceras malas, datos inválidos, fichero vacío,
extensión no admitida, error de servidor y fallo de red— y de la ficha se
prueban la edición (con sus tres caminos de fallo) y la eliminación individual.
El resto de la ficha —pestañas de tareas, documentos, portal, acciones de IA—
sigue sin cobertura de navegador.

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

Allowlist: seis entradas, cada una con su motivo escrito en el fichero.
Verificada inyectando una excepción: la aserción pasa y la prueba falla igual.

Los errores de consola se contrastan también con la **URL** del mensaje, no sólo
con su texto: cuando una petición no llega, el navegador escribe «Failed to load
resource: net::ERR_FAILED» sin decir de qué recurso, y una prueba que corta la
red a propósito —declarándolo con `permitirFalloEn`— fallaba por su propio
escenario.

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

Al cerrar `/cases` aparecieron seis más de la misma familia, todos corregidos y
todos con prueba: los seis botones «Guardar» de la ficha del expediente no
miraban `res.ok` (cerraban el panel y dejaban los datos antiguos en pantalla,
sin decir nada) y con la red caída se quedaban en «Guardando…» para siempre;
mover una tarjeta del Kanban fallaba en silencio; la pantalla de importación
presentaba un 500 del servidor como «Error de conexión»; y aceptaba cualquier
extensión de archivo pese a lo que anunciaba su propio selector.
