# 00 — Resumen ejecutivo y puerta de decisión

> **Fecha:** 22 de septiembre de 2026
> **Alcance:** auditoría del repositorio (rama `claude/heredia-security-hardening-v1`,
> commit `da998a9`) + investigación externa en cinco frentes.
> **Regla observada:** no se ha inventado ningún cliente, testimonio, dato de
> mercado, capacidad de producto ni cifra financiera. Lo que no se ha podido
> establecer está marcado como tal.

---

## 1. El diagnóstico en un párrafo

HEREDIA es un producto real, sustancial y bien construido —121 rutas de API, 44
modelos de datos, 112 ficheros de test, 366 commits desde abril de 2026— que
**nunca ha tocado a un comprador**. No tiene clientes, no tiene ingresos, no ha
tramitado un solo expediente real y **no está publicado**: el dominio que el
propio código usa como URL canónica no resuelve en DNS. El plan de lanzamiento
fijaba el 22 de agosto; hoy es 22 de septiembre y el trabajo del último mes ha
sido endurecimiento de seguridad. **El riesgo dominante del proyecto dejó de ser
técnico hace meses, y la asignación de esfuerzo no lo ha seguido.**

---

## 2. Los cinco hallazgos que cambian decisiones

### 2.1 El precio está por debajo del competidor — pero eso no valida nada

> ⚠️ **Corregido el 22-sep-2026.** La versión anterior afirmaba *"el precio no es
> el problema"* sobre una comparación mal construida. Ver
> [`10-CLAIMS-AND-EVIDENCE-AUDIT.md`](10-CLAIMS-AND-EVIDENCE-AUDIT.md) §2.

**Ulpiano** (`ulpiano.es`) vende esto mismo, al mismo comprador, con precios
públicos: **Free 0 € / 169 € / 382 € / 849 €**, sin cuota de alta, sin
permanencia y back-office desde 850 €/paquete. **[VERIFIED FACT — cita literal,
re-verificada]**

Los precios de Ulpiano llevan la coletilla **"facturado anualmente"** (ya incluyen
su −15 %). Comparación corregida, como-con-como:

| Escalón | HEREDIA mensual | Ulpiano mensual *(inferido)* | HEREDIA anual | Ulpiano anual | Δ anual |
|---|---|---|---|---|---|
| Inicia / Esencial | 149 € | ~199 € | 1.490 € | 2.028 € | **−27 %** |
| Despacho / Avanzado | 349 € | ~449 € | 3.490 € | 4.584 € | **−24 %** |
| Firma / Pro | 749 € | ~999 € | 7.490 € | 10.188 € | **−26 %** |

**HEREDIA está un 22-27 % por debajo de la tarifa pública** — no un 9-13 %, como
se afirmó inicialmente. **[STRONG INFERENCE]**

**Pero la ventaja desaparece frente al comprador real.** Ulpiano publica dos
descuentos vigentes **[VERIFIED FACT — cita literal]**:

- *"Colegio profesional −15 % · Para colegiados de cualquier colegio profesional."*
- *"−25 % de por vida · Para los primeros 20 clientes. Hasta el 31 dic 2026."*

El ICP recomendado —gestores administrativos y abogados— **es colegiado por
definición**. Coste real del primer año, escalón medio:

| Escenario | Año 1 |
|---|---|
| HEREDIA Despacho anual + setup 299 € | 3.789 € |
| Ulpiano Avanzado −15 % colegiado | 3.896 € → HEREDIA sólo **2,8 %** más barato |
| Ulpiano Avanzado −25 % early adopter | 3.438 € → **HEREDIA 10,2 % MÁS CARO** |

> **Lo que el precio de un competidor demuestra: que ese competidor eligió ese
> precio. Nada más.** No demuestra que alguien lo pague, cuántos, ni que sea
> rentable u óptimo. De hecho, que Ulpiano ofrezca −25 % *"a los primeros 20
> clientes"* es **evidencia de que su propio precio de tarifa tampoco está
> validado**.
>
> **Conclusión defendible:** no hay evidencia de que 149/349 € esté fuera de la
> banda plausible, y bajar precio empeora mecánicamente el umbral de clientes.
> **Pero no existe ninguna evidencia de que nadie pague esa cantidad — ni a
> HEREDIA ni a Ulpiano.** **[HYPOTHESIS TO TEST]**

Y lo que HEREDIA pierde **antes de que el precio importe**: sin plan gratuito,
con setup de 299/990 € frente a 0 €, y con una página de precios desde la que no
se puede comprar.

