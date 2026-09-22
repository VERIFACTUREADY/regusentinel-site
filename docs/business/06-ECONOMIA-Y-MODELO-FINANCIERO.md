# 06 — Economía del negocio y crítica del modelo financiero

> **Fecha:** 21 de septiembre de 2026
> **Base:** `src/lib/financial-model.ts`, `src/lib/roi-calculator.ts`,
> `src/lib/stripe.ts`, ejecutados y re-verificados numéricamente.
> Toda cifra marcada **[MODELO]** sale de ejecutar el código propio de HEREDIA;
> **[ARITMÉTICA]** es cálculo directo verificable; **[SUPUESTO]** es una
> hipótesis explícita, no un dato.

---

## 1. Qué proyecta hoy el modelo propio de HEREDIA

El repositorio contiene dos escenarios en `financial-model.ts`. Los he ejecutado
tal cual, sin tocar una sola constante.

### Escenario CONSERVADOR (el que el propio código llama *"defendible ante due diligence"*)

| Mes | Visitas SEO | Trials/mes | Clientes | MRR | ARR | Cash acumulado |
|---|---|---|---|---|---|---|
| 6 | 1.374 | 5,2 | 3 | 913 € | 10.956 € | −27.657 € |
| 12 | 3.733 | 14,0 | 15 | 3.937 € | 47.244 € | −44.662 € |
| 18 | 6.260 | 23,5 | 34 | 9.178 € | 110.136 € | −94.061 € |
| 24 | 10.499 | 39,4 | 66 | 17.604 € | 211.248 € | −108.529 € |
| 36 | 29.529 | 110,7 | 213 | 56.774 € | 681.288 € | **−134.457 €** |

**[MODELO]** ARPA 267 €/mes · setup medio 183 € · **EBITDA mensual positivo en el
mes 24** · **caja acumulada nunca positiva en 36 meses** · capital máximo
necesario **173.756 €**.

### El docstring no coincide con lo que el modelo produce

El comentario de `CONSERVATIVE_ASSUMPTIONS` (`financial-model.ts:104-107`)
promete: *"break-even mes 28-32, capital ~150-200k, ARR Y3 ~700k-1M EUR, margen
EBITDA Y3 25-35%."*

| Afirmación del docstring | Resultado real al ejecutarlo | Veredicto |
|---|---|---|
| Break-even mes 28-32 | EBITDA mensual positivo en m24; caja acumulada positiva **nunca** dentro de 36 meses. La propia función devuelve `breakEvenMonth = null`. | **No se sostiene con ninguna de las dos definiciones** |
| Capital ~150-200k | 173.756 € | Correcto |
| ARR Y3 700k-1M | 681.288 € | Ligeramente por debajo |

No es un error de cálculo del código: el código está bien. Es que **la
documentación describe un resultado más benigno que el que el modelo produce**.
Si esto llega a un inversor tal cual, lo descubre en la primera hoja de cálculo.

### Escenario STRETCH: por qué no debe usarse para nada

**[MODELO]** Break-even mes 8, capital 3.201 €, ARR Y3 3,37 M€.

Es inalcanzable por construcción, porque asume `cacPerNewCustomer: 0`. El propio
comentario lo justifica como *"100 % orgánico, asume contenido evergreen sin
coste imputado"*. Un CAC de cero no es optimismo: es la eliminación de la
variable que decide si un SaaS vive o muere. Cualquier conclusión derivada de
este escenario (incluida "sólo necesito 3.000 € para arrancar") es inválida.

**Recomendación:** renombrar el escenario STRETCH a *"techo teórico, no
planificable"* o eliminarlo. Riesgo que mitiga: decisiones de negocio tomadas
sobre una cifra imposible.

---

## 2. El modelo es frágil: una sola variable adversa lo rompe

He movido **una variable cada vez** sobre el escenario conservador, dejando todo
lo demás intacto. **[MODELO]**

| Variable modificada | Clientes m36 | ARR m36 | Capital necesario | Δ vs base |
|---|---|---|---|---|
| **Base conservador** | 213 | 681.288 € | **173.756 €** | — |
| Conversión trial→pago 20 % → 10 % | 106 | 340.644 € | **373.229 €** | ×2,1 |
| Churn Y1 3,5 % → 5 % | 201 | 642.492 € | 189.656 € | ×1,1 |
| Uso de herramientas gratis 15 % → 8 % | 113 | 363.348 € | **357.310 €** | ×2,1 |
| Crecimiento SEO 28 % → 15 % mensual | 46 | 147.468 € | **476.727 €** | ×2,7 |
| Visitas iniciales 400 → 100 | 53 | 170.316 € | **492.614 €** | ×2,8 |

