# 02 — Mercado y competencia

> **Fecha:** 22 de septiembre de 2026
> Etiquetas: **[CONFIRMADO]** fuente primaria con URL · **[ESTIMADO]** inferido,
> con la aritmética a la vista · **[DESCONOCIDO]** no establecido.
>
> **Nota de método.** El agente de investigación asignado al dimensionamiento de
> mercado se interrumpió por límite de uso antes de terminar. Las cifras de esta
> sección se han recuperado después por consulta directa, pero **varios huecos
> siguen abiertos y están señalados como tales en §7**. No se ha rellenado ningún
> hueco con estimaciones inventadas.

---

## 1. El mercado, en cifras verificadas

### 1.1 El hecho generador

| Dato | Valor | Fuente |
|---|---|---|
| **Defunciones en España, 2025** | **441.270** (222.711 hombres, 218.559 mujeres) — datos provisionales, definitivos en dic-2026 | INE, Estadística de Defunciones según la Causa de Muerte **[CONFIRMADO]** |
| Estimación alternativa por registro civil, 2025 | 446.982 (+2,5 % interanual) | INE, EDeS **[CONFIRMADO]** |
| Defunciones 2024 | 433.547 (−0,59 % vs 2023) | PANASEF, *Radiografía del sector funerario* **[ESTIMADO vía secundaria]** |
| Tasa bruta de mortalidad 2025 | 894,1 por 100.000 habitantes | INE **[CONFIRMADO]** |

### 1.2 El impuesto que HEREDIA orbita

| Dato | Valor | Fuente |
|---|---|---|
| **Recaudación ISD prevista 2025** | **1.383 M€** (frente a 1.375 M€ en 2024) | Estimaciones de Hacienda vía prensa económica **[ESTIMADO]** |
| Variación 2025 | **−0,6 %** — el único gran impuesto autonómico que baja | ídem **[ESTIMADO]** |
| Potencial si todas las CCAA alinearan parámetros con la ley estatal | 10.200 M€ (0,7 % del PIB) | Banco de España **[ESTIMADO vía secundaria]** |

> **Lectura estratégica incómoda.** La recaudación del ISD **cae**, porque las CCAA
> compiten bonificando el impuesto. Eso significa que **la cuota a pagar de un
> expediente medio tiende a cero en muchas comunidades** — y con ella, parte del
> argumento "te ahorramos recargos". **Lo que no desaparece es la obligación de
> presentar**: incluso con cuota cero, hay que declarar en plazo, y las
> bonificaciones autonómicas suelen exigir presentación en plazo para aplicarse.
>
> **Consecuencia para el posicionamiento:** el dolor del cliente no es
> principalmente fiscal. Es **administrativo y documental**. Vender HEREDIA como
> "optimización fiscal" es vender contra una tendencia a la baja; venderlo como
> "el expediente no se te atasca y no pierdes la bonificación por presentar
> tarde" es vender contra un problema que crece.

### 1.3 Los compradores

| Segmento | Tamaño | Fuente |
|---|---|---|
| **Gestores administrativos colegiados** | **~6.000 en toda España**, en 22 colegios territoriales | Consejo General **[CONFIRMADO]** |
| **Abogados colegiados** | **237.239** total; **149.695 ejercientes** | CGAE, Abogacía en Datos **[CONFIRMADO]** |
| **Empresas CNAE 6920** (contabilidad, auditoría, asesoría fiscal) | **53.998 empresas** | Directorio CNAE / DIRCE **[CONFIRMADO]** |
| Asesoría de empresas en sentido amplio | >82.000 empresas, >300.000 empleados, >28.000 M€ de facturación | INE **[ESTIMADO vía secundaria]** |
| **Empresas funerarias** | **~1.404 empresas**, 11.126 empleados, **1.430 M€** de facturación | PANASEF **[CONFIRMADO vía cita]** |
| Miembros de PANASEF | **500 empresas** (~65 % del sector) | PANASEF **[CONFIRMADO]** |

### 1.4 El dato que cambia la estrategia comercial

**Estructura de tamaño del CNAE 69.2 [WEAK INFERENCE por antigüedad — ver aviso]:**

