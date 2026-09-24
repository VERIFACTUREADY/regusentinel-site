# 08 — Experimentos comerciales: las próximas dos semanas

> ⛔ **SUPERSEDIDO el 22-sep-2026 por
> [`11-CURRENT-DECISION-BRIEF.md`](11-CURRENT-DECISION-BRIEF.md) §G**, que
> contiene el **plan de 14 días autoritativo**. Este documento se conserva por su
> detalle sobre el **diseño de cada experimento** (coste, método, umbrales de
> decisión), pero **si el calendario de §G difiere del de aquí, manda §G**.

> **Fecha de inicio:** 22 de septiembre de 2026
> **Fecha de cierre:** 6 de octubre de 2026 (coincide con el IV Fórum PANASEF)
>
> **Propósito:** convertir en datos las hipótesis que el resto de documentos han
> dejado abiertas. No construir producto. No refactorizar. **Medir.**

---

## Por qué exactamente estos experimentos

HEREDIA lleva 366 commits y ~5,5 meses de construcción con **cero datos de
mercado**. El riesgo dominante del proyecto dejó de ser técnico hace tiempo.

Cada experimento de abajo cumple tres condiciones: **se ejecuta en menos de dos
semanas**, **cuesta poco o nada**, y **su resultado cambia una decisión
concreta**. Los que no cumplían las tres se han quedado fuera.

---

## BLOQUE 0 — Desbloqueo (días 1-3)

No son experimentos: son las puertas que hoy están cerradas. **Sin esto, ningún
experimento posterior puede ejecutarse.**

| # | Acción | Tiempo | Por qué bloquea |
|---|---|---|---|
| **B1** | **Registrar el dominio definitivo** y actualizar `layout.tsx:7`, `sitemap.ts:7`, `robots.ts:20` | 1 h | `heredia.app` no resuelve. **Sin dominio no hay sitio, y sin sitio no hay nada** |
| **B2** | **Eliminar los testimonios sintéticos** de `portal-familia/page.tsx:296-322` | 10 min | Práctica comercial desleal prohibida en la UE. Doc. 07 §1 |
| **B3** | **Enlazar `/precios` → `/register`** en `pricing-table.tsx:145` | **1 línea** | El embudo self-service existe y está desconectado. Doc. 01 §3.1 |
| **B4** | **Etiquetar todo output de IA** en la interfaz | 1 h | Art. 50 del Reglamento de IA, **exigible desde el 02-08-2026** |
| **B5** | **Rediseño anti-falsedad del PDF 650/651**: título "Resumen de datos para cumplimentar…", marca de agua, sin escudos ni códigos | 1 día | Arts. 390/392 CP. Doc. 07 §2 |
| **B6** | **Textos legales con identidad real + publicar el DPA** | 2 días | Descalificatorio ante cualquier comprador colegiado |
| **B7** | **Publicar el sitio** | 2 h | — |

**Criterio de salida del bloque 0:** el sitio está en línea, un desconocido puede
registrarse y abrir un expediente sin hablar con nadie, y no hay ninguna
afirmación falsa publicada.

---

## EXPERIMENTO 1 — Cuánto cuesta realmente un expediente con IA

**La hipótesis:** el análisis de márgenes del documento 03 §7.3 descansa en un
supuesto propio de 200.000 tokens de entrada y 30.000 de salida por expediente.
De ese número depende si el plan alto tiene **36 % o 74 %** de margen bruto.

**Es el único número de todo el análisis convertible de estimación en hecho en dos
horas.**

**Cómo:**
1. Coger un expediente realista (el sembrado por `sample-case-seeder.ts` sirve, o
   uno anonimizado).
2. Pasarlo por el pipeline completo: `case-analyzer`, `autopilot`, `smart-tasks`,
   `progress-report`, `doc-request-generator`.
3. Contar tokens reales de entrada y salida en cada llamada.
4. Repetir con caché activada para medir el ahorro del *prompt caching*.

