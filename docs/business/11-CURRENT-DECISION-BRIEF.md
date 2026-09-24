# 11 — Brief de decisión

> **22 de septiembre de 2026.** Síntesis de la investigación **ya corregida**
> (ver `CHANGELOG-CORRECTIONS.md`). Documento de decisión, no de investigación.
> **Sustituye al plan de 14 días del doc. 08.**

---

## A. LO QUE SABEMOS

Sólo lo que está lo bastante soportado como para actuar.

### Sobre nosotros — **[VERIFIED FACT]**, leído en el código

| # | Hecho |
|---|---|
| A1 | **No estamos accesibles.** `heredia.app` no resuelve en DNS, y está cableado como URL canónica en tres ficheros |
| A2 | **Cero clientes, cero expedientes reales** (`README.md:6-9`) |
| A3 | **El embudo de autoservicio existe y está desconectado.** Registro con trial de 14 días, onboarding de 5 pasos y expediente de ejemplo — y los tres CTA de `/precios` van a `/#demo` |
| A4 | **Publicamos cuatro afirmaciones falsas:** testimonios sintéticos en `/portal-familia`, "SSO" (0 referencias a SAML), "API" (no hay modelo `ApiKey`), "DPA extendido" (sin publicar) |
| A5 | **El producto es real:** 121 rutas de API, 44 modelos, 112 ficheros de test, motor de plazos con art. 67 RISD correctamente implementado |
| A6 | **Textos legales con marcadores de posición.** No se puede contratar legalmente |

### Sobre el mercado — **[VERIFIED FACT]** salvo indicación

| # | Hecho |
|---|---|
| A7 | 441.270 defunciones en España en 2025 (INE, provisional). **No es un TAM** |
| A8 | **Más de 6.000 gestores administrativos colegiados.** No es el número de despachos, que es la unidad de compra |
| A9 | Una gestoría de 10 personas gasta **~12.000 €/año en software total** (7,4 % de sus costes). El plan alto consumiría el 75 % **[STRONG INFERENCE]** |
| A10 | Un expediente **factura** 500-1.500 € a una gestoría; 3.000-8.000 € a un abogado **[STRONG INFERENCE]**. **El margen no se ha medido** |
| A11 | **Abril-junio el mercado está cerrado** (campaña de Renta). Septiembre-noviembre y enero-febrero están abiertos |
| A12 | **El email comercial frío está prohibido** (art. 21 LSSI, cita literal del BOE, sin excepción B2B) |
| A13 | Existe un precedente de responsabilidad directo: **SAP Navarra 17/03/2021, 76.500 €** por una autoliquidación de ISD incorrecta |
| A14 | **Art. 50 del Reglamento de IA exigible desde el 02-08-2026**: hay que etiquetar el output de IA |

### Sobre la economía — **[STRONG INFERENCE]**

| # | Hecho |
|---|---|
| A15 | **Necesitamos decenas de clientes, no cientos.** Entre 6 y 12 sin sueldo de fundador; 20-50 con estructura mínima. Robusto a todos los supuestos probados |
| A16 | **Bajar precio empeora mecánicamente la situación:** −50 % exige 2,5× más clientes. Con un solo vendedor, inviable |
| A17 | El modelo a 36 meses del repositorio **no alcanza caja positiva** y su docstring afirma lo contrario. Valor diagnóstico, no predictivo |

---

## B. LO QUE NO SABEMOS

**Ninguna de estas casillas tiene un solo dato propio.**