### 2.2 La métrica de valor está rota

HEREDIA limita **expedientes al mes** (15/50/200). Ulpiano limita **expedientes
activos** (1/5/15/50). Como una herencia dura 6-12 meses, los topes de HEREDIA
equivalen a **180 / 600 / 2.400 expedientes al año**.

Una gestoría pequeña tramita 10-30 al año; una media, 30-80; un especialista,
100-300.

> **Ningún plan alcanza jamás su propio límite.** El tope no segmenta, no
> monetiza y no protege margen. Y como está implementado con **bloqueo duro**
> (`plan-limits.ts`), el único cliente que lo tocará es uno tan bueno que no
> queremos castigarlo — justo a mitad de un plazo legal.

### 2.3 Hay tres afirmaciones comerciales que el código no sostiene

| Se vende | Realidad verificada |
|---|---|
| Plan Firma: **"SSO"** | **Cero referencias a SAML** en todo el repositorio. Sólo hay Google OAuth activado por variable de entorno global, no por plan ni por inquilino |
| Plan Firma: **"API / webhooks"** | Hay **webhooks salientes** (Slack, Teams, HTTP+HMAC), correctamente limitados a Firma. **No existe API de datos de cliente**: no hay modelo `ApiKey`, ni emisión de credenciales |
| Plan Firma: **"DPA extendido"** | **El DPA no está publicado** — el propio README lo lista como pendiente antes de operar con datos reales |

Y una cuarta, más grave: **`/portal-familia` publica cuatro testimonios
fabricados** con atribución geográfica y una cifra de resultado inventada, bajo
un descargo que afirma proceder de *"feedback real de despachos en periodo de
prueba o producción"* que, según el propio README, no existen. En la UE, los
testimonios falsos son una práctica comercial desleal de lista negra.

> Estas cuatro cosas no cuestan una venta. Cuestan **la credibilidad de todo lo
> demás que se afirma** — ante un comprador que es profesionalmente experto en
> detectar afirmaciones sin soporte.

### 2.4 El embudo de conversión está construido y desconectado

HEREDIA tiene registro self-service, trial de 14 días, onboarding guiado de 5
pasos y un expediente de ejemplo sembrado automáticamente. Todo funciona.

**Y los tres botones de `/precios` apuntan a `/#demo`.** No existe un solo enlace
de la página de precios al registro.

> Se ha construido el motor de conversión de menor fricción del producto y luego
> se ha cerrado la puerta con un formulario. **Coste de arreglarlo: una línea.**

### 2.5 El modelo financiero proyecta un canal que no existe

Ejecutado tal cual, el escenario que el propio código llama *"defendible ante due
diligence"* **nunca alcanza caja positiva en 36 meses** y necesita **173.756 €**
— mientras su docstring promete break-even en el mes 28-32. Mover **una sola**
variable de adquisición en sentido adverso eleva la necesidad de capital a
**350-490 k€**.

Y las dos variables de las que todo depende —visitas iniciales y crecimiento
SEO— **valen hoy cero**, porque no hay sitio publicado.

> **El objetivo operativo correcto de los próximos 12 meses no es un ARR. Son
> decenas de clientes de pago, no cientos:** entre **6 y 12** si el fundador no
> se paga sueldo, entre **20 y 50** con sueldo y estructura mínima.
>
> *(Corregido el 22-sep-2026. La cifra anterior —"~24"— era exacta sólo bajo tres
> supuestos simultáneos, uno de ellos el mix de planes, del que no existe ningún
> dato. El umbral **ignora además el CAC**: es un suelo en estado estacionario, no
> un objetivo. Derivación completa en el doc. 10 §4.)* **[STRONG INFERENCE en el
> orden de magnitud; ASSUMPTION en la cifra concreta]**

---

## 3. Qué hacer, en orden

### Esta semana — desbloquear (4-5 días)

1. **Registrar el dominio definitivo** y actualizar las tres referencias del código
2. **Eliminar los testimonios sintéticos**
3. **Enlazar `/precios` → `/register`** *(una línea)*
4. **Etiquetar el output de IA** *(obligación vigente desde el 02-08-2026)*
5. **Rediseñar el PDF del borrador 650/651** para que no pueda confundirse con el impreso oficial
6. **Textos legales con identidad real + publicar el DPA**
7. **Publicar el sitio**
8. **Retirar "SSO", "API" y "DPA extendido"** de la tarifa pública

