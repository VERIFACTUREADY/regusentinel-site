# Matriz funcional

Estado real de cobertura por pantalla. **Este documento no describe lo que
debería estar probado: describe lo que lo está.** Una casilla vacía es un hueco
declarado, no un olvido.

Criterio, fijado a propósito: **una función no cuenta como cubierta porque
exista una prueba directa de su API.** Sólo cuenta si una prueba de navegador la
ejerce como la ejercería una persona. Las columnas que dicen «API» señalan
justamente eso — hay red de seguridad en el servidor, pero nadie ha comprobado
que el botón la llame.

Suites (27 ficheros, **850** pruebas de navegador contando los tres tamaños de
pantalla): `smoke`, `calendar`, `invitaciones`, `correo-real`, `estados-carga`,
`expedientes`, `acciones-expedientes`, `tareas`, `tareas.responsive`,
`documentos`, `documentos.responsive`, `usuarios`, `usuarios.responsive`,
`autenticacion`, `sesion-y-roles`, `navegacion.responsive`, `dashboard`, `today`,
`panel.responsive`, `mensajes`, `notificaciones`, `aprobaciones`,
`avisos.responsive`, `automatizaciones`, `registro-automatizaciones`,
`auditoria` y `automatizaciones.responsive`. Todas corren con el vigilante de
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

### `/dashboard` — Panel

Inventario completo de lo que existe de verdad en la pantalla y en sus nueve
componentes hijos (`onboarding-panel`, `demo-highlights`, `my-tasks-widget`,
`usage-widget`, `deadline-calendar`, `bulk-analyze-button`, `risk-radar-widget`,
`action-queue-widget`, `no-org-setup`). Pruebas en `dashboard.spec.ts` y
`panel.responsive.spec.ts`.

| Elemento | Estado | Prueba |
|---|---|---|
| KPI «Expedientes activos» | ✅ | `dashboard.spec.ts` — cuadra con la base; la cifra se afirma exacta, no por subcadena |
| KPI «Tareas pendientes» | ✅ | ídem |
| KPI «Tareas bloqueadas» | ✅ | ídem |
| KPI «Listas para accion» | ✅ | ídem |
| KPI «Aprobaciones pend.» | ✅ | ídem |
| KPI «Cerrados este mes» | ✅ | ídem |
| Etiqueta junto a cada cifra | ✅ | `dashboard.spec.ts` — los seis rótulos |
| **Un KPI con su consulta caída muestra «—», nunca 0** | ✅ | `dashboard.spec.ts` — **defecto corregido**: `safe()` devolvía `0` y el panel anunciaba «Expedientes activos: 0» con la base caída. Se comprueba que aparece «—», que el 0 **no** aparece y que la cifra no existe siquiera en el DOM |
| Degradación parcial: los demás KPI siguen dando su dato | ✅ | `dashboard.spec.ts` |
| Un cero REAL se sigue viendo como cero | ✅ | `dashboard.spec.ts` — organización sin datos |
| Aviso «Esta pantalla está incompleta» enumerando lo caído | ✅ | `dashboard.spec.ts` — nombra sólo los bloques que fallaron |
| Franja «Requiere acción inmediata» | ✅ | `dashboard.spec.ts` — vencidas, ISD crítico y mensajes de familia |
| Enlace «Ver resumen del día →» | ✅ | `dashboard.spec.ts` — se pulsa y llega a `/today` |
| Enlace de una tarea vencida → expediente | ✅ | `dashboard.spec.ts` |
| Widget «Plan de acciones» (`ActionQueueWidget`) | ✅ | `dashboard.spec.ts` — datos, orden por urgencia y estado vacío |
| **El Plan de acciones caído NO dice «Nada pendiente de acción inmediata»** | ✅ | `dashboard.spec.ts` — **defecto corregido**: el respaldo `items: []` pintaba un mensaje tranquilizador y falso |
| Widget «Radar ISD» (`RiskRadarWidget`) | ✅ | `dashboard.spec.ts` — recuentos por severidad y expedientes |
| **El Radar ISD caído NO dice «Todos los expedientes en orden»** | ✅ | `dashboard.spec.ts` — **defecto corregido**, mismo patrón |
| «Mis tareas asignadas»: listado y enlace al expediente | ✅ | `dashboard.spec.ts` |
| Completar una tarea desde el panel | ✅ | `dashboard.spec.ts` — desaparece y persiste tras recargar |
| Completar: HTTP 403, HTTP 500 y fallo de red | ✅ | `dashboard.spec.ts` — avisa, la tarea **no** desaparece y el botón sigue utilizable |
| Reintento tras el error | ✅ | `dashboard.spec.ts` — quitado el fallo, el segundo intento completa |
| «Mis tareas asignadas» con su consulta caída | ✅ | `dashboard.spec.ts` |
| Calendario de plazos: mes en curso y enlace «Ver todo» | ✅ | `dashboard.spec.ts` |
| **Calendario: una tarea de las 00:30 de Madrid cae en SU día** | ✅ | `dashboard.spec.ts` — **defecto corregido**: se agrupaba con `setHours(0,0,0,0)` y `getDate()`, hora local del servidor (UTC), y la tarea se pintaba en la casilla de la víspera. Se comprueba la casilla concreta y la del día anterior |
| Calendario con su consulta caída | ✅ | `dashboard.spec.ts` — lo dice; no pinta una rejilla vacía |
| «Uso del plan»: expedientes y usuarios sobre su límite | ✅ | `dashboard.spec.ts` |
| Cerca del límite / límite alcanzado | ✅ | `dashboard.spec.ts` — avisos distintos |
| Enlaces «Ampliar plan» y «Gestionar suscripcion» | ✅ | `dashboard.spec.ts` — se pulsan y llegan a `/billing` |
| Uso del plan: HTTP 401, 403, 500 y fallo de red | ✅ | `dashboard.spec.ts` — mensaje propio de cada caso |
| Uso del plan: «Reintentar» | ✅ | `dashboard.spec.ts` — vuelve a pedirlo y el widget aparece |
| «Plazos proximos (30 días)»: la ventana y el corte | ✅ | `dashboard.spec.ts` — el de 31 días no aparece nunca; el bloque corta en 8 y va en orden ascendente. **La versión anterior de esta prueba pasaba por accidente**: el sembrado anclaba los plazos al día civil UTC, «vence hoy» caía en el pasado y liberaba el octavo hueco |
| **Una tarea que vence HOY no se etiqueta «VENCIDO»** | ✅ | `dashboard.spec.ts` — **defecto corregido**: la etiqueta era `days <= 0 ? "VENCIDO"`, y `days` cuenta días civiles, así que una tarea que vence hoy a mediodía se anunciaba como vencida a las nueve de la mañana — en un bloque cuya consulta es `deadline >= now`, donde nada puede estar vencido |
| **Los plazos del sembrado se anclan al día civil ESPAÑOL** | ✅ | `seed-e2e.ts` — **defecto corregido**: se anclaban a las 12:00 UTC, y entre las 00:00 y las 02:00 de Madrid el día UTC va uno por detrás, así que todos los plazos se sembraban un día antes y tres pruebas de `/today` fallaban. Una ventana de dos horas al día en la que la suite se caía sola |
| «Tareas bloqueadas +7 días»: borde del corte | ✅ | `dashboard.spec.ts` — entran la de 8 y la de 20, no la de 6; se ve el motivo del bloqueo |
| Los dos bloques anteriores con su consulta caída | ✅ | `dashboard.spec.ts` — cada uno lo dice por separado |
| Carga de trabajo del equipo | ✅ | `dashboard.spec.ts` — miembros con tareas, activas/bloqueadas; quien no tiene tareas no aparece |
| Carga del equipo con su consulta caída | ✅ | `dashboard.spec.ts` — **defecto corregido**: el bloque desaparecía entero sin dejar rastro |
| Expedientes recientes: orden, causante, solicitante, estado, enlace | ✅ | `dashboard.spec.ts` — máximo 5, orden por fecha de creación |
| Expedientes recientes: estado vacío real | ✅ | `dashboard.spec.ts` |
| **Expedientes recientes caídos NO dicen «No hay expedientes»** | ✅ | `dashboard.spec.ts` — **defecto corregido**: la misma frase servía para «hay cero» y para «no he podido consultarlo» |
| Actividad reciente: autor y acción | ✅ | `dashboard.spec.ts` |
| **Actividad reciente caída NO dice «Sin actividad»** | ✅ | `dashboard.spec.ts` — **defecto corregido**, mismo patrón |
| Insights IA: contadores de 30 días y score medio | ✅ | `dashboard.spec.ts` — con la consulta caída se muestra «—», no 0 |
| Botón «Analizar todos (N)»: rótulo con el número real | ✅ | `dashboard.spec.ts` |
| Botón inhabilitado sin expedientes abiertos | ✅ | `dashboard.spec.ts` |
| Botón con el contador caído: dice «(—)» y no se puede pulsar | ✅ | `dashboard.spec.ts` — **defecto corregido**: anunciaba «Analizar todos (0)», cifra inventada |
| Análisis masivo: clic real, carga, éxito y refresco posterior | ✅ | `dashboard.spec.ts` — **defecto corregido**: no refrescaba, y los contadores de IA quedaban desfasados. **No se llama al servicio de pago**: se sustituye la respuesta de nuestra propia API |
| Análisis masivo: error del servidor y fallo de red | ✅ | `dashboard.spec.ts` — el botón sigue utilizable |
| Análisis masivo: respuesta que no es JSON | ✅ | `dashboard.spec.ts` — **defecto corregido**: `res.json()` antes de mirar `res.ok` mostraba «Unexpected token '<'…» |
| Análisis masivo: doble clic | ✅ | `dashboard.spec.ts` — una sola llamada |
| Panel de primeros pasos en organización nueva | ✅ | `dashboard.spec.ts` — pasos, progreso «0 de N» y enlace del primer paso |
| Una organización ya configurada NO recibe onboarding | ✅ | `dashboard.spec.ts` |
| «No mostrar mas»: fallo del servidor y de red | ✅ | `dashboard.spec.ts` — **defecto corregido**: no miraba `res.ok` ni capturaba el rechazo; el panel volvía igual sin decir nada y el botón se quedaba congelado en «...» |
| Usuario sin organización: no se le expulsa al login | ✅ | `dashboard.spec.ts` |
| Alta de organización desde `NoOrgSetup` y vuelta al panel | ✅ | `dashboard.spec.ts` — formulario real; **defecto corregido**: la etiqueta del campo no estaba asociada (`htmlFor`/`id`) |
| Roles OWNER, MANAGER, OPERATOR y VIEWER | ✅ | `dashboard.spec.ts` — política real: `/dashboard` no exige ningún permiso; los cuatro entran y ven los indicadores |
| Aislamiento entre organizaciones (datos) | ✅ | `dashboard.spec.ts` — expedientes, causantes, tareas, mensajes, aprobaciones y actividad de la organización vecina; en los dos sentidos |
| **Aislamiento en los CONTADORES** | ✅ | `dashboard.spec.ts` — un agregado que filtre mal `orgId` también es una fuga aunque no enseñe ningún nombre |
| Escritorio, tablet y móvil | ✅ | `panel.responsive.spec.ts` — sin desbordamiento horizontal, KPI enteros, calendario pulsable, aviso de fallo legible |
| `DemoHighlights` (atajos de la organización de demostración) | — | Sólo se pinta con `DEMO_ENABLED=true` y el slug de demo, que el entorno E2E no activa. Sus tres consultas ya no usan `safe()` |