| Incógnita | Estado | Por qué importa | Se resuelve con |
|---|---|---|---|
| **Disposición a pagar real** | **HYPOTHESIS TO TEST** | Decide si existe el negocio | Señales cobradas (§G) |
| **Precio óptimo** | DESCONOCIDO | 149/349 sólo son "no absurdos" | Gabor-Granger + señales |
| **Conversión** (visita→registro, demo→cierre) | DESCONOCIDO | No hay benchmark español fiable para este nicho | Medición propia, 60-90 días |
| **CAC real** | ASSUMPTION (120 €) | Ninguna conclusión que dependa de él es accionable | Coste real de las primeras 10 ventas |
| **Churn** | ASSUMPTION (4-6 %/mes) | Hay un argumento estructural en contra: un expediente dura 6-12 meses, no te vas a mitad | Cohortes propias, 6+ meses |
| **Qué segmento prefiere el producto** | DESCONOCIDO | Se eligió gestorías por lógica, no por evidencia | Entrevistas (§G) |
| **Volumen de expedientes por cliente** | **ASSUMPTION** (10-30/30-80/100-300) | **De esto depende toda la métrica de valor** | Entrevistas — pregunta 1 |
| **Valor de Managed** | DESCONOCIDO | 490 €/exp sin modelo de costes | Cronometrar 1 expediente real |
| Coste real de IA por expediente | ASSUMPTION (200k/30k tokens) | Decide si el plan alto tiene 36 % o 74 % de margen | 2 horas de medición |
| Cuántos despachos tramitan herencias | DESCONOCIDO | **Es el TAM real** | Entrevistas + DIRCE |
| Tracción de Ulpiano | DESCONOCIDO | Calibra la urgencia | Registro Mercantil |

---

## C. HEREDIA vs ULPIANO

> **Regla aplicada:** no se infiere tracción de precios ni de marketing. Los ~12
> logotipos de Ulpiano **no son evidencia de clientes de pago**; tampoco lo es su
> afirmación de *"−35 % de tiempo"*.

### C1. Funcionalidad — lo que existe HOY

| Capacidad | HEREDIA | Ulpiano | Fuente |
|---|---|---|---|
| Expediente estructurado | ✅ | ✅ | Código / web |
| Motor de plazos ISD | ✅ **con aviso del mes 5 (art. 67 RISD)** | ✅ *"control del plazo de 6 meses"* — **si cubre el mes 5: DESCONOCIDO** | Código / web |
| Cálculo ISD por CCAA | ✅ 19 fichas **sin revisar** | ✅ foco catalán declarado | Código / web |
| **Plusvalía municipal** | ✅ **implementada y testeada** | ❌ **"Próx."** | Código / cita literal |
| Modelo 650 / 651 | ✅ borrador PDF | ✅ **650/651/652/653/660** | Código / web |
| **Modelos AEAT en el plan de entrada** | ✅ **incluidos, sin coste** | ❌ **0 incluidos — "15€/modelo"** | Cita literal |
| **Portal familia** | ✅ con consentimiento RGPD | ✅ **white-label para funerarias** | Código / web |
| **Pack banco unificado** | ✅ | **No visible** | Código |
| Checklist >20 entidades (incl. vida digital) | ✅ 8 categorías | Parcial (*"activos digitales"*) | Código / web |
| Cuaderno particional | ❌ | ✅ | — |
| Árbol genealógico / legítimas | ❌ | ✅ | — |
| OCR de escrituras y certificados | Parcial (IA, **desactivada por defecto**) | ✅ *"extracción AI"* | Código / web |
| Auditoría inmutable | ✅ | No visible | Código |
| **Arquitectura de privacidad de IA** (puerta única + minimización con test) | ✅ | No visible | Código |
| White-label | ✅ (portal familia) | ✅ **+ dominio propio en Pro** | Código / web |

### C2. Funcionalidad ANUNCIADA y no construida

| | HEREDIA | Ulpiano |
|---|---|---|
| API | **Vendida en tarifa. No existe** | *"API básica (próx.)"* / *"API completa (próx.)"* |
| SSO | **Vendido en tarifa. 0 referencias a SAML** | *"SSO/SCIM (próx.)"* |
| Plusvalía | — *(ya la tiene)* | *"Cálculo de plusvalía municipal Próx."* |
| Generación de documentos sucesorios | Plantillas sí | *"Próx."* |
| Asistente conversacional | Chat de expediente sí (IA off por defecto) | *"Próx. sept."* |