### Próximas dos semanas — medir

→ `08-EXPERIMENTOS-14-DIAS.md`. Los tres números que definen el éxito:
**3 señales de 300 € cobradas · 12 entrevistas completadas · el coste real de IA
por expediente.**

### Dos eventos con fecha, y uno es inmediato

| Evento | Fecha | Días | Por qué |
|---|---|---|---|
| **IV Fórum PANASEF** (Tarragona) | 6-7 oct | **14** | ~300 profesionales, ~65 % del sector. **Bienal: el siguiente es en 2028** |
| **VIII Congreso Nacional de GA** (Palma) | 22-24 oct | **30** | El organizador **prevé** ~1.500 personas, pero la cita incluye *"acompañantes, representantes de otras profesiones, empresarios, autónomos y personal de las administraciones públicas"*. **Cuántos son gestores colegiados: DESCONOCIDO.** Patrocinio ofrecido explícitamente |

**Y una ventana de calendario:** de abril a junio el mercado está cerrado por la
campaña de la Renta. **Lo que no esté cerrado en marzo, espera a septiembre de
2027.**

---

## 4. Puerta de decisión: las 13 preguntas

### 1. ¿Cuál es nuestro ICP inicial?

**Gestorías y asesorías españolas de 1-10 personas que ya tramitan entre 10 y 80
herencias al año.** Un solo ICP durante seis meses.

Razones: ya tramitan herencias (no hay que crear demanda); **83 % de las empresas
del sector son de 0-2 personas**, donde una sola persona decide, usa, paga e
implanta **[CONFIRMADO, DIRCE]**; la población es enumerable y pública; y su dolor
declarado —**64 % señala la sobrecarga normativa** **[CONFIRMADO, Barómetro WK
2026]**— es exactamente lo que alivia el motor de plazos.

Funerarias y abogados: landings mantenidas, **cero esfuerzo comercial** hasta
tener 10 clientes de gestoría.

### 2. ¿Cuánto gana o ahorra ese ICP usando HEREDIA?

**Un expediente de herencia genera 500-1.500 € a una gestoría** y 3.000-8.000 € a
un abogado **[CONFIRMADO]**. Con 6-12 h por expediente **[ESTIMADO]** a 25-35 €/h
**[ESTIMADO]**, el coste laboral es de 150-420 € por expediente.

De la ecuación de valor del encargo, **sólo tres componentes son demostrables
hoy**: trabajo ahorrado (parcialmente), errores evitados (con precedente
documentado: **SAP Navarra 17/03/2021, 76.500 € de condena** por una
autoliquidación de ISD mal hecha) y **riesgo de plazo reducido**. Capacidad
ganada, ingresos extra y cross-sell **no son demostrables** con los datos
actuales, y no deben venderse.

### 3. ¿Qué parte de ese valor podemos capturar razonablemente?

Una gestoría de 10 personas gasta **~12.000 €/año en software total** (7,4 % de
sus costes operativos) **[CONFIRMADO, estudio sobre 157 gestorías]**.

- Plan de 149 € = **15 %** de ese presupuesto → digerible
- Plan de 349 € = **35 %** → defendible **si sustituye trabajo facturable**
- Plan de 749 € = **75 %** → **sólo para un especialista en sucesiones**, no para
  un despacho generalista

**El techo realista de captura está en 1.800-4.200 €/año por cuenta**, salvo que
HEREDIA desplace software existente.

### 4. ¿Cuál es la métrica de valor correcta?

**El expediente activo.** Cumple los dos criterios decisivos: los clientes grandes
consumen más de ella que los pequeños (a diferencia del usuario, donde 5 empleados
pueden tramitar 3 herencias al año), y **no penaliza abrir un expediente** —
a diferencia del expediente creado, que haría dudar al cliente antes de usar el
producto.

Es también la métrica del competidor directo, lo que reduce la fricción de
comparación.

### 5. ¿Qué servicios son realmente must-have?

Expedientes · checklist de >20 entidades · tareas y dependencias · **motor de
plazos con aviso del mes 5** · **portal familia** · documentos · **pack banco
unificado** · cálculo ISD orientativo · borrador 650 · email · auditoría · roles ·
multi-tenant · billing · onboarding · trial.

Eso es el **Producto Mínimo Vendible**, y **está íntegramente construido y
probado**:

> *Un expediente de herencia que no se te pasa de plazo y cuyos documentos llegan
> solos.*

### 6. ¿Qué estamos desarrollando sin demanda suficiente?