**Lectura.** El resultado del negocio no depende del precio: depende casi
enteramente de **dos supuestos de tráfico** (visitas iniciales y tasa de
crecimiento SEO) que hoy **valen cero**, porque el dominio `heredia.app` no
resuelve y no hay ningún sitio publicado (ver `01-AUDITORIA-PRODUCTO.md`, §0).

El modelo financiero de HEREDIA es, hoy, un modelo de un canal que todavía no
existe. Ésa es la conclusión financiera central de este documento.

---

## 3. Los únicos tres números operativos que importan ahora

Olvidando proyecciones a 36 meses, esto es lo que hay que saber. **[ARITMÉTICA]**

**Fórmulas** *(explicitadas el 22-sep-2026 — la versión anterior daba el
resultado sin la derivación)*:

```
(1)  ARPA = Σ(precio_plan_i × mix_i) / Σ(mix_i)
(2)  C    = ARPA − CosteVariable          (contribución por cliente)
(3)  N    = ⌈ OPEX_fijo_mensual / C ⌉
```

> ⚠️ **Qué significa N exactamente, y qué no.** N es el número de clientes en
> **estado estacionario** que cubre el OPEX fijo **ignorando el CAC** — es decir,
> supone que **no se está adquiriendo ningún cliente nuevo**. En cuanto hay
> adquisición, el umbral real es mayor. **N es un suelo, no un objetivo.**

Con ARPA 267 €/mes y coste variable 50 €/cliente/mes (**ambos supuestos del propio
modelo, ninguno medido**), la contribución por cliente es 217 €/mes:

```
ARPA = (149×55 + 349×38 + 749×7) / 100 = 26.700/100 = 267,00 €
C    = 267 − 50 = 217 €
N    = ⌈5.000 / 217⌉ = ⌈23,04⌉ = 24 clientes
```

**Pero el resultado es extremadamente sensible al mix supuesto**, del que **no
existe ningún dato** (cero clientes):

| Mix supuesto | ARPA | C | **N (OPEX 5.000 €)** |
|---|---|---|---|
| 100 % Inicia | 149 € | 99 € | **51 clientes** |
| **Mix del repo (55/38/7)** | **267 €** | **217 €** | **24 clientes** |
| 50/50 Inicia-Despacho | 249 € | 199 € | 26 clientes |
| 100 % Despacho | 349 € | 299 € | 17 clientes |

Y al coste variable y a la estructura de costes:

| OPEX/mes | vc = 25 € | **vc = 50 €** | vc = 100 € |
|---|---|---|---|
| **1.200 € (fundador sin sueldo)** | 5 | **6** | 8 |
| 2.500 € (autónomo + gastos) | 11 | **12** | 15 |
| **5.000 € (modelo, Y1)** | 21 | **24** | 30 |
| 14.000 € (modelo, Y2) | 58 | **65** | 84 |

> ⚠️ **Corregido el 22-sep-2026.** La versión anterior afirmaba *"~24 clientes"*
> como objetivo. **Esa cifra es exacta sólo bajo tres supuestos simultáneos**
> —mix 55/38/7, coste variable de 50 € y OPEX de 5.000 €—, **y el primero no tiene
> ningún dato detrás**. El plan de entrada suele captar la mayoría de los primeros
> clientes, lo que empuja hacia el extremo alto (51).
>
> **Formulación correcta [STRONG INFERENCE en el orden de magnitud]:**
> **entre 6 y 12 clientes si el fundador no se paga sueldo; entre 20 y 50 con
> sueldo y estructura mínima.**
>
> **Lo que sobrevive y es robusto a todos los supuestos probados:** HEREDIA
> necesita **decenas de clientes, no cientos ni miles**. Eso define un negocio
> alcanzable por venta directa de un fundador, y descarta cualquier estrategia que
> requiera volumen.

> **Nota sobre el OPEX Y1 de 5.000 €/mes.** Incluye *"payroll fundador mínimo"*.
> Si el fundador no se paga en Y1, el OPEX real baja a ~800-1.500 €/mes
> (infraestructura, herramientas, asesoría, seguro) y el umbral cae a **4-7
> clientes**. Esta distinción cambia radicalmente la urgencia de captar capital
> y debería hacerse explícita en el modelo en lugar de quedar enterrada en un
> comentario. **[SUPUESTO]** — los costes concretos se cierran en §6.

---

## 4. Test de estrés del pricing actual (149 / 349 / 749 €)