> **Ambos venden funcionalidad inexistente. La diferencia: Ulpiano la etiqueta.**
> Eso no excusa a HEREDIA — lo empeora, porque el comprador puede comprobarlo.

### C3. Precio, límites, entrada

| | HEREDIA | Ulpiano |
|---|---|---|
| Plan gratuito | ❌ | ✅ **1 usuario, 1 expediente activo, permanente, sin tarjeta** |
| Entrada | 149 €/mes · 1.490 €/año | 169 €/mes *fact. anual* (~199 mensual) · 2.028 €/año |
| Medio | 349 €/mes · 3.490 €/año | 382 €/mes *fact. anual* (~449) · 4.584 €/año |
| Alto | 749 €/mes · 7.490 €/año | 849 €/mes *fact. anual* (~999) · 10.188 €/año |
| **Δ tarifa anual** | — | **HEREDIA −22 a −27 %** |
| **Setup** | **299 € / 990 €** | **0 €** |
| **Descuento colegiados** | ❌ | ✅ **−15 % a cualquier colegiado** |
| **Early adopter** | ❌ | ✅ **−25 % de por vida, 20 primeros, hasta 31-dic-2026** |
| **Coste real año 1, escalón medio** | **3.789 €** (con setup) | **3.896 €** colegiado · **3.438 €** early adopter |
| **Métrica de valor** | **Expedientes AL MES** (15/50/200) | **Expedientes ACTIVOS** (1/5/15/50) |
| Capa transaccional | Ninguna | 15/9/5 € por modelo AEAT |
| Descuento anual | −17 % | −15 % (−25 % a 2 años) |
| Permanencia | Sin | Sin |
| Servicio gestionado | 490 €/expediente | desde 850 €/paquete |

> **Frente al comprador real (colegiado), HEREDIA es un 2,8 % más barato. Frente a
> su oferta de early adopter, un 10,2 % más caro. La ventaja de precio no existe.**

### C4. Posicionamiento y target

| | HEREDIA | Ulpiano |
|---|---|---|
| Posicionamiento | *"Backoffice post-fallecimiento"* — coordinación documental | *"El sistema operativo para las herencias"* — motor normativo |
| Target declarado | Gestorías, abogados, funerarias (3 landings) | Despachos, notarías, asesorías, family offices, funerarias, **aseguradoras** (6) |
| Foco geográfico | Nacional (19 CCAA, **sin revisar**) | *"100 % normativa catalana"* — **profundidad, no exclusividad** |
| Producto para funerarias | Landing | **Producto white-label específico** |

### C5. Fortalezas y debilidades aparentes

| | Fortalezas | Debilidades |
|---|---|---|
| **HEREDIA** | Coordinación documental (portal + pack banco + checklist); privacidad de IA verificable; plusvalía; modelos incluidos; cobertura nacional *(si se revisa)* | **No accesible**; sin plan gratuito; con setup; afirmaciones falsas publicadas; sin cuaderno particional ni árbol genealógico; **sin un solo cliente** |
| **Ulpiano** | Entrada sin fricción; descuentos agresivos al ICP; profundidad normativa catalana; más modelos AEAT; cuaderno particional; producto funerario | Plan de entrada sin modelos incluidos; sin plusvalía; API/SSO inexistentes; concentración geográfica aparente |

### C6. Dónde está HEREDIA genuinamente por delante

**Sólo cuatro cosas, todas verificables hoy:**

1. **Plusvalía municipal implementada** (ellos: "Próx.")
2. **Modelos AEAT incluidos en el plan de entrada** (ellos: 15 €/modelo, 0 incluidos)
3. **Pack banco unificado** (no visible en su oferta)
4. **Arquitectura de privacidad de IA auditable** (no visible en su oferta)

### C7. Dónde está Ulpiano por delante