### `/today` — Resumen del día

Pruebas en `today.spec.ts` y `panel.responsive.spec.ts`.

| Elemento | Estado | Prueba |
|---|---|---|
| Encabezado con la fecha del calendario español | ✅ | `today.spec.ts` — **defecto corregido**: se componía con la hora local del servidor (UTC); entre las 00:00 y las 02:00 de Madrid mostraba el día de ayer |
| «Mis tareas vencidas»: listado, antigüedad y enlace | ✅ | `today.spec.ts` — orden cronológico, la más antigua primero |
| **Una tarea de hoy ya no sale a la vez en «vencidas» y en «Para hoy»** | ✅ | `today.spec.ts` — **defecto corregido**: `deadline < ahora` la pasaba a vencida a partir de su hora y aparecía duplicada; ahora vencida = de un día ya pasado |
| «Para hoy» | ✅ | `today.spec.ts` — sólo lo de hoy |
| **«Esta semana» incluye el séptimo día completo** | ✅ | `today.spec.ts` — **defecto corregido**: el corte era la medianoche del día +7 y una tarea de esa misma tarde desaparecía de todas las secciones |
| «Tareas del equipo vencidas», con responsable | ✅ | `today.spec.ts` — no repite las propias; enlace a `/tasks` |
| «Plazos ISD próximos» con fecha y cuenta atrás | ✅ | `today.spec.ts` — enlace al expediente |
| «Aprobaciones pendientes» | ✅ | `today.spec.ts` — la ya aprobada no aparece; enlace a `/approvals` |
| «Mensajes sin responder»: autor y texto | ✅ | `today.spec.ts` — ni el leído ni el nuestro cuentan |
| «Expedientes bloqueados» con sus tareas y motivo | ✅ | `today.spec.ts` |
| «Listas para continuar» (prerrequisito completado) | ✅ | `today.spec.ts` |
| **«Todo al día» con cero datos reales** | ✅ | `today.spec.ts` — aparece, y es cierto |
| **«Todo al día» NUNCA con una consulta caída** | ✅ | `today.spec.ts` — **defecto corregido, el más grave de la fase**: `hasAnything` se calculaba sobre listas que `safe()` devolvía vacías también al fallar, así que con PostgreSQL caído la pantalla mostraba un tic verde y «Todo al día». Se prueba con una consulta caída y con las nueve |
| Una sola tarea vencida basta para que no aparezca | ✅ | `today.spec.ts` |
| Degradación parcial: lo que sí cargó se sigue viendo | ✅ | `today.spec.ts` — dos bloques caídos, el resto con sus datos reales |
| Fallo por sección: vencidas, ISD, aprobaciones, mensajes, bloqueados | ✅ | `today.spec.ts` — cada uno se nombra y su sección no finge estar vacía |
| Contador de acción inmediata: suma y desglose | ✅ | `today.spec.ts` — vencidas + ISD crítico + aprobaciones |
| Contador: cero, uno y varias categorías | ✅ | `today.spec.ts` — con cero no aparece la franja; con uno, singular |
| **Plural de «aprobación»** | ✅ | `today.spec.ts` — **defecto corregido**: decía «2 aprobaciónes», que no existe |
| Roles OWNER, MANAGER, OPERATOR y VIEWER | ✅ | `today.spec.ts` — política real: sólo exige sesión con organización y rol |
| Cada uno ve SUS tareas | ✅ | `today.spec.ts` — el VIEWER no ve las del OWNER en la sección propia, pero sí la del equipo, que es de toda la organización |
| Usuario sin organización → `/dashboard`, no al login | ✅ | `today.spec.ts` |
| Sin sesión → `/login` | ✅ | `today.spec.ts` |
| Aislamiento entre organizaciones, datos y contadores | ✅ | `today.spec.ts` |
| Escritorio, tablet y móvil | ✅ | `panel.responsive.spec.ts` |

### `/messages` — Mensajes del portal

Inventario completo de la pantalla y de su panel de hilo. Pruebas en
`mensajes.spec.ts` (39) y `avisos.responsive.spec.ts`.

