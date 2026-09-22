# 10 — Auditoría de afirmaciones y evidencia

> **Fecha:** 22 de septiembre de 2026
> **Propósito:** determinar qué conclusiones de `docs/business/` son lo bastante
> fiables como para actuar sobre ellas, y cuáles no. **Este documento intenta
> falsar activamente el análisis anterior, incluido su hallazgo principal.**
>
> **Resultado en una línea:** se han encontrado **tres errores materiales** y
> **siete sobreafirmaciones** en los documentos 00-08. La conclusión central
> ("los precios no son el problema") **no sobrevive intacta**: sobrevive
> degradada y con una condición que la invierte para el ICP real.

---

## 1. Método y limitaciones de esta auditoría

### Qué se ha hecho

Cada afirmación con capacidad de cambiar una decisión de negocio se ha
re-verificado **contra la fuente original**, no contra mi propio resumen
anterior. Donde la fuente es el repositorio, se ha vuelto a leer el fichero.
Donde es externa, se ha vuelto a consultar la página pidiendo **cita literal**,
no paráfrasis.

### Limitación metodológica que afecta a toda la investigación previa

**La herramienta de consulta web devuelve la lectura que un modelo hace de la
página, no el HTML en bruto.** Esto no es una observación teórica: al re-consultar
la página de precios de Ulpiano pidiendo cita literal, aparecieron **dos datos
que la primera consulta omitió** y que resultan decisivos:

1. que los precios están etiquetados **"facturado anualmente"**;
2. que existe un **−15 % para colegiados de cualquier colegio profesional**.

> **Consecuencia:** toda cifra externa de los documentos 02-07 que no haya sido
> re-verificada con cita literal en esta auditoría debe tratarse como **un grado
> de confianza inferior al que declara**. Las que sí se han re-verificado están
> marcadas **[RE-VERIFICADO 22-sep-2026]**.

### Escala de evidencia usada

| Nivel | Definición |
|---|---|
| **HECHO VERIFICADO** | Cita literal de fuente primaria, o lectura directa del código. Falsable y comprobable por un tercero en minutos |
| **INFERENCIA FUERTE** | Se sigue de hechos verificados con un solo paso lógico y sin supuestos ocultos relevantes |
| **INFERENCIA DÉBIL** | Requiere encadenar varios pasos, o descansa en una fuente secundaria, o admite explicaciones alternativas razonables |
| **SUPUESTO** | Cifra elegida, no medida. Puede ser razonable y seguir siendo arbitraria |
| **HIPÓTESIS A TESTAR** | Afirmación sobre el comportamiento futuro de clientes que no existen |

---

## 2. LA FALSACIÓN CENTRAL: *"Los precios de HEREDIA no son el problema"*

Ésta era la conclusión de titular del documento 03 y del resumen ejecutivo. El
encargo pedía explícitamente atacarla. **Se sostiene sólo en parte, y contiene un
error de cálculo.**

### 2.1 Error material nº 1 — la comparación estaba mal construida

**[RE-VERIFICADO 22-sep-2026]** La página de Ulpiano muestra un selector
**"Mensual | Anual −15 %"**, y los precios publicados llevan la coletilla literal
**"169€/mes facturado anualmente"**.

**Los documentos 02, 03 y 00 compararon el precio MENSUAL de HEREDIA con el
precio ANUAL de Ulpiano.** Comparación inválida.

Comparación corregida:

| Escalón | HEREDIA mensual | Ulpiano mensual *(inferido: 169/0,85)* | Δ | HEREDIA anual | Ulpiano anual | Δ |
|---|---|---|---|---|---|---|
| Inicia / Esencial | 149 € | ~199 € | **−25 %** | 1.490 € | 2.028 € | **−27 %** |
| Despacho / Avanzado | 349 € | ~449 € | **−22 %** | 3.490 € | 4.584 € | **−24 %** |
| Firma / Pro | 749 € | ~999 € | **−25 %** | 7.490 € | 10.188 € | **−26 %** |

> La afirmación publicada decía **"9-13 % por debajo"**. La cifra real es
> **22-27 % por debajo**. El error infravaloraba la diferencia por un factor de
> ~2. **La dirección de la conclusión no cambia; su magnitud sí.**
>
> *(El precio mensual de Ulpiano es una **INFERENCIA FUERTE**: la página no lo
> muestra sin interactuar con el selector. 199/449/999 se deriva de aplicar el
> −15 % declarado a la inversa. Verificable en 30 segundos pulsando "Mensual".)*

### 2.2 Falsación nº 2 — para el ICP real, la ventaja de precio se evapora hoy

**[RE-VERIFICADO 22-sep-2026, cita literal]** Ulpiano publica dos descuentos
vigentes:

- **"Colegio profesional −15 % · Para colegiados de cualquier colegio profesional."**
- **"−25 % de por vida · Para los primeros 20 clientes. Hasta el 31 dic 2026."**

**El ICP que el documento 05 recomienda —gestores administrativos y abogados— es
colegiado por definición.** El primer descuento se aplica a prácticamente todo el
mercado objetivo.

Coste real del primer año, escalón medio:

| Escenario | Coste año 1 |
|---|---|
| HEREDIA Despacho anual **+ setup 299 €** | **3.789 €** |
| HEREDIA Despacho anual sin setup | 3.490 € |
| Ulpiano Avanzado anual, tarifa | 4.584 € |
| **Ulpiano Avanzado anual −15 % colegiado** | **3.896 €** → HEREDIA sólo **2,8 %** más barato |
| **Ulpiano Avanzado anual −25 % early adopter** | **3.438 €** → **HEREDIA es 10,2 % MÁS CARO** |

> **Esto invierte la conclusión durante exactamente la ventana en la que HEREDIA
> pretende vender.** La oferta de early adopter de Ulpiano expira el **31 de
> diciembre de 2026**, y el plan comercial del documento 05 concentra el esfuerzo
> entre septiembre y diciembre de 2026.
>
> **En el trimestre en que HEREDIA saldría a vender, su competidor directo es más
> barato para los 20 primeros clientes y prácticamente igual de caro para
> cualquier colegiado.**

### 2.3 Contra-falsación — dos hechos que juegan a favor de HEREDIA y que el análisis anterior no recogió

Para ser simétrico: la re-verificación también encontró evidencia en sentido
contrario, que **refuerza** la posición de HEREDIA.

**(a) Ulpiano cobra los modelos AEAT aparte en su plan de entrada.**
Cita literal del plan Esencial: **"Modelos AEAT en pago por uso (15€/modelo)"**.

