# 03 — Pricing: investigación, test de estrés y recomendación

> **Fecha:** 21 de septiembre de 2026
> **Premisa del encargo:** 149 / 349 / 749 €/mes son **hipótesis**, no precios
> validados. HEREDIA tiene cero clientes de pago, luego cero datos de demanda.
> Etiquetas: **[CONFIRMADO]** = leído en la fuente, con URL · **[ESTIMADO]** =
> inferido, con la aritmética a la vista · **[HIPÓTESIS]** = sin evidencia todavía.

---

## RESUMEN EJECUTIVO DE ESTE DOCUMENTO

> ⚠️ **Corregido el 22-sep-2026.** La versión anterior afirmaba que el precio
> *"está validado por un competidor que cobra un 9-13 % más"*. **Las dos mitades
> de esa frase eran incorrectas.** Ver `10-CLAIMS-AND-EVIDENCE-AUDIT.md` §2.

**El nivel de precio de HEREDIA está un 22-27 % por debajo de la tarifa pública
de su competidor directo [STRONG INFERENCE] — pero eso NO lo valida [ver §1.2].**
Frente a un colegiado con el descuento que ese competidor ya publica, la ventaja
de HEREDIA cae a **~2,8 %**; frente a su oferta de early adopter, **HEREDIA es un
10 % más caro**.

**No hay ninguna evidencia de que nadie pague 149 o 349 € — ni a HEREDIA ni a
Ulpiano. [HYPOTHESIS TO TEST]**

Lo que sí está establecido es que el problema está en otros cuatro sitios:

1. **La métrica de valor está rota.** Los topes son "expedientes **al mes**"
   (15/50/200), cuando el competidor directo mide **expedientes activos**
   (5/15/50). HEREDIA ofrece entre 12 y 48 veces más capacidad por un precio
   menor — es decir, **el límite nunca se alcanza, no segmenta nada, y los tres
   planes se diferencian en la práctica sólo por usuarios**.
2. **La fricción de entrada es la peor del mercado**: 299/990 € de setup y sin
   plan gratuito, frente a un competidor con **setup 0 € y plan gratuito
   permanente**.
3. **El plan Firma puede tener margen bruto del 36 %** si se sirve con un modelo
   de IA de gama alta.
4. **La página de precios no deja comprar**: los tres botones llevan a un
   formulario de demo, existiendo registro self-service con trial de 14 días.

---

## 1. Investigación de precios de competidores

### 1.1 El hallazgo central: **Ulpiano** ya existe

`ulpiano.es` — *"El sistema operativo para las herencias"*. **Verificado
directamente el 21-sep-2026.** **[CONFIRMADO]**

Segmentos a los que se dirige: **despachos, notarías, asesorías fiscales, family
offices, funerarias y aseguradoras**. Es, literalmente, el mismo ICP que HEREDIA
persigue en sus tres landings verticales.

**Precios etiquetados literalmente "facturado anualmente"** — ya incluyen su
−15 %. El selector de la página dice *"Mensual | Anual −15 %"*.

| Plan | €/mes *(fact. anual)* | €/mes *(mensual, inferido)* | Usuarios | **Expedientes activos** | Almacen. | Modelos AEAT/mes | Modelo extra |
|---|---|---|---|---|---|---|---|
| **Free** | **0** | 0 | 1 | **1** | 5 GB | 0 *(pago por uso)* | 15 € |
| Esencial | 169 | ~199 | 2 | **5** | 50 GB | **0 — "pago por uso (15€/modelo)"** | 15 € |
| Avanzado | 382 | ~449 | 5 | **15** | 250 GB | 20 | 9 € |
| Pro | 849 | ~999 | 10 | **50** | 500 GB | 50 | 5 € |
| Enterprise | a medida | — | a medida | a medida | a medida | API, SSO/SCIM, SLA | — |

- **Setup: 0 €.** No hay ninguna cuota de alta publicada.
- **Descuento anual −15 %**; compromiso a 2 años **−25 %**.
- **Sin permanencia.** Precios sin IVA.
- **Plan gratuito permanente, sin tarjeta.**
- **Back-office (servicio gestionado): desde 850 €/paquete.**
- **Early Adopter: −25 % de por vida para los 20 primeros clientes, hasta el
  31-dic-2026.**
- **−15 % para miembros de asociaciones profesionales.**
- Funcionalidad **existente**: expediente estructurado, árbol familiar, cálculo de
  legítimas, simulación ISD en tiempo real, cumplimentación de **Modelos
  650/651/652/653/660**, OCR/IA sobre certificados y escrituras, control del plazo
  de 6 meses, inventario de activos digitales, **portal familia white-label para
  funerarias**.
- **Funcionalidad ANUNCIADA pero NO construida [VERIFIED FACT — cita literal]:**
  *"API básica (próx.)"*, *"API completa con SSO/SCIM (próx.)"*, **"Cálculo de
  plusvalía municipal Próx."**, *"Generación de documentos sucesorios Próx."*,
  *"Asistente conversacional Próx. sept."*
- ~12 logotipos de despachos, notarías y asesorías, con sesgo catalán;
  posicionamiento en *"100 % normativa catalana"*.
  ⚠️ **Los logotipos no son evidencia de tracción**: no están verificados, no
  indican si pagan, ni cuánto, ni desde cuándo. **[DESCONOCIDO]**

### 1.2 Comparación directa HEREDIA ↔ Ulpiano

> ⚠️ **Tabla corregida el 22-sep-2026.** La versión anterior comparaba el precio
> **mensual** de HEREDIA con el **anual** de Ulpiano. Comparación inválida.

**Comparación anual como-con-como (el único eje comparable sin ambigüedad):**

| Escalón | HEREDIA anual | Ulpiano anual | Δ |
|---|---|---|---|
| Inicia / Esencial | 1.490 € | 2.028 € | **−27 %** |
| Despacho / Avanzado | 3.490 € | 4.584 € | **−24 %** |
| Firma / Pro | 7.490 € | 10.188 € | **−26 %** |

**Coste real del primer año, escalón medio, con los descuentos que Ulpiano
publica hoy [VERIFIED FACT]:**

| Escenario | Año 1 |
|---|---|
| HEREDIA Despacho anual + setup 299 € | **3.789 €** |
| HEREDIA Despacho anual sin setup | 3.490 € |
| Ulpiano Avanzado, tarifa | 4.584 € |
| **Ulpiano Avanzado −15 % colegiado** | **3.896 €** → HEREDIA sólo **2,8 %** más barato |
| **Ulpiano Avanzado −25 % early adopter** *(hasta 31-dic-2026)* | **3.438 €** → **HEREDIA 10,2 % MÁS CARO** |

**Resto de la comparación:**