- **Calculadora y comparador de donaciones (Modelo 651)** — pertenece a otro
  producto: planificación patrimonial en vida, no tramitación post-mortem
- **Workflows configurables** — nadie de 0-2 personas los configurará
- **Aprobaciones y versionado de plantillas** — sólo despachos grandes
- **Webhooks salientes, roles avanzados** — enterprise antes del primer cliente
- **Notificaciones en tiempo real** — no implementadas y no necesarias
- **Tres landings verticales simultáneas** — dos ICP de más

### 7. ¿Qué funcionalidad inexistente está bloqueando ventas?

**Bloqueantes reales, por orden:**

1. **DPA publicado y textos legales con identidad real** — no es una desventaja
   competitiva, es una **descalificación** ante un comprador colegiado
2. **Enlace de `/precios` a `/register`** — bloquea conversión
3. **Nivel gratuito** — el competidor directo lo tiene y es su puerta de entrada
4. **Rediseño anti-falsedad del PDF** — bloquea el lanzamiento por riesgo penal
5. **Etiquetado de IA** — obligación ya vigente
6. **Antivirus en subidas** — objeción de seguridad barata de eliminar

**Candidatos sin evidencia todavía** (entran en las entrevistas como preguntas,
no en el backlog como tareas): cuaderno particional, árbol genealógico/legítimas,
OCR de escrituras, festivos autonómicos.

**Y una frontera, no un hueco: la presentación telemática.** HEREDIA **nunca**
podrá ser colaborador social —lo son colegios, asociaciones y sus colegiados, y
la colaboración social de la AEAT ni siquiera cubre el ISD autonómico
**[CONFIRMADO]**—. Prometerla sería incumplible.

### 8. ¿Qué puede monetizarse como add-on?

Por orden de atractivo: **módulo PBC/blanqueo** (valor muy alto, disposición a
pagar alta porque es obligación legal del cliente, sin competidor que lo destaque,
y **da la base legal que hoy falta para custodiar los DNI del portal familia** —
dos problemas con una función) · **créditos de IA** · **almacenamiento** ·
**migración de datos** · white-label · multi-sede.

### 9. ¿Cuántos planes necesitamos?

**Dos de pago, más un nivel gratuito, más enterprise sin precio público.**

Con cero clientes, cada plan adicional es una hipótesis más que validar en
paralelo y una historia comercial más que mantener. El plan alto tiene además un
**ICP distinto** (especialista de alto volumen) y hoy no está poblado: pasa a
*contactar ventas*.

### 10. ¿Por qué pagaría alguien exactamente el precio recomendado?

**Porque 349 €/mes cuesta menos de lo que la gestoría factura por un solo
expediente de herencia** (500-1.500 €) **[STRONG INFERENCE para el precio;
WEAK INFERENCE para el margen — el margen no se ha medido]**.

*(Corregido: la versión anterior decía "menos que el **margen** de un expediente".
Con 6-12 h a 25-35 €/h el coste laboral es de 150-420 €, así que el margen sobre
un expediente de 600 € puede ser de 180-450 €, no 600 €. Usar "factura", nunca
"margen", hasta medirlo.)*

Y porque la tarifa del competidor directo es superior — **con la salvedad de que
su descuento para colegiados deja esa ventaja en ~3 %** (§2.1).

### 11. ¿Qué evidencia tenemos?

**VERIFIED FACT** (cita literal o lectura de código, re-verificado 22-sep-2026):
precios y descuentos publicados de Ulpiano · el software como 7,4 % de los costes
de una gestoría (157 gestorías) · precios de los servicios de tramitación
(450-1.633 € Heredary; 500-1.500 € mercado general) · 441.270 defunciones en 2025
(INE, **provisional**) · "más de 6.000 gestores administrativos" · precios de la
API de Anthropic y de Stripe España · la asimetría del mes 5 (art. 67 RISD) ·
LSSI art. 21 · el precedente de responsabilidad (SAP Navarra) · las dos fechas de
congreso · todo el inventario de producto del doc. 01.

**STRONG INFERENCE:** HEREDIA 22-27 % por debajo de la tarifa de Ulpiano · la
ventaja cae a ~3 % frente a un colegiado · el plan alto consume ~75 % del
presupuesto de software de un despacho de 10 personas · el umbral de clientes son
decenas, no cientos.