- **52,32 % de las empresas no tienen ningún asalariado**
- **30,73 % tienen 1-2 asalariados**
- ⇒ **~83 % del mercado objetivo son negocios de 0-2 personas**

> ⚠️ **Corregido el 22-sep-2026.** Esta cifra se presentó como actual. **Procede
> de datos DIRCE de 2021, publicados en abril de 2022 por el Centro de Innovación
> de Despachos Profesionales — tiene cinco años.** El propio análisis cita que el
> sector se contrajo ~7 % en tres años con >11.000 despachos cerrados, lo que
> sugiere consolidación y por tanto que el porcentaje puede haber cambiado.
> **DIRCE publica anualmente: refrescar antes de fijar el ICP definitivamente.**

> En esas empresas **el propietario es simultáneamente decisor, usuario, pagador
> e implantador**. No hay comité de compras, no hay procurement, no hay
> departamento de IT. Es la mejor noticia de este documento para un fundador en
> solitario: **una sola conversación cierra la venta**.
>
> Y es también la razón por la que la fricción de entrada de HEREDIA (setup de
> 299/990 €, sin plan gratuito, sin poder comprar desde `/precios`) es tan cara:
> ese comprador decide en minutos o no decide.

### 1.5 El presupuesto real disponible

**[CONFIRMADO, estudio sobre 157 gestorías, dic-2025/ene-2026]:**

- El software supone **~7,4 % de los costes operativos** de una gestoría.
- Un despacho de 10 personas gasta **~12.000 €/año en software total**
  (12.000 € de 162.000 € de costes anuales).

Lo que cobran esas gestorías a sus propios clientes (medianas):

| Perfil de cliente | P25 | **Mediana** | P75 |
|---|---|---|---|
| Autónomo básico | 35 € | **50 €/mes** | 70 € |
| Autónomo complejo | 80 € | **110 €/mes** | 150 € |
| Pyme 1-10 empleados | 150 € | **200 €/mes** | 280 € |
| Pyme 10-50 empleados | 350 € | **500 €/mes** | 750 € |

> **Implicación de pricing directa:** HEREDIA Despacho (349 €/mes = 4.188 €/año)
> consume **~35 %** del presupuesto anual de software de un despacho de 10
> personas. Es defendible si HEREDIA sustituye trabajo facturable; es indefendible
> si se percibe como "una herramienta más". Ver `03-PRICING.md`, §1.4.

---

## 2. El mapa competitivo real

HEREDIA no compite en una categoría vacía. Compite, simultáneamente, en cuatro
frentes distintos.

### 2.1 Frente 1 — El competidor directo: **Ulpiano**

`ulpiano.es`, *"El sistema operativo para las herencias"*. **Verificado
directamente el 21-sep-2026.** **[CONFIRMADO]**

**Es el mismo producto, para el mismo comprador, con los precios publicados.**

- Segmentos declarados: **despachos, notarías, asesorías fiscales, family offices,
  funerarias y aseguradoras** — exactamente los tres ICP de HEREDIA más tres más.
- Funcionalidad: expediente estructurado, árbol familiar, cálculo de legítimas,
  simulación ISD en tiempo real, cumplimentación de **Modelos 650/651/652/653/660**,
  OCR/IA sobre certificados y escrituras, control del plazo de 6 meses, inventario
  de activos digitales, cuaderno particional.
- **Producto white-label específico para funerarias**, con portal familia con
  marca de la funeraria, presentado como ingreso recurrente nuevo *"sin contratar
  personal jurídico ni fiscal"*; afirman cubrir el 80 % de la tramitación.
- Precios: **Free 0 € / Esencial 169 € / Avanzado 382 € / Pro 849 €** + Enterprise.
  **Sin cuota de alta.** −15 % anual, −25 % a dos años. Sin permanencia.
- **Capa transaccional**: 15 → 9 → 5 € por modelo AEAT; 2 → 1 → 0,50 € por bien.
- **Back-office (servicio gestionado) desde 850 €/paquete.**
- **Early Adopter: −25 % de por vida para los 20 primeros, hasta el 31-dic-2026.**
- **−15 % para miembros de asociaciones profesionales.**
- Tracción visible: ~12 logotipos de despachos, notarías y asesorías.

**Sus dos debilidades explotables:**