| | **HEREDIA (hipótesis)** | **Ulpiano (público)** | Lectura |
|---|---|---|---|
| Usuarios (entrada/medio/alto) | 2 / 5 / **20** | 2 / 5 / **10** | HEREDIA duplica usuarios en el alto |
| **Expedientes** | **15 / 50 / 200 AL MES** | **1 / 5 / 15 / 50 ACTIVOS** | **HEREDIA ofrece 12-48× más capacidad** |
| **Plan gratuito** | **No existe** | **Sí, permanente** | **Ulpiano gana la entrada** |
| **Setup** | **299 € / 990 €** | **0 €** | **Ulpiano gana la fricción** |
| Descuento anual | −17 % | −15 % (−25 % a 2 años) | Equivalente |
| **Descuento colegiados** | **Ninguno** | **−15 % a cualquier colegiado** | **Ulpiano gana en el ICP real** |
| Permanencia | Sin | Sin | Igual |
| Capa transaccional | Ninguna | 15/9/5 € por modelo AEAT | Ulpiano monetiza el uso — **y su plan de entrada no incluye ningún modelo** |
| **Modelos AEAT en el plan de entrada** | **Incluidos, sin coste** | **0 incluidos, 15 €/modelo** | **HEREDIA gana**: 5 modelos/mes = 244 € en Ulpiano vs 149 € |
| **Plusvalía municipal** | **Implementada y testeada** | **"Próx."** | **HEREDIA gana** |
| API / SSO | Vendidos, **no existen** | Marcados **"(próx.)"** | Empate — Ulpiano lo etiqueta, HEREDIA no |
| Servicio gestionado | 490 €/expediente | desde 850 €/paquete | HEREDIA más barato |
| Cobertura normativa | 19 CCAA **sin revisar** | *"100 % normativa catalana"* | **Indeterminado** — profundidad ≠ exclusividad, y las fichas de HEREDIA están pendientes de revisión |

> **Conclusión 1 [corregida].** HEREDIA está un **22-27 % por debajo de la tarifa
> pública** de Ulpiano **[STRONG INFERENCE]** — pero frente al comprador real
> (colegiado, con descuento) esa ventaja es de **~2,8 %**, y **negativa** frente a
> la oferta de early adopter vigente hasta el 31-dic-2026.
> **La comparación NO valida el precio de HEREDIA.** Ver §1.2.bis.
>
> **Conclusión 2 [se mantiene].** Todo lo que HEREDIA pierde frente a Ulpiano lo
> pierde **antes de que el precio importe**: no hay plan gratuito, hay setup de
> cuatro cifras, y la página de precios no permite comprar. **Éstas sí son
> ventajas competitivas reales del rival, y son las baratas de neutralizar.**

### 1.2.bis Qué demuestra y qué no demuestra el precio de un competidor

**Demuestra:** que Ulpiano eligió esos números. **[VERIFIED FACT]**

**No demuestra** *(ninguno de estos puntos tiene evidencia)*:

- que alguien pague esos precios;
- cuántos los pagan;
- que sean rentables para Ulpiano;
- que sean óptimos;
- que HEREDIA pueda capturarlos sin la marca, las referencias y el canal del rival;
- que el mercado admita dos proveedores a ese precio.

> **Y hay una señal en sentido contrario:** que Ulpiano ofrezca **−25 % de por
> vida "para los primeros 20 clientes"** es **evidencia de que su propio precio de
> tarifa tampoco está validado**, y probablemente de que aún no tiene 20 clientes.
>
> **Formulación defendible:** *no hay evidencia de que 149/349 € esté fuera de la
> banda que el mercado considera plausible, y bajar precio empeoraría
> mecánicamente el umbral de clientes. Pero no existe ninguna evidencia de que
> nadie pague esa cantidad.* **[HYPOTHESIS TO TEST]**

### 1.3 El incumbente: `a3ASESOR|her` (Wolters Kluwer)

**Precio: NO PÚBLICO.** Ningún partner (Esofitec, Linksoluciones, Infolab,
SasCom, Visio, Creinsa) publica tarifa. **[CONFIRMADO que no es público]**

Lo que sí está confirmado y es lo que importa: calcula **ISD y plusvalía
municipal en tiempo real adaptado a cada CCAA**, automatiza ajuar doméstico,
legados, seguros de vida, adición y acumulación de donaciones y consolidaciones
de dominio, genera borrador en un clic — **e importa el inventario de bienes
directamente desde `a3ASESOR|ren`, el módulo de IRPF que la asesoría ya usa.**
**[CONFIRMADO]**

> **Esto es el problema de la solución puntual en su forma más pura.** El módulo
> de ISD del incumbente es más barato de adoptar porque **los datos
> patrimoniales ya están al lado**. HEREDIA no compite contra una funcionalidad:
> compite contra una integración.
>
> **Consecuencia estratégica:** no se puede ganar por el calculador fiscal. Se
> gana por lo que ni WK ni Ulpiano ponen en el centro: **la recogida documental
> con la familia, el portal familia y el pack banco** — la capa de coordinación.
> Ver documento 04.

### 1.4 Bandas de mercado del software profesional español

Tres fuentes independientes y fechadas convergen **[CONFIRMADO]**:

| Nivel | €/usuario/mes |
|---|---|
| Básico | 20-40 |
| Intermedio | 50-90 |
| Avanzado / ERP | 100+ |

Anclas confirmadas de fabricante: Sage Despachos base **19,50 €/usuario/mes** +
módulos (Gestión Fiscal y Contable **83 €**, Facturación **51 €**) → un despacho
Sage completo paga del orden de **153 €/usuario/mes**. LexFlow 9,99-149,99 €/mes
por despacho. Norbia Legal **120 €/mes** (PVP 175 €) + **600 € de implantación**.
Amberlo **59-89 €/usuario/mes** + **299 € de onboarding**. Gularis (funerario)
**39/69/99 €/mes**.

**Dato de contexto crítico [CONFIRMADO, estudio sobre 157 gestorías,
dic-2025/ene-2026]:** el software supone **~7,4 % de los costes operativos** de
una gestoría; un despacho de 10 personas gasta **~12.000 €/año en software total**.

| Plan HEREDIA | €/año | % del presupuesto total de software de un despacho de 10 personas |
|---|---|---|
| Inicia | 1.788 | **15 %** |
| Despacho | 4.188 | **35 %** |
| Firma | 8.988 | **75 %** |
| *(Ulpiano Pro)* | *10.188* | *85 %* |

> **Conclusión 3.** Inicia y Despacho son digeribles. **Firma, a 75 % del
> presupuesto total de software de un despacho de 10 personas, sólo se vende a un
> despacho que tramite sucesiones como línea principal de negocio** — no como una
> actividad más. Eso no invalida el plan; **redefine su ICP**.

### 1.5 Lo que cobran los servicios (no el software) — la referencia de valor

| Proveedor | Precio | Fuente |
|---|---|---|
| **Heredary** (básico: liquidación + plusvalía + registro) | **450 € por heredero**, hasta 3 inmuebles; +181,50 €/inmueble | heredary.com/precio [CONFIRMADO] |
| **Heredary** (completo, abogado) | **1.633,50 €** hasta 2 herederos y 3 inmuebles; +40 %/heredero | ídem |
| SabemosDeHerencias | **desde 190 €** | sabemosdeherencias.es |
| Herencias Online | desde 500 € | herenciasonline.es |
| Enley | desde 990 € | enley.com |
| **Mercado general (jul-2026)** | Gestoría **500-1.500 €**; abogado **3.000-8.000 €** | everly.es [CONFIRMADO] |

