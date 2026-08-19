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
`expedientes`, `acciones-expedientes`, `tareas`, `tareas.responsive`,
`sesion-y-roles` y `navegacion.responsive`. Todas corren con el vigilante de
`e2e/vigilancia.ts` activo (ver «Detección global»).

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

### `/tasks` y `/tasks/timeline` — Tareas

**Inventario real del módulo.** `/tasks` es una **bandeja**: lista, filtra,
completa, inicia, actúa en lote, anota y exporta. **No** crea, **no** edita
campos y **no** borra — esos controles no existen ahí. Crear, renombrar,
reasignar, cambiar plazo, cambiar estado (incluido reabrir), poner dependencias
y borrar se hacen desde la pestaña **Tareas de la ficha del expediente**. Hay un
tercer sitio desde el que se escribe: el resumen **«Mis tareas asignadas»** del
escritorio, que completa. Los tres se auditan aquí. La matriz marca cada fila
donde el producto ofrece la función, no donde sería cómodo que estuviera.

#### Bandeja `/tasks`

| Elemento | Estado | Prueba |
|---|---|---|
| Listado con filtros por defecto (mis tareas + activas) | ✅ | `tareas.spec.ts` |
| Filtro de responsable: mis tareas, sin asignar, miembro concreto | ✅ | `tareas.spec.ts` — petición **y** resultados |
| Filtro de estado: activas, todas, pendiente, bloqueada, completada… | ✅ | `tareas.spec.ts` — petición **y** resultados |
| Filtro de categoría | ✅ | `tareas.spec.ts` — petición **y** resultados |
| Aviso de plazos vencidos (cuenta calculada en cliente) | ✅ | `tareas.spec.ts` — cuadra con lo que marca la lista |
| Paginación (50 por página) | ✅ | `tareas.spec.ts` — existe si y sólo si sobra una página |
| Completar una tarea | ✅ | `tareas.spec.ts` — avisa, persiste y se ve tras recargar |
| Iniciar una tarea (pendiente → en curso) | ✅ | `tareas.spec.ts` |
| Completar/iniciar: error de servidor y fallo de red | ✅ | `tareas.spec.ts` — avisa, no falsea, botón utilizable |
| Selección múltiple | ✅ | `tareas.spec.ts` |
| Lote: completar | ✅ | `tareas.spec.ts` |
| Lote: reasignar | ✅ | `tareas.spec.ts` |
| Lote: error de servidor | ✅ | `tareas.spec.ts` — no se anuncia como hecho, barra utilizable |
| Notas de gestión: leer y escribir | ✅ | `tareas.spec.ts` |
| Notas: fallo al cargar | ✅ | `tareas.spec.ts` — **no** se presenta como «sin notas» |
| Notas: fallo al guardar | ✅ | `tareas.spec.ts` — avisa y el texto no se pierde |
| Estado vacío por filtros | ✅ | `tareas.spec.ts` |
| Estado vacío real (sin ninguna tarea) | ✅ | `tareas.spec.ts` — deja de culpar a los filtros |
| Error de carga + «Reintentar» | ✅ | `estados-carga.spec.ts` |
| Sesión caducada distinguida | ✅ | `tareas.spec.ts` |
| Fallo al cargar compañeros no tumba la bandeja | ✅ | `tareas.spec.ts` |
| Exportar CSV | ✅ | `tareas.spec.ts` — se pulsa, se descarga y se lee: BOM, cabeceras, estados traducidos y **respeta los filtros** |
| Enlace al expediente desde la tarjeta | ✅ | `tareas.spec.ts` |
| Enlace al cronograma | ✅ | `tareas.spec.ts` |

#### Tareas dentro de la ficha del expediente

| Elemento | Estado | Prueba |
|---|---|---|
| Ver las tareas del expediente | ✅ | `tareas.spec.ts` |
| **Crear tarea** (título, categoría, fecha, responsable, descripción) | ✅ | `tareas.spec.ts` — se crea, aparece en la ficha, en la base y en la bandeja |
| Crear: título obligatorio (también sólo espacios) | ✅ | `tareas.spec.ts` |
| Crear: HTTP 400, 422, 500 y fallo de red | ✅ | `tareas.spec.ts` — avisa, no crea nada, formulario utilizable |
| Editar título (en línea) | ✅ | `tareas.spec.ts` |
| Editar responsable | ✅ | `tareas.spec.ts` |
| Editar estado | ✅ | `tareas.spec.ts` |
| **Reabrir** una tarea completada (DONE → PENDING) | ✅ | `tareas.spec.ts` — persiste tras recargar |
| Editar: HTTP 400, 500 y fallo de red | ✅ | `tareas.spec.ts` — avisa y la pantalla vuelve a lo que hay en base |
| Eliminar: confirmación, cancelar, confirmar | ✅ | `tareas.spec.ts` |
| Eliminar: error de servidor y fallo de red | ✅ | `tareas.spec.ts` — nunca se anuncia un borrado que no ocurrió |
| Integración: la tarea creada pertenece a su expediente | ✅ | `tareas.spec.ts` — comprobado en base y por la referencia de la tarjeta |
| Editar plazo (ramas `deadline` y `dueDate`) | ✅ | `tareas.spec.ts` — se cambia, persiste y se relee; y un 500 se dice en vez de tragarse |
| Poner y quitar dependencia entre tareas | ✅ | `tareas.spec.ts` — persiste y la ficha muestra «Espera: …» |
| Dependencia que crearía un ciclo | ✅ | `tareas.spec.ts` — rechazada **desde el navegador**, se explica y no se guarda |
| Notas de gestión desde la ficha | ✅ | `tareas.spec.ts` — se escribe, queda en base y se lee en el panel |