1. **Foco catalán.** Se posicionan en *"100 % normativa catalana"* y los
   logotipos son mayoritariamente catalanes. HEREDIA tiene contenido para
   **19 CCAA** (`ccaa-content.ts`, `isd-calculator.ts`).
   ⚠️ **Corregido:** *"100 % normativa catalana"* afirma **profundidad, no
   exclusividad** — **no prueba que Ulpiano no cubra otras CCAA [WEAK INFERENCE]**.
   Y **HEREDIA no puede usar la cobertura nacional como argumento de venta
   todavía**: `README.md:316` reconoce que las reglas fiscales están pendientes de
   revisión contra normativa vigente. Afirmar cobertura no verificada es
   exactamente el riesgo del caso SAP Navarra (doc. 07 §3).
2. **Funcionalidad anunciada pero no construida [VERIFIED FACT — cita literal]:**
   *"API básica (próx.)"*, *"API completa con SSO/SCIM (próx.)"*, **"Cálculo de
   plusvalía municipal Próx."**, *"Generación de documentos sucesorios Próx."*,
   *"Asistente conversacional Próx. sept."*
   → **HEREDIA sí tiene plusvalía municipal implementada y testeada**
   (`src/lib/plusvalia-calculator.ts`, método real vs objetivo). **Ventaja
   funcional real y comprobable hoy** — previa verificación del cálculo.
   → Y una simetría incómoda: **Ulpiano también vende API y SSO inexistentes**,
   con la diferencia de que los etiqueta.
3. **Coste oculto en su plan de entrada [VERIFIED FACT]:** Esencial **no incluye
   modelos AEAT** — *"Modelos AEAT en pago por uso (15€/modelo)"*. Con 5
   modelos/mes son **244 €** frente a los 149 € de HEREDIA Inicia, sin coste por
   modelo.
4. **Sus logotipos y su "−35 % de tiempo" son afirmaciones de fabricante sin
   verificación independiente [DESCONOCIDO]** — igual que lo serían las de HEREDIA.

**Lo que hay que aceptar** *(corregido el 22-sep-2026 — la versión anterior decía
"9-13 %", comparando el precio mensual de HEREDIA con el anual de Ulpiano)*:

| Escalón | HEREDIA anual | Ulpiano anual | Δ |
|---|---|---|---|
| Inicia / Esencial | 1.490 € | 2.028 € | **−27 %** |
| Despacho / Avanzado | 3.490 € | 4.584 € | **−24 %** |
| Firma / Pro | 7.490 € | 10.188 € | **−26 %** |

**HEREDIA está un 22-27 % por debajo de la tarifa pública [STRONG INFERENCE]** —
**pero Ulpiano ofrece −15 % a colegiados (todo el ICP) y −25 % de por vida a sus
20 primeros clientes hasta el 31-dic-2026**, con lo que la ventaja real cae a
~2,8 % o se invierte (doc. 10 §2.2). Eso no es un posicionamiento: es un me-too
marginalmente más barato. **La diferenciación tiene que venir de otro sitio** (§4).

### 2.2 Frente 2 — El incumbente que ya está dentro: **`a3ASESOR|her`** (Wolters Kluwer)

**Precio NO PÚBLICO.** Ningún partner (Esofitec, Linksoluciones, Infolab, SasCom,
Visio, Creinsa) publica tarifa. **[CONFIRMADO que no es público]**

Lo confirmado y decisivo: calcula **ISD y plusvalía municipal en tiempo real
adaptado a cada CCAA**; automatiza ajuar doméstico, legados, seguros de vida,
adición y acumulación de donaciones, consolidaciones de dominio; genera borrador
en un clic; **e importa el inventario de bienes directamente desde `a3ASESOR|ren`,
el módulo de IRPF que la asesoría ya utiliza**. **[CONFIRMADO]**

Escala del canal: Wolters Kluwer tiene oficinas en Madrid, Barcelona, Valencia,
Bilbao y San Sebastián, **>800 profesionales** y **>300 partners autorizados** en
niveles Premium/Gold/Associate Plus. **[CONFIRMADO]**