> **Conclusión 4 [corregida].** Un expediente de herencia **factura** al cliente
> de HEREDIA entre **500 y 1.500 €** (gestoría) o **3.000-8.000 €** (abogado)
> **[STRONG INFERENCE para el precio]**. El plan Despacho (349 €/mes) cuesta
> **menos de lo que ese cliente factura por un solo expediente al mes**. Ése es el
> argumento de venta correcto, y no está en ninguna página del producto.
>
> ⚠️ **Decir "factura", nunca "margen".** El margen **no se ha medido**
> **[WEAK INFERENCE]**: con 6-12 h por expediente a 25-35 €/h, el coste laboral es
> de 150-420 €, así que sobre un expediente de 600 € el margen puede ser de
> 180-450 €, no 600 €. Un comprador que haga esa cuenta en voz alta y encuentre el
> error pierde la confianza en todo lo demás.

---

## 2. El valor económico del problema: qué podemos demostrar y qué no

La ecuación del encargo era:

```
VALOR = trabajo ahorrado + capacidad ganada + errores evitados
      + ingresos extra + retención/cross-sell + riesgo reducido
```

**No todos esos componentes son demostrables hoy.** Ésta es la separación honesta:

| Componente | ¿Demostrable? | Evidencia |
|---|---|---|
| **Trabajo ahorrado** | **Parcialmente** | El competidor directo afirma "−35 % de tiempo de gestión"; HEREDIA asume 30 % en `roi-calculator.ts`. **Ambas son afirmaciones de fabricante sin medición independiente.** Medible en el primer piloto, no antes |
| **Errores evitados** | **Sí, con matices** | Precedente documentado: **SAP Navarra 17/03/2021, 76.500 €** de condena a una gestoría por una autoliquidación de ISD mal hecha. El riesgo existe y es cuantificable. Lo que **no** está probado es la *frecuencia* (el `roi-calculator.ts` asume 1 error/50 expedientes sin fuente) |
| **Riesgo reducido — plazo de prórroga** | **Sí, y es el mejor argumento del producto** | El plazo de 6 meses es conocido por todos. **La asimetría del mes 5 no**: la prórroga debe pedirse en los 5 primeros meses; pedida dentro de plazo y sin notificación en el mes siguiente **se entiende concedida**; pedida fuera, **se entiende denegada sin necesidad de notificación** (art. 67 RISD). **[CONFIRMADO]** Un motor que vigila el mes 5 hace algo que un recordatorio de calendario no puede |
| **Capacidad ganada** | **No demostrable hoy** | Requiere datos de uso reales |
| **Ingresos extra** | **No demostrable hoy** | El testimonio que lo afirmaba en `/portal-familia` es **fabricado** (ver doc. 07) |
| **Retención / cross-sell** | **No demostrable hoy** | Hipótesis razonable, cero evidencia |

> **Regla comercial que se deriva de esto:** vender sólo los dos primeros
> componentes y, sobre todo, el tercero. **El argumento de venta más fuerte y más
> honesto de HEREDIA hoy es el control del mes 5.** Es concreto, verificable,
> legalmente cierto, y el comprador puede comprobarlo en su propio expediente
> abierto.

---

## 3. ROI por tipo de cliente

Rangos construidos sobre datos de mercado confirmados. Coste laboral: convenio de
oficinas y despachos + ~32 % de cargas ⇒ **25-35 €/hora** para perfil
administrativo **[ESTIMADO]**. Horas por expediente: **6-12 h** **[ESTIMADO — a
medir en piloto]**. Ahorro de tiempo: **20-30 %** **[HIPÓTESIS, no medida]**.

| Perfil | Expedientes/año | Ingreso/exp. | Coste actual del proceso | Valor potencial HEREDIA/año | Precio razonable | Payback |
|---|---|---|---|---|---|---|
| **Gestoría pequeña** (1-3 prof.) | 10-30 | 500-900 € | 60-360 h ≈ 1.800-12.600 € | 360-3.800 € | **99-149 €/mes** | 3-9 meses |
| **Gestoría media** (4-10) | 30-80 | 600-1.200 € | 180-960 h ≈ 5.400-33.600 € | 1.100-10.000 € | **249-349 €/mes** | 2-6 meses |
| **Gestoría especialista en sucesiones** | 100-300 | 700-1.500 € | 600-3.600 h ≈ 18.000-126.000 € | 3.600-37.800 € | **449-749 €/mes** | 1-3 meses |
| **Despacho de abogados** | 20-60 | 3.000-8.000 € | 120-720 h ≈ 4.200-25.200 € | 840-7.500 € | **349-749 €/mes** | 1-5 meses |
| **Funeraria independiente** | 200-600 servicios, **conversión a herencia desconocida** | n/a hoy | n/a | **Ingreso nuevo, no ahorro** | **99-249 €/mes** | depende de conversión |
| **Grupo funerario** | >10.000 servicios | n/a | n/a | Ingreso nuevo a escala | **Enterprise** | n/a |

**Tres advertencias que el `roi-calculator.ts` actual no hace:**

1. **El valor teórico no es disposición a pagar.** Que HEREDIA genere 10.000 € de
   valor no significa que una gestoría pague 5.000 €. Paga lo que su presupuesto
   de software y su percepción de alternativa permiten — y ese presupuesto total
   es ~12.000 €/año para un despacho de 10 personas.
2. **El valor por defecto de la calculadora pública es irreal.**
   `calculadora-roi/roi-client.tsx:23` arranca en **50 expedientes/mes = 600 al
   año**. Eso es un especialista de altísimo volumen, no el cliente medio.
   **Cambiar el valor por defecto a 3-5 expedientes/mes.** Un ROI creíble vende
   más que un ROI espectacular que el prospecto sabe falso.
3. **Para funerarias, HEREDIA no es ahorro: es una línea de ingresos nueva.** Es
   una venta completamente distinta —más difícil, más lenta, con más incógnitas—
   y hoy está mezclada con la venta a gestorías en la misma página de precios.

---

## 4. Cómo descubrir la disposición a pagar real

### 4.1 Van Westendorp — las cuatro preguntas, en español y en este orden

Describir el producto primero, con una ficha idéntica para todos. Preguntar por
**precio mensual por despacho**, nunca por usuario: mezclar unidades rompe el
análisis. Respuesta abierta en euros, sin lista de opciones.

> 1. *"¿A partir de qué precio al mes le parecería **tan caro** que ni se lo
>    plantearía para su despacho?"*
> 2. *"¿A partir de qué precio al mes le **empezaría a parecer caro** — no
>    descartable, pero sí algo que tendría que pensarse bien?"*
> 3. *"¿Por debajo de qué precio al mes le parecería una **buena compra**, que da
>    claramente más valor de lo que cuesta?"*
> 4. *"¿Por debajo de qué precio al mes le parecería **tan bajo** que dudaría de
>    la calidad del producto o de la solvencia de quien lo ofrece?"*