#### Resumen «Mis tareas asignadas» del escritorio

Es el tercer sitio desde el que se escribe una tarea, así que se audita con los
otros dos y no como parte del escritorio.

| Elemento | Estado | Prueba |
|---|---|---|
| Completar una tarea desde el resumen | ✅ | `tareas.spec.ts` — desaparece del resumen porque de verdad se guardó |
| Completar: error de servidor | ✅ | `tareas.spec.ts` — avisa, la tarea **no** desaparece y el botón sigue utilizable |

#### Cronograma `/tasks/timeline`

| Elemento | Estado | Prueba |
|---|---|---|
| Agrupación por vencidas / semanas / completadas | ✅ | `tareas.spec.ts` |
| Recuentos de vencidas, esta semana y este mes | ✅ | `tareas.spec.ts` — cuadran con la respuesta del servidor |
| Sólo entran tareas con plazo; las omitidas no | ✅ | `tareas.spec.ts` |
| Filtro de responsable | ✅ | `tareas.spec.ts` — petición **y** resultados |
| Navegar al expediente de una tarea | ✅ | `tareas.spec.ts` |
| Estado vacío (filtro sin resultados) | ✅ | `tareas.spec.ts` |
| Error de servidor + «Reintentar» | ✅ | `tareas.spec.ts` |
| Fallo de red | ✅ | `tareas.spec.ts` — no se disfraza de cronograma vacío |
| Fallo al cargar compañeros se dice | ✅ | producto corregido; aviso propio |

#### Roles, accesibilidad y tamaños

| Elemento | Estado | Prueba |
|---|---|---|
| MANAGER opera tareas | ✅ | `tareas.spec.ts` |
| OPERATOR opera tareas | ✅ | `tareas.spec.ts` |
| VIEWER: sin botones de escritura en la bandeja | ✅ | `tareas.spec.ts` |
| VIEWER: el servidor rechaza PATCH, POST, DELETE, lote y **notas** | ✅ | `tareas.spec.ts` |
| Filtros de la bandeja con etiqueta asociada | ✅ | `tareas.spec.ts` — falla si pierden el nombre accesible |
| Formulario de nueva tarea con etiqueta en cada campo | ✅ | `tareas.spec.ts` |
| Botones de acción con nombre accesible que incluye la tarea | ✅ | `tareas.spec.ts` |
| Campo de plazo y cuadro de nota de la ficha con nombre accesible | ✅ | `tareas.spec.ts` — antes sólo tenían `title`/`placeholder` |
| Editar el título con teclado | ✅ | `tareas.spec.ts` |
| Escritorio, tablet y móvil: bandeja, filtros, completar, abrir, crear, cronograma | ✅ | `tareas.responsive.spec.ts` — sin desbordamiento horizontal |

#### Funciones que **no existen** en el producto

No se prueban ni se inventan; quedan declaradas:

| Función | Realidad |
|---|---|
| Crear tarea desde `/tasks` | La bandeja no tiene botón de alta. Se crea desde la ficha del expediente. |
| Editar campos desde `/tasks` | La bandeja sólo cambia el estado (completar/iniciar). Renombrar, reasignar, plazo y dependencia están en la ficha. |
| Eliminar desde `/tasks` | No hay botón de borrado en la bandeja. Está en la ficha. |
| Reabrir desde `/tasks` | Al completarse, los botones de la tarjeta desaparecen. Reabrir existe sólo en el selector de estado de la ficha. |
| **Prioridad** de una tarea | No existe: el modelo `Task` no tiene ese campo. Lo que ordena es el plazo y `sortOrder`. |
| **Fecha de finalización** | No existe `completedAt`. Completar cambia el estado a `DONE` y queda registrado en la auditoría, no en la tarea. |
| Página de detalle de una tarea | No hay ruta `/tasks/[id]`. Desde la bandeja y el cronograma se navega al **expediente**. |
| Búsqueda por texto en `/tasks` | No hay caja de búsqueda. Se filtra por responsable, estado y categoría. |
| Filtro por expediente en `/tasks` | No existe como control. |
| Filtros de «vencidas» / «próximas» | No son filtros: hay un **aviso** de cuántas están vencidas y el cronograma agrupa por vencidas y semanas. |
| Navegación entre periodos en el cronograma | No hay controles de anterior/siguiente. La vista abarca de −30 días a +6 meses y agrupa por semana. |

### `/billing` — Facturación

| Elemento | Estado | Prueba |
|---|---|---|
| Suspensión visible y acceso a facturación | ✅ | `smoke.spec.ts` |
| APIs privadas devuelven 402 suspendido | ✅ | `smoke.spec.ts` |
| Cambio de plan, portal de Stripe | ❌ | |

### Sin cobertura de interfaz

**Con estados de carga probados** (carga, vacío, error y «Reintentar», vía
`estados-carga.spec.ts`), pero **sin sus interacciones propias probadas**:

`/documents`, `/notifications`, `/approvals`, `/audit`, `/workflow-logs`.

Que la pantalla resista un fallo de carga no significa que sus botones estén
probados. Subir un documento o aprobar siguen sin cobertura.

`/cases/kanban` ya no está en esta lista: mover tarjetas se prueba entero
—arrastre, petición real, persistencia y los dos caminos de fallo— en
`expedientes.spec.ts`. `/tasks` y `/tasks/timeline` tampoco: tienen sección
propia arriba, con sus acciones conducidas desde el navegador.

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