| Modelos/mes | Coste real Ulpiano Esencial | HEREDIA Inicia |
|---|---|---|
| 3 | 169 + 45 = **214 €** | **149 €** (sin coste por modelo) |
| 5 | 169 + 75 = **244 €** | **149 €** |
| 10 | 169 + 150 = **319 €** | **149 €** |

**(b) Funcionalidad de Ulpiano que no existe todavía.** Cita literal: *"API
básica (próx.)"*, *"API completa con SSO/SCIM (próx.)"*, **"Cálculo de plusvalía
municipal Próx."**, *"Generación de documentos sucesorios Próx."*, *"Asistente
conversacional Próx. sept."*

> **HEREDIA tiene plusvalía municipal implementada y testeada**
> (`src/lib/plusvalia-calculator.ts`, con método real vs objetivo). Ulpiano no.
> Es una ventaja funcional verificable que el documento 02 no recogió.
>
> Y una simetría incómoda: **Ulpiano también vende API y SSO que no existen** —
> con la diferencia de que los marca "(próx.)" y HEREDIA no.

### 2.4 Veredicto sobre la afirmación central

| Formulación | Estado |
|---|---|
| ~~"Los precios de HEREDIA no son el problema"~~ | **FALSADA como estaba formulada** |
| "HEREDIA está un 22-27 % por debajo de la tarifa pública de su competidor directo" | **INFERENCIA FUERTE** |
| "Por tanto el mercado pagará 149/349 €" | **NO SE SIGUE.** Ver §2.5 |
| "Frente a un colegiado con descuento, la ventaja de precio de HEREDIA es de ~3 %, y negativa frente a la oferta de early adopter" | **INFERENCIA FUERTE**, y es el dato operativo relevante |

### 2.5 El error lógico de fondo, dicho explícitamente

**El precio publicado de un competidor demuestra que ese competidor eligió ese
precio. No demuestra nada más.**

En concreto, **no demuestra**:

- que alguien lo pague;
- cuántos lo pagan;
- que sea rentable;
- que sea óptimo;
- que HEREDIA pueda capturarlo sin la marca, las referencias y el canal de ese competidor;
- que el mercado tenga capacidad para dos proveedores a ese precio.

Ulpiano muestra **~12 logotipos de clientes**, sin verificación independiente, con
sesgo geográfico catalán, y ofrece **−25 % de por vida a sus 20 primeros
clientes**. Esa última oferta es en sí misma **evidencia de que Ulpiano todavía
está buscando sus primeros 20 clientes** — es decir, **evidencia de que el precio
de tarifa tampoco está validado por ellos**.

> **La comparación con Ulpiano no valida el precio de HEREDIA. Valida que dos
> empresas sin tracción demostrada han elegido números parecidos.** Eso es
> información, pero es información mucho más débil de lo que el documento 03
> afirmó.
>
> **Reformulación defendible:** *"No hay evidencia de que 149/349 € esté fuera de
> la banda que el mercado considera plausible, y bajar precio empeoraría
> mecánicamente el umbral de clientes. Pero no existe ninguna evidencia de que
> alguien pague esa cantidad, ni de HEREDIA ni de su competidor."*

---

## 3. Auditoría de afirmaciones, por área

Formato: **AFIRMACIÓN · FUENTE · TIPO · FECHA · EVIDENCIA EXACTA · CONFIANZA ·
QUÉ PRUEBA · QUÉ NO PRUEBA · IMPLICACIÓN**

---

### 3.1 PRECIOS Y PRODUCTO DE ULPIANO

**AFIRMACIÓN:** Ulpiano publica Free 0 € / Esencial 169 € / Avanzado 382 € / Pro 849 €, sin cuota de alta, −15 % anual, sin permanencia, back-office desde 850 €/paquete.
**FUENTE:** ulpiano.es/precios · **TIPO:** Fuente primaria (página del fabricante) · **FECHA:** consultada 21 y 22-sep-2026
**EVIDENCIA EXACTA:** *"0€/mes"*, *"Gratis, sin tarjeta"*, *"169€/mes facturado anualmente"*, *"382€/mes facturado anualmente"*, *"849€/mes facturado anualmente"*, *"–15%"*, *"No hay permanencia"*, *"Precios sin IVA"*, *"desde 850€/paquete"*. Setup: **NOT PRESENT**.
**CONFIANZA:** **HECHO VERIFICADO** [RE-VERIFICADO]
**QUÉ PRUEBA:** Que existe un competidor directo español con precios públicos en esa banda, sin setup y con plan gratuito.
**QUÉ NO PRUEBA:** Que tenga clientes a esos precios; que sean rentables; que sean los precios efectivamente cobrados (los descuentos sugieren que no).
**IMPLICACIÓN:** Es el mejor punto de referencia disponible. **No es validación de precio.**

---

**AFIRMACIÓN:** *"HEREDIA está un 9-13 % por debajo de Ulpiano en cada escalón"* (docs 00, 02, 03).
**FUENTE:** cálculo propio · **TIPO:** Aritmética sobre datos mal alineados · **FECHA:** 21-sep-2026
**EVIDENCIA EXACTA:** Se comparó 149 vs 169, 349 vs 382, 749 vs 849 — precio mensual de HEREDIA contra precio **anual** de Ulpiano.
**CONFIANZA:** **ERROR MATERIAL — AFIRMACIÓN RETIRADA**
**QUÉ PRUEBA:** Nada. La comparación no era válida.
**QUÉ NO PRUEBA:** —
**IMPLICACIÓN:** **Corregir en los documentos 00, 02 y 03.** La cifra correcta es 22-27 %.

---

**AFIRMACIÓN:** Ulpiano ofrece −15 % a colegiados y −25 % de por vida a sus 20 primeros clientes hasta el 31-dic-2026.
**FUENTE:** ulpiano.es/precios · **TIPO:** Primaria · **FECHA:** 22-sep-2026
**EVIDENCIA EXACTA:** *"Colegio profesional–15% Para colegiados de cualquier colegio profesional."* · *"–25% de por vida · Para los primeros 20 clientes. Hasta el 31 dic 2026"*
**CONFIANZA:** **HECHO VERIFICADO** [RE-VERIFICADO]
**QUÉ PRUEBA:** Que el precio efectivo de Ulpiano para el ICP de HEREDIA es ~15-25 % inferior a su tarifa. **Y que Ulpiano aún no tiene 20 clientes**, o no los tenía al publicar la oferta.
**QUÉ NO PRUEBA:** Cuántas de esas 20 plazas quedan.
**IMPLICACIÓN:** **Alta.** Anula casi toda la ventaja de precio de HEREDIA frente al comprador real. Debe incorporarse a cualquier argumentario comercial.