**Cálculo:** acumular "demasiado caro" y "empieza a ser caro" de forma
ascendente; "buena compra" y "demasiado barato" de forma descendente. **PMC** =
cruce demasiado barato × empieza a ser caro (límite inferior). **PME** = cruce
demasiado caro × buena compra (límite superior). **OPP** = cruce demasiado barato
× demasiado caro. **IPP** = cruce buena compra × empieza a ser caro.

**Muestra:** **40 respuestas es el suelo técnico absoluto** (el algoritmo necesita
8 para computar el OPP). Objetivo realista: **60-80 gestorías cualificadas**. **[CONFIRMADO]**

**Limitación que hay que asumir:** Van Westendorp mide *percepción de precio
justo*, **no** intención de compra ni presupuesto, y en B2B se rompe
estructuralmente porque quien responde a menudo no es quien firma. **Úsese como
red de seguridad para detectar si 149/349/749 está grotescamente fuera de rango,
no para elegir el precio.**

### 4.2 Gabor-Granger — escalera propuesta

Precio inicial aleatorizado; si acepta, subir un escalón; si rechaza, bajar.
Espaciado geométrico (~25-30 %), porque la percepción de precio es logarítmica.

**Escalera para el plan medio:** `99 — 149 — 199 — 249 — 349 — 449 — 599 — 749`

**Derivar el precio:** curva de demanda *D(p)* = proporción que compraría a ese
precio o más. Curva de ingresos = *p × D(p)*. **Curva de contribución =
(p − coste variable) × D(p)** — ésta es la que importa, y con el coste de IA por
expediente (§7) **su pico no coincide con el de ingresos**.

**Corrección obligatoria:** Gabor-Granger sobreestima la demanda porque decir
"sí" es gratis. Multiplicar "definitivamente sí" por 0,7 y "probablemente sí"
por 0,3.

**Conjoint / MaxDiff: NO, todavía.** MaxDiff necesita 400-1.000 respuestas y no
está diseñado para evaluar precio; el conjoint requiere diseño experimental. A
esta altura, 400 encuestas cuestan más que los 10 primeros clientes y dicen
menos. Es una herramienta de *packaging* para cuando haya 30-50 clientes. **[CONFIRMADO]**

### 4.3 Entrevistas cualitativas — 21 preguntas que no inducen

Principio: preguntar por **comportamiento pasado concreto**, nunca por opinión
hipotética.

**El problema, en pasado y con números**
1. ¿Cuántos expedientes de herencia ha cerrado su despacho en los últimos 12 meses?
2. Lléveme al último que cerró: ¿qué pasó desde que el cliente entró por la puerta hasta que se liquidó el Impuesto de Sucesiones?
3. En ese expediente concreto, ¿quién hizo cada parte?
4. ¿Cuántas horas calcula que se fueron? ¿A qué coste por hora?
5. ¿Qué le facturó al cliente? ¿Cómo fijó ese precio?
6. ¿Qué parte le dio más guerra o tuvo que rehacer?
7. La última vez que se le pasó un plazo —o estuvo a punto—, ¿qué ocurrió exactamente?
8. ¿Cuántos expedientes ha rechazado o derivado en el último año? ¿Por qué ésos?

**Alternativas y coste actual (sin nombrar HEREDIA)**
9. ¿Qué herramientas abrió durante ese expediente? ¿Me las puede enseñar?
10. ¿Cuánto paga hoy al mes en software de despacho, todo incluido? ¿A quién?
11. ¿Cuál fue la última herramienta que contrató? ¿Cómo la encontró y cuánto tardó en decidirse?
12. ¿Y la última que dio de baja? ¿Qué pasó para que la cancelara?
13. ¿Ha intentado ya resolver esto de alguna manera, aunque fuera un apaño?

**Autoridad, presupuesto y proceso**
14. ¿Quién firma un gasto de este tipo? ¿Tiene que consultarlo con alguien?
15. ¿De qué partida saldría: software, formación, personal?
16. Si hoy decidiera contratar algo de 300 €/mes, ¿qué pasos internos daría y cuánto tardaría?
17. ¿Quién más tendría que usarlo para que sirviera? ¿Y quién podría bloquearlo?

**Prioridad — la pregunta que todo el mundo se salta**
18. ¿Qué tres cosas tiene que sacar adelante este trimestre sí o sí?
19. Si tuviera que elegir entre arreglar esto y [otro problema que él haya mencionado], ¿cuál primero? ¿Por qué ése?

**Cierre con compromiso, no con cumplido**
20. ¿A quién más debería preguntar? ¿Me lo presentaría?
21. *"Si esto existiera el mes que viene tal y como se lo he descrito, ¿estaría dispuesto a reservar plaza con una señal de 300 € a cuenta del primer año?"* — **si dice que sí, sacar el enlace de pago en ese momento. Si dice "hablamos", la respuesta real es no.**

**Prohibido preguntar:** *"¿cuánto pagarías?"*, *"¿te parece caro 349 €?"*,
*"¿usarías esto?"*. Las tres producen ruido cortés.

### 4.4 ¿Cuántas entrevistas antes de fijar precio?

Evidencia académica **[CONFIRMADO]**: Guest, Bunce & Johnson (2006) — saturación
de códigos en la entrevista **12**; el 80 % de los códigos aparece en las **6**
primeras. Meta-análisis posteriores: saturación de códigos entre 9 y 17,
saturación de significado entre 16 y 24.

| Fase | Volumen | Qué produce |
|---|---|---|
| Descubrimiento del problema | **12-15** gestorías | Saturación. Si a la 12ª no oyes nada nuevo, para |
| Por segmento adicional (funeraria, abogado) | **+8-10** cada uno | Sus economías son distintas; no mezclar muestras |
| Cuantitativo VW/GG | **40 mínimo, 60-80 deseable** | Rango aceptable y curva de demanda |
| **Validación real** | **5-10 compromisos de pago** | **El único dato que no miente** |

> **El punto central: ninguna encuesta mide disposición a pagar. Mide percepción
> declarada.** El precio v1 debe salir de **5-10 señales cobradas o cartas de
> intención firmadas**; las encuestas sólo sirven para no poner un número absurdo
> en la web mientras tanto.

---

## 5. La métrica de valor: el error de diseño más importante

### 5.1 Evaluación de las opciones

| Métrica | Alineación con valor | Previsibilidad | Fricción de venta | Expansión | Margen | Percepción | Complejidad |
|---|---|---|---|---|---|---|---|
| Fijo por organización | **Mala** | Máxima | Mínima | **Nula** | Riesgo si abusan | Simple | Trivial |
| **Por usuario** | **Mala** — 5 usuarios pueden tramitar 3 herencias/año | Alta | Media | Media | Buena | Familiar | Baja |
| Por expediente creado | Buena | Baja | **Alta** — el cliente teme la factura | Alta | Excelente | *"me cobran por trabajar"* | Media |
| **Por expediente ACTIVO** | **Excelente** | **Media-alta** | Media | **Alta** | Excelente | Justa: *"pago por lo que tengo abierto"* | **Media** |
| Por sede | Mala en gestorías, buena en grupos funerarios | Alta | Baja | Media | Buena | Simple | Baja |
| Base + uso | Buena | Media | Media | **Excelente** | Excelente | Compleja | **Alta** |
| Enterprise | n/a | Baja | Alta | Alta | Variable | n/a | Alta |