| Elemento | Estado | Prueba |
|---|---|---|
| Listado de conversaciones | ✅ | `mensajes.spec.ts` — referencia, causante y vista previa del último mensaje |
| Filtro «Sin leer» | ✅ | `mensajes.spec.ts` — sólo las que tienen pendientes; cifra exacta |
| Filtro «Todos» | ✅ | `mensajes.spec.ts` — añade la ya leída; el expediente sin ningún mensaje sigue fuera |
| Marca «N sin leer» del encabezado | ✅ | `mensajes.spec.ts` — la cifra pintada se comprueba con una respuesta fija; el total se contrasta contra la base |
| Selección inicial automática | ✅ | `mensajes.spec.ts` |
| Cambio entre conversaciones | ✅ | `mensajes.spec.ts` — el hilo cambia con ella |
| Hilo de mensajes | ✅ | `mensajes.spec.ts` |
| Enlace «Ver expediente →» | ✅ | `mensajes.spec.ts` — se pulsa y llega |
| **La lista caída NO dice «No hay mensajes sin leer»** | ✅ | `mensajes.spec.ts` — **defecto corregido**: era `r.ok ? r.json() : null` + `.catch(() => {})`, así que un 401, un 403, un 500 o la red caída pintaban el estado vacío. Se comprueba en los tres códigos, en fallo de red y con forma inesperada, y que el vacío **no** aparece |
| «Reintentar» de la lista | ✅ | `mensajes.spec.ts` |
| Estado vacío REAL | ✅ | `mensajes.spec.ts` — organización sin conversaciones |
| Hilo caído: no aparenta que la familia no escribió | ✅ | `mensajes.spec.ts` |
| **Marcar leído sólo baja el contador si el servidor confirma** | ✅ | `mensajes.spec.ts` — **defecto corregido**: era un PUT al aire con `.catch(() => {})` y el contador bajaba igual |
| Un VIEWER no puede marcar leído (política real) | ✅ | `mensajes.spec.ts` — `PUT` exige `cases.update`, que VIEWER no tiene: avisa, el contador no baja y en la base siguen sin leer |
| Marcar leído: HTTP 500, fallo de red y «Reintentar» | ✅ | `mensajes.spec.ts` |
| Persistencia del marcado tras recargar | ✅ | `mensajes.spec.ts` — contrastado contra la base |
| Coherencia de filtro y contador tras leer | ✅ | `mensajes.spec.ts` |
| Enviar respuesta: aparece y persiste | ✅ | `mensajes.spec.ts` — recarga y verificación en la base |
| ⌘/Ctrl+Enter envía | ✅ | `mensajes.spec.ts` |
| **La familia lo ve en su portal** | ✅ | `mensajes.spec.ts` — navegador limpio, sin sesión de gestor, entrando por el token |
| Texto vacío o sólo espacios no se envía | ✅ | `mensajes.spec.ts` |
| Doble envío no duplica | ✅ | `mensajes.spec.ts` — **defecto corregido**: el botón se inhabilitaba, pero ⌘Enter colaba un segundo envío. Una sola llamada |
| Enviar: HTTP 400, 403, 500 y fallo de red | ✅ | `mensajes.spec.ts` — avisa, **no** pinta el mensaje y conserva lo escrito |
| Enviar: respuesta que no es JSON | ✅ | `mensajes.spec.ts` — **defecto corregido**: `res.json()` sin red de seguridad mostraba «Unexpected token '<'» |
| Enviar: 200 sin cuerpo válido | ✅ | `mensajes.spec.ts` — no se da por enviado |
| Roles OWNER, MANAGER, OPERATOR y VIEWER | ✅ | `mensajes.spec.ts` — política real: `cases.read`, que tienen los cuatro |
| Aislamiento entre organizaciones (lista y contador) | ✅ | `mensajes.spec.ts` |
| Autorización de servidor en expediente ajeno | ✅ | `mensajes.spec.ts` — leer, marcar y escribir devuelven 404 y no crean nada |
| Escritorio, tablet y móvil | ✅ | `avisos.responsive.spec.ts` — incluido el «Volver» del panel partido, que sólo existe en estrecho |
| **En móvil se entra viendo la LISTA, no dentro de un hilo** | ✅ | `avisos.responsive.spec.ts` — **defecto corregido**: la pantalla preseleccionaba la primera conversación también en estrecho, donde el hilo tapa la lista (`hidden sm:flex`). El usuario entraba en Mensajes y aparecía dentro de una conversación que no había elegido, y que además quedaba marcada como leída. La preselección sólo ocurre ahora cuando los dos paneles caben a la vez |
| El filtro «Sin leer» se comprueba por CONVERSACIONES, no por su cifra | ✅ | `mensajes.spec.ts` — **prueba inestable eliminada**: afirmaba «2 conversaciones» nada más entrar, y la preselección automática marca leída la primera y baja la cifra a 1 a los pocos milisegundos. Pasaba casi siempre y fallaba de vez en cuando en CI. La cifra tiene su propia prueba contra el API; ésta comprueba lo que promete su nombre: qué conversaciones deja el filtro |
| **Contador del encabezado al entrar: la secuencia completa** | ✅ | `mensajes.spec.ts` — **política real, probada de punta a punta y sin carreras**: en escritorio se preselecciona la primera conversación, su hilo se muestra, el servidor confirma el marcado (`{ ok, marked: X }`) y el contador pasa de N a N−X exacto. Se espera a la respuesta real del PUT con `waitForResponse`, no a un tiempo fijo; se comprueba la base y la persistencia tras recargar |
| La preselección sólo ocurre si el hilo se ve | ✅ | `mensajes.spec.ts` — en móvil no hay conversación preseleccionada, el contador queda intacto y en la base no se marca nada: es lo que hace coherente al marcado automático de escritorio |

### `/notifications` y campana del encabezado

Pruebas en `notificaciones.spec.ts` (36) y `avisos.responsive.spec.ts`.

| Elemento | Estado | Prueba |
|---|---|---|
| Campana: nombre accesible | ✅ | `notificaciones.spec.ts` — **defecto corregido**: sólo tenía `title`, que es una ayuda emergente, no un nombre. Ahora `aria-label` dice además cuántas hay |
| Campana: contador | ✅ | `notificaciones.spec.ts` |
| Contador «99+» | ✅ | `notificaciones.spec.ts` |
| Marca de urgentes | ✅ | `notificaciones.spec.ts` |
| Abrir y cerrar; cierre al pulsar fuera | ✅ | `notificaciones.spec.ts` |
| Enlace de una alerta a su expediente | ✅ | `notificaciones.spec.ts` |
| «Ver todas las notificaciones» | ✅ | `notificaciones.spec.ts` |
| Estado vacío REAL | ✅ | `notificaciones.spec.ts` — cero alertas: sin contador, y el desplegable lo dice |
| **El fallo de carga NO dice «Sin notificaciones pendientes»** | ✅ | `notificaciones.spec.ts` — **defecto corregido**: `errorCarga` se guardaba y no se pintaba en ninguna parte. Ahora el botón marca «!» en vez de un 0 inventado, y el desplegable explica el fallo. Probado en 401, 500 y fallo de red |
| «Reintentar» de la campana | ✅ | `notificaciones.spec.ts` |
| **Descartar baja el contador UNA sola vez** | ✅ | `notificaciones.spec.ts` — **defecto corregido**: `setCount(c => c-1)` más `count - dismissed.size` restaban dos veces; con tres alertas, descartar una dejaba 1 en vez de 2 |
| **Descartar se confirma con el servidor, con marcha atrás** | ✅ | `notificaciones.spec.ts` — **defecto corregido**: era un POST al aire con `.catch(() => {})`. Con 403, 404, 500 o red caída la alerta vuelve a su sitio y se avisa |
| Descartar: doble clic | ✅ | `notificaciones.spec.ts` — una sola llamada |
| Descartar un aviso ALMACENADO persiste | ✅ | `notificaciones.spec.ts` — se elige por id; el servidor lo deja en `read` y no vuelve |
| Descartar un aviso SINTÉTICO no persiste | — | Por diseño: los avisos vivos (`portal:`, `overdue:`, `isd:`…) se recalculan en cada petición y no hay fila que marcar; el API responde `{ ok: true, synthetic: true }` |
| Botones «Descartar» con nombre que identifica la alerta | ✅ | `notificaciones.spec.ts` — **defecto corregido**: todos se llamaban «Descartar» y eran indistinguibles |
| Descartar con teclado, y el botón visible al enfocarlo | ✅ | `notificaciones.spec.ts` — **defecto corregido**: `opacity-0` sin `focus:opacity-100` lo dejaba enfocable pero invisible |
| Historial: listado, tipo, canal, destinatario, expediente, estado | ✅ | `notificaciones.spec.ts` |
| Error del envío en las fallidas | ✅ | `notificaciones.spec.ts` |
| Filtros Tipo, Canal y Estado | ✅ | `notificaciones.spec.ts` — cifras exactas derivadas del sembrado |
| Combinación de filtros | ✅ | `notificaciones.spec.ts` |
| **Etiquetas de los filtros asociadas por `htmlFor`/`id`** | ✅ | `notificaciones.spec.ts` — **defecto corregido**: estaban sueltas. Se localizan por `getByLabel` y una guardia comprueba que el `for` apunta a un control real |
| «Limpiar» | ✅ | `notificaciones.spec.ts` |
| Resultado vacío por filtros, distinto del vacío absoluto | ✅ | `notificaciones.spec.ts` |
| Paginación real (34 registros, 2 páginas) | ✅ | `notificaciones.spec.ts` — navega, y filtrar vuelve a la primera |
| **Estado del envío legible sin depender del color (móvil)** | ✅ | `avisos.responsive.spec.ts` — **defecto corregido**: en móvil era un punto verde o rojo a secas. Ahora lleva «Enviado»/«Fallido» en `sr-only` |
| Roles con `audit.read` | ✅ | `notificaciones.spec.ts` — política real: lo tienen los CUATRO roles. No hay rol denegado que probar y no se inventa ninguno |
| Sin sesión → `/login` | ✅ | `notificaciones.spec.ts` |
| Aislamiento entre organizaciones | ✅ | `notificaciones.spec.ts` |
| Escritorio, tablet y móvil | ✅ | `avisos.responsive.spec.ts` |

### `/approvals` — Aprobaciones

Pruebas en `aprobaciones.spec.ts` (29) y `avisos.responsive.spec.ts`.

