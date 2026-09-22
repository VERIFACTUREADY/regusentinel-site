# Changelog de correcciones

> Correcciones aplicadas el **22 de septiembre de 2026** a los documentos 00-08
> tras la auditoría de [`10-CLAIMS-AND-EVIDENCE-AUDIT.md`](10-CLAIMS-AND-EVIDENCE-AUDIT.md).
> **El documento 10 se conserva sin modificar como traza de auditoría.**
>
> Orden: de mayor a menor impacto en la estrategia.

---

## C1 — La comparación de precios con Ulpiano estaba mal construida

**Afirmación original:** *"HEREDIA cobra 149/349/749 — un 9-13 % por debajo de
Ulpiano en cada escalón. La hipótesis de que 149/349/749 puede ser demasiado
queda refutada por comparable directo."*

**Afirmación corregida:** *"HEREDIA está un **22-27 %** por debajo de la tarifa
pública de Ulpiano. **Pero eso no valida el precio**: con el −15 % que Ulpiano
ofrece a cualquier colegiado —que es todo el ICP— la ventaja cae a **~2,8 %**, y
frente a su oferta de −25 % de por vida para los 20 primeros clientes (vigente
hasta el 31-dic-2026) **HEREDIA es un 10,2 % más caro**."*

**Ficheros afectados:** `00`, `02`, `03`, `README.md`

**Motivo:** Los precios de Ulpiano llevan la coletilla literal **"facturado
anualmente"** y su página tiene un selector *"Mensual | Anual −15 %"*. Se comparó
el precio **mensual** de HEREDIA con el **anual** de Ulpiano. Comparación
inválida. La re-consulta pidiendo cita literal reveló además dos descuentos
vigentes que la primera consulta omitió.

**Impacto en la estrategia:** **Alto.** La conclusión de titular del análisis
—*"los precios no son el problema"*— deja de sostenerse tal cual. HEREDIA no
tiene ventaja de precio frente a su competidor ante el comprador real. **La
diferenciación tiene que venir de producto, no de tarifa.** No cambia la
recomendación de *no bajar precios*, que se apoya en el umbral de clientes.

---

## C2 — "Los precios de HEREDIA no son el problema"

**Afirmación original:** El precio *"está validado por un competidor directo
español"*.

**Afirmación corregida:** *"El precio publicado de un competidor demuestra que
ese competidor eligió ese precio. No demuestra que alguien lo pague, cuántos, que
sea rentable ni que sea óptimo. No hay evidencia de que nadie pague 149 o 349 € —
ni a HEREDIA ni a Ulpiano."* **[HYPOTHESIS TO TEST]**

**Ficheros afectados:** `00` §2.1, `03` (resumen y §1.2.bis nuevo), `README.md`

**Motivo:** Error lógico de fondo. Además, que Ulpiano ofrezca −25 % *"a los
primeros 20 clientes"* es **evidencia de que su propio precio de tarifa tampoco
está validado**.

**Impacto en la estrategia:** **Alto.** 149/349 pasan de "validados" a
"hipótesis que no parecen absurdas". Obliga a diseñar el descubrimiento de
disposición a pagar en lugar de darlo por hecho.

---

## C3 — Asistencia al Congreso Nacional de Gestores Administrativos

**Afirmación original:** *"~1.500 asistentes sobre una profesión nacional de
~6.000 gestores. Una cuarta parte de todo el mercado profesional español, en un
edificio."*

**Afirmación corregida:** *"El organizador **prevé** ~1.500 personas «entre
profesionales del sector, acompañantes, representantes de otras profesiones,
empresarios, autónomos y personal de las administraciones públicas». **Cuántos
son gestores administrativos colegiados: DESCONOCIDO.**"*

**Ficheros afectados:** `00`, `05`, `08`

**Motivo:** La cita literal excluye la lectura que se hizo. Es además una
previsión, no un registro, emitida por el presidente del colegio organizador —
fuente con interés en que la cifra sea alta.

**Impacto en la estrategia:** **Medio.** El congreso sigue siendo probablemente
el mejor evento del año, pero **la cifra no justifica por sí sola un patrocinio
caro**. Se añade una acción previa: preguntar al colegio cuántos inscritos son
gestores colegiados.