> **Éste es el problema de la solución puntual en su forma más pura.** El módulo
> de ISD del incumbente no gana por ser mejor: gana porque **los datos
> patrimoniales del causante ya están en el sistema de al lado**. HEREDIA no
> compite contra una funcionalidad, compite contra una integración y contra 300
> partners que ya visitan al cliente.

También en este frente: **Aranzadi "One"**, bundle explícito para autónomos y
despachos pequeños *"sin el coste de una suscripción premium"* — dirigido justo
al segmento de entrada de HEREDIA; y **Lefebvre LEX-ON + GenIA-L**, que además ha
absorbido las plataformas RIJ y SPC del propio Consejo General de la Abogacía.
**[CONFIRMADO]**

### 2.3 Frente 3 — Quien ya posee el momento de la muerte: las aseguradoras de decesos

**Las tres grandes ya prometen gestión de herencias a sus asegurados.** **[CONFIRMADO]**

| Aseguradora | Qué ofrece |
|---|---|
| **Santalucía** | Certificados de defunción, últimas voluntades y contratos de seguros; pensiones de viudedad y orfandad; baja en Seguridad Social; **"asesoramiento para la gestión de la herencia"**; testamento notarial y vital |
| **Ocaso** | Página dedicada *"Servicio de gestión de sucesiones"*: certificados, bajas, **equipo de abogados** para orientación legal y fiscal, **gestión de testamentaría y adjudicación de herencia**, cierre de vida digital. El cliente puede elegir su propio abogado |
| **Mapfre** | *"Ayuda en la gestión de aceptación de herencias"* y **"gestionar el Impuesto de Sucesiones"**; testamento notarial anual; **Asesor Personal de Decesos** que lo coordina todo en una llamada |

**Y los bancos también:** BBVA ofrece tramitación de herencias online desde
bbva.es y su app. **[CONFIRMADO]** Eso erosiona parcialmente el valor del "pack
banco".

> **El hueco.** La divulgación de estas aseguradoras se vuelve **conspicuamente
> vaga justo en la presentación del Modelo 650**. Ocaso menciona "liquidación de
> impuestos" sin detalle. **Si efectivamente se detienen en certificados,
> pensiones, testamentaría y orientación, ahí está la cuña de HEREDIA**: vender el
> motor que hay detrás de una promesa que ya están haciendo, en lugar de intentar
> hacer la promesa uno mismo.
>
> **Pero está contestado:** Ulpiano ya lista "aseguradoras" como segmento propio.
> Y **quién opera hoy esos servicios (interno o externalizado, y a quién) es el
> hueco de información de mayor valor de todo este análisis [DESCONOCIDO]**.

### 2.4 Frente 4 — Los servicios al consumidor final

Compiten por el mismo expediente, sólo que vendiendo a la familia:

| Proveedor | Precio | Fuente |
|---|---|---|
| **SabemosDeHerencias** | **desde 190 €** | sabemosdeherencias.es **[CONFIRMADO]** |
| **Heredary** básico | **450 € por heredero** (hasta 3 inmuebles) | heredary.com/precio **[CONFIRMADO]** |
| **Heredary** completo | **1.633,50 €** (hasta 2 herederos, 3 inmuebles) | ídem |
| Herencias Online | desde 500 € | herenciasonline.es |
| reclamador.es | desde 800 € + IVA | reclamador.es |
| Enley | desde 990 € | enley.com |
| **Mercado general (jul-2026)** | Gestoría **500-1.500 €**; abogado **3.000-8.000 €** | everly.es **[CONFIRMADO]** |

> **Doble lectura.** (a) Confirma que un expediente **factura** 500-1.500 € al
> cliente de HEREDIA: el plan Despacho cuesta menos de lo que se factura por un
> solo expediente al mes. *(Corregido: antes decía "margen". El margen no se ha
> medido — con 6-12 h a 25-35 €/h el coste laboral es de 150-420 € por
> expediente.)* (b) **El ancla de 190 € que una familia encuentra en Google
> está 2,6 veces por debajo del Managed de HEREDIA (490 €/expediente)** — lo que
> hace la venta B2C de Managed mucho más dura de lo que su precio sugiere.

### 2.5 Frente lateral — El software funerario