**Coste:** 2 horas + unos céntimos de API.

**Qué decide:**

| Resultado | Decisión |
|---|---|
| < 0,50 €/expediente | La IA se incluye sin cupo. El plan alto no tiene problema de margen |
| 0,50 - 1,50 €/expediente | **Cupo de IA por plan** + paquetes adicionales, como propone el doc. 03 §15.1 |
| > 1,50 €/expediente | Cascada obligatoria (Haiku para extracción, Opus sólo para razonamiento) **antes** de vender el plan alto |

---

## EXPERIMENTO 2 — Doce entrevistas de descubrimiento

**El experimento más importante de los ocho.** Responde de una vez a las tres
incógnitas que bloquean el pricing y el portfolio.

**Las tres preguntas que tienen que quedar contestadas:**

1. **¿Cuántos expedientes de herencia tramita al año una gestoría española?**
   → Determina si la métrica de valor propuesta está bien calibrada (doc. 03 §5).
2. **¿Cuántos tiene abiertos *ahora mismo*?**
   → Calibra los escalones de "expedientes activos" (3 / 15 / negociado).
3. **¿Qué parte del proceso duele de verdad?**
   → Confirma o refuta la tesis central: *el trabajo caro es coordinar, no calcular*.

**Cómo:**
- Lista de 100 gestorías del **Registro de Gestores Administrativos** (público y
  gratuito).
- Contacto por **LinkedIn o teléfono — nunca email frío** (art. 21 LSSI, doc. 05 §3).
- **Las 21 preguntas del documento 03 §4.3**, sin desviarse. Nada de "¿pagarías X?".
- 25 minutos por conversación.

**Meta:** **12 entrevistas completas.** La evidencia académica sitúa la saturación
de códigos en la entrevista 12, con el 80 % de los códigos ya presentes en las 6
primeras **[CONFIRMADO: Guest, Bunce & Johnson, 2006]**. Si a la duodécima no se
oye nada nuevo, parar.

**Coste:** ~10 horas.

**Qué decide:**

| Si los expedientes/año resultan… | Entonces |
|---|---|
| **< 20** | El plan de entrada debe bajar de 149 € **o** incluir mucho más valor. El mercado es más pequeño de lo previsto |
| **20-80** | La propuesta del doc. 03 §15.1 es correcta tal cual |
| **> 80 con frecuencia** | Existe un segmento especialista real: el tercer plan vuelve, y a precio alto |

---

## EXPERIMENTO 3 — ¿Convierte la página de precios cuando deja comprar?

**La hipótesis:** los tres botones de `/precios` llevan hoy a `/#demo`, existiendo
registro self-service con trial de 14 días. **Cada visitante con intención se
convierte en un lead que hay que trabajar a mano.**

**Cómo:** tras B3, medir durante 14 días: visitas a `/precios`, clics en el CTA,
registros completados, expedientes creados en los 7 días siguientes.

**Coste:** ~0 (la instrumentación de `DemoRequest.source` ya existe en el
esquema).

**Qué decide:** si la ratio visita→registro supera el 3 %, el autoservicio es un
canal real y **la demanda de demo deja de ser el único camino**. Si no llega al
1 %, el problema no es el botón: es el mensaje.

**Advertencia honesta:** con el sitio recién publicado el tráfico será
mínimo. Este experimento probablemente **no producirá significancia en 14 días**.
Se instrumenta ahora y se lee en 60. Se incluye porque el coste es una línea.

---

## EXPERIMENTO 4 — La oferta de Socio Fundador

**La hipótesis a validar no es "¿les gusta?" sino "¿pagan?".**

**La oferta** (detalle en doc. 03 §13):
- **Señal de 300 €**, íntegramente acreditable al primer año
- Precio de lista completo y público — **nunca descontar el precio, regalar tiempo**
- **3 meses gratis** al arrancar
- **Puesta en marcha gratuita**
- **Precio congelado 24 meses**
- A cambio: una sesión de feedback al mes, caso de estudio y derecho a citarlos
- **10 plazas, con fecha de cierre**