---

**AFIRMACIÓN:** Ulpiano tiene API y SSO.
**FUENTE:** doc 02 (implícito en la tabla comparativa) · **TIPO:** Inferencia mía a partir de la primera consulta
**EVIDENCIA EXACTA:** La página dice *"API básica (próx.)"* y *"API completa con SSO/SCIM (próx.)"*
**CONFIANZA:** **AFIRMACIÓN CORREGIDA** — no existen todavía
**QUÉ PRUEBA:** Que ambos productos venden funcionalidad no construida; Ulpiano la etiqueta, HEREDIA no.
**IMPLICACIÓN:** Reduce la desventaja relativa de HEREDIA. **No justifica mantener "SSO" y "API" sin etiquetar en `/precios`** — la recomendación del doc 04 se mantiene.

---

**AFIRMACIÓN:** HEREDIA tiene cobertura de 19 CCAA frente al foco catalán de Ulpiano.
**FUENTE:** `src/lib/ccaa-content.ts` (19 fichas), `isd-calculator.ts` · **TIPO:** Lectura de código + página del competidor
**CONFIANZA:** **INFERENCIA FUERTE** en cuanto a que HEREDIA tiene 19 fichas. **INFERENCIA DÉBIL** en cuanto a que Ulpiano sólo cubra Cataluña — su material dice *"100 % normativa catalana"*, lo que afirma **profundidad**, no exclusividad.
**QUÉ PRUEBA:** Que HEREDIA tiene contenido para 19 CCAA.
**QUÉ NO PRUEBA:** **Que ese contenido esté actualizado o sea correcto.** `README.md:316` reconoce expresamente que las reglas fiscales están pendientes de revisión contra normativa vigente. Tampoco prueba que Ulpiano no cubra otras CCAA.
**IMPLICACIÓN:** **No usar como argumento de venta hasta revisar las 19 fichas.** Afirmar cobertura nacional sin haberla verificado es exactamente el riesgo del caso SAP Navarra (doc 07 §3).

---

**AFIRMACIÓN:** HEREDIA tiene plusvalía municipal y Ulpiano no.
**FUENTE:** `src/lib/plusvalia-calculator.ts` + cita *"Cálculo de plusvalía municipal Próx."*
**CONFIANZA:** **HECHO VERIFICADO** en ambos lados [RE-VERIFICADO]
**QUÉ PRUEBA:** Ventaja funcional real y comprobable hoy.
**QUÉ NO PRUEBA:** Que el cliente la valore lo suficiente para cambiar de proveedor; ni que el cálculo de HEREDIA sea correcto.
**IMPLICACIÓN:** **Hallazgo nuevo y positivo** que el doc 02 no recogió. Candidato a argumento de demo — previa verificación del cálculo.

---

### 3.2 TAMAÑO DE MERCADO Y NÚMERO DE CLIENTES POTENCIALES

**AFIRMACIÓN:** 441.270 defunciones en España en 2025.
**FUENTE:** INE, Estadística de Defunciones según la Causa de Muerte · **TIPO:** Estadística oficial · **FECHA:** datos **provisionales**; definitivos previstos dic-2026
**CONFIANZA:** **HECHO VERIFICADO** (con la salvedad de provisionalidad)
**QUÉ PRUEBA:** El tamaño del hecho generador.
**QUÉ NO PRUEBA:** **Nada sobre el mercado direccionable.** Una defunción no es un expediente tramitado por un profesional. Muchas herencias no generan ISD, no se tramitan profesionalmente, o las lleva el propio heredero.
**IMPLICACIÓN:** **Cifra de contexto, no de TAM.** No debe usarse en un deck como tamaño de mercado.

---

**AFIRMACIÓN:** ~6.000 gestores administrativos en España; 22 colegios.
**FUENTE:** Consejo General + nota de prensa del congreso · **TIPO:** Secundaria citando al Consejo · **FECHA:** sep-2026
**EVIDENCIA EXACTA:** *"más de 6.000 gestores administrativos en España"*
**CONFIANZA:** **HECHO VERIFICADO** [RE-VERIFICADO]
**QUÉ PRUEBA:** Que la profesión colegiada es pequeña y enumerable.
**QUÉ NO PRUEBA:** Cuántos **despachos** hay (varios gestores pueden compartir despacho, y un despacho es la unidad de compra, no el colegiado). **Ni cuántos tramitan herencias.**
**IMPLICACIÓN:** El TAM de cuentas es **menor** que 6.000, no igual. Sin dato sobre qué fracción tramita sucesiones, **el mercado direccionable real sigue siendo desconocido**.

---

**AFIRMACIÓN:** 83 % de las empresas del sector son de 0-2 personas (52,32 % sin asalariados + 30,73 % con 1-2).
**FUENTE:** Centro de Innovación de Despachos Profesionales, citando DIRCE · **TIPO:** **Secundaria** citando estadística oficial · **FECHA:** **artículo de abril de 2022, datos DIRCE de 2021**
**CONFIANZA:** **INFERENCIA DÉBIL por antigüedad** — se presentó como actual y tiene **5 años**
**QUÉ PRUEBA:** Que en 2021 la estructura del sector estaba muy atomizada.
**QUÉ NO PRUEBA:** La situación en 2026. El propio análisis cita que el sector **se contrajo ~7 % en tres años con >11.000 despachos cerrados**, lo que sugiere consolidación y por tanto que el porcentaje puede haber cambiado.
**IMPLICACIÓN:** La conclusión *"decide una sola persona"* es **probablemente cierta pero está peor soportada de lo que se afirmó**. Es barato refrescarla: DIRCE publica anualmente. **Debe re-consultarse antes de fijar el ICP definitivamente.**

---

**AFIRMACIÓN:** 53.998 empresas CNAE 6920.
**FUENTE:** directorio comercial (Iberinform/eInforma) · **TIPO:** **Secundaria comercial**, no INE directo · **FECHA:** no determinada
**CONFIANZA:** **INFERENCIA DÉBIL** — fuente comercial, fecha desconocida, y convive con otra cifra citada (">82.000 empresas de asesoría") que **no es comparable** porque usa otra definición de sector
**QUÉ PRUEBA:** Orden de magnitud: decenas de miles.
**QUÉ NO PRUEBA:** Un número utilizable para modelar.
**IMPLICACIÓN:** **No usar ninguna de las dos cifras en un modelo.** Si hace falta el dato, consultar DIRCE directamente.