Aritmética pura, sin suponer todavía ninguna elasticidad. **[ARITMÉTICA]**

| Δ precio | Inicia | Despacho | Firma | ARPA | Contrib./cliente | Clientes p/ 5k€ | p/ 14k€ | p/ 32k€ | ARR con 50 clientes |
|---|---|---|---|---|---|---|---|---|---|
| **−50 %** | 75 | 175 | 375 | 134 € | 84 € | 60 | 167 | 381 | 80.400 € |
| **−30 %** | 104 | 244 | 524 | 187 € | 137 € | 37 | 103 | 235 | 111.960 € |
| **−20 %** | 119 | 279 | 599 | 213 € | 163 € | 31 | 86 | 196 | 128.040 € |
| **actual** | 149 | 349 | 749 | 267 € | 217 € | **24** | 65 | 148 | 160.200 € |
| **+20 %** | 179 | 419 | 899 | 321 € | 271 € | 19 | 52 | 119 | 192.360 € |
| **+30 %** | 194 | 454 | 974 | 347 € | 297 € | 17 | 48 | 108 | 208.440 € |
| **+50 %** | 224 | 524 | 1.124 | 401 € | 351 € | 15 | 40 | 92 | 240.600 € |

### Lo que esta tabla demuestra y lo que no

**Demuestra:** bajar precio un 50 % obliga a captar **2,5 veces más clientes**
(60 en vez de 24) para el mismo punto muerto. Para un fundador en solitario que
vende a mano, eso no es una palanca de crecimiento: es la diferencia entre
posible e imposible. **Con un canal de venta asistido y un solo vendedor, bajar
precio es la peor de las opciones disponibles.**

**No demuestra:** que se pueda subir. La tabla asume que se vende lo mismo a
cualquier precio, y eso es falso. Sin un solo cliente, no existe curva de
demanda. El análisis de dónde está la zona TOO CHEAP / COMPETITIVE / PREMIUM /
UNSELLABLE se hace en `03-PRICING.md` con los comparables de mercado; aquí sólo
se fija la restricción financiera.

---

## 5. Precio efectivo por unidad: la métrica de valor no está funcionando

**[ARITMÉTICA]** Dividiendo el precio del plan por sus límites incluidos:

| Plan | €/mes | €/expediente incluido | €/usuario | Capacidad anual implícita |
|---|---|---|---|---|
| Inicia | 149 | **9,93 €** | 74,50 € | 180 expedientes |
| Despacho | 349 | **6,98 €** | 69,80 € | 600 expedientes |
| Firma | 749 | **3,75 €** | 37,45 € | 2.400 expedientes |

Tres problemas visibles sin necesidad de dato externo:

1. **El precio por expediente baja un 62 % de Inicia a Firma.** Es el patrón de
   descuento por volumen habitual, pero si el valor de HEREDIA es *por
   expediente*, entonces el cliente grande está pagando 2,6 veces menos por
   unidad de valor entregado. La métrica de valor y el precio no están alineados.

2. **Las capacidades anuales implícitas son enormes.** El plan de entrada
   permite 180 herencias al año; el plan medio, 600. La pregunta que decide toda
   la arquitectura de precios es: **¿cuántas herencias tramita realmente al año
   una gestoría española media?** Si la respuesta está en decenas y no en
   centenares, entonces el límite de expedientes **nunca se alcanza**, no
   segmenta nada, y los tres planes se diferencian en la práctica sólo por el
   número de usuarios y por funcionalidades. (Datos de mercado en
   `02-MERCADO-Y-COMPETENCIA.md`; conclusión de diseño en `03-PRICING.md`.)

3. **La calculadora de ROI pública asume 50 expedientes al mes por defecto**
   (`src/app/calculadora-roi/roi-client.tsx:23`) — es decir, **600 herencias al
   año**. Si ese número está muy por encima del cliente real, la calculadora
   exagera sistemáticamente el ROI ante cada visitante, y el primer cliente que
   ajuste el dato a su realidad verá una cifra mucho peor que la prometida. Es
   un riesgo de credibilidad en el momento exacto de la venta.

---

## 6. El coste variable de 50 €/cliente/mes: probablemente mal estimado en ambos sentidos

`variableCostPerCustomer: 50` incluye, según el propio comentario, *"infra + AI +
Stripe + email + 30 min soporte/cliente"*.

**Problemas del supuesto:**