| Elemento | Estado | Prueba |
|---|---|---|
| Contador «N acciones pendientes de revisión» | ✅ | `aprobaciones.spec.ts` — cuadra con la base y con la pestaña |
| Singular y plural del contador | ✅ | `aprobaciones.spec.ts` — se deja la cola en 1 para ver el singular de verdad |
| Pestañas Pendientes / Aprobadas / Rechazadas / Todas | ✅ | `aprobaciones.spec.ts` — cada una con su cifra |
| Fila: acción, expediente, causante, fecha | ✅ | `aprobaciones.spec.ts` |
| Revisor y fecha de revisión | ✅ | `aprobaciones.spec.ts` |
| Enlace al expediente | ✅ | `aprobaciones.spec.ts` |
| Estado vacío real | ✅ | `aprobaciones.spec.ts` |
| **Las de expedientes borrados no cuentan** | ✅ | `aprobaciones.spec.ts` — **defecto corregido**: faltaba `deletedAt: null` en el contador y en `GET /api/approvals`, así que la misma organización mostraba dos cifras distintas de pendientes en tres pantallas |
| Aprobar: funciona y persiste | ✅ | `aprobaciones.spec.ts` — recarga; contador, pestaña y lista coherentes |
| Rechazar: funciona y persiste | ✅ | `aprobaciones.spec.ts` |
| El dashboard refleja el cambio | ✅ | `aprobaciones.spec.ts` |
| **Aprobar/rechazar avisa cuando falla** | ✅ | `aprobaciones.spec.ts` — **defecto corregido**: era un `fetch` sin `try`, sin mensaje y sin `finally`; con 403/404/500 no pasaba nada en absoluto. Probado en 400, 403, 404, 409 y 500 |
| **Fallo de red no deja el botón bloqueado** | ✅ | `aprobaciones.spec.ts` — **defecto corregido**: sin `finally`, `setActing(null)` no llegaba a ejecutarse y el botón se quedaba en «...» para siempre |
| Respuesta que no es JSON | ✅ | `aprobaciones.spec.ts` — no muestra «Unexpected token» |
| Doble clic no aprueba dos veces | ✅ | `aprobaciones.spec.ts` |
| Botones con nombre que identifica la aprobación | ✅ | `aprobaciones.spec.ts` — **defecto corregido**: todas las filas tenían el mismo «Aprobar» |
| «Ver detalle» / «Ocultar» | ✅ | `aprobaciones.spec.ts` — con `aria-expanded` |
| Aprobación sin `details`: no aparece el botón | ✅ | `aprobaciones.spec.ts` |
| **El detalle se muestra como TEXTO, no se ejecuta** | ✅ | `aprobaciones.spec.ts` — se siembra con `<img onerror>`, `<b>` y `<script>`: se leen tal cual y no crean ningún elemento |
| Roles con `autopilot.approve` | ✅ | `aprobaciones.spec.ts` — política real: OWNER, MANAGER y OPERATOR |
| Un VIEWER no entra ni por URL directa | ✅ | `aprobaciones.spec.ts` — sin enlace en el menú, y `/approvals` redirige al panel |
| El servidor rechaza a un VIEWER | ✅ | `aprobaciones.spec.ts` — listar y aprobar devuelven 403; nada cambia |
| Aislamiento entre organizaciones | ✅ | `aprobaciones.spec.ts` — la cola no la muestra, y aprobar la ajena devuelve 404 |
| Paginación: página 1, «Siguiente», «Anterior» | ✅ | `aprobaciones.spec.ts` — prueba **propia**, sobre una organización dedicada con 40 aprobaciones (35 pendientes → 30 + 5) |
| Paginación: sin duplicados ni ausencias | ✅ | `aprobaciones.spec.ts` — cada aprobación cuelga de su expediente con referencia única; se comprueba que ninguna sale en las dos páginas y que entre ambas están las 35 |
| Paginación: cambiar de pestaña vuelve a la página 1 | ✅ | `aprobaciones.spec.ts` — desde la página 2, «Aprobadas» (3 filas) no deja al usuario en una página que ya no existe |
| Paginación: cifras exactas por pestaña | ✅ | `aprobaciones.spec.ts` — 35 / 3 / 2 / 40, y «Todas» también pagina |
| Paginación: aislamiento entre organizaciones | ✅ | `aprobaciones.spec.ts` — las de otra organización no aparecen en ninguna página ni alteran el total; se comprueba en la interfaz y en el API, con y sin filtro de estado |
| Escritorio, tablet y móvil | ✅ | `avisos.responsive.spec.ts` |

### `/workflow-rules` — Automatizaciones

Inventario real de la pantalla y de sus tres modales. Pruebas en
`automatizaciones.spec.ts` (52).

| Elemento | Rol / permiso | Estado | Prueba |
|---|---|---|---|
| Ver la lista de reglas | `workflow.read` (los 4 roles) | ✅ | `automatizaciones.spec.ts` — nombre, disparador y acción |
| **La lista caída NO dice «Sin reglas de automatización»** | — | ✅ | **defecto corregido**: era `try { if (res.ok) … } catch {}`; con la petición caída el gestor concluía que no tenía ninguna automatización montada. HTTP 401/403/500, red y forma inesperada |
| «Reintentar» de la lista | — | ✅ | `automatizaciones.spec.ts` |
| Estado vacío REAL | — | ✅ | organización sin reglas |
| Crear regla (comentario) | `workflow.manage` | ✅ | flujo completo desde el navegador; persiste con su configuración |
| Crear regla (email) con asunto y cuerpo | `workflow.manage` | ✅ | `automatizaciones.spec.ts` |
| Los 4 disparadores despliegan sus condiciones | `workflow.manage` | ✅ | `CASE_STATUS_CHANGED`, `TASK_STATUS_CHANGED`, `CASE_CREATED`, `DOCUMENT_UPLOADED` |
| Las 4 acciones despliegan su configuración | `workflow.manage` | ✅ | `SEND_EMAIL_CONTACT`, `SEND_EMAIL_TEAM`, `ADD_CASE_COMMENT`, `CHANGE_CASE_STATUS` |
| Casilla «Regla activa» | `workflow.manage` | ✅ | se guarda como se deja |
| Nombre vacío o sólo espacios | — | ✅ | el botón queda inhabilitado, y el servidor lo rechaza con 400 |
| **Los estados de expediente que ofrece el formulario existen** | — | ✅ | **defecto corregido**: ofrecía `OPEN`, `PENDING_SIGNATURE` y `FILED`, que **no existen** en `CaseStatus`, y omitía `INTAKE`, `VALIDATION`, `READY_TO_SEND`, `SENT` y `FOLLOW_UP`. Elegir «Presentado» daba un 400; poner «Abierto» como condición creaba una regla que **no se disparaba jamás**, sin un solo error. Ahora la lista sale del enum |
| Disparador y acción inválidos | — | ✅ | el servidor los rechaza con 400 |
| Estado de destino inválido | — | ✅ | rechazado; no se crea la regla |
| **Guardar no finge éxito** | — | ✅ | **defecto corregido**: HTTP 400/403/500, respuesta que no es JSON —ya no sale «Unexpected token '<'»— y fallo de red. El modal queda abierto y con lo escrito |
| Editar una regla | `workflow.manage` | ✅ | nombre, descripción, disparador, condiciones, acción y configuración; persiste |
| Una edición rechazada NO aparece guardada | — | ✅ | `automatizaciones.spec.ts` |
| **Activar / desactivar comprueba el resultado** | `workflow.manage` | ✅ | **defecto corregido**: disparaba el PATCH y recargaba sin mirar; con un 403 el usuario se iba creyendo que la había desactivado. Los dos sentidos persisten |
| Activar: HTTP 403, 500 y fallo de red | — | ✅ | avisa y el estado real **no** cambia |
| **Borrar comprueba el resultado** | `workflow.manage` | ✅ | **defecto corregido**: cerraba la confirmación pasara lo que pasara. Cancelar deja la regla; confirmar la borra y persiste |
| Borrar: HTTP 403, 404 y 500 | — | ✅ | la confirmación sigue abierta y la regla sigue en la base |
| Borrar: doble clic | — | ✅ | una sola llamada |
| **El buscador del modal de prueba distingue vacío de fallo** | — | ✅ | **defecto corregido**: el `catch {}` convertía 401/403/500/red en «sin resultados» y el modal quedaba mudo |
| Probar regla: ejecución real y efecto | `workflow.manage` | ✅ | se busca el expediente, se pulsa el resultado real, se ejecuta y el comentario aparece en el expediente; queda registrada la ejecución |
| Probar regla: servidor caído | — | ✅ | avisa y no finge éxito |
| **DISPARO AUTOMÁTICO de punta a punta** | — | ✅ | se cambia el estado desde la ficha del expediente y el motor arranca **solo**: comentario, registro de ejecución, `execCount` y `lastRunAt`. Prueba la cadena `interfaz → evento → motor → acción → registro`, sin pasar por el endpoint de prueba |
| Etiquetas del formulario asociadas | — | ✅ | **defecto corregido**: **ninguna** lo estaba. 12 campos por `getByLabel`, con guardia que falla si alguna vuelve a quedar suelta |
| «Condiciones» y «Configuración de acción» como grupo | — | ✅ | `fieldset`/`legend`: rotulan un conjunto, no un campo |
| Botones de icono con nombre que identifica la regla | — | ✅ | **defecto corregido**: editar y eliminar no tenían nombre **ninguno**; los otros dos dependían de `title` |
| Los tres modales se anuncian como diálogo | — | ✅ | `role="dialog"` + `aria-modal` + título |
| Roles: los 4 leen | `workflow.read` | ✅ | política real |
| OPERATOR y VIEWER no ven controles de gestión | `workflow.manage` | ✅ | `automatizaciones.spec.ts` |
| El servidor rechaza a OPERATOR y VIEWER | — | ✅ | crear, editar, borrar y probar → 403; nada cambia |
| Aislamiento entre organizaciones | — | ✅ | la lista no la muestra; leer, editar, borrar y probar la ajena → 404 |
| Idempotencia del motor | — | 🟡 | `idempotencyKey` existe en el esquema y **no se ha tocado**; su comportamiento bajo evento duplicado no se ha probado desde el navegador en esta fase |
| «Probar regla» con una acción de CORREO | `workflow.manage` | ❌ | **hueco declarado**: el modal de prueba se conduce con la regla de comentario, cuyo efecto se comprueba en el expediente. Con `SEND_EMAIL_CONTACT` o `SEND_EMAIL_TEAM` no se ha comprobado contra el buzón de pruebas. (El envío por correo del motor **sí** está probado contra el buzón, pero por la vía del reintento de `/workflow-logs`, no por este modal) |
| DISPARO AUTOMÁTICO de los otros tres disparadores | — | ❌ | **hueco declarado**: sólo `CASE_STATUS_CHANGED` se ha conducido de punta a punta desde la interfaz. `TASK_STATUS_CHANGED`, `CASE_CREATED` y `DOCUMENT_UPLOADED` se comprueban al crear y guardar la regla, pero no se ha provocado el evento real que los dispara |
| Escritorio, tablet y móvil | — | ✅ | `automatizaciones.responsive.spec.ts` — la lista, y el formulario de nueva regla se abre y se rellena con la pantalla estrecha |