**Cómo:** ofrecerla al final de cada entrevista del experimento 2, con la
pregunta 21 tal cual está redactada. **Si dice que sí, sacar el enlace de pago en
ese momento.** Si dice "hablamos", la respuesta real es no.

**Meta a 14 días:** **3 señales cobradas** de 12 entrevistas.

**Coste:** ~0.

**Qué decide:**

| Señales cobradas | Lectura |
|---|---|
| **≥3** | Hay disposición a pagar. Seguir con el precio propuesto |
| **1-2** | Señal débil: el problema existe pero la solución no convence todavía. Volver a las entrevistas |
| **0** | **Parar y replantear.** O el ICP está mal elegido, o el problema no duele lo suficiente, o el producto no lo resuelve como se cree |

> **Éste es el dato que no miente.** Van Westendorp y Gabor-Granger miden
> percepción; una transferencia de 300 € mide intención.

---

## EXPERIMENTO 5 — Van Westendorp ligero

**Sólo si el experimento 2 va bien.** Es la red de seguridad, no el decisor.

**Cómo:** formulario de 4 preguntas (redacción exacta en doc. 03 §4.1) enviado a
los contactos de LinkedIn que **no** llegaron a entrevista. Preguntar por **precio
mensual por despacho**, nunca por usuario.

**Meta:** **40 respuestas** — el suelo técnico del método. Objetivo deseable
60-80 **[CONFIRMADO]**.

**Coste:** 2 horas de montaje.

**Qué decide:** si 349 € cae dentro del rango [PMC, PME], el precio se mantiene.
Si cae fuera, hay que investigar por qué **antes** de cambiarlo — el método mide
percepción de precio justo, no presupuesto.

**Limitación que hay que asumir:** en B2B, quien responde a menudo no es quien
firma, y el encuestado responde en el vacío competitivo. **Úsese para detectar
disparates, no para elegir el número.**

---

## EXPERIMENTO 6 — Dos eventos con fecha inamovible

No es un experimento de laboratorio: es la mayor concentración de compradores
disponible, y no se repite.

| Evento | Fecha | Acción |
|---|---|---|
| **IV Fórum PANASEF** (Tarragona) | **6-7 oct** — 14 días | **Asistir.** ~300 profesionales, ~65 % del sector, **bienal: el siguiente es 2028**. Objetivo secundario: averiguar quién opera los servicios de herencias de las aseguradoras (hueco nº 2 del doc. 05) |
| **VIII Congreso Nacional de GA** (Palma) | **22-24 oct** — 30 días | **Escribir hoy** al Colegio de Baleares por patrocinio/sesión — **y preguntar cuántos inscritos son gestores colegiados**. El organizador prevé ~1.500 personas, pero la cita incluye acompañantes, otras profesiones y personal de administraciones: **cuántos son compradores es DESCONOCIDO**. Las herencias **no** están en la agenda: proponer sesión |

**Coste:** viaje y alojamiento; patrocinio **[tarifas no públicas — DESCONOCIDO]**.

**Qué decide:** 30 conversaciones y 10 demos agendadas en Palma valdrían más que
dos meses de contacto en frío.

---

## EXPERIMENTO 7 — Cronometrar un expediente Managed

**La hipótesis:** `Heredia Managed` se vende a **490 €/expediente** sin ningún
modelo de costes. A 30 expedientes/mes genera 9.900 €/mes — **trece veces** el
mejor plan de software (doc. 06 §7). Es la decisión estratégica más importante
pendiente y **no hay un solo dato que la sostenga**.

**Cómo:** ofrecer a **un** cliente fundador operar su expediente completo. Cronometrar
cada fase: intake, recogida documental, cálculo, pack banco, comunicación.

**Coste:** el tiempo del fundador — que es exactamente el punto: hay que saber
cuánto es.

**Qué decide:**