1. **Entrada sin fricción:** plan gratuito permanente + sin setup
2. **Descuentos que anulan nuestra ventaja de precio** ante el ICP
3. **Cuaderno particional y árbol genealógico / legítimas**
4. **Más modelos AEAT** (652, 653, 660)
5. **Producto white-label específico para funerarias**
6. **Está en el mercado. Nosotros no.**

### C8. Incógnitas sobre Ulpiano — **[DESCONOCIDO]**

Clientes de pago reales · facturación · financiación · plantilla · cuántas de las
20 plazas de early adopter quedan · si cubren CCAA fuera de Cataluña · si su
motor de plazos contempla el mes 5 · si tienen pack banco.

---

## D. PRICING — POSICIÓN ACTUAL

### Qué nos dice el precio del competidor

- Que **un operador informado eligió la banda 169-849 €/mes** para este producto y
  este comprador. **[VERIFIED FACT]**
- Que **considera viable no cobrar setup** y regalar un plan de entrada.
- Que **espera vender a colegiados** (por eso les descuenta) **y a través de
  asociaciones**.

### Qué NO nos dice — y es lo importante

- Si alguien paga esos precios · cuántos · si son rentables · si son óptimos · si
  hay sitio para dos proveedores a esa banda.
- **Su −25 % "para los primeros 20 clientes" sugiere que su propia tarifa tampoco
  está validada.**

### ¿Se mantienen 149/349/749?

**Sí, como hipótesis de test — no como precios validados.**

| Razón | Fuerza |
|---|---|
| Están dentro de la banda que el mercado **publica** | **[WEAK INFERENCE]** — catálogos, no transacciones |
| Bajar exige 2,5× más clientes | **[STRONG INFERENCE]** — aritmética |
| No hay cliente sobre el que subir | **[VERIFIED FACT]** |

**Lo que sí hay que cambiar ya, porque no es precio sino fricción:**
**eliminar el setup obligatorio** y **crear un nivel gratuito**. Son las dos
ventajas reales del competidor y las dos más baratas de neutralizar.

### Rangos a testar

| Plan | Escalera Gabor-Granger |
|---|---|
| Entrada | **99 — 129 — 149 — 179 — 199** |
| Medio | **199 — 249 — 299 — 349 — 449** |
| Alto | **no testar todavía** — retirar de tarifa pública |
| Managed | **390 — 490 — 690 €/expediente**, sólo tras cronometrar |

### Cómo testarlos con prospectos reales

1. **Señal de 300 €** al final de cada entrevista (§G). **El único dato que no
   miente.**
2. **Gabor-Granger** sobre 40+ respuestas — sólo después de 12 entrevistas.
3. **Van Westendorp** como red de seguridad, para detectar disparates.
4. **Nunca preguntar "¿pagarías 349 €?".** Preguntar qué pagan hoy y por qué.

> **No se fija precio óptimo en este documento.** No hay evidencia para hacerlo.

---

## E. DECISIONES DE PRODUCTO