**Criterio decisivo (Poyar/Campbell) [CONFIRMADO]:** una métrica válida exige que
**los clientes grandes consuman más de ella que los pequeños** y que **no penalice
la retención**.

- **El usuario falla el primer criterio.** Una gestoría con 5 empleados puede
  tramitar 3 herencias al año; una con 2, cuarenta. El tamaño del equipo no
  predice el valor entregado.
- **El expediente activo lo cumple.** Y tiene una propiedad que el expediente
  creado no tiene: **no penaliza abrir**. El cliente no piensa dos veces antes de
  meter un caso en el sistema, que es exactamente lo que queremos.

### 5.2 Por qué los topes actuales no segmentan nada

Un expediente de herencia dura **6-12 meses**. Por tanto, expedientes activos
≈ volumen anual ÷ 2.

| Plan HEREDIA | Tope | Equivalente anual | ¿Lo alcanza el ICP? |
|---|---|---|---|
| Inicia | 15/mes | **180/año** | **Nunca.** Una gestoría pequeña hace 10-30 |
| Despacho | 50/mes | **600/año** | **Nunca.** Una gestoría media hace 30-80 |
| Firma | 200/mes | **2.400/año** | **Nunca.** Un especialista hace 100-300 |

**Ningún plan alcanza jamás su propio límite.** Y Ulpiano, con el mismo ICP,
vende 5 / 15 / 50 **activos** — que sí son números de la realidad.

> **Conclusión 5.** El límite de expedientes de HEREDIA es decorativo. No
> segmenta, no monetiza y no protege el margen. Y como está implementado con tope
> **duro y bloqueante** (`plan-limits.ts`), sólo puede hacer daño: el único
> cliente que lo tocará es uno tan bueno que no queremos castigarlo.

---

## 6. Arquitectura: ¿cuántos planes?

| Estructura | Fricción | Expansión | Claridad | Veredicto para HEREDIA |
|---|---|---|---|---|
| 1 plan | Mínima | Nula | Máxima | Demasiado rígido para 3 ICP distintos |
| **2 planes + gratuito** | **Baja** | Buena | **Alta** | **Recomendado** |
| 3 planes | Media | Buena | Media | Actual. El tercero (Firma) tiene ICP distinto y no está poblado |
| 4+ | Alta | Buena | Baja | No, con cero clientes |
| Usage puro | Alta | Excelente | Baja | El comprador español teme la factura variable |
| Base + add-ons | Media | **Excelente** | Media | **Sí, como segunda fase** |

**Razonamiento.** Con cero clientes, cada plan adicional es una hipótesis más que
validar simultáneamente. Tres planes obligan al prospecto a elegir antes de
entender el producto, y obligan al fundador a mantener tres historias
comerciales. **Dos planes de pago más un nivel gratuito** reduce la decisión a
"¿empiezo o ya estoy en serio?".

---

## 7. Test de estrés del pricing actual

### 7.1 Aritmética (ARPA con el mix del propio modelo, coste variable 50 €)

| Δ precio | Inicia | Despacho | Firma | ARPA | Contrib. | Clientes p/ 5k€ | p/ 14k€ | p/ 32k€ |
|---|---|---|---|---|---|---|---|---|
| −50 % | 75 | 175 | 375 | 134 € | 84 € | **60** | 167 | 381 |
| −30 % | 104 | 244 | 524 | 187 € | 137 € | 37 | 103 | 235 |
| −20 % | 119 | 279 | 599 | 213 € | 163 € | 31 | 86 | 196 |
| **actual** | **149** | **349** | **749** | **267 €** | **217 €** | **24** | **65** | **148** |
| +20 % | 179 | 419 | 899 | 321 € | 271 € | 19 | 52 | 119 |
| +30 % | 194 | 454 | 974 | 347 € | 297 € | 17 | 48 | 108 |
| +50 % | 224 | 524 | 1.124 | 401 € | 351 € | 15 | 40 | 92 |

### 7.2 Zonas de precio

| Zona | Rango (plan medio) | Evidencia |
|---|---|---|
| **DEMASIADO BARATO** | **< 150 €/mes** | Por debajo del software genérico de despacho (Norbia 120 €, LexFlow 70 €) sin poder alegar ser genérico. Obliga a 60 clientes para el punto muerto y destruye la percepción de especialización |
| **COMPETITIVO** | **200-400 €/mes** | Ulpiano Avanzado 382 €. Un despacho Sage completo ≈153 €/usuario/mes. 349 € = **35 %** del presupuesto de software de un despacho de 10 personas |
| **PREMIUM JUSTIFICABLE** | **400-850 €/mes** | Ulpiano Pro 849 €. Sólo para especialistas en sucesiones, no para despacho generalista |
| **INVENDIBLE** | **> 900 €/mes** | Supera el presupuesto total de software del ICP salvo grupo funerario o aseguradora — que son venta enterprise, no de tarifa |

> ⚠️ **Estas zonas se construyen sobre precios de catálogo de competidores, no
> sobre transacciones observadas. [WEAK INFERENCE]** Delimitan lo que el mercado
> **publica**, no lo que el mercado **paga**.
>
> **Conclusión 6 [matizada].** 349 € está dentro de la zona que el mercado
> publica, cerca de su centro. No hay argumento de mercado para bajarlo, y bajarlo
> un 50 % multiplicaría por 2,5 los clientes necesarios: con un solo vendedor, eso
> convierte un plan difícil en imposible. **No bajar precios.**
>
> **Tampoco subir.** Sin un cliente, una subida es una hipótesis sobre una
> hipótesis.
>
> **Y lo más importante: mantenerlos no equivale a validarlos.** 149/349 siguen
> siendo **hipótesis de precio**. Lo que se sabe es que no son absurdos; no que
> alguien los pague. **[HYPOTHESIS TO TEST]**

### 7.3 El problema de margen que sí es real: el plan Firma

Coste de IA por expediente con precios verificados de Anthropic (supuesto:
200k tokens de entrada + 30k de salida por expediente — **[HIPÓTESIS a medir]**):

| Modelo | USD/expediente |
|---|---|
| Haiku 4.5 | 0,35 |
| Sonnet 5 | 0,70 |
| Opus 5 | 1,75 |

**Margen bruto por plan en el peor caso** (todos los expedientes incluidos
consumidos **e** IA activada), incluyendo infraestructura y comisión de cobro:

| Plan | Haiku 4.5 | Sonnet 5 | **Opus 5** |
|---|---|---|---|
| Inicia (15 exp.) | 88 % | 84 % | 74 % |
| Despacho (50 exp.) | 84 % | 79 % | 64 % |
| **Firma (200 exp.)** | 74 % | 64 % | **36 %** |