---

### 3.3 VOLÚMENES DE CLIENTE Y DISPOSICIÓN A PAGAR

**AFIRMACIÓN:** Una gestoría pequeña tramita 10-30 herencias/año; una media 30-80; un especialista 100-300.
**FUENTE:** **Ninguna.** · **TIPO:** **Estimación propia** · **FECHA:** 21-sep-2026
**EVIDENCIA EXACTA:** No existe. El doc 03 §3 la etiquetó **[ESTIMADO]** pero la usó después como base de la tabla de ROI, del diseño de los escalones de "expedientes activos" y de la conclusión de que los topes actuales nunca se alcanzan.
**CONFIANZA:** **SUPUESTO**
**QUÉ PRUEBA:** Nada.
**QUÉ NO PRUEBA:** Nada.
**IMPLICACIÓN:** **Ésta es la incógnita más cara del análisis.** De ella dependen: la métrica de valor recomendada, los escalones 3/15, la afirmación de que los topes son decorativos, y toda la tabla de ROI. **Un único dato la resuelve, y se obtiene en las 12 entrevistas.**
> **Atenuante parcial:** los escalones de Ulpiano (**5 / 15 / 50 expedientes activos**) son una señal independiente de mercado que apunta al mismo orden de magnitud. Un proveedor que dimensiona así probablemente ha visto los datos. Eso eleva la afirmación de SUPUESTO a **SUPUESTO CORROBORADO INDIRECTAMENTE** — pero sigue sin ser un dato.

---

**AFIRMACIÓN:** Un expediente genera 500-1.500 € a una gestoría y 3.000-8.000 € a un abogado.
**FUENTE:** everly.es (jul-2026), heredary.com/precio, sabemosdeherencias.es · **TIPO:** Precios públicos de servicios B2C + artículo sectorial · **FECHA:** 2026
**CONFIANZA:** **INFERENCIA FUERTE** para el rango de **precio**; **INFERENCIA DÉBIL** para el **margen**
**QUÉ PRUEBA:** Lo que se cobra al consumidor final.
**QUÉ NO PRUEBA:** **El margen.** El argumento comercial recomendado —*"cuesta menos que el margen de un expediente al mes"*— usa **precio** como si fuera **margen**. Con 6-12 h por expediente a 25-35 €/h, el coste laboral es de 150-420 €, y sobre un expediente de 600 € el margen puede ser de 180-450 €, no 600 €.
**IMPLICACIÓN:** **El argumento de venta sigue funcionando pero hay que decirlo bien.** Formulación defendible: *"cuesta menos de lo que factura por un expediente al mes"*. Nunca "margen" sin haberlo medido.

---

**AFIRMACIÓN:** El software supone ~7,4 % de los costes operativos; un despacho de 10 personas gasta ~12.000 €/año.
**FUENTE:** estudio CopilotGestoria sobre 157 gestorías, dic-2025/ene-2026 · **TIPO:** Encuesta sectorial **publicada por un competidor de software** · **FECHA:** ene-2026
**CONFIANZA:** **INFERENCIA FUERTE** en magnitud; **con sesgo de fuente no despreciable**
**QUÉ PRUEBA:** Que existe un techo de presupuesto de software del orden de 12.000 €/año en un despacho de 10 personas.
**QUÉ NO PRUEBA:** Que ese techo sea rígido (un despacho puede pagar más si sustituye trabajo). Ni que la muestra de 157 sea representativa — es autoseleccionada y la publica una empresa con interés en la cifra.
**IMPLICACIÓN:** **Es la restricción de pricing mejor soportada del análisis.** El cálculo de que el plan alto consume el 75 % de ese presupuesto se mantiene y es el argumento más sólido para retirar Firma de la tarifa pública.

---

**AFIRMACIÓN:** HEREDIA ahorra un 20-30 % del tiempo por expediente.
**FUENTE:** `roi-calculator.ts` (constante `FACTOR_AHORRO_HORAS = 0.3`) · **TIPO:** **Constante elegida por el propio producto** · **FECHA:** —
**CONFIANZA:** **HIPÓTESIS A TESTAR**
**QUÉ PRUEBA:** Nada. Es un número escrito en un fichero.
**QUÉ NO PRUEBA:** Nada.
**IMPLICACIÓN:** **No puede afirmarse comercialmente en ninguna forma.** El *"−35 % de tiempo de gestión"* de Ulpiano tiene exactamente el mismo estatus. **Ninguna cifra de ahorro debe aparecer en material comercial hasta medirla con un cliente real.** El doc 03 §2 ya lo decía; se ratifica y se endurece.

---

**AFIRMACIÓN:** 1 error costoso cada 50 expedientes, con coste medio 1.200 €.
**FUENTE:** `roi-calculator.ts` (`PROB_ERROR_POR_EXPEDIENTE = 1/50`, `COSTE_MEDIO_ERROR = 1200`) · **TIPO:** Constantes elegidas
**CONFIANZA:** **SUPUESTO sin fuente**
**QUÉ PRUEBA:** Nada.
**IMPLICACIÓN:** La calculadora de ROI pública presenta como cálculo lo que es una invención. **Riesgo de credibilidad** ante un comprador que pregunte de dónde sale. Añadir la fuente o retirar el componente.
> **Lo que sí está probado** es la *existencia* del riesgo, no su frecuencia: **SAP Navarra 17/03/2021, 76.500 €**. Eso es un **HECHO VERIFICADO** y basta para el argumento cualitativo.

---

### 3.4 CANALES: PANASEF Y CONGRESO DE GESTORES

**AFIRMACIÓN:** *"~1.500 asistentes sobre una profesión de ~6.000 → una cuarta parte de todo el mercado en un edificio"*.
**FUENTE:** baleares-sinfronteras.com, 12-sep-2026 · **TIPO:** Nota de prensa, declaración del presidente del colegio organizador · **FECHA:** sep-2026
**EVIDENCIA EXACTA:** *"prevé reunir alrededor de 1.500 personas entre profesionales del sector, **acompañantes, representantes de otras profesiones, empresarios, autónomos y personal de las administraciones públicas**"*
**CONFIANZA:** **SOBREAFIRMACIÓN — AFIRMACIÓN DEGRADADA**
**QUÉ PRUEBA:** Que el organizador **prevé** ~1.500 asistentes **de perfiles mixtos**.
**QUÉ NO PRUEBA:** **Que haya 1.500 gestores administrativos.** La cita excluye explícitamente esa lectura: incluye acompañantes, otras profesiones, empresarios y personal de administraciones. **El número de compradores reales presentes es DESCONOCIDO.** Además es una previsión, no un registro, hecha por una fuente con interés en que la cifra sea alta.
**IMPLICACIÓN:** **El evento sigue siendo probablemente el mejor del año**, pero *"una cuarta parte del mercado en un edificio"* **debe retirarse**. No justifica un patrocinio caro sin preguntar antes cuántos gestores hay inscritos. **Pregunta concreta al colegio: ¿cuántos de los inscritos son gestores administrativos colegiados?**