| Capacidad | Decisión | Razón |
|---|---|---|
| **Topes por expediente/mes** | **REMOVE** | 15/50/200 al mes = 180/600/2.400 al año. **Ningún plan alcanza jamás su límite**: no segmenta, no monetiza, sólo puede bloquear |
| **Topes por expediente ACTIVO** | **ADD — pero TEST FIRST los escalones** | Es la métrica correcta (escala con valor y con coste, no penaliza abrir). **Los escalones 3/15 son un supuesto**: confirmar volúmenes en las entrevistas antes de fijarlos |
| **Modelo 650/651** | **KEEP + IMPROVE urgente** | Table stakes. **Rediseño anti-falsedad obligatorio** (arts. 390/392 CP; caso Alcalá jul-2025). Y revisar el endpoint público **sin autenticación** |
| **Plusvalía municipal** | **KEEP + PROMOCIONAR** ⭐ | **Ulpiano la marca "Próx."** Diferenciador verificable hoy — previa verificación del cálculo |
| **Portal familia** | **KEEP — es el núcleo** ⭐ | El trabajo caro de una herencia es perseguir documentos. Ni WK ni las aseguradoras lo ponen en el centro |
| **Pack banco unificado** | **KEEP + PROMOCIONAR** ⭐ | No visible en la oferta del competidor |
| **IA** | **KEEP desactivada + ADD etiquetado + MAKE ADD-ON** | El etiquetado es **obligación legal vigente**. Es el único coste variable grande → cupo, no barra libre |
| **Automatización / workflows** | **ENTERPRISE LATER** | Nadie de 0-2 personas configurará reglas. Quitar del discurso comercial |
| **White-label** | **KEEP en plan superior** | Valioso en funerarias, que no son el ICP ahora |
| **API** | **REMOVE de la tarifa → ENTERPRISE LATER** | No existe. Ulpiano al menos la etiqueta |
| **SSO** | **REMOVE de la tarifa → ENTERPRISE LATER** | 0 referencias a SAML. Lo que hay es Google OAuth global, no por plan |
| **Managed / back-office** | **TEST FIRST, fuera de tarifa pública** | 13× el mejor plan de software, **sin modelo de costes**. Y compite con los clientes a quienes vendemos. Reestructurar como **BPO puro para colegiados**, máx. 3-5 cuentas |
| **Nivel gratuito** | **ADD** | Es la puerta de entrada del competidor y no la tenemos |
| **Setup obligatorio** | **REMOVE** (opcional y bonificable) | Ventaja competitiva del rival, barata de neutralizar |
| **Testimonios sintéticos** | **REMOVE HOY** | Práctica desleal prohibida en la UE |
| **Módulo PBC** | **TEST FIRST** | Mejor oportunidad identificada, **pero sin validar**. Preguntar en las entrevistas antes de construir |
| **Cuaderno particional / árbol genealógico / OCR** | **TEST FIRST** | Ulpiano los tiene. **No copiar por copiar**: preguntar si bloquean la compra |
| **19 fichas CCAA** | **IMPROVE antes de venderlo** | `README.md:316` admite que están sin revisar. Venderlo sin revisar es el riesgo del caso SAP Navarra |

---

## F. EL PROBLEMA DE DIFERENCIACIÓN

### ¿Por qué debería una gestoría española elegir HEREDIA en lugar de Ulpiano?

**Respuesta honesta: hoy no tenemos una respuesta suficientemente fuerte.**

Lo que tenemos son **cuatro ventajas funcionales verificables** (plusvalía,
modelos incluidos en la entrada, pack banco, privacidad de IA). **Ninguna está
probada como razón para cambiar de proveedor**, y tres de ellas el comprador ni
siquiera sabe que necesita hasta que se las enseñas.

Y enfrente hay **seis desventajas**, de las cuales las dos primeras son
decisivas en el momento de la decisión: **ellos tienen plan gratuito y no cobran
setup; nosotros ni siquiera estamos accesibles.**

> **No se va a fabricar una diferenciación que no existe.** La posición honesta
> es: *HEREDIA no tiene todavía una razón demostrada para que alguien lo elija
> frente a Ulpiano.* Tenerla es el objetivo de los próximos 90 días, no una
> premisa del plan.

### Las cuatro vías más baratas para construir una — en orden de coste