> **Conclusión 7.** Firma a 749 € con 200 expedientes ingresa **3,75 €/expediente**
> frente a 1,75 € de inferencia si se sirve con un modelo de gama alta: **36 % de
> margen bruto en un negocio que debería estar en el 81 %**.
>
> **Esto también invierte el juicio sobre los topes duros:** hoy son lo único que
> impide que un cliente de 149 € procese 60 expedientes con IA y deje pérdidas. El
> tope es necesario — lo que está mal es **dónde** está puesto (§5.2).
>
> **Palancas antes de tocar el precio:** *prompt caching* (lectura de caché en
> Opus 5 es **10× más barata** que entrada fresca), **Batch API −50 %** para lo no
> interactivo, y **cascada de modelos** (Haiku para extracción y clasificación,
> Opus sólo para el razonamiento jurídico). Bien hecho, recorta el coste por
> expediente un 60-70 %.
>
> **Contexto que quita dramatismo:** el margen mediano objetivo del mercado para
> funcionalidades de IA es **~50 %**, frente al 70-80 % del SaaS clásico; sólo el
> 12 % aspira a 80 %+. **[CONFIRMADO]** HEREDIA no está fuera de mercado — pero no
> puede presupuestar como un SaaS del 80 %.

---

## 8. Packaging: qué va en cada nivel

Criterios: valor percibido, coste marginal, diferenciación, necesidad,
disposición a pagar, ingreso de expansión y palanca de venta.

### INCLUIDO PARA TODOS (incluido el nivel gratuito)

Todo lo que hace que el producto se **use**, porque el uso es el activo:

- Expedientes, checklist, tareas, plazos y dependencias
- **Motor de plazos ISD con aviso del mes 5** — el diferenciador; nunca detrás de un muro
- Cálculo ISD orientativo por CCAA y plusvalía
- Portal familia y mensajería
- Documentos y export PDF/ZIP
- Auditoría, roles y permisos *(seguridad nunca es un upsell: es descalificatoria si falta)*
- Etiquetado de IA y minimización

### CORE (plan de pago de entrada)

- Todo lo anterior sin límite de 1 expediente
- Borrador Modelo 650/651
- **Pack banco unificado**
- Plantillas de documentos
- Recordatorios automáticos por email
- Importación CSV/Excel

### PRO (plan de pago superior)

- Portal familia **white-label**
- Plantillas versionadas con aprobación
- Reporting operativo (lead time, bloqueos, Radar ISD agregado)
- Workflows configurables
- Multi-sede
- Soporte prioritario

### ENTERPRISE (sin precio público)

- SSO empresarial *(hoy **no existe** — ver doc. 01)*
- API de datos de cliente *(hoy **no existe**)*
- Webhooks salientes *(sí existe)*
- SLA, DPA extendido, revisión de seguridad
- Onboarding dedicado y migración

### ADD-ON (facturable aparte)

- **Créditos de IA** por encima del volumen incluido
- Almacenamiento adicional
- **Módulo PBC/blanqueo** — ver doc. 04 y 07
- Migración de datos
- Formación

### RETIRAR DE LA OFERTA ACTUAL

- **"SSO" del plan Firma** — no existe como se vende
- **"API" del plan Firma** — sólo hay webhooks salientes
- **"DPA extendido"** — hasta que el DPA exista
- El **tercer plan** como oferta de tarifa pública (pasa a *contactar ventas*)

---

## 9. Límites: cuándo monetizan y cuándo castigan

| Límite | ¿Monetiza o castiga? | Recomendación |
|---|---|---|
| **Expedientes activos** | **Monetiza** — escala con el valor y con el coste | **Sí. Ésta es la métrica.** 3 / 15 / 40 activos |
| Expedientes/mes | **Castiga** — bloquea en el peor momento y nunca se alcanza | **Eliminar** |
| **Usuarios** | Neutro-castiga: invitar a un compañero es adopción, y la adopción es retención | Límites **generosos**, no como palanca principal |
| **Almacenamiento** | Monetiza limpiamente, coste real, fácil de entender | **Sí.** 5 / 50 / 250 GB |
| **IA (expedientes analizados)** | **Monetiza** — es el único coste variable grande | **Sí**, con créditos y recarga |
| Emails | Castiga | No limitar |
| **Portales familia** | **Castiga gravemente** — es el motor de adopción y de viralidad | **Nunca limitar** |
| Automatizaciones | Castiga | No limitar; reservar las avanzadas a PRO por funcionalidad |
| Integraciones | Neutro | Por funcionalidad, no por cantidad |

**Principio rector:** *limitar lo que cuesta dinero (IA, almacenamiento) y lo que
escala con el valor (expedientes activos). No limitar nunca lo que produce
adopción (usuarios, portales, emails, automatizaciones).*

---

## 10. Excedentes: qué pasa al superar el límite

| Opción | Efecto | Veredicto |
|---|---|---|
| **A. Bloquear** | Cliente parado a mitad de un plazo legal → no hace upgrade, llama enfadado y se va | **No** — es lo que hay hoy |
| B. Cobrar automáticamente | Protege margen, pero el *bill shock* es la primera causa de tickets de precio y un motor de churn en modelos de uso **[CONFIRMADO]** | No como única vía |
| C. Forzar el siguiente plan | Salto brusco, sensación de castigo | No |
| **D. Paquetes adicionales a un clic** | El cliente elige, sin sorpresa | **Sí, para IA y almacenamiento** |
| E. Sin límite | Insostenible con el coste de IA (§7.3) | No |

**Recomendación: tope duro con buenos modales.**

1. Avisos al **50 %, 80 % y 100 %** del cupo.
2. **Colchón de cortesía del 20 %** que se consume con aviso visible — nadie se
   queda parado con un plazo encima.
3. **Upgrade en un clic desde dentro del producto**, sin hablar con nadie.
4. Para IA y almacenamiento: **paquete adicional**, no bloqueo.

Esto no es facturación por excedentes: es un tope duro que no arruina el día a
nadie.

---

## 11. Cuotas de alta (setup)

**Situación actual:** Despacho 299 €, Firma 990 €. Como % del contrato anual:
**7,1 %** y **11,0 %** respectivamente — estructuralmente sano (por encima del
15-20 % el mix de servicios hunde el margen bruto, porque los servicios rinden
~30 % frente al 81 % de la suscripción **[CONFIRMADO]**).

**Contexto español [CONFIRMADO]:** la implantación de software en asesorías va de
375 a 8.250 €, con valor más frecuente **2.375 €**; en despachos de 1-3 empleados,
el **39,4 % paga entre 1 y 500 €**. Norbia cobra **600 €** sobre una cuota de
120 €/mes; Amberlo **299 €** sobre 59 €/usuario/mes.

**Pero el competidor directo cobra 0 €.** Y el efecto de las cuotas de setup sobre
la conversión **no está medido en ninguna literatura publicada** **[DESCONOCIDO]** —
es el candidato número uno a test A/B cuando haya flujo de leads.