---

**AFIRMACIÓN:** IV Fórum PANASEF, Tarragona, 6-7 oct 2026, ~300 profesionales, bienal.
**FUENTE:** forum.panasef.com (fechas) + fuente secundaria (asistencia) · **TIPO:** Primaria para fechas, **secundaria para asistencia y referida a la edición ANTERIOR (Bilbao 2024)** · **FECHA:** 22-sep-2026
**EVIDENCIA EXACTA:** *"los días 6 y 7 de octubre de 2026 en Tarragona"*. Asistencia en la web oficial: **NOT PRESENT**.
**CONFIANZA:** Fechas: **HECHO VERIFICADO**. Asistencia: **INFERENCIA DÉBIL** (dato de otra edición, otra ciudad, otro año).
**QUÉ PRUEBA:** Que el evento existe y es inminente.
**QUÉ NO PRUEBA:** Cuánta gente irá, ni que sean compradores.
**IMPLICACIÓN:** La recomendación de asistir se sostiene **por su bajo coste y por el ICP funerario, que el doc 04 recomienda NO perseguir todavía**. ⚠️ **Contradicción interna detectada entre documentos:** el doc 04 §7.1 dice "cero esfuerzo comercial en funerarias" y el doc 05 recomienda viajar a un congreso funerario en 14 días. **Coherencia: ir sólo si el objetivo es investigación** (cerrar el hueco de quién opera los servicios de herencias de las aseguradoras), **no venta**.

---

### 3.5 LEGALIDAD DEL EMAIL FRÍO, LINKEDIN Y TELÉFONO

**AFIRMACIÓN:** El email comercial frío está prohibido en España; no hay excepción B2B.
**FUENTE:** BOE, Ley 34/2002, art. 21, texto consolidado · **TIPO:** **Fuente primaria legislativa** · **FECHA:** última actualización 10/05/2014, en vigor desde 11/05/2014
**EVIDENCIA EXACTA:** *"Queda prohibido el envío de comunicaciones publicitarias o promocionales por correo electrónico u otro medio de comunicación electrónica equivalente que previamente no hubieran sido solicitadas o expresamente autorizadas por los destinatarios de las mismas."*
**CONFIANZA:** **HECHO VERIFICADO** [RE-VERIFICADO, cita literal del BOE]
**QUÉ PRUEBA:** Que el envío no solicitado está prohibido, sin distinguir destinatario empresa o particular.
**QUÉ NO PRUEBA:** El nivel real de persecución ni el importe de sanción esperable.
**IMPLICACIÓN:** **Se mantiene íntegra.** Es la afirmación legal mejor soportada del análisis.

---

**AFIRMACIÓN:** *"LinkedIn carece de esa restricción / la exposición es materialmente menor"* (doc 05 §3).
**FUENTE:** interpretación propia · **TIPO:** **Inferencia mía**, etiquetada [ESTIMADO] pero usada como recomendación operativa
**EVIDENCIA EN CONTRA:** el art. 21 dice **"por correo electrónico u otro medio de comunicación electrónica equivalente"**. **Un mensaje directo comercial en LinkedIn es defendiblemente "un medio de comunicación electrónica equivalente".**
**CONFIANZA:** **INFERENCIA DÉBIL — RECOMENDACIÓN DEGRADADA**
**QUÉ PRUEBA:** Nada. No he localizado ninguna resolución de la AEPD que resuelva si LinkedIn entra o no en el art. 21.
**IMPLICACIÓN:** **El canal principal recomendado en el doc 05 descansa en una interpretación legal no verificada.** Mitigación práctica y barata: usar LinkedIn para **conectar y conversar**, no para enviar un mensaje publicitario no solicitado; la solicitud de conexión y el intercambio conversacional no son equiparables a una comunicación comercial. **[VALIDAR con abogado antes de escalar el volumen.]**

---

**AFIRMACIÓN:** *"El teléfono es viable: el comprador es un profesional colegiado con número público"* (doc 05 §3).
**FUENTE:** Ley 11/2022 General de Telecomunicaciones, art. 66.1.b + Circular AEPD 1/2023 · **TIPO:** Legislativa + circular
**EVIDENCIA:** El art. 66 reconoce el derecho de los usuarios finales a no recibir llamadas comerciales no deseadas **"salvo que exista consentimiento previo del usuario o que la comunicación pueda ampararse en otra base de legitimación"** de la normativa de protección de datos.
**CONFIANZA:** **INFERENCIA DÉBIL — RECOMENDACIÓN DEGRADADA**
**QUÉ PRUEBA:** Que la llamada comercial **no está prohibida per se**: el interés legítimo puede amparar la llamada B2B.
**QUÉ NO PRUEBA:** Que HEREDIA pueda llamar sin más. Requiere **análisis de interés legítimo documentado**. Y aparece un requisito nuevo no recogido en el doc 05: **desde octubre de 2026 se exige un prefijo identificable para llamadas comerciales** — es decir, **este mes**. La aplicación al B2B puro no está clara en las fuentes consultadas.
**IMPLICACIÓN:** **Los dos canales de contacto en frío recomendados en el doc 05 están peor soportados de lo que se afirmó.** No los invalida, pero **exige validación legal antes de construir el plan comercial sobre ellos.** Alternativas sin esta exposición: eventos (§3.4), referencias, convenios con asociaciones y el widget embebible.

---

### 3.6 BENCHMARKS DE CONVERSIÓN Y TARJETA EN EL TRIAL