| # | Vía | Coste | Por qué podría funcionar |
|---|---|---|---|
| **F1** | **El mes 5 como momento de demo** | **0 €** | El plazo de 6 meses lo conoce todo el mundo; **la asimetría del mes 5 no** (pedida en plazo y sin respuesta en el mes siguiente → **concedida**; fuera de plazo → **denegada sin notificar**). Si Ulpiano sólo vigila los 6 meses, esto es una diferencia real y demostrable en 3 minutos. **Verificar primero si ellos lo cubren** |
| **F2** | **Atención del fundador** | **0 €** | 10 clientes fundadores con acceso directo al fundador, precio congelado 24 meses y una sesión de feedback al mes. **Un competidor con 20 clientes no puede igualarlo, y no es copiable con dinero** |
| **F3** | **Coste total honesto frente a su plan de entrada** | **0 €** | Su Esencial no incluye ningún modelo AEAT: con 5 al mes son 244 € frente a nuestros 149 €. **Argumento aritmético, verificable por el prospecto** |
| **F4** | **Módulo PBC** | 2-3 semanas | **Nadie lo tiene.** Resuelve una obligación legal real del cliente *y* da la base para custodiar DNIs. **Validar demanda en las entrevistas antes de construir** |

**F1, F2 y F3 no requieren escribir código.** Son las tres que hay que probar
primero.

---

## G. PRÓXIMOS 14 DÍAS — PLAN AUTORITATIVO

**22-sep a 6-oct de 2026.** Sustituye al plan del doc. 08.
*(Días 5-6 y 12-13 son fin de semana: buffer, no trabajo comercial.)*

### Bloque 1 — Estar accesible y no mentir (Días 1-4)

| Día | Objetivo | Acción | Volumen | Resultado esperado | Éxito | Fallo | Decisión que desbloquea |
|---|---|---|---|---|---|---|---|
| **1** mar 22 | Existir | Registrar dominio; actualizar `layout.tsx:7`, `sitemap.ts:7`, `robots.ts:20` | 1 | Dominio operativo | DNS resuelve | Sin dominio al final del día | **Todo lo demás** |
| **1** | No mentir | Eliminar testimonios sintéticos; retirar "SSO", "API", "DPA extendido" de `/precios` | 4 cambios | Tarifa veraz | 0 afirmaciones falsas | Queda alguna | Poder vender sin riesgo reputacional |
| **1** | Vender | **Enlazar `/precios` → `/register`** | 1 línea | Embudo conectado | Un desconocido puede registrarse | — | Autoservicio |
| **2** mié 23 | Legalidad | Textos legales con identidad real + **publicar DPA** + etiquetar output de IA | 3 | Contratable | DPA descargable | Sin DPA | **Primera venta** |
| **3** jue 24 | No delinquir | Rediseño anti-falsedad del PDF 650/651 (marca de agua, sin escudos, título "Resumen de datos para…") | 1 | PDF inequívocamente no oficial | Un tercero no lo confunde | — | Publicar |
| **3** | Medir | **Medir tokens reales de un expediente por el pipeline de IA** | 1 expediente | Coste €/expediente | Cifra obtenida | — | **Cupos de IA y viabilidad del plan alto** |
| **4** vie 25 | Publicar | Desplegar. Escribir al Colegio de Baleares: patrocinio, sesión **y cuántos inscritos son gestores colegiados** | 1 deploy + 1 correo | **HEREDIA accesible** | Sitio en línea | No desplegado | **Todo el bloque 2** |

### Bloque 2 — Encontrar y escuchar compradores (Días 7-11)

| Día | Objetivo | Acción | Volumen | Resultado esperado | Éxito | Fallo | Decisión que desbloquea |
|---|---|---|---|---|---|---|---|
| **7** lun 28 | Prospectar | Lista del Registro de Gestores Administrativos, filtrando quien **publica sobre herencias** | **60 nombres** | Lista cualificada | ≥60 | <30 → el ICP es más estrecho de lo previsto | Segmentación |
| **7-11** | Contactar | LinkedIn (conectar y conversar, **no publicidad**) + teléfono | **15/día = 75** | Conversaciones | ≥15 respuestas | <5 → el canal no funciona | **Validez del canal** |
| **8-11** mar-vie | **Entrevistar** | Las 21 preguntas del doc. 03 §4.3. **Nunca "¿pagarías X?"** | **12 entrevistas** | Volúmenes reales, dolor real | ≥12 | <6 | **Métrica de valor, precio, portfolio** |
| **8-11** | **Demostrar** | Demo de 15 min con **su propio expediente abierto**, centrada en el mes 5 | **6 demos** | Reacción real | ≥6 | <3 | **Si el producto se entiende** |
| **8-11** | **Pedir dinero** | Oferta Socio Fundador: **señal de 300 €**, 3 meses gratis, setup gratis, precio congelado 24 meses, 10 plazas con fecha | En cada demo | Señales cobradas | **≥2 cobradas** | **0 → parar y replantear** | **DISPOSICIÓN A PAGAR** |
| **9** mié 30 | Inteligencia | Presupuesto a 2 partners de `a3ASESOR\|her` como despacho interesado; contactar FunerFlow | 3 | Precios opacos | ≥1 presupuesto | — | Posicionamiento |