**Casi nadie publica precio.** De once productos españoles revisados, **sólo
Gularis** lo hace: 39 / 69 / 99 €/mes, 15 días de prueba sin tarjeta.
**[CONFIRMADO]** GESMEMORI, Aelis, ThanatMe, Zancuda, Memento Cloud, SisFun,
ASISFUN y el resto venden exclusivamente por demo y presupuesto. **[CONFIRMADO]**

**Y hay un entrante español de 2026 con módulo de herencias: FunerFlow**,
presentado como *"nueva línea de ingresos para las funerarias"*. **Precio
totalmente opaco. Máxima prioridad de inteligencia competitiva.** **[CONFIRMADO
que existe; precio DESCONOCIDO]**

Referencias internacionales de estructura, útiles para el diseño de tarifa:
**Halcyon** ($295/mes **tarifa plana por funeraria, no por usuario**, + cuota de
activación + *"small case fee"* para clientes de volumen); **Passare**
($200-400/mes **por sede** [ESTIMADO]); **Gather** (activación única +
suscripción). El sector estadounidense usa habitualmente **$25-75 por caso, o
1-3 % del valor del servicio**. **[ESTIMADO, guía sectorial ago-2025]**

### 2.6 Frente de sustitución — Excel, el correo y el WhatsApp

La página `/comparativa` de HEREDIA compara contra tres categorías (Excel/Drive,
CRM genérico, software legal clásico) **sin nombrar competidores ni inventar
datos** — decisión correcta y bien ejecutada.

Pero tiene un problema de categoría: **nadie busca "software de expedientes de
herencia"** porque la categoría no existe en la cabeza del comprador. Ver
`05-GTM-Y-VENTAS.md`.

---

## 3. Tabla de huecos competitivos (FEATURE GAP)

Criterio: separar **table stakes** (hay que tenerlo para estar en la mesa) de
**diferenciadores** (razón para cambiar).

| Funcionalidad | HEREDIA | Ulpiano | a3ASESOR\|her | Aseguradoras | Importancia para el cliente | Tipo |
|---|---|---|---|---|---|---|
| Cálculo ISD por CCAA | **Sí (19 CCAA)** | Sí (foco catalán) | **Sí (nacional)** | Orientación | Alta | **Table stakes** |
| Borrador Modelo 650 | Sí | **Sí (650/651/652/653/660)** | Sí (1 clic) | No | Alta | **Table stakes** |
| Plusvalía municipal | Sí | No visible | **Sí** | No | Media | Table stakes |
| Cuaderno particional | **No** | **Sí** | Parcial | No | Media-alta | **Hueco** |
| Árbol genealógico / legítimas | **No** | **Sí** | Parcial | No | Media | **Hueco** |
| **Motor de plazos con aviso del mes 5** | **Sí** | Control de 6 meses | No destacado | No | **Alta** | **DIFERENCIADOR** |
| **Portal familia + recogida documental** | **Sí** | Sí (white-label funerarias) | **No** | No | **Alta** | **DIFERENCIADOR vs WK** |
| **Pack banco unificado** | **Sí** | No visible | No | No | **Alta** | **DIFERENCIADOR** |
| Checklist >20 entidades (bancos, suministros, telecom, vida digital) | **Sí** | Activos digitales | No | Parcial | Alta | **DIFERENCIADOR** |
| Integración con el módulo de IRPF del despacho | **No** | No | **Sí** | — | Alta | **Hueco estructural** |
| OCR de escrituras y certificados | Parcial (IA, desactivada por defecto) | **Sí** | Sí | — | Media-alta | **Hueco** |
| Auditoría inmutable | **Sí** | No visible | Sí | — | Media (alta en abogados) | Diferenciador parcial |
| Arquitectura de privacidad de IA (puerta única + minimización) | **Sí, verificada en código** | No visible | No visible | — | Media (alta con DPO) | **DIFERENCIADOR poco explotado** |
| Módulo PBC/blanqueo | **No** | No | No | — | **Alta y creciente** | **HUECO ABIERTO PARA TODOS** |
| Presentación telemática | **No (imposible)** | No | Vía colaborador social del despacho | — | Alta | No competible — ver doc. 07 |
| Plan gratuito | **No** | **Sí** | No | — | Alta para entrar | **Hueco de embudo** |

---

## 4. Dónde puede ganar HEREDIA