**AFIRMACIÓN:** Prueba con tarjeta obligatoria convierte 25-35 %; sin tarjeta 4-6 %. *"Cinco veces más — la única palanca con evidencia cuantificada."*
**FUENTE:** ChartMogul, *SaaS Conversion Report* · **TIPO:** **Encuesta autoinformada** vía Typeform, distribuida por email, Slack y redes sociales · **FECHA:** datos ene-2026, publicado 04-feb-2026 · **MUESTRA:** 200 productos B2B
**EVIDENCIA EXACTA:** *"Free trials that require a credit card see 30% free-to-paid conversion – more than 5x ones that don't require one."* Tabla: con tarjeta *"GOOD is 25%-35% and GREAT is 50%-60%"*; sin tarjeta *"4-6% and 10-15% good and great respectively"*.
**CONFIANZA:** La **cita** es **HECHO VERIFICADO** [RE-VERIFICADO]. La **conclusión que extraje** es **INFERENCIA DÉBIL**.
**QUÉ PRUEBA:** Que, entre 200 productos autoseleccionados que respondieron a una encuesta, los que piden tarjeta reportan mayor conversión **de trials iniciados a pago**.
**QUÉ NO PRUEBA — y esto es decisivo:**
1. **Causalidad.** Pedir tarjeta **selecciona** compradores de alta intención; no los **crea**. El 5× puede ser enteramente efecto de selección.
2. **El denominador.** Mide conversión de *trials iniciados*, **no de visitantes**. Pedir tarjeta **reduce drásticamente cuántos trials empiezan**. Si corta los inicios un 80 % y multiplica la conversión por 5, **el resultado neto es cero**.
3. Representatividad: encuesta autoinformada y autoseleccionada, con sesgo evidente hacia quien tiene buenos números que reportar.
**IMPLICACIÓN:** **Retirar la formulación *"la única palanca con evidencia cuantificada (5×)"***. Es un dato interesante, no una palanca demostrada. **Y choca frontalmente con la recomendación de crear un plan gratuito sin tarjeta** (doc 03 §15.1, doc 04 §8) — otra **contradicción interna** entre documentos que hay que resolver a favor del plan gratuito, porque el objetivo en esta fase es **aprender**, no maximizar la conversión de un embudo que todavía no tiene tráfico.

---

### 3.7 CAC, CHURN, UMBRAL DE CLIENTES Y MODELO A 36 MESES

**AFIRMACIÓN:** CAC de 120 €/cliente (escenario conservador) y 0 € (escenario stretch).
**FUENTE:** `financial-model.ts`, constantes `cacPerNewCustomer` · **TIPO:** Constantes elegidas por el propio proyecto
**CONFIANZA:** **SUPUESTO.** El de 0 € es además **imposible**, como ya señaló el doc 06.
**QUÉ PRUEBA:** Nada.
**CONTEXTO EXTERNO:** El único anclaje hallado es *"CAC de vertical SaaS por debajo de 5.000 $ en todas las categorías"* (Tidemark, vía fuente secundaria) — **INFERENCIA DÉBIL**, y tan amplio que no restringe nada.
**IMPLICACIÓN:** Ninguna conclusión que dependa del CAC es accionable. **Afortunadamente el umbral de clientes (§4) no depende del CAC.**

---

**AFIRMACIÓN:** Churn mensual realista de 4-6 % en los primeros 18 meses.
**FUENTE:** rangos de agregadores; ChartMogul por banda de ARPA · **TIPO:** **Secundaria**, y el propio informe de investigación la etiquetó **[DESCONOCIDO]** para Europa/servicios profesionales
**CONFIANZA:** **SUPUESTO**
**QUÉ PRUEBA:** Nada específico de este mercado.
**QUÉ NO PRUEBA:** El churn de HEREDIA. Hay además un argumento estructural en sentido contrario que ninguna fuente captura: **un expediente de herencia dura 6-12 meses**, así que un cliente con expedientes abiertos **no puede irse sin migrar trabajo en curso**. El churn real podría ser sustancialmente menor que el benchmark genérico.
**IMPLICACIÓN:** **No planificar sobre ningún número de churn.** Medir cohortes propias.

---

**AFIRMACIÓN:** El escenario conservador nunca alcanza caja positiva en 36 meses y requiere 173.756 €; su docstring promete break-even en el mes 28-32.
**FUENTE:** ejecución directa de `financial-model.ts` sin alterar constantes · **TIPO:** **Cálculo reproducible sobre el código del repositorio**
**CONFIANZA:** **HECHO VERIFICADO** (aritmética reproducible)
**QUÉ PRUEBA:** Que **el modelo, con sus propios supuestos, produce ese resultado**, y que **la documentación del modelo no coincide con su salida**.
**QUÉ NO PRUEBA:** **Absolutamente nada sobre el futuro de HEREDIA.** Es un modelo cuyas entradas son todas supuestos. Su valor es **diagnóstico** (revela fragilidad y una inconsistencia documental), no **predictivo**.
**IMPLICACIÓN:** La acción que se deriva —corregir el docstring y no usar el escenario stretch— es **sólida**. Cualquier uso del modelo para planificar captación de capital **no lo es**.

---

## 4. El umbral de ~24 clientes, recalculado desde primeros principios

El encargo pide la derivación explícita. Aquí está, con sus supuestos a la vista.

### 4.1 Las fórmulas

```
(1)  ARPA = Σ(precio_plan_i × mix_i) / Σ(mix_i)

(2)  Contribución por cliente:  C = ARPA − CosteVariable

(3)  Umbral de clientes:  N = ⌈ OPEX_fijo_mensual / C ⌉
```

**Lo que (3) significa exactamente, y que el documento 06 no explicitó:** N es el
número de clientes en **estado estacionario** que cubre el OPEX fijo **ignorando
el CAC**. Es decir, **N supone que no se está adquiriendo ningún cliente nuevo**.
En cuanto hay adquisición, el umbral real es mayor. **N es un suelo, no un
objetivo.**

### 4.2 El cálculo publicado

```
ARPA = (149×55 + 349×38 + 749×7) / 100
     = (8.195 + 13.262 + 5.243) / 100
     = 26.700 / 100
     = 267,00 €/mes

C    = 267 − 50 = 217 €/mes

N    = ⌈5.000 / 217⌉ = ⌈23,04⌉ = 24 clientes        ✓ coincide con lo publicado
```

### 4.3 Los tres supuestos que sostienen el número — y su fragilidad

**Supuesto 1: el mix de planes es 55/38/7.** Con cero clientes, esto es una
invención. Sensibilidad:

| Mix supuesto | ARPA | C (vc=50) | **N (OPEX 5.000)** |
|---|---|---|---|
| 100 % Inicia | 149 € | 99 € | **51 clientes** |
| **Repo (55/38/7)** | **267 €** | **217 €** | **24 clientes** |
| 50/50 Inicia-Despacho | 249 € | 199 € | 26 clientes |
| 100 % Despacho | 349 € | 299 € | 17 clientes |