### `/workflow-logs` — Registro de ejecuciones

Pruebas en `registro-automatizaciones.spec.ts` (50 en escritorio) y
`automatizaciones.responsive.spec.ts`.

| Elemento | Rol / permiso | Estado | Prueba |
|---|---|---|---|
| Estados de carga, vacío, error y «Reintentar» | — | ✅ | `estados-carga.spec.ts` (fase anterior) |
| Las tarjetas coinciden con la base | `workflow.read` | ✅ | contadas contra `groupBy` en PostgreSQL, no contra una cifra escrita a mano |
| **«Total ejecuciones» incluye las que están en curso** | — | ✅ | **defecto corregido**: sumaba SUCCESS + PARTIAL + FAILED + SKIPPED y olvidaba PROCESSING, mientras el botón «En curso» de justo debajo sí las contaba. La suma de los botones podía superar al total que tenían encima |
| **La tasa de éxito se mide sobre las terminadas** | — | ✅ | **defecto corregido**: una ejecución en curso hundía el porcentaje por el mero hecho de mirar la pantalla mientras corría |
| Una PARCIAL no se pinta ni se cuenta como éxito | — | ✅ | `registro-automatizaciones.spec.ts` |
| Filtro por cada estado (4 estados) | `workflow.read` | ✅ | toda fila de la tabla lleva la etiqueta del filtro puesto |
| Filtro por regla, y combinado con el estado | `workflow.read` | ✅ | el número de filas se compara con `count` en la base |
| **Un clic en un filtro lanza UNA sola petición** | — | ✅ | **defecto corregido**: `handleFilter` recargaba a mano *y* cambiaba el estado que disparaba el efecto que recargaba. Dos peticiones idénticas por clic, con la respuesta vieja pudiendo llegar después de la nueva |
| Filtro sin resultados: lo dice como filtro | — | ✅ | y **no** con el texto de «tus reglas no se han disparado nunca» |
| **Volver de la página 2 a la 1 recarga de verdad** | — | ✅ | **defecto corregido**: el efecto sólo recargaba con filtros o fuera de la página 1. Sin filtros, la tabla seguía mostrando la página 2 mientras el pie decía «1–30 de N» |
| Última página: el resto de las filas, «Siguiente» inhabilitado | — | ✅ | `registro-automatizaciones.spec.ts` |
| Fallo de carga: 401 / 403 / 500, red y forma inesperada | — | ✅ | sale el aviso y **no** «Sin ejecuciones»; sin «Failed to fetch» en pantalla |
| «Reintentar» del aviso vuelve a cargar | — | ✅ | `registro-automatizaciones.spec.ts` |
| **«Reintentar fallidas» sólo donde queda algo pendiente** | `workflow.manage` | ✅ | **defecto corregido**: salía en toda ejecución PARTIAL o FAILED, incluidas las que no tienen entregas —una regla de comentario no tiene destinatarios— y las ya recuperadas. `pendingDeliveries` lo decide |
| **El reintento escribe al que falló y NO al que ya lo recibió** | `workflow.manage` | ✅ | contra el **buzón de pruebas real**: llega un correo al destinatario en FAILED y **ninguno** al que estaba en SENT. El estado de la ejecución pasa a SUCCESS en la base |
| **El aviso dice a quién le llegó** | — | ✅ | **defecto corregido**: el detalle por destinatario que devuelve el servidor se tiraba a la basura, y era el motivo de entrar aquí |
| **Los contadores se refrescan tras el reintento** | — | ✅ | **defecto corregido**: venían congelados del render inicial; la fila pasaba a «Exitoso» y la tarjeta «Con error» seguía marcando el número de antes |
| **Un fallo del reintento se ve como fallo** | — | ✅ | **defecto corregido**: los tres desenlaces salían en la misma caja gris con `role="status"`. Ahora el error es `role="alert"` y rojo; 500, red y 404 comprobados, y la ejecución sigue fallida en la base |
| **«No quedaban entregas» deja de ser mentira** | — | ✅ | **defecto corregido**: cuando la regla ya no podía reconstruirse el servidor devolvía `retried: 0` igual que si no quedara nada, y la pantalla daba por resuelto un aviso que seguía sin llegar. Ahora dice que **no se pueden** reintentar |
| Doble clic en «Reintentar»: un solo correo | — | ✅ | comprobado contando los mensajes del buzón |
| Enlace al expediente desde la fila | `cases.read` | ✅ | se pulsa y se llega a la ficha |
| **El nombre de la regla filtra por esa regla** | — | ✅ | antes llevaba a `/workflow-rules` sin decir cuál |
| Roles: los 4 leen el registro | `workflow.read` | ✅ | política real de `src/lib/rbac.ts` |
| **OPERATOR y VIEWER no ven «Reintentar fallidas»** | `workflow.manage` | ✅ | **defecto corregido**: se les ofrecía un botón que el servidor iba a rechazar |
| El servidor rechaza el reintento de OPERATOR y VIEWER | — | ✅ | 403, **ningún correo sale** y la ejecución no cambia. Esconder el botón no es el control |
| Aislamiento entre organizaciones | — | ✅ | ni una ejecución ajena en pantalla; `?ruleId=` ajeno → 404; reintentar una ejecución ajena → 404 |
| **El API no se cae con parámetros raros** | — | ✅ | **defecto corregido**: `?page=abc` daba 500 (`skip: NaN`) y `?limit=-5` devolvía **las últimas filas en orden inverso** sin avisar. Estado inventado → 400, no 500 |
| Sin sesión no se lee nada | — | ✅ | 401/403 |
| Grupo de filtros con nombre y `aria-pressed` | — | ✅ | **defecto corregido**: el color de fondo era la única señal de cuál estaba puesto |
| El selector de regla tiene rótulo | — | ✅ | **defecto corregido**: no tenía ninguno |
| Tabla con `caption` y `scope` en toda cabecera | — | ✅ | `registro-automatizaciones.spec.ts` |
| El mensaje de error de una fila se lee entero | — | ✅ | **defecto corregido**: estaba en un `truncate` con el texto completo sólo en `title`: inalcanzable con teclado y en móvil |
| Escritorio, tablet y móvil | — | ✅ | `automatizaciones.responsive.spec.ts` — se llega por el enlace (no `page.goto`), caben las cinco tarjetas, se filtra, se reintenta y el fallo de carga se explica |
| Idempotencia del motor | — | 🟡 | `idempotencyKey` existe y **no se ha tocado**; su comportamiento bajo evento duplicado no se ha probado desde el navegador |