---

## C4 — El umbral de "~24 clientes"

**Afirmación original:** *"El objetivo operativo correcto de los próximos 12
meses son ~24 clientes de pago (o 4-7 si el fundador no se paga sueldo)."*

**Afirmación corregida:** *"Entre **6 y 12** clientes si el fundador no se paga
sueldo; entre **20 y 50** con sueldo y estructura mínima. **El umbral ignora el
CAC**: es un suelo en estado estacionario, no un objetivo."*

**Ficheros afectados:** `00`, `04`, `06` (con la derivación completa)

**Motivo:** La cifra de 24 es exacta sólo bajo tres supuestos simultáneos —mix de
planes 55/38/7, coste variable de 50 €, OPEX de 5.000 €—, **y el mix no tiene
ningún dato detrás**. Según el mix, N varía entre 17 y 51; según la estructura de
costes, entre 5 y 84.

**Impacto en la estrategia:** **Medio.** Lo robusto sobrevive y es lo que
importa: **decenas de clientes, no cientos**. Eso sigue definiendo un negocio
alcanzable por venta directa de un fundador. Lo que se retira es la falsa
precisión.

---

## C5 — El benchmark de la tarjeta en el trial

**Afirmación original:** *"La única palanca de conversión con evidencia
cuantificada en toda la investigación: sin tarjeta 4-6 %, con tarjeta 25-35 %.
Cinco veces más."*

**Afirmación corregida:** La cita de ChartMogul es correcta, pero **no es una
palanca demostrada**: (1) no es causalidad —pedir tarjeta **selecciona**
compradores de alta intención, no los crea—; (2) mide conversión de *trials
iniciados*, no de visitantes, y pedir tarjeta reduce drásticamente cuántos
empiezan; (3) es una encuesta autoinformada y autoseleccionada. **[WEAK INFERENCE]**

**Ficheros afectados:** `03` §13, `05` §5.1

**Impacto en la estrategia:** **Medio.** Resuelve una contradicción interna: la
recomendación del **plan gratuito sin tarjeta** se mantiene, porque en esta fase
el objetivo es aprender, no optimizar un embudo sin tráfico.

---

## C6 — Legalidad del contacto en frío por LinkedIn y teléfono

**Afirmación original:** *"Lo que sí es viable: LinkedIn —la exposición es
materialmente menor—; teléfono —el comprador es un profesional colegiado con
número público."*

**Afirmación corregida:** Ambas recomendaciones se degradan a **[WEAK INFERENCE]
y quedan pendientes de validación legal**:
- **LinkedIn:** el art. 21 LSSI dice *"por correo electrónico **u otro medio de
  comunicación electrónica equivalente**"*. Un mensaje comercial directo en
  LinkedIn es defendiblemente un medio equivalente. No se ha localizado ninguna
  resolución de la AEPD que lo resuelva.
- **Teléfono:** el art. 66.1.b de la Ley 11/2022 exige consentimiento **"o otra
  base de legitimación"** — el interés legítimo puede amparar la llamada B2B,
  pero **exige un análisis documentado**. Y **desde octubre de 2026 se exige
  prefijo identificable para llamadas comerciales**.

**Ficheros afectados:** `05` §3 Canal 2

**Motivo:** La prohibición del email frío está verificada con cita literal del
BOE; la seguridad sobre los otros dos canales no lo estaba.

**Impacto en la estrategia:** **Alto.** **El canal principal del plan comercial
descansaba en una interpretación legal no verificada.** Se añade una mitigación
práctica (usar LinkedIn para conectar y conversar, no para publicidad no
solicitada) y se priorizan los canales sin esta exposición: eventos, referencias,
convenios y el widget embebible.

---

## C7 — Funcionalidad de Ulpiano que no existe, y una ventaja real de HEREDIA

**Afirmación original:** La tabla comparativa atribuía a Ulpiano API y SSO, y
presentaba la cobertura de 19 CCAA como la ventaja principal de HEREDIA.