### Bloque 3 — Pilotos y cierre (Días 14-15)

| Día | Objetivo | Acción | Volumen | Resultado esperado | Éxito | Fallo | Decisión que desbloquea |
|---|---|---|---|---|---|---|---|
| **14** lun 5-oct | **Pilotos** | Onboarding en directo, 45 min, **con un expediente real suyo** | **2-3 pilotos** | Uso real | ≥2 activos | 0 | **Activación** |
| **14** | Usar | Instrumentar: expedientes creados, documentos subidos por la familia, portales abiertos | — | Datos de uso | Medición activa | — | **Retención** |
| **15** mar 6-oct | Investigar | **IV Fórum PANASEF (Tarragona)** — **investigación, no venta**: quién opera los servicios de herencias de Santalucía, Ocaso y Mapfre | 10 conversaciones | Respuesta al hueco nº 3 | ≥1 respuesta clara | — | **Si las aseguradoras son canal** |

### Lo que NO se hace estos 14 días

Cuaderno particional · árbol genealógico · OCR · festivos autonómicos · módulo
PBC · nivel gratuito · métrica de expedientes activos · SEPA · refactors.
**Todo eso son preguntas para las entrevistas, no tareas.**
Sólo se toca código para **desbloquear una venta** (bloque 1).

---

## H. LAS 10 DECISIONES PENDIENTES

| # | Decisión | Hipótesis actual | Evidencia | Evidencia que falta | Experimento | Fecha |
|---|---|---|---|---|---|---|
| **1** | ¿Alguien paga por esto? | Sí, 149-349 € | Ninguna propia | **Todo** | Señal de 300 € en 12 entrevistas | **6-oct** |
| **2** | ¿Cuál es la métrica de valor? | Expedientes activos | Ulpiano usa activos (5/15/50) | Volúmenes reales del ICP | Pregunta 1-2 de la entrevista | **6-oct** |
| **3** | ¿Cuántos escalones y en qué números? | 3/15 activos | Ninguna | Distribución real | Entrevistas | 6-oct |
| **4** | ¿Plan gratuito sí o no? | Sí, 1 expediente activo | Ulpiano lo tiene | Si canibaliza | Publicarlo y medir 60 días | 30-nov |
| **5** | ¿Setup obligatorio? | No — opcional y bonificable | El competidor cobra 0 € | Efecto real en conversión | A/B cuando haya tráfico | 31-dic |
| **6** | ¿Gestorías, abogados o funerarias? | Gestorías | Lógica, no evidencia | Cuál convierte antes | 12 entrevistas + 6 demos | **6-oct** |
| **7** | ¿Managed es negocio o distracción? | Distracción con cupo | 13× el software; margen 30 % vs 81 % | **Horas reales por expediente** | Cronometrar 1 expediente | 31-oct |
| **8** | ¿Cuál es nuestra diferenciación? | El mes 5 + coordinación documental | 4 ventajas verificables, ninguna probada | Si mueven la decisión | F1-F3 en las 6 demos | **6-oct** |
| **9** | ¿Construimos PBC? | Sí, es el hueco abierto | Obligación legal del cliente | Si lo piden | Preguntarlo en las 12 entrevistas | 6-oct |
| **10** | ¿El contacto en frío es legal y funciona? | Teléfono sí, LinkedIn probablemente | Art. 21 LSSI prohíbe email | **Interpretación legal + tasa real** | Consulta a abogado + medir 75 contactos | 31-oct |