Tres posiciones defendibles, en orden de solidez:

### 4.1 La capa de coordinación con la familia (la más defendible)

Ni Wolters Kluwer ni las aseguradoras ponen en el centro **la recogida documental
con los herederos**. WK optimiza el cálculo; las aseguradoras optimizan la
promesa. **El trabajo real de una herencia no es calcular: es perseguir
documentos durante seis meses a gente que está de duelo y repartida por España.**

HEREDIA ya tiene construido exactamente eso: portal familia con consentimiento
RGPD, mensajería, solicitudes documentales, checklist por categoría (BANCOS,
SUMINISTROS, TELECOM, SUSCRIPCIONES, SEGUROS, VIDA_DIGITAL, FISCAL), pack banco
unificado y bloqueo de tareas por dependencia documental.

### 4.2 El control del mes 5

El plazo de 6 meses lo conoce todo el mundo. **La asimetría del mes 5, no:** la
prórroga debe pedirse en los cinco primeros meses; pedida dentro de plazo y sin
notificación en el mes siguiente **se entiende concedida**; pedida fuera, **se
entiende denegada sin necesidad de notificación** (art. 67 RISD). **[CONFIRMADO]**

`deadline-engine.ts` ya implementa el cómputo *de fecha a fecha* del art. 67 con
el detalle correcto del último día de mes. **Es un momento de demo que ningún
recordatorio de calendario puede replicar**, y hoy no se está usando como el
argumento central de venta.

### 4.3 La cobertura nacional frente a la profundidad catalana

19 CCAA frente al posicionamiento catalán de Ulpiano. Es el argumento para
cualquier despacho fuera de Cataluña y para los expedientes multi-CCAA.

**Con una advertencia seria:** mantener 19 normativas autonómicas actualizadas es
un coste recurrente real, y `README.md:316` ya reconoce que las reglas fiscales
están pendientes de revisión contra normativa vigente. **Vender cobertura
nacional obliga a financiar su mantenimiento.** Ver `06-ECONOMIA-Y-MODELO-FINANCIERO.md`, §6.

---

## 5. Dónde HEREDIA no puede ganar

Decirlo explícitamente evita meses de esfuerzo mal dirigido.

| Frente | Por qué no |
|---|---|
| **El calculador fiscal** | `a3ASESOR|her` es nacional, maduro e integrado con los datos que el despacho ya tiene |
| **La presentación telemática** | HEREDIA **nunca** será colaborador social. Restricción estructural, no comercial — doc. 07 |
| **El precio** | Bajar exige 2,5× más clientes con un solo vendedor. Y la ventaja frente al competidor ya es marginal para un colegiado (~2,8 %) o negativa frente a su oferta de early adopter |
| **La relación con la familia en el momento del fallecimiento** | La poseen la funeraria y la aseguradora de decesos. HEREDIA sólo puede llegar ahí **a través** de ellas |
| **El B2C de tramitación** | El ancla de Google está en 190-450 € y hay actores establecidos con equipo jurídico |

---

## 6. Las dos señales de compra más fuertes encontradas

1. **Grupo Catalana Occidente / Occident (matriz de Mémora): el Plan Estratégico
   2025-2027 prioriza explícitamente "digitalización y eficiencia del servicio".**
   Mémora: >62.000 servicios funerarios al año, >2.000 empleados, 194 tanatorios,
   57 crematorios, 97 cementerios; su resultado ordinario creció +31,2 % en 2025.
   **[CONFIRMADO]** Es el mandato de compra documentado más claro del sector.

2. **Barómetro de la Asesoría 2026 (Wolters Kluwer), V edición [CONFIRMADO vía
   múltiples fuentes concordantes]:**
   - **68 %** de los despachos considera la digitalización eje estratégico (+11 puntos vs 2025)
   - **7 de cada 10** ya usan IA en su trabajo diario
   - **67,3 %** creció en ingresos en 2025; **63 %** espera crecer en 2026
   - **64 % señala la sobrecarga normativa como principal reto**
   - **74 %** tiene escasez de perfiles cualificados; **53 % identifica el relevo generacional como riesgo**