### `/audit` — Traza de auditoría

Pruebas en `auditoria.spec.ts` (43 en escritorio) y
`automatizaciones.responsive.spec.ts`.

| Elemento | Rol / permiso | Estado | Prueba |
|---|---|---|---|
| Estados de carga, vacío, error y «Reintentar» | — | ✅ | `auditoria.spec.ts` — 401, 403, 500 y fallo de red |
| El contador coincide con la base | `audit.read` | ✅ | contado contra PostgreSQL |
| Un registro sin usuario sale como «Sistema» | — | ✅ | `auditoria.spec.ts` |
| **El detalle se lee entero** | — | ✅ | **defecto corregido**: la columna «Detalles» estaba en un `truncate` **sin `title` siquiera**: el texto se cortaba y no había forma de ver el resto ni con ratón, ni con teclado, ni en el móvil. En una traza de auditoría el detalle *es* el registro |
| Filtro por categoría (prefijo de acción) | `audit.read` | ✅ | toda fila lleva el prefijo, y el contador cuadra con `count` |
| Filtro por usuario, y «Sistema» aparte | `audit.read` | ✅ | `auditoria.spec.ts` |
| Búsqueda en acción y en detalle | `audit.read` | ✅ | el contador se compara con la misma consulta en la base |
| «Limpiar» devuelve la lista completa | — | ✅ | y deja los controles a cero |
| Filtro sin resultados: lo dice como filtro | — | ✅ | `auditoria.spec.ts` |
| **«Desde hoy» incluye las 00:30 y excluye ayer a las 23:30** | — | ✅ | **defecto corregido**: `gte: new Date(from)` es medianoche UTC —las 02:00 en Madrid—, así que «desde el 22» **perdía** los registros de 00:00 a 02:00. Dos registros sembrados a media hora de la medianoche **civil española**, uno a cada lado |
| **«Hasta ayer» incluye ayer a las 23:30 y excluye hoy** | — | ✅ | **defecto corregido**: `to + "T23:59:59.999Z"` son las 01:59 del día siguiente en Madrid, así que «hasta el 22» **colaba** registros del 23 |
| «Hasta hoy» incluye hoy: el límite es inclusivo | — | ✅ | `auditoria.spec.ts` |
| **Una fecha imposible se rechaza con 400** | — | ✅ | **defecto corregido**: `?from=ayer` es `Invalid Date` y Prisma lanzaba: 500 en la auditoría |
| Paginación: ida, vuelta y filas de la página 2 | — | ✅ | las filas cambian de verdad y vuelven; el número de la última página cuadra con la base |
| Cambiar de filtro vuelve a la página 1 | — | ✅ | `auditoria.spec.ts` |
| **El CSV exporta todo lo filtrado, no 30 filas** | `audit.read` | ✅ | **defecto corregido**: se construía desde `logs`, la página actual. Quien exportaba para una inspección se llevaba 30 registros de los que hubiera, sin aviso y con un fichero que parece completo. Se descarga el fichero y **se cuentan sus líneas** contra el total de la base |
| Nombre del fichero, BOM y cabecera | — | ✅ | `audit-trail-AAAA-MM-DD.csv`; sin BOM, Excel abre en Latin-1 y rompe los acentos |
| Comillas, comas y acentos sobreviven | — | ✅ | un registro sembrado con `"comillas"`, coma y `ñáéíóú`: las comillas van dobladas, la coma no parte la fila, salen los seis campos, «Sistema» y la referencia del expediente |
| Con filtros, el CSV lleva lo filtrado y lo declara | — | ✅ | el `aria-label` del botón dice el alcance |
| Una exportación fallida no descarga nada a medias | — | ✅ | avisa, no aparece el mensaje de éxito y **no** se dispara ninguna descarga |
| El aviso de exportación no sobrevive a un cambio de filtro | — | ✅ | **defecto corregido**: decía «Exportados 37 registros» junto a una lista ya filtrada |
| **Acción real → traza → interfaz** | — | ✅ | se desactiva una regla **desde `/workflow-rules`**, y el registro aparece en la base y en `/audit`, con el nombre de quien lo hizo |
| Sólo lectura: POST, PUT, PATCH y DELETE | — | ✅ | los cuatro fallan y el número de registros no cambia |
| Un GET no modifica la base | — | ✅ | filtrar y paginar deja el recuento intacto |
| Roles: los 4 leen la traza | `audit.read` | ✅ | política real de `src/lib/rbac.ts` |
| Aislamiento entre organizaciones | — | ✅ | ni en pantalla, ni buscándolo a propósito, ni pidiendo el `caseId` ajeno por el API |
| Sin sesión no se lee nada | — | ✅ | 401/403 |
| **El API no se cae con parámetros raros** | — | ✅ | **defecto corregido**: `?page=abc` → 500; `?limit=-5` devolvía las últimas filas en orden inverso |
| Etiquetas de los cinco filtros asociadas | — | ✅ | **defecto corregido**: ninguna lo estaba. Con guardia que falla si alguna vuelve a quedar suelta |
| El botón de CSV declara su alcance | — | ✅ | `auditoria.spec.ts` |
| **En MÓVIL, un fallo de carga no dice «No hay registros»** | — | ✅ | **defecto corregido**: la rama `md:hidden` de tarjetas no miraba el error. En un teléfono, una auditoría que no había podido cargarse afirmaba que no había pasado nada en la organización, y sin forma de reintentar. El aviso se dibuja ahora **una sola vez**, fuera de las dos ramas |
| Escritorio, tablet y móvil | — | ✅ | `automatizaciones.responsive.spec.ts` — lectura, filtros, paginación y el fallo de carga |

#### Dejado como estaba, a propósito