---

## I. UMBRALES GO / NO-GO

**Medidos el 6 de octubre de 2026.** Sin ajustar para que HEREDIA parezca exitoso.

| Métrica | PIVOT SIGNAL | WARNING | INCONCLUSIVE | PROMISING |
|---|---|---|---|---|
| **Entrevistas completadas** | <4 | 4-7 | 8-11 | **≥12** |
| **Tasa de respuesta al contacto** | <5 % | 5-10 % | 10-20 % | **>20 %** |
| **Demos realizadas** | 0-1 | 2-3 | 4-5 | **≥6** |
| **Señales de 300 € cobradas** | **0** | 1 | — | **≥2** |
| **Pilotos activos** | 0 | 1 | — | **≥2** |
| **Uso real** (expediente creado y trabajado a 7 días) | 0 | 1 de 3 | 2 de 3 | **3 de 3** |
| **Documentos subidos por la familia** (la prueba del portal) | 0 | 1-2 | 3-5 | **>5** |
| **Disposición a pagar declarada** (banda espontánea) | <99 € | 99-149 € | 149-249 € | **≥249 €** |
| **Retención a 30 días** *(medida el 5-nov)* | 0 de 3 | 1 de 3 | 2 de 3 | **3 de 3** |

### Cómo leer el resultado

| Lectura | Qué significa | Qué se hace |
|---|---|---|
| **PROMISING** | Hay disposición a pagar y el producto se usa | Seguir el plan de 90 días. Cerrar 10 fundadores antes de marzo |
| **INCONCLUSIVE** | Interés sin compromiso | **Otras 2 semanas**, cambiando **una sola variable**: el guion de demo. No cambiar precio ni producto todavía |
| **WARNING** | Conversaciones sin conversión | El problema es el **mensaje o el segmento**. Probar abogados especializados en sucesiones antes de tocar el producto |
| **PIVOT SIGNAL** | **0 señales y <4 entrevistas** | **Parar.** O el ICP está mal elegido, o el problema no duele lo suficiente, o el producto no lo resuelve como creemos. Antes de escribir una línea de código, 10 entrevistas más en otro segmento |

> **Regla anti-autoengaño:** *"les ha encantado"* no es una métrica. Un cliente
> entusiasta que no paga es un **INCONCLUSIVE**, no un **PROMISING**.

---

## QUÉ DEBERÍA HACER ADRIÁN MAÑANA

En este orden exacto. Nada de esto lleva más de un día.

1. **Registrar el dominio definitivo** y cambiar las tres referencias del código.
2. **Borrar el bloque de testimonios** de `portal-familia/page.tsx:296-322`.
3. **Quitar "SSO", "API" y "DPA extendido"** de `pricing-table.tsx`.
4. **Cambiar el `href` de los tres botones de `/precios`** de `/#demo` a `/register`.
5. **Rellenar los textos legales** con la identidad real y **publicar el DPA**.
6. **Etiquetar el output de IA** en la interfaz ("Generado con IA — revisar").
7. **Rediseñar el PDF del borrador 650** con marca de agua y sin escudos.
8. **Desplegar.**
9. **Escribir al Colegio de Gestores de Illes Balears**: patrocinio, sesión sobre
   herencias, y **cuántos inscritos son gestores colegiados**.
10. **Abrir una hoja con 60 gestorías** que publiquen sobre herencias, y **llamar
    a las tres primeras**.

> Los puntos 1-8 son el último código que hay que tocar antes de vender. **El
> punto 10 es el que decide si HEREDIA existe.**