| Horas reales | Coste a 35 €/h | Margen a 490 € | Decisión |
|---|---|---|---|
| < 6 h | < 210 € | > 57 % | Managed es viable como producto |
| 6-10 h | 210-350 € | 29-57 % | Viable **sólo como BPO** con cupo estricto |
| > 10 h | > 350 € | < 29 % | **Retirar o reprecificar** |

**Beneficio secundario, quizá mayor que el primario:** operar un expediente real
responde de una vez a las horas por expediente, al coste real de IA y a qué
funcionalidad falta de verdad. **Es la investigación de producto más barata
disponible.**

---

## EXPERIMENTO 8 — Inteligencia competitiva sobre los dos precios opacos

**La hipótesis:** los dos competidores más peligrosos no publican precio.

| Objetivo | Cómo | Por qué importa |
|---|---|---|
| **`a3ASESOR\|her`** (Wolters Kluwer) | Pedir presupuesto a dos partners (Esofitec, Linksoluciones) como despacho interesado | Es el incumbente con ventaja de integración: importa el inventario de bienes desde el módulo de IRPF que la asesoría ya usa |
| **FunerFlow** | Contacto comercial | Entrante español 2026 con módulo de herencias para funerarias |
| **Ulpiano** | Registro Mercantil, notas de prensa, LinkedIn | Clientes reales, financiación y plantilla. Calibra la urgencia |

**Coste:** 3 horas.

---

## Cuadro de mando de los 14 días

| # | Experimento | Coste | Meta | Decide |
|---|---|---|---|---|
| **B0** | Desbloqueo (7 acciones) | 4-5 días | Sitio publicado sin afirmaciones falsas | Todo lo demás |
| **1** | Coste real de IA/expediente | 2 h | Cifra medida | Arquitectura de planes y cupos |
| **2** | **12 entrevistas** | 10 h | 12 completas | **Pricing, métrica de valor y portfolio** |
| **3** | Instrumentar `/precios`→`/register` | 1 línea | Medición activa | Si el autoservicio es un canal |
| **4** | **Socio Fundador** | 0 | **3 señales de 300 €** | **Si existe disposición a pagar** |
| **5** | Van Westendorp | 2 h | 40 respuestas | Si 349 € está en rango |
| **6** | PANASEF (6-7 oct) + escribir a Palma | Viaje | 20 conversaciones | Canal de eventos |
| **7** | Cronometrar 1 expediente Managed | 1 expediente | Horas reales | **Software vs servicio** |
| **8** | Precios de a3\|her y FunerFlow | 3 h | 2 presupuestos | Posicionamiento |

---

## Los tres números que definen el éxito de estas dos semanas

1. **3 señales de 300 € cobradas.** Es el único dato que no admite interpretación.
2. **12 entrevistas completadas**, con la distribución real de expedientes/año.
3. **El coste medido de IA por expediente.**

Con esos tres números, el pricing de HEREDIA deja de ser una hipótesis y pasa a
ser una decisión informada. **Sin ellos, cualquier precio que se fije —149, 349 o
749— sigue siendo una apuesta**, por muy bien razonada que esté.

---

## Lo que deliberadamente NO se hace estas dos semanas

Se dice explícitamente porque la tentación es real y el historial del proyecto la
confirma:

- **No construir el cuaderno particional**, ni el árbol genealógico, ni el OCR de
  escrituras, ni los festivos autonómicos. Son preguntas para las entrevistas, no
  tareas del backlog.
- **No construir el módulo PBC todavía.** Es la mejor oportunidad identificada
  (doc. 04 §6), y por eso merece validarse antes: preguntar en las 12 entrevistas
  si llevan la diligencia debida a mano.
- **No refactorizar nada.** El producto tiene 112 ficheros de test y 121 rutas de
  API. Está suficientemente bien construido. **El cuello de botella no es el
  código.**
- **No rehacer el modelo financiero.** Se rehace cuando haya clientes que modelar.
- **No perseguir funerarias ni abogados.** Un ICP, seis meses (doc. 04 §7.1).