### Recomendación

| Decisión | Razón |
|---|---|
| **Eliminar el setup del plan de entrada** | Ya es 0 €. Mantener |
| **Convertir el setup del plan medio en opcional y explícito: "Puesta en marcha asistida, 299 €"** | Deja de ser un peaje y pasa a ser un servicio que el cliente elige. Quien no lo quiere, no lo paga y no se va |
| **Bonificar el setup al 100 % con contratación anual** | Convierte una objeción en un argumento de cierre y empuja al anual, que es donde está la caja |
| **Gratis para los 10 primeros clientes** | Además sirve para **medir cuánto cuesta realmente implantar** antes de ponerle precio |
| **Mantener el setup alto sólo en Enterprise**, donde es migración y onboarding real | Ahí sí hay trabajo que justificarlo |

---

## 12. Contrato anual y forma de cobro

### Profundidad del descuento

**Evidencia [CONFIRMADO]:** todas las empresas que ofrecen plan anual descuentan;
**más de la mitad descuenta entre el 15 % y el 20 %**. Y **descuentos por encima
del 20 % correlacionan con mayor churn**.

| Descuento | Anual (Despacho) | Meses equivalentes | Veredicto |
|---|---|---|---|
| 0 % | 4.188 € | 12,0 | Nadie lo contrata |
| 10 % | 3.769 € | 10,8 | Poco incentivo |
| 15 % | 3.560 € | 10,2 | Norma de mercado (Ulpiano −15 %) |
| **16,7 % (actual)** | **3.490 €** | **10,0** | **Correcto. Mantener** |
| 20 % | 3.350 € | 9,6 | Límite; más allá, riesgo de churn |

**Recomendación: mantener el 16,7 %, pero decirlo como "2 meses gratis".** Los
importes en euros y los meses superan a los porcentajes para mover a anual
**[CONFIRMADO]**. Y añadir **−25 % a dos años**, igualando a Ulpiano.

**Lo que de verdad mueve la adopción del anual no es la profundidad del descuento
sino qué plan viene marcado por defecto** **[ESTIMADO, consistente entre
fuentes]**. `pricing-table.tsx` ya arranca en anual — decisión correcta, mantener.

### La mejora de margen más barata disponible: domiciliación SEPA

| Forma de cobro del plan anual (3.490 €) | Coste |
|---|---|
| Tarjeta EEE estándar + Billing | 77,03 € |
| **Tarjeta EEE corporativa** (la que usará una gestoría) **+ Billing** | **122,40 €** |
| **SEPA Direct Debit (0,35 € fijos) + Billing** | **24,78 €** |

**Ahorro: ~98 € por cliente y año.** Además, la domiciliación bancaria es la forma
de pago culturalmente natural del B2B español. **Activar SEPA Direct Debit en
Stripe para el plan anual es una tarde de trabajo y mejora margen, adopción del
anual y conversión a la vez.**

---

## 13. Precio de los primeros pilotos

**Objetivo declarado: validar disposición a pagar y uso real, no maximizar
ingresos.** Entonces el diseño debe optimizar exactamente eso.

| Opción | ¿Valida WTP? | ¿Valida uso? | Veredicto |
|---|---|---|---|
| Gratis, abierto, sin fecha | **No** | Mal — sin coste no hay compromiso | **No** |
| 50 €/mes | Débil | Sí | Señal demasiado baja |
| 99 €/mes | Medio | Sí | Aceptable |
| **Precio de lista + tiempo gratis** | **Sí** | **Sí** | **Recomendado** |
| Piloto reembolsable | Sí | Sí | Buena alternativa |
| Descuento permanente | No — arrastra precio para siempre | Sí | **No** |

**El dato más citado de esta área, y por qué NO es la palanca que parece:**

ChartMogul, *SaaS Conversion Report* (publicado 04-feb-2026, encuesta Typeform de
enero sobre 200 productos B2B) afirma literalmente: *"Free trials that require a
credit card see 30% free-to-paid conversion – more than 5x ones that don't require
one."* Tabla: con tarjeta *"GOOD is 25%-35%"*; sin tarjeta *"4-6%"*.
**La cita es [VERIFIED FACT]. La conclusión que se extrajo de ella era
[WEAK INFERENCE].**

> ⚠️ **Corregido el 22-sep-2026.** La versión anterior lo presentaba como *"la
> única palanca con evidencia cuantificada"*. **No lo es**, por tres razones:
> 1. **No es causalidad.** Pedir tarjeta **selecciona** compradores de alta
>    intención; no los crea. El 5× puede ser enteramente efecto de selección.
> 2. **El denominador cambia.** Mide conversión de *trials iniciados*, no de
>    visitantes. Pedir tarjeta **reduce drásticamente cuántos trials empiezan**:
>    si corta los inicios un 80 % y multiplica la conversión por 5, el neto es cero.
> 3. **Muestra autoinformada y autoseleccionada**, distribuida por email, Slack y
>    redes — con sesgo evidente hacia quien tiene buenos números que reportar.
>
> **Consecuencia práctica:** no contradice la recomendación de lanzar un **plan
> gratuito sin tarjeta** (§15.1). En esta fase el objetivo es **aprender**, no
> optimizar la conversión de un embudo que todavía no tiene tráfico.

No hay dato publicado que compare pilotos gratuitos con pilotos de pago
**[DESCONOCIDO]**, pero el consenso de práctica es unánime: *si no cobras, no es
un piloto — es una demo alargada.*

### Oferta recomendada: **"Socio Fundador" — 10 plazas**

- **Señal de 300 € cobrada hoy**, íntegramente acreditable al primer año. Ésta es
  la prueba de demanda y lo que separa un sí real de un sí cortés.
- **Precio de lista completo y publicado desde el día 1.** Nunca descontar el
  precio público: lo que se regala es **tiempo**, no **precio**.
- **3 meses gratis** al arrancar (≈25 % de descuento efectivo sobre el año 1, pero
  se percibe como tiempo y **expira solo**).
- **Puesta en marcha gratuita** para los 10 primeros.
- **Precio congelado 24 meses** — el incentivo más barato posible: no cuesta caja
  y vale mucho para un gestor.
- A cambio, por escrito: **una sesión de feedback al mes**, permiso de caso de
  estudio y derecho a citarlos como referencia.
- **Con fecha de cierre.** Las evaluaciones acotadas en el tiempo convierten 2-3×
  mejor que las abiertas **[ESTIMADO]**.

---

## 14. Enterprise: cuándo dejar de publicar precio

**Regla: se deja de publicar precio cuando el comprador tiene un proceso de
compra en vez de una decisión.**

Eso ocurre cuando aparece cualquiera de estos: revisión de seguridad, DPA
negociado, SSO, API, SLA, multi-sede, integración con un sistema existente,
onboarding dedicado o compras centralizadas.

**Segmentos que caen automáticamente en enterprise:**

- **Aseguradoras de decesos.** Santalucía, Ocaso y Mapfre **ya prometen gestión
  de herencias** a sus asegurados **[CONFIRMADO]**. Son a la vez canal y
  competidor, y su compra nunca será por tarifa.