> Dos de esas cifras son directamente explotables. **La sobrecarga normativa
> (64 %) es exactamente lo que alivia un motor de plazos ISD.** Y el **relevo
> generacional (53 %)** es una cuña notable: la misma ola demográfica que genera
> las herencias genera la ansiedad sucesoria del propio despacho. El problema del
> comprador y el problema de sus clientes son la misma historia demográfica.

---

## 7. Lo que no hemos podido establecer

Estos huecos son reales y afectan a decisiones concretas. **No se han rellenado
con estimaciones.**

| # | Hueco | Por qué importa | Cómo cerrarlo |
|---|---|---|---|
| 1 | **Número de declaraciones ISD presentadas al año** (frente a recaudación) | Es el verdadero TAM de expedientes. 441.270 defunciones ≠ 441.270 expedientes tramitados por un profesional | Petición de datos a las haciendas autonómicas; informes del Consejo General del Notariado sobre escrituras de aceptación de herencia |
| 2 | **Cuántos expedientes de herencia tramita al año una gestoría media** | **Determina si la métrica de valor propuesta está bien calibrada** (doc. 03, §5) | Las primeras 12-15 entrevistas |
| 3 | **Quién opera los servicios de herencias de Santalucía, Ocaso y Mapfre** | Decide si las aseguradoras son canal o mercado cerrado. **El hueco de mayor valor** | Llamada directa; buscar convenios publicados; Legálitas y ARAG son candidatos plausibles pero **sin evidencia** |
| 4 | **Si esas aseguradoras presentan realmente el Modelo 650** o se detienen antes | Si se detienen, es la cuña de HEREDIA | Llamar como asegurado y preguntar |
| 5 | **Precio de `a3ASESOR|her` y de FunerFlow** | Los dos competidores más relevantes con precio opaco | Petición de presupuesto a dos partners de WK; contacto comercial con FunerFlow |
| 6 | **Quién compra software centralmente en Mémora, Albia, Funespaña y ASV** | Convierte una señal estratégica en un contacto | LinkedIn; IV Fórum PANASEF |
| 7 | **Horas reales por expediente y coste laboral** | Todo el modelo de ROI descansa en ello | Cronometrar 3 expedientes reales en piloto |
| 8 | **Tracción real de Ulpiano** (clientes, financiación, plantilla) | Calibra la urgencia | Registro Mercantil, notas de prensa, LinkedIn |
| 9 | **Duración del ciclo de venta en software profesional español** | Planificación de caja | No hay benchmark publicado; medir el propio |

---

## 8. Conclusión

El mercado existe, pero **está peor medido de lo que estas cifras sugieren**:
441.270 defunciones al año **[VERIFIED FACT, provisional]** — que **no** es un TAM,
porque una defunción no es un expediente tramitado por un profesional; *~54.000
empresas de asesoría* **[WEAK INFERENCE — fuente comercial sin fecha]**; **más de
6.000 gestores administrativos** **[VERIFIED FACT]** — que **no** es el número de
despachos, que es la unidad de compra; ~1.404 funerarias; 149.695 abogados
ejercientes. **El mercado direccionable real —cuántos despachos tramitan
herencias con volumen— sigue siendo DESCONOCIDO.** Pero es un mercado **pequeño en cuentas
direccionables y muy fragmentado en tamaño** (83 % de 0-2 personas **según datos
DIRCE de 2021 — pendiente de refrescar**), lo que
significa dos cosas simultáneas: **cada cuenta es alcanzable por su nombre**, y
**el ARPA no puede ser alto sin un ICP especializado**.

La competencia no está vacía: hay **un clon directo con precios públicos y mejor
entrada (Ulpiano)**, **un incumbente con ventaja de integración
(`a3ASESOR|her`)**, **tres aseguradoras que ya poseen el momento y la promesa**, y
**un mercado de servicios al consumidor anclado en 190-450 €**.

La posición defendible de HEREDIA **no es el cálculo fiscal**. Es **la
coordinación documental con la familia, el pack banco y el control del mes 5** —
y da la casualidad de que eso es exactamente lo que ya está construido y probado
en el repositorio, y lo que menos se está usando como argumento de venta.

→ Qué vender y qué retirar: `04-PORTFOLIO-SERVICIOS.md`
→ Cómo llegar a estos compradores: `05-GTM-Y-VENTAS.md`