> **El umbral varía entre 17 y 51 clientes según un supuesto sin ningún dato
> detrás.** Y el plan de entrada suele captar la mayoría de clientes iniciales,
> lo que empuja hacia el extremo alto.

**Supuesto 2: coste variable de 50 €/cliente/mes.** El doc 06 §6 ya lo cuestionó.
Sensibilidad:

| OPEX/mes | vc = 25 € | **vc = 50 €** | vc = 100 € |
|---|---|---|---|
| 1.200 € (fundador sin sueldo) | 5 | **6** | 8 |
| 2.500 € (autónomo + gastos) | 11 | **12** | 15 |
| **5.000 € (modelo, Y1)** | 21 | **24** | 30 |
| 14.000 € (modelo, Y2) | 58 | **65** | 84 |

**Supuesto 3: OPEX fijo de 5.000 €/mes**, que incluye *"payroll fundador
mínimo"*. Es una **decisión**, no un dato.

### 4.4 Veredicto sobre el umbral

| Afirmación | Estado |
|---|---|
| *"Hacen falta 24 clientes"* | **SOBREAFIRMACIÓN.** Es exacto **sólo** bajo tres supuestos simultáneos, uno de los cuales (el mix) no tiene ningún dato |
| *"El umbral está entre 6 y 51 clientes según estructura de costes y mix"* | **HECHO VERIFICADO** (aritmética reproducible) |
| *"El orden de magnitud son decenas de clientes, no cientos ni miles"* | **INFERENCIA FUERTE** y **robusta a todos los supuestos probados** |

> **Lo que sobrevive, y es lo que importa:** con esta estructura de precios,
> HEREDIA necesita **decenas de clientes, no miles**. Esa conclusión es robusta y
> **sí es accionable**: define un negocio alcanzable por venta directa de un
> fundador, y descarta cualquier estrategia que requiera volumen.
>
> **Formulación recomendada para sustituir a "24 clientes":**
> *"Entre 6 y 12 clientes si el fundador no se paga sueldo; entre 20 y 50 con
> sueldo y estructura mínima."*

---

## 5. Clasificación consolidada

### HECHO VERIFICADO — actuable hoy

| # | Afirmación |
|---|---|
| 1 | `heredia.app` no resuelve en DNS; está cableado como URL canónica en tres ficheros |
| 2 | Cero clientes, cero expedientes reales (`README.md:6-9`) |
| 3 | Los testimonios de `/portal-familia` son sintéticos (el propio comentario del código lo dice) y el descargo afirma un origen que no existe |
| 4 | Los tres CTA de `/precios` apuntan a `/#demo`; existe registro self-service con trial de 14 días (`register/route.ts:11`) |
| 5 | SAML: cero referencias en el repositorio. No existe modelo `ApiKey`. El DPA no está publicado |
| 6 | Ulpiano publica 0/169/382/849 €, "facturado anualmente", sin setup, −15 % anual, **−15 % colegiados**, **−25 % de por vida a los 20 primeros hasta 31-dic-2026** |
| 7 | Ulpiano marca API, SSO, plusvalía municipal y generación documental como *"(próx.)"* — no existen |
| 8 | HEREDIA tiene plusvalía municipal implementada y testeada |
| 9 | LSSI art. 21: prohibido el envío comercial no solicitado por email o medio electrónico equivalente, sin excepción B2B |
| 10 | Congreso de Palma: 22-24 oct 2026; el organizador **prevé** ~1.500 personas **de perfiles mixtos** |
| 11 | IV Fórum PANASEF: 6-7 oct 2026, Tarragona |
| 12 | INE: 441.270 defunciones en 2025 (provisional) |
| 13 | "Más de 6.000 gestores administrativos en España" |
| 14 | El escenario conservador de `financial-model.ts` no alcanza caja positiva en 36 meses; su docstring afirma lo contrario |
| 15 | SAP Navarra 17/03/2021: 76.500 € de condena a una gestoría por una autoliquidación de ISD incorrecta |
| 16 | Art. 50 del Reglamento de IA aplicable desde 02-08-2026 |

### INFERENCIA FUERTE — actuable con la salvedad declarada

- HEREDIA está **22-27 % por debajo de la tarifa pública** de Ulpiano *(corregido)*
- **Frente a un colegiado con su descuento, esa ventaja cae a ~3 %; frente a su oferta de early adopter, HEREDIA es ~10 % más caro**
- El plan alto consume ~75 % del presupuesto de software de un despacho de 10 personas
- El umbral de clientes son **decenas, no cientos**
- La fricción de entrada de HEREDIA es peor que la del competidor (sin plan gratuito, con setup)

### INFERENCIA DÉBIL — no actuar sin verificar

- 83 % de las empresas son de 0-2 personas *(dato DIRCE de 2021)*
- ~300 asistentes al Fórum PANASEF *(edición anterior, otra ciudad)*
- 53.998 empresas CNAE 6920 *(fuente comercial, fecha desconocida)*
- LinkedIn tiene menor exposición legal que el email *(interpretación no verificada)*
- El teléfono es viable para contacto en frío B2B *(requiere análisis de interés legítimo; nuevo requisito de prefijo desde oct-2026)*
- El 5× de la tarjeta en el trial *(correlación, denominador distinto, muestra autoseleccionada)*
- Ulpiano está limitado a Cataluña *(afirma profundidad, no exclusividad)*

### SUPUESTO — no es evidencia

- Volúmenes de expedientes por perfil de cliente (10-30 / 30-80 / 100-300)
- Mix de planes 55/38/7 → y con él, el ARPA de 267 €
- Coste variable de 50 €/cliente/mes
- CAC de 120 € · churn de 4-6 % mensual
- 6-12 horas por expediente · 25-35 €/hora
- **200k/30k tokens por expediente** → y con ello **todo el análisis de margen del plan alto**

### HIPÓTESIS A TESTAR

- Que alguien pague 149 o 349 €/mes por HEREDIA
- Que HEREDIA ahorre un 20-30 % del tiempo
- Que el plan gratuito convierta
- Que el setup no mate la conversión
- Que el contacto directo funcione en este nicho
- Que `Heredia Managed` sea rentable a 490 €/expediente

---

## 6. Contradicciones internas detectadas entre documentos