- **Grupos funerarios.** Mémora: >62.000 servicios/año, 194 tanatorios; el Plan
  Estratégico 2025-2027 de su matriz **prioriza explícitamente "digitalización y
  eficiencia del servicio"** **[CONFIRMADO]** — la señal de compra más clara
  encontrada en toda la investigación.
- **Firmas grandes y multisede.**

**Marco de precio enterprise, sin inventar cifras de mercado:**

```
Plataforma base anual
  + precio por sede / por marca
  + precio por volumen de expedientes activos (escalones)
  + módulos (SSO, API, PBC, white-label)
  + servicios (migración, onboarding, formación)
  + soporte con SLA
```

**No fijar todavía los importes.** No hay ni un solo dato de compra enterprise, y
el primer contrato de este tipo debe negociarse con coste real de entrega
medido, no con una tarifa inventada.

---

## 15. Salida: precio actual vs recomendado vs a testar

### 15.1 Recomendación v1 — lo que cambiaría hoy

| | **GRATIS** | **CORE** | **PRO** | **ENTERPRISE** |
|---|---|---|---|---|
| **ICP** | Cualquiera que quiera probar con un caso real | Gestoría 1-5 personas, despacho pequeño | Gestoría media y especialista en sucesiones | Grupos funerarios, aseguradoras, multisede |
| **Mensual** | **0 €** | **149 €** | **349 €** | Contactar ventas |
| **Anual** | — | **1.490 €** (2 meses gratis) | **3.490 €** (2 meses gratis) | Anual |
| **2 años** | — | **−25 %** | **−25 %** | Negociado |
| **Setup** | 0 € | 0 € | **299 € opcional, bonificado al 100 % con anual** | Migración a presupuesto |
| **Usuarios** | 1 | **5** | **15** | Ilimitados |
| **Expedientes** | **1 activo** | **3 activos** | **15 activos** | Negociado |
| **Almacenamiento** | 2 GB | 50 GB | 250 GB | Negociado |
| **IA** | No | 25 expedientes analizados/mes | 100/mes | Negociado |
| **Funcionalidad** | Núcleo completo + plazos + portal familia | + Modelo 650/651, pack banco, plantillas, importación | + white-label, aprobaciones, reporting, workflows, multisede, soporte prioritario | + SSO, API, SLA, DPA extendido, PBC |
| **Excedente** | Bloqueo suave con aviso | Paquetes de IA/almacenamiento a un clic | Ídem | Contractual |
| **Contrato** | — | Sin permanencia | Sin permanencia | 12-24 meses |
| **Soporte** | Documentación | Email 48 h | Prioritario 24 h | Dedicado + SLA |

**Los siete cambios y la evidencia que los sostiene:**

| Cambio | Evidencia |
|---|---|
| **Añadir un plan gratuito con 1 expediente activo** | Ulpiano lo tiene y es la puerta de entrada de su embudo **[CONFIRMADO]**. Hoy HEREDIA no tiene ninguna forma de que un prospecto pruebe con un caso real sin hablar con nadie |
| **Cambiar el tope a expedientes ACTIVOS** | Los topes mensuales nunca se alcanzan (§5.2). El competidor directo usa activos. Alinea precio con valor y con coste |
| **Bajar de 3 planes a 2 + gratuito + enterprise** | Firma tiene un ICP distinto (especialista de alto volumen) y hoy no está poblado; con cero clientes, tres planes son tres hipótesis simultáneas |
| **Setup opcional y bonificable** | 299 € es estructuralmente sano (7,1 % del ACV) pero el competidor cobra 0. Hacerlo opcional elimina la objeción sin renunciar al ingreso |
| **Mantener 149/349 — como hipótesis a testar, no como precio validado** | La tarifa de Ulpiano es superior (−22-27 %), **pero con su descuento para colegiados la ventaja cae a ~2,8 %**. No hay argumento de mercado para bajar, y bajar 50 % exige 2,5× más clientes (§7.1). **Ninguna evidencia de que nadie pague estos precios [HYPOTHESIS TO TEST]** |
| **Incluir la IA como cupo, no como funcionalidad ilimitada** | Es el único coste variable grande: 0,35-1,75 $/expediente **[CONFIRMADO precio; HIPÓTESIS el consumo]** |
| **Activar SEPA para el anual** | Ahorra ~98 €/cliente/año y encaja con el comprador español **[CONFIRMADO]** |

### 15.2 Lo que NO recomiendo fijar todavía

**El precio de `Heredia Managed`.** Hoy es 490 €/expediente sin modelo de costes,
sin alcance definido y con riesgo regulatorio abierto (doc. 07). Comparables:
Heredary cobra **450 €/heredero** en su servicio básico y **1.633,50 €** en el
completo; Ulpiano vende back-office **desde 850 €/paquete**; y hay servicios al
consumidor **desde 190 €**. **[CONFIRMADO]**

**Rango de hipótesis: 390-690 €/expediente**, a confirmar sólo después de
cronometrar tres expedientes reales de principio a fin. Sin eso, cualquier precio
es una apuesta sobre un coste que nadie ha medido.

**El precio enterprise.** Sin datos de compra, cualquier tarifa es ficción.

### 15.3 Precios a testar (el experimento)

| Hipótesis | Cómo se testa | Qué la confirma |
|---|---|---|
| **H1: 349 € es aceptable para el plan PRO** | Gabor-Granger `99→749` sobre 40-60 gestorías + las 10 señales de fundador | ≥30 % acepta 349 € y al menos 5 pagan la señal |
| **H2: el plan gratuito aumenta el embudo sin canibalizar** | Publicar gratis con 1 expediente activo y medir gratis→CORE a 60 días | ≥8 % convierte |
| **H3: el setup opcional no reduce la conversión** | A/B: setup obligatorio vs opcional bonificado | Diferencia de conversión < 5 puntos |
| **H4: expedientes activos es la métrica correcta** | Preguntar en las 12-15 entrevistas cuántos expedientes tienen **abiertos ahora mismo** | La distribución cae en 2-20, no en cientos |
| **H5: el coste real de IA por expediente** | Pasar un expediente real anonimizado por el pipeline y contar tokens | Confirma o refuta el supuesto 200k/30k |

---

## 16. Los tres números que quedan sin establecer

1. **El coste real de IA por expediente.** Todo el análisis de margen de §7.3
   descansa en un supuesto mío de 200k/30k tokens. **Es el único número de este
   documento convertible de estimación en hecho en dos horas**, y debería hacerse
   antes que nada.
2. **Cuántos expedientes de herencia tramita realmente una gestoría española al
   año.** Determina si la métrica de valor propuesta está bien calibrada. Se
   responde en las primeras 12 entrevistas.
3. **Qué efecto tiene la cuota de setup sobre la conversión.** No existe
   literatura publicada. Sólo lo descubriréis vosotros, con tráfico.

→ Plan de ejecución de los tres: `08-EXPERIMENTOS-14-DIAS.md`