| Cosa | Por qué |
|---|---|
| El título «Audit Trail», en inglés | Es copia visible para el usuario en una aplicación por lo demás en español. Cambiarlo es una decisión de producto, no la corrección de un defecto de uso o de accesibilidad, y el encargo pedía **conservar la copia** salvo en ese caso |
| El `<select>` de estado de `/cases/[id]` no tiene nombre accesible | Es un defecto **real**, encontrado al conducir el disparo automático desde la ficha. La ficha del expediente está **fuera del alcance** de esta fase, así que se declara aquí y no se toca |
| `WorkflowLog.idempotencyKey` | La protección contra ejecuciones duplicadas ya existía y no se ha modificado. Sigue marcada 🟡 arriba porque no está probada desde el navegador, no porque se haya debilitado |

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
| Roles autorizados (OWNER, MANAGER, OPERATOR, VIEWER) | ✅ | `calendar.spec.ts` — política real: `/api/tasks/calendar` e `ical` exigen `tasks.read`, que tienen los cuatro. Para cada rol: enlace en el menú, rejilla, filtros, detalle del día, enlace al expediente y exportación `.ics` |
| Filtros del calendario con etiqueta asociada | ✅ | `calendar.spec.ts` — `<label htmlFor>` + `id` (en `sr-only`); las pruebas los localizan por `getByLabel`, y una guardia falla si pierden el nombre o si dependen sólo de `title` |
| Botón de cerrar el detalle del día | ✅ | `calendar.spec.ts` — **defecto corregido**: su nombre accesible era el carácter «×»; ahora `aria-label="Cerrar detalle"` |

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
| Estado vacío del panel (sin invitaciones pendientes) | ✅ | `usuarios.spec.ts` — escenario real, sin error y sin spinner |
| Error de carga + «Reintentar» del panel | ✅ | `usuarios.spec.ts` — HTTP 500, fallo de red y 401; «Reintentar» pide de nuevo y el panel se recupera |
| Cambio de rol de un miembro | ✅ | `usuarios.spec.ts` — desde el selector real, persiste tras recargar y **la persona obtiene de verdad los permisos** |
| No degradar al último OWNER | ✅ | `usuarios.spec.ts` — la interfaz no lo ofrece, el servidor lo rechaza y dos degradaciones simultáneas no dejan la organización sin OWNER |
| OPERATOR no puede invitar | ✅ | «un OPERATOR no puede reenviar ni revocar» |
| Organización ajena → 404 | ✅ | «no se puede tocar una invitacion de otra organizacion» |
| Listado de miembros con rol, correo y fecha | ✅ | `usuarios.spec.ts` |
| Contador de usuarios del plan | ✅ | `usuarios.spec.ts` — cuadra con los miembros reales |
| Aviso al alcanzar el límite del plan | ✅ | `usuarios.spec.ts` |
| Las invitaciones pendientes siguen visibles con el plan lleno | ✅ | `usuarios.spec.ts` — **defecto corregido**: el panel entero desaparecía y no había forma de revocarlas |
| Cambio de rol: HTTP 400, 403, 422, 500 | ✅ | `usuarios.spec.ts` — avisa, el rol no cambia y el control sigue utilizable |
| Cambio de rol: respuesta no-JSON y fallo de red | ✅ | `usuarios.spec.ts` — **defecto corregido**: el aviso salía vacío o con «Unexpected token» |
| Con dos OWNER sí se puede degradar a uno | ✅ | `usuarios.spec.ts` — persiste y queda un OWNER |
| Un MANAGER no degrada, expulsa ni crea un OWNER | ✅ | `usuarios.spec.ts` — 403 del servidor |
| Expulsar a un miembro: confirmar, cancelar, confirmar | ✅ | `usuarios.spec.ts` |
| Expulsar: error de servidor y fallo de red | ✅ | `usuarios.spec.ts` — nunca desaparece de la lista si no se eliminó |
| OWNER y MANAGER administran el equipo | ✅ | `usuarios.spec.ts` — política real de `rbac.ts` |
| OPERATOR y VIEWER: sin acceso en interfaz **y** en servidor | ✅ | `usuarios.spec.ts` — sin enlace, redirección y 403 en PATCH, DELETE e invitación |
| Cada control dice sobre quién actúa | ✅ | `usuarios.spec.ts` — **defecto corregido**: selects y botones «Eliminar» eran indistinguibles entre filas |
| Campos del formulario de invitación con etiqueta | ✅ | `usuarios.spec.ts` — **defecto corregido**: no tenían ninguna |
| Escritorio, tablet y móvil | ✅ | `usuarios.responsive.spec.ts` — las dos maquetas (tabla y tarjetas), sin desbordamiento horizontal |

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
| `autoComplete` para gestores de contraseñas | ✅ | `autenticacion.spec.ts` — login (`username` + `current-password`), recuperación, alta, restablecimiento y perfil; se comprueban `autocomplete`, `type` y `name` en el DOM real. **Limitación externa declarada:** que Safari o Chrome muestren visualmente su gestor depende del navegador y su llavero, no de la aplicación; Playwright no lo expone y queda como prueba manual |
| Cada campo de autenticación con etiqueta asociada | ✅ | `autenticacion.spec.ts` — **defecto corregido**: los cinco formularios (login, recuperar, alta, restablecer, perfil) tenían 14 `<label>` y **ninguna** asociada a su campo |
| Las credenciales no se guardan en el navegador | ✅ | `autenticacion.spec.ts` — tras un login real se vuelca `localStorage`, `sessionStorage` e IndexedDB y se comprueba que la contraseña no aparece |
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

### `/documents` — Documentos

**Inventario real del módulo.** `/documents` es una **biblioteca**: lista,
busca por nombre, filtra por origen, pagina de 30 en 30, descarga y borra.
**No sube** — ahí no existe ningún control de alta. Se sube desde la pestaña
**Documentos de la ficha del expediente** y desde el **portal familiar**. La
matriz marca cada fila donde el producto ofrece la función, no donde sería
cómodo que estuviera.

**Todo lo de esta sección se prueba contra MinIO real**, el mismo contenedor y
la misma versión fijada que usa el job de integración. Que la fila exista en la
base de datos no se acepta como prueba de que el archivo esté: se comprueba el
objeto en el bucket y se comparan los bytes.

#### Subida (ficha del expediente)

| Elemento | Estado | Prueba |
|---|---|---|
| Subir un documento desde la ficha | ✅ | `documentos.spec.ts` — interfaz, base **y objeto en MinIO** |
| Los bytes que llegan al bucket son los del archivo | ✅ | `documentos.spec.ts` — comparación byte a byte |
| Aparece después en la biblioteca `/documents` | ✅ | `documentos.spec.ts` |
| Vinculación automática a tarea por nombre | ✅ | `documentos.spec.ts` — sugerencias cuando no casa |
| Archivo vacío | ✅ | `documentos.spec.ts` — se explica y no se crea nada |
| Extensión no admitida | ✅ | `documentos.spec.ts` — dice cuáles se aceptan |
| Ejecutable renombrado a `.pdf` | ✅ | `documentos.spec.ts` — rechazado por su **contenido**, no por lo que declara el cliente |
| Archivo por encima del límite | ✅ | `documentos.spec.ts` — 413 con el máximo |
| Nombre con ruta (`../../etc/passwd`) | ✅ | `documentos.spec.ts` — se sanea y la clave no escapa del ámbito |
| Error del servidor al subir | ✅ | `documentos.spec.ts` — avisa y no aparece documento |
| Fallo de red al subir | ✅ | `documentos.spec.ts` — avisa y el control vuelve a estar disponible |
| Almacenamiento no disponible | ✅ | `documentos.spec.ts` — avisa y no queda fila fantasma |
| Doble envío | ✅ | `documentos.spec.ts` — el control anuncia «Subiendo…» y no se deja usar; sale **una** petición y se crea **un** documento |

#### Descarga

| Elemento | Estado | Prueba |
|---|---|---|
| Descargar desde `/documents` | ✅ | `documentos.spec.ts` — **bytes idénticos**, nombre y tamaño |
| Descargar desde la ficha | ✅ | `documentos.spec.ts` — bytes idénticos; **la descarga desde el expediente no existía**: `/api/cases/[id]` no devolvía `downloadUrl` y el enlace nunca se pintaba |
| Error del servidor al descargar | ✅ | `documentos.spec.ts` — avisa y el botón sigue utilizable |
| Fallo de red al descargar | ✅ | `documentos.spec.ts` — antes era un `catch {}` mudo |
| URL firmada, temporal y con caducidad ≤ 1 h | ✅ | `documentos.spec.ts` |
| La URL fuerza descarga (`attachment`) | ✅ | `documentos.spec.ts` — antes se abría en línea |
| La URL no expone credenciales | ✅ | `documentos.spec.ts` |
| Una URL manipulada no sirve el objeto | ✅ | `documentos.spec.ts` — firma y ruta |

#### Eliminación

| Elemento | Estado | Prueba |
|---|---|---|
| Confirmación, cancelar y confirmar | ✅ | `documentos.spec.ts` |
| Borra de la interfaz, de la base **y del bucket** | ✅ | `documentos.spec.ts` |
| HTTP 403, 404 y 500 | ✅ | `documentos.spec.ts` — avisa y la fila **no** desaparece |
| Fallo de red | ✅ | `documentos.spec.ts` |
| El almacenamiento no puede borrar (502) | ✅ | `documentos.spec.ts` — no se anuncia un borrado que no ocurrió |

#### Biblioteca: búsqueda, filtros y paginación

| Elemento | Estado | Prueba |
|---|---|---|
| Búsqueda por nombre | ✅ | `documentos.spec.ts` — petición **y** resultados |
| Limpiar la búsqueda | ✅ | `documentos.spec.ts` |
| Filtro Todos / Equipo / Familia | ✅ | `documentos.spec.ts` — petición **y** resultados, los tres |
| Búsqueda + origen combinados | ✅ | `documentos.spec.ts` |
| Paginación de 30: siguiente, anterior y última | ✅ | `documentos.spec.ts` — sin duplicados ni documentos perdidos |
| Volver a la página 1 recarga sus documentos | ✅ | `documentos.spec.ts` — **defecto corregido** |
| Paginación coherente al buscar y al filtrar | ✅ | `documentos.spec.ts` |
| Estado vacío por filtro | ✅ | `documentos.spec.ts` |
| Error del servidor + «Reintentar» | ✅ | `documentos.spec.ts` — **no** se disfraza de biblioteca vacía |
| Sesión caducada distinguida | ✅ | `documentos.spec.ts` |
| Enlace al expediente desde la fila | ✅ | `documentos.spec.ts` |

#### Metadatos

| Elemento | Estado | Prueba |
|---|---|---|
| `fileName`, `fileSize`, `mimeType` reales | ✅ | `documentos.spec.ts` — el tipo lo decide el contenido |
| Expediente correcto | ✅ | `documentos.spec.ts` |
| `uploadedBy` correcto | ✅ | `documentos.spec.ts` |
| `isPortalUpload` refleja el origen real | ✅ | `documentos.spec.ts` — equipo y familia |
| Documento interno privado por defecto | ✅ | `documentos.spec.ts` |
| Tarea vinculada | ✅ | `documentos.spec.ts` |
| `createdAt` se muestra en la fila | ✅ | `documentos.spec.ts` |
| Clave de objeto impredecible y dentro del ámbito | ✅ | `documentos.spec.ts` |