**WEAK INFERENCE — no actuar sin verificar:** 83 % de empresas de 0-2 personas
(**datos DIRCE de 2021, artículo de 2022 — cinco años**) · ~300 asistentes al
Fórum PANASEF (edición anterior, otra ciudad) · 53.998 empresas CNAE 6920 (fuente
comercial, fecha desconocida) · legalidad del contacto en frío por LinkedIn y
teléfono · el 5× de la tarjeta en el trial.

**Débil o ausente:** **todo lo relativo al comportamiento del cliente. Cero datos
propios.** Y dos advertencias: *441.270 defunciones no es un TAM* (una defunción
no es un expediente tramitado por un profesional), y *"más de 6.000 gestores" no
es el número de despachos*, que es la unidad de compra.

### 12. ¿Qué sigue siendo hipótesis?

1. Que una gestoría pagará 149 o 349 €/mes por esto **(ningún cliente todavía)**
2. Cuántos expedientes tramita realmente al año **(sin medir)**
3. Que el ahorro de tiempo es del 20-30 % **(afirmación de fabricante, propia y ajena)**
4. El coste real de IA por expediente **(supuesto de 200k/30k tokens sin verificar)**
5. Que la cuota de setup no mata la conversión **(no existe literatura publicada)**
6. Que el nivel gratuito convertirá **(sin datos)**
7. Que el canal de contacto directo funciona en este nicho **(sin datos)**
8. Que `Heredia Managed` es rentable a 490 €/expediente **(sin modelo de costes)**

### 13. ¿Qué experimento comercial ejecutamos en las próximas dos semanas?

→ **`08-EXPERIMENTOS-14-DIAS.md`**, ocho experimentos con coste, meta y decisión
asociada. Los tres números que definen el éxito:

| # | Meta | Convierte en dato |
|---|---|---|
| 1 | **3 señales de 300 € cobradas** | Si existe disposición a pagar real |
| 2 | **12 entrevistas completadas** | Expedientes/año, métrica de valor y dolor real |
| 3 | **Coste medido de IA por expediente** | Arquitectura de planes y viabilidad del plan alto |

---

## 5. La decisión que ningún dato resuelve

**`Heredia Managed` genera trece veces más ingresos que el mejor plan de
software.** Un solo cliente con 30 expedientes al mes factura 9.900 €/mes; el plan
Firma factura 749 €.

Esto plantea la pregunta que la aritmética no puede contestar:

> **¿HEREDIA es una empresa de software que además presta un servicio, o una
> empresa de servicios que ha construido su propio software?**

Las dos son legítimas. Tienen **márgenes (81 % frente a 30 %), escalabilidad,
uso del tiempo del fundador, riesgo regulatorio y valoración completamente
distintos** **[CONFIRMADO]**. Y hay un conflicto que ninguna cláusula resuelve:
**Managed compite por el mismo expediente con las gestorías a las que se le vende
el software**.

**Recomendación:** mantener Managed reestructurado como **BPO puro** —el cliente
es siempre el colegiado, nunca la familia—, **fuera de la página de precios
pública**, con **cupo máximo de 3-5 cuentas** mientras el fundador esté solo, y
**usándolo deliberadamente como investigación**: operar tres expedientes reales
responde de una vez a las horas por expediente, al coste real de IA y a qué
funcionalidad falta.

**Pero la decisión de fondo es tuya, y conviene tomarla explícitamente en lugar
de dejar que la resuelva la inercia de cuál de las dos cosas se vende primero.**

---

## 6. Índice de documentos

| Doc | Contenido |
|---|---|
| **00** | Este resumen y la puerta de decisión |
| **01** | `01-AUDITORIA-PRODUCTO.md` — inventario verificado, contradicciones código/marketing |
| **02** | `02-MERCADO-Y-COMPETENCIA.md` — dimensionamiento, Ulpiano, `a3ASESOR\|her`, aseguradoras |
| **03** | `03-PRICING.md` — comparables, test de estrés, métrica de valor, recomendación v1 |
| **04** | `04-PORTFOLIO-SERVICIOS.md` — qué vender, qué retirar, producto mínimo vendible |
| **05** | `05-GTM-Y-VENTAS.md` — ICP, canales, guion de demo, plan de 90 días |
| **06** | `06-ECONOMIA-Y-MODELO-FINANCIERO.md` — crítica del modelo, unit economics |
| **07** | `07-RIESGO-LEGAL-Y-NEGOCIO.md` — intrusismo, falsedad documental, RGPD, IA, PBC |
| **08** | `08-EXPERIMENTOS-14-DIAS.md` — el plan de las próximas dos semanas |