| # | Contradicción | Resolución propuesta |
|---|---|---|
| 1 | Doc 04 §7.1: *"cero esfuerzo comercial en funerarias"*. Doc 05: *"asistir al Fórum PANASEF en 14 días"* | Ir **sólo como investigación**, no como venta. Objetivo declarado: cerrar el hueco sobre las aseguradoras |
| 2 | Doc 03/04 recomiendan **plan gratuito sin tarjeta**. Doc 03 §13 y 05 §5.1 destacan que **pedir tarjeta multiplica ×5 la conversión** | A favor del **plan gratuito**: en esta fase el objetivo es aprender, y el dato del ×5 no es causal (§3.6) |
| 3 | Doc 02 presenta la cobertura de 19 CCAA como diferenciador. Doc 01 §4 y `README.md:316` dicen que las reglas fiscales están **pendientes de revisión** | **No usar como argumento de venta hasta revisarlas.** Afirmar cobertura no verificada es el riesgo del caso SAP Navarra |
| 4 | Doc 06 §7 sugiere que Managed podría ser "el negocio real". Doc 04 §5.3 recomienda limitarlo a 3-5 cuentas | Sin datos de coste, prevalece **limitarlo**. Se decide tras el experimento 7 |

---

## 7. Veredicto: qué es lo bastante fiable para actuar

### ✅ ACTUAR YA — no depende de ninguna hipótesis

Todas estas acciones se sostienen sobre **HECHO VERIFICADO** y **ninguna se
invalida** si las hipótesis de mercado resultan falsas:

1. Registrar el dominio y publicar el sitio
2. **Eliminar los testimonios sintéticos**
3. Enlazar `/precios` → `/register`
4. Retirar "SSO", "API" y "DPA extendido" de la tarifa
5. Etiquetar el output de IA (obligación vigente)
6. Rediseñar el PDF del borrador 650/651
7. Publicar el DPA y los textos legales con identidad real
8. Corregir el docstring de `financial-model.ts`
9. **Revisar las 19 fichas de CCAA** antes de afirmar cobertura nacional

### ⚠️ ACTUAR CON CONDICIÓN

| Acción | Condición previa |
|---|---|
| Mantener 149/349 € | Aceptando que **no está validado**, sólo que no hay evidencia de que sea absurdo. **Y sabiendo que frente a un colegiado la ventaja de precio es ~3 %** |
| Métrica de expedientes activos | **Confirmar volúmenes en las 12 entrevistas.** Los escalones 3/15 son un supuesto |
| Contacto en frío por teléfono o LinkedIn | **Validación legal previa** (§3.5) |
| Congreso de Palma | Preguntar antes **cuántos inscritos son gestores colegiados** |
| Retirar el plan alto de la tarifa | Sólido: se apoya en el dato de presupuesto de software, que es la restricción mejor soportada |

### ⛔ NO ACTUAR — evidencia insuficiente

- Cualquier cifra de ahorro de tiempo o ROI en material comercial
- Cualquier plan que dependa del CAC o del churn supuestos
- Fijar el precio de `Heredia Managed`
- Usar el modelo a 36 meses para captar capital
- Usar "441.270 defunciones" como tamaño de mercado
- Afirmar "una cuarta parte del mercado en un edificio"
- Dimensionar el plan alto sobre un coste de IA no medido

---

## 8. Correcciones que deben aplicarse a los documentos 00-08

| Doc | Corrección |
|---|---|
| **00, 02, 03** | *"9-13 % por debajo"* → **"22-27 % por debajo de tarifa"**, añadiendo que **con el −15 % de colegiado la ventaja cae a ~3 % y con el −25 % de early adopter se invierte** |
| **00, 03** | *"Los precios no son el problema"* → **reformular** según §2.4 |
| **00, 05, 08** | *"~1.500 asistentes sobre 6.000 gestores"* → **"el organizador prevé ~1.500 personas de perfiles mixtos; el número de gestores es desconocido"** |
| **02** | Añadir que Ulpiano marca API, SSO, plusvalía y generación documental como *"(próx.)"*, y que **HEREDIA sí tiene plusvalía** |
| **02** | Añadir que el plan Esencial de Ulpiano **no incluye modelos AEAT** (15 €/modelo) |
| **02** | Datar el 83 % de DIRCE como **datos de 2021** |
| **03, 05** | Retirar *"la única palanca con evidencia cuantificada (5×)"* |
| **05** | Degradar las recomendaciones de LinkedIn y teléfono a **pendientes de validación legal**, y añadir el requisito de prefijo desde oct-2026 |
| **06, 00** | *"24 clientes"* → **"entre 6 y 12 sin sueldo de fundador; entre 20 y 50 con estructura mínima"**, explicitando que N ignora el CAC |
| **03** | Cambiar *"menos que el margen de un expediente"* por *"menos de lo que factura por un expediente"* |
| **02, 05** | Resolver la contradicción funerarias: asistir a PANASEF **como investigación** |

---

## 9. Conclusión de la auditoría

**De los cinco hallazgos principales del resumen ejecutivo:**

| Hallazgo | Estado tras la auditoría |
|---|---|
| 1. *"El precio no es el problema"* | **DEGRADADO.** Error de cálculo corregido; y frente al ICP real con descuentos vigentes, la ventaja de precio prácticamente desaparece |
| 2. *"La métrica de valor está rota"* | **SE MANTIENE**, con la salvedad de que los volúmenes de cliente son un supuesto corroborado sólo indirectamente por los escalones de Ulpiano |
| 3. *"Tres afirmaciones que el código no sostiene"* | **SE MANTIENE ÍNTEGRO.** Verificado en código |
| 4. *"El embudo está construido y desconectado"* | **SE MANTIENE ÍNTEGRO.** Verificado en código |
| 5. *"El modelo financiero proyecta un canal que no existe"* | **SE MANTIENE**, con la precisión de que el modelo no prueba nada sobre el futuro: su valor es diagnóstico |

**Patrón de error detectado en mi trabajo previo, digno de nota:** los tres
errores materiales fueron **todos en afirmaciones sobre el exterior** (precio del
competidor, asistencia a un congreso, interpretación legal de un canal). **Las
afirmaciones derivadas de leer el repositorio han resistido íntegras la
verificación.**

La lección operativa es directa: **las conclusiones basadas en el código son
fiables; las basadas en una sola consulta web no lo son.** Las cuatro acciones
más valiosas identificadas en todo el análisis —publicar el sitio, quitar los
testimonios, conectar el embudo y retirar las afirmaciones falsas de la tarifa—
son precisamente las que se apoyan en lectura de código, y **sobreviven intactas
a esta auditoría**.