**Afirmación corregida:** Ulpiano marca literalmente como **"(próx.)"**: *API
básica*, *API completa con SSO/SCIM*, **Cálculo de plusvalía municipal**,
*Generación de documentos sucesorios* y *Asistente conversacional*.
→ **HEREDIA tiene plusvalía municipal implementada y testeada. Ulpiano no.**
Ventaja funcional real y comprobable hoy.
→ Y ambos venden API y SSO inexistentes; la diferencia es que Ulpiano los
etiqueta.

**Ficheros afectados:** `02` §2.1, `03` §1.1-1.2, `04` (tabla de portfolio)

**Impacto en la estrategia:** **Medio-alto.** Aporta un diferenciador verificable
que el análisis anterior no recogía, justo cuando la ventaja de precio desaparece
(C1). Y refuerza —sin excusarla— la recomendación de retirar "SSO" y "API" de la
tarifa de HEREDIA.

---

## C8 — Coste oculto en el plan de entrada de Ulpiano

**Afirmación original:** No se recogía.

**Afirmación añadida:** El plan Esencial de Ulpiano **no incluye ningún modelo
AEAT**: *"Modelos AEAT en pago por uso (15€/modelo)"*. Con 5 modelos/mes el coste
real es de **244 €** frente a los 149 € de HEREDIA Inicia, que no cobra por
modelo.

**Ficheros afectados:** `02` §2.1, `03` §1.1-1.2

**Impacto en la estrategia:** **Medio.** Recupera parte de la ventaja de precio
perdida en C1, **pero sólo en el escalón de entrada y sólo para clientes con
volumen de modelos**. Es un argumento de venta concreto y verificable.

---

## C9 — "Margen" usado donde correspondía "facturación"

**Afirmación original:** *"349 €/mes cuesta menos que el **margen** de un solo
expediente de herencia al mes."*

**Afirmación corregida:** *"…cuesta menos de lo que la gestoría **factura** por un
expediente al mes."*

**Ficheros afectados:** `00`, `02`, `03`, `05` (guion de demo y objeciones)

**Motivo:** Lo verificado es el **precio al consumidor** (500-1.500 €), no el
margen. Con 6-12 h a 25-35 €/h, el coste laboral es de 150-420 €, así que el
margen sobre un expediente de 600 € puede ser de 180-450 €.

**Impacto en la estrategia:** **Bajo en el fondo, alto en credibilidad.** El
argumento sigue funcionando; decirlo mal ante un profesional que sabe hacer la
cuenta destruye la confianza en todo lo demás.

---

## C10 — Antigüedad del dato estructural del sector

**Afirmación original:** *"83 % del mercado objetivo son negocios de 0-2 personas
[CONFIRMADO, DIRCE]"*, presentado como actual.

**Afirmación corregida:** Mismo porcentaje, pero **datos DIRCE de 2021,
publicados en abril de 2022 por un tercero — cinco años de antigüedad**.
**[WEAK INFERENCE]**, con la nota de que el sector se contrajo ~7 % en tres años
con >11.000 despachos cerrados, lo que sugiere consolidación.

**Ficheros afectados:** `02` §1.4 y §8, `04` §7.1, `05` §1 y §3

**Impacto en la estrategia:** **Bajo-medio.** La conclusión —*"decide una sola
persona"*— es probablemente cierta, pero está peor soportada de lo que se afirmó.
Refrescarla en DIRCE es barato y debe hacerse antes de fijar el ICP
definitivamente.

---

## C11 — Cifras de mercado presentadas como TAM

**Afirmación original:** *"El mercado existe y es medible: 441.270 defunciones al
año, ~54.000 empresas de asesoría, ~6.000 gestores administrativos…"*

**Afirmación corregida:** Se mantienen las cifras con sus etiquetas, añadiendo:
**441.270 defunciones no es un TAM** (una defunción no es un expediente tramitado
por un profesional); **"más de 6.000 gestores" no es el número de despachos**, que
es la unidad de compra; y las 53.998 empresas CNAE 6920 proceden de una **fuente
comercial sin fecha [WEAK INFERENCE]**. **El mercado direccionable real sigue
siendo DESCONOCIDO.**

**Ficheros afectados:** `00` (respuesta 11), `02` §1 y §8