#### Portal familiar

| Elemento | Estado | Prueba |
|---|---|---|
| Abrir con token válido y consentimiento | ✅ | `documentos.spec.ts` |
| La familia sube un documento | ✅ | `documentos.spec.ts` — confirmación, base y **objeto en MinIO** |
| El equipo lo ve marcado como «Familia» | ✅ | `documentos.spec.ts` |
| El equipo lo descarga con los mismos bytes | ✅ | `documentos.spec.ts` |
| El portal sólo ve lo que le corresponde | ✅ | `documentos.spec.ts` — el documento interno no se filtra ni en el API |
| Archivo inválido desde el portal | ✅ | `documentos.spec.ts` — antes no producía nada en pantalla |
| Fallo de almacenamiento desde el portal | ✅ | `documentos.spec.ts` |
| Token inválido | ✅ | `documentos.spec.ts` |
| Token revocado | ✅ | `documentos.spec.ts` |
| Un portal no alcanza documentos de otro expediente | ✅ | `documentos.spec.ts` |

#### Aislamiento entre organizaciones

| Elemento | Estado | Prueba |
|---|---|---|
| No se listan documentos de otra organización | ✅ | `documentos.spec.ts` — ni buscándolos por su nombre exacto |
| No se obtiene URL de descarga ajena | ✅ | `documentos.spec.ts` — 404 |
| No se elimina ni modifica un documento ajeno | ✅ | `documentos.spec.ts` — 404 y nada cambia |
| No se sube a un expediente ajeno | ✅ | `documentos.spec.ts` — 404 |
| No se filtran metadatos sensibles en el error | ✅ | `documentos.spec.ts` — ni nombre, ni clave, ni enlace |

#### Roles, accesibilidad y tamaños

Política real comprobada en `src/lib/rbac.ts` antes de escribir las pruebas:
OWNER, MANAGER, OPERATOR y MANAGED_OPS tienen `documents.create/read/update/delete`;
**VIEWER sólo los permisos que terminan en `.read`**, es decir sólo consultar y
descargar.

| Elemento | Estado | Prueba |
|---|---|---|
| MANAGER sube, descarga y elimina | ✅ | `documentos.spec.ts` |
| OPERATOR sube, descarga y elimina | ✅ | `documentos.spec.ts` |
| VIEWER consulta y descarga | ✅ | `documentos.spec.ts` |
| VIEWER: sin controles de subida ni borrado | ✅ | `documentos.spec.ts` |
| VIEWER: el servidor rechaza subir, borrar y compartir | ✅ | `documentos.spec.ts` — 403 por URL directa |
| Búsqueda con nombre accesible | ✅ | `documentos.spec.ts` — antes sólo tenía `placeholder` |
| Filtros identificables y con estado anunciado | ✅ | `documentos.spec.ts` — `role=group` + `aria-pressed` |
| Descargar y Eliminar dicen a qué documento pertenecen | ✅ | `documentos.spec.ts` |
| Input de fichero con etiqueta asociada | ✅ | `documentos.spec.ts` |
| Diálogo de confirmación y mensajes de error | ✅ | `documentos.spec.ts` — `role=alert` / `role=status` |
| Navegación por teclado | ✅ | `documentos.spec.ts` |
| Escritorio, tablet y móvil | ✅ | `documentos.responsive.spec.ts` — listado, búsqueda, filtros, abrir expediente, subir, descargar, eliminar, paginar y portal, sin desbordamiento horizontal |
| Portal familiar en móvil sin scroll lateral | ✅ | `documentos.responsive.spec.ts` — **defecto corregido**: el indicador de estado desbordaba 95 px y arrastraba a toda la página |

#### Funciones que **no existen** en el producto

No se prueban ni se inventan; quedan declaradas:

| Función | Realidad |
|---|---|
| Subir desde `/documents` | La biblioteca no tiene control de alta. Se sube desde la ficha del expediente o desde el portal familiar. |
| Renombrar un documento | No existe. El nombre se fija al subir y sólo se puede borrar y volver a subir. |
| Carpetas o etiquetas propias | No existen. La organización real es por expediente y por tarea vinculada. |
| Previsualización dentro de la aplicación | No hay visor. La descarga se fuerza como adjunto a propósito, para no ejecutar contenido de terceros en el navegador. |
| Versiones de un documento | No existe historial: cada subida es un documento nuevo. |
| Filtro por expediente, por tarea o por fecha en `/documents` | No existen como control. Se filtra por origen y se busca por nombre. |
| Descarga múltiple o en ZIP desde `/documents` | No existe. El paquete de banco es otra funcionalidad, con su propia pantalla. |
| Papelera o recuperación tras borrar | No existe. El borrado es definitivo y así se advierte en la confirmación. |
| Análisis antivirus de lo subido | **No existe.** Se valida tipo, tamaño y firma de contenido; no se busca malware dentro de un PDF bien formado. Documentado también en `src/lib/file-policy.ts`. |

### Sin cobertura de interfaz

Esta sección enumera lo que **no** está cubierto. Una pantalla con sección
propia arriba no aparece aquí: si figura en los dos sitios, la matriz se está
contradiciendo y hay que corregirla.

**Con estados de carga probados** (carga, vacío, error y «Reintentar», vía
`estados-carga.spec.ts`), pero **sin sus interacciones propias probadas**:

Ninguna. `/audit` y `/workflow-logs` estaban aquí y ya no: tienen sección
propia arriba, con sus filtros, su paginación, su exportación y su reintento
conducidos desde el navegador.

Que la pantalla resista un fallo de carga no significa que sus botones estén
probados.

**Sin ninguna cobertura de interfaz:**

`/reports` (+ `isd`, `pipeline`, `portal`, `team`), `/templates`,
`/templates/[id]`, `/case-templates`, `/settings`
(+ `general`, `branding`, `integrations`, `notifications`, `users`),
`/profile`, `/cases/[id]/isd`, `/admin/*`.

**Con sección propia arriba** —y por tanto fuera de las dos listas
anteriores—: `/dashboard`, `/today`, `/messages`, `/notifications` (más la
campana del encabezado), `/approvals`, `/cases`, `/cases/kanban`, `/tasks`,
`/tasks/timeline`, `/documents`, `/users`, `/calendar`, el portal familiar y
las pantallas de autenticación.

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
| `approvals` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` y `aprobaciones.spec.ts` — además de la carga, los cinco códigos de error al aprobar y rechazar |
| `notifications` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` y `notificaciones.spec.ts` — filtros, paginación y resultado vacío distinguido del vacío absoluto |
| `search-modal` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` |
| `users` (panel de invitaciones) | ✅ | ✅ | ✅ | `usuarios.spec.ts` — vacío real, 500, fallo de red, 401 y «Reintentar» |
| `documents` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` |
| `cases/kanban` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` |
| `tasks/timeline` | ✅ | ✅ | ✅ | `estados-carga.spec.ts` |
| `messages` | ✅ | ✅ | ✅ | `mensajes.spec.ts` — HTTP 401, 403, 500, fallo de red y forma inesperada; se exige además que el estado vacío **no** aparezca, y «Reintentar» recupera la lista |
| `usage-widget` | ✅ | ✅ | ✅ | `dashboard.spec.ts` — HTTP 401, 403, 500, fallo de red y «Reintentar», desde el panel real |
| `notification-bell` | ✅ | ✅ | ✅ | `notificaciones.spec.ts` — **defecto corregido**: el fallo se guardaba y no se pintaba, así que la campana decía «Sin notificaciones pendientes» con la petición caída. HTTP 401, 500, fallo de red y «Reintentar» |
| `cases/[id]` (análisis) | ✅ | ✅ | — | ❌ sin prueba de navegador |
| `audit` | ✅ | ✅ | ✅ | `auditoria.spec.ts` — HTTP 401, 403, 500 y fallo de red; el aviso se dibuja **una sola vez**, así que la vista de móvil ya no puede quedarse sin él |
| `workflow-logs` | ✅ | ✅ | ✅ | `registro-automatizaciones.spec.ts` — HTTP 401, 403, 500, red y forma inesperada, provocados al filtrar |
| `dashboard` (componente de servidor) | — no hay `fetch` | ✅ | recargar | `dashboard.spec.ts` — **defecto corregido**: `safe()` devolvía `0`/`[]`/`null` y el fallo era indistinguible del dato. Ahora cada consulta devuelve `{ ok, datos \| error }` |
| `today` (componente de servidor) | — no hay `fetch` | ✅ | recargar | `today.spec.ts` — mismo defecto; además «Todo al día» ya no puede aparecer con una fuente caída |

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