- **La IA está desactivada por defecto** (`aiEnabled @default(false)`), así que
  para la mayoría de clientes ese coste es **cero**, no el que se presupuesta.
  Cuando se activa, el coste depende del volumen de expedientes, no del cliente:
  es un coste **por uso**, y modelarlo como fijo por cliente oculta que un
  cliente de alto volumen con IA activada puede tener un margen muy distinto.
- **30 minutos de soporte al mes por cliente** es optimista para un producto
  vertical con normativa autonómica, en su primer año, vendido a despachos poco
  digitalizados. Si son 2 horas, el coste variable real se acerca a los 100-120 €
  y la contribución por cliente cae de 217 € a ~150 €, subiendo el umbral de
  24 a **34 clientes**.
- **No incluye el mantenimiento normativo de 19 CCAA**, que es el coste
  recurrente estructural de este producto (ver `01-AUDITORIA-PRODUCTO.md`, §4).
  Es un coste fijo, no variable, pero hoy no aparece en ninguna línea del modelo.

**Acción:** separar el coste en tres líneas —infraestructura por cliente, uso de
IA por expediente, y mantenimiento normativo como OPEX fijo— en lugar de un
único número de 50 €. Riesgo que mitiga: fijar precios sobre un margen bruto que
no es el real.

---

## 7. El elefante: `Heredia Managed` genera 13× el mejor plan de software

**[ARITMÉTICA]** Con los precios publicados en `/precios`:

| Comparación | Resultado |
|---|---|
| Un solo expediente Managed (490 €) | equivale a **3,3 meses** del plan Inicia o **1,4 meses** del plan Despacho |
| 30 expedientes/mes a 330 € | **9.900 €/mes** de un solo cliente |
| El mejor plan de software (Firma) | 749 €/mes |
| Ratio | **×13** |

Un solo cliente Managed de volumen medio factura más que **trece** clientes del
plan de software más caro. Y los umbrales de la §3 se alcanzarían con **un
único** cliente Managed de 15-20 expedientes al mes.

Esto plantea la pregunta estratégica más importante de todo el análisis, y **no
se puede responder desde la aritmética**:

> ¿HEREDIA es una empresa de software que además presta un servicio, o una
> empresa de servicios que ha construido su propio software?

Las dos son negocios legítimos. Tienen **márgenes, estructura de costes,
escalabilidad, valoración y riesgo regulatorio completamente distintos**:

| | SaaS puro | Servicio gestionado |
|---|---|---|
| Margen bruto | 75-85 % **[SUPUESTO sectorial]** | limitado por horas humanas |
| Escala | marginal ≈ 0 | lineal con plantilla |
| Tiempo del fundador | producto y canal | operación de expedientes |
| Riesgo regulatorio | bajo (proveedor de herramienta) | **alto** — ver `07-RIESGO-LEGAL-Y-NEGOCIO.md` |
| Velocidad para los primeros ingresos | lenta | **rápida** |

Hoy HEREDIA vende ambas en la misma página de precios, sin haber modelado
ninguna de las dos para el servicio. El análisis completo —incluido si Managed
debe prestarse en propio, con socio, o retirarse— está en
`04-PORTFOLIO-SERVICIOS.md`, §7, y su exposición legal en `07`.

---

## 8. Conclusiones financieras

1. **El modelo conservador no llega a caja positiva en 36 meses** y necesita
   ~174 k€. El docstring que promete break-even en el mes 28-32 debe corregirse.
2. **El escenario STRETCH no es utilizable** por asumir CAC = 0.
3. **El resultado depende del tráfico SEO, no del precio.** Las dos variables
   más destructivas al moverse son las de adquisición, y hoy valen cero porque no
   hay sitio publicado.
4. **El objetivo operativo correcto para 12 meses son decenas de clientes, no un
   ARR:** entre **6 y 12** si el fundador no se paga sueldo, entre **20 y 50** con
   sueldo y estructura mínima. *(Corregido: la cifra anterior de "~24" dependía de
   un mix de planes inventado; ver §3.)*
5. **Bajar precios está financieramente descartado** en un canal de venta
   asistida con un solo vendedor: multiplica por 2,5 el número de clientes
   necesarios.
6. **El coste variable de 50 € debe descomponerse**, y el mantenimiento
   normativo de 19 CCAA debe aparecer como coste fijo explícito.
7. **La decisión software-vs-servicio es la decisión financiera principal
   pendiente**, y ningún número la resuelve: la resuelve una elección sobre qué
   empresa se quiere construir.

→ Precios recomendados y experimentos para validarlos: `03-PRICING.md`
→ Qué vender y qué retirar: `04-PORTFOLIO-SERVICIOS.md`