**Impacto en la estrategia:** **Medio.** Impide usar estas cifras como tamaño de
mercado ante un inversor. El dato que falta —cuántos despachos tramitan herencias
con volumen— se obtiene en las entrevistas.

---

## C12 — Cobertura de 19 CCAA como argumento de venta

**Afirmación original:** *"HEREDIA cubre 19 CCAA. Ése es un argumento real para
cualquier despacho fuera de Cataluña."*

**Afirmación corregida:** HEREDIA **tiene contenido** para 19 CCAA, pero
`README.md:316` reconoce que **las reglas fiscales están pendientes de revisión
contra normativa vigente**. **No usarlo como argumento de venta hasta revisarlas.**
Y *"100 % normativa catalana"* afirma **profundidad, no exclusividad**: no prueba
que Ulpiano no cubra otras CCAA. **[WEAK INFERENCE]**

**Ficheros afectados:** `02` §2.1

**Motivo:** Afirmar cobertura no verificada es exactamente el riesgo del caso
**SAP Navarra 17/03/2021** (76.500 € de condena por una autoliquidación de ISD
incorrecta).

**Impacto en la estrategia:** **Medio.** Se añade una tarea previa al
lanzamiento: revisar las 19 fichas.

---

## C13 — Contradicción funerarias: PANASEF

**Contradicción original:** El doc. 04 §7.1 recomienda *"cero esfuerzo comercial
en funerarias"* durante seis meses; el doc. 05 recomienda viajar a un congreso
funerario en 14 días.

**Resolución:** Asistir **como investigación, no como venta**. Objetivo declarado:
cerrar el hueco de información de mayor valor pendiente —**quién opera los
servicios de herencias de Santalucía, Ocaso y Mapfre**— y localizar a quien compra
software en los grupos funerarios.

**Ficheros afectados:** `05` §3 Canal 1

**Impacto en la estrategia:** **Bajo.** Mantiene el viaje y elimina la
incoherencia.

---

## C14 — Plan de 14 días: fuente autoritativa única

**Situación original:** El doc. 08 contenía el plan de 14 días.

**Corrección:** El plan autoritativo pasa a ser
[`11-CURRENT-DECISION-BRIEF.md`](11-CURRENT-DECISION-BRIEF.md) §G. El doc. 08 se
conserva por su detalle sobre el **diseño de cada experimento** (coste, método,
umbrales), con un aviso de supersesión.

**Ficheros afectados:** `08` (cabecera)

**Impacto en la estrategia:** **Bajo.** Evita dos calendarios en circulación.

---

## Resumen de impacto

| Corrección | Impacto | ¿Cambia alguna decisión? |
|---|---|---|
| C1 Comparación de precios | **Alto** | Sí — elimina la ventaja de precio como argumento |
| C2 "El precio no es el problema" | **Alto** | Sí — 149/349 vuelven a ser hipótesis |
| C6 Legalidad de LinkedIn y teléfono | **Alto** | Sí — el canal principal necesita validación legal |
| C7 Plusvalía como diferenciador | Medio-alto | Sí — aporta un diferenciador verificable |
| C3 Asistencia al congreso | Medio | Sí — preguntar antes de patrocinar |
| C4 Umbral de clientes | Medio | No — el orden de magnitud sobrevive |
| C5 Benchmark de la tarjeta | Medio | Sí — resuelve la contradicción a favor del plan gratuito |
| C8 Coste oculto de Ulpiano | Medio | No — refuerza un argumento existente |
| C11 Cifras de mercado | Medio | Sí — no usarlas como TAM |
| C12 Cobertura de 19 CCAA | Medio | Sí — revisar antes de venderlo |
| C9 "Margen" vs "facturación" | Bajo/credibilidad | Sí — en el guion de demo |
| C10 Antigüedad del dato DIRCE | Bajo-medio | No — refrescar |
| C13 Contradicción PANASEF | Bajo | Sí — viaje de investigación |
| C14 Plan único | Bajo | No |

**Lo que NO ha cambiado tras la auditoría:** las cuatro acciones de mayor valor
—publicar el sitio, eliminar los testimonios sintéticos, conectar el embudo y
retirar las afirmaciones falsas de la tarifa— **se apoyan en lectura de código y
han sobrevivido intactas**.
