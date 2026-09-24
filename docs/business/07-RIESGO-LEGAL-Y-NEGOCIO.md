# 07 — Riesgo legal y de negocio

> **Fecha:** 21 de septiembre de 2026
> **Aviso:** esto es investigación documental con fuentes, no asesoramiento
> jurídico. Los puntos marcados **[VALIDAR]** requieren confirmación de un
> abogado colegiado en España antes de operar.
> Etiquetas: **[C]** confirmado con fuente primaria · **[I]** interpretación ·
> **[D]** desconocido.

---

## 0. Los cuatro riesgos que hay que tratar antes de vender nada

Ordenados por (probabilidad × impacto comercial). El detalle está más abajo.

| # | Riesgo | Coste de arreglarlo hoy | Coste de no arreglarlo |
|---|---|---|---|
| **1** | **Testimonios fabricados en `/portal-familia`** | 10 minutos | Práctica comercial desleal prohibida en la UE + credibilidad destruida ante el primer cliente que pida referencias |
| **2** | **El PDF "borrador" del Modelo 650/651 puede parecerse al oficial** | 1 día de maquetación | Arts. 390/392 CP — falsedad en documento oficial (6 meses a 3 años) |
| **3** | **Un cálculo ISD erróneo en el que el cliente confía** | Disclaimers + registro de aceptación + versionado normativo | **Precedente directo: 76.500 €** (SAP Navarra 17/03/2021) |
| **4** | **Vender "presentamos por ti"** | Corregir el copy | Promesa incumplible: HEREDIA **nunca** podrá ser colaborador social |

---

## 1. Testimonios fabricados — el riesgo más barato de eliminar y el más caro de ignorar

### El hallazgo

`src/app/portal-familia/page.tsx:296-322` publica cuatro testimonios bajo el
titular **"La diferencia, en palabras de quienes lo usan"**, atribuidos a
*"Gestoría boutique · Madrid"*, *"Despacho fiscal · Sevilla"*, *"Funeraria con
servicio post-mortem · Bilbao"* y *"Abogado de derecho sucesorio · Valencia"*.

Uno de ellos afirma un resultado de negocio cuantificado:

> *"Hemos pasado de captar 2-3 herencias por trimestre por recomendación a 6-8."*

El descargo dice que son *"citas representativas reconstruidas a partir de
feedback real de despachos en periodo de prueba o producción"*.

### Por qué es grave

1. **El descargo es falso.** `README.md:6-9` establece que el producto *"no ha
   operado todavía con expedientes reales"*. No existen despachos en producción,
   luego no existe el feedback real del que dicen estar reconstruidas.
2. **El comentario del código lo admite**: `{/* Testimonios (sintéticos) */}`.
3. **Régimen jurídico.** La Directiva 2005/29/CE de prácticas comerciales
   desleales, modificada por la Directiva Ómnibus (UE) 2019/2161 y transpuesta
   en España por el RDL 24/2021, incorporó al **Anexo I (lista negra)** las
   reseñas y testimonios falsos —prácticas desleales *en todo caso*, sin
   necesidad de probar que engañaron a nadie—. Conecta además con el art. 5 de
   la Ley 3/1991 de Competencia Desleal (actos de engaño). **[C]**
4. **Riesgo comercial mayor que el legal.** Este producto se vende a gestorías y
   abogados: compradores entrenados profesionalmente en detectar afirmaciones
   sin soporte. El día que uno pida hablar con la gestoría boutique de Madrid,
   se acaba la conversación — y con ella la credibilidad del resto de
   afirmaciones del sitio, incluidas las que sí son ciertas.

### Acción

**Eliminar el bloque completo antes de publicar el sitio.** No reescribirlo, no
suavizar el descargo: borrarlo. Sustituirlo, si se quiere ocupar ese espacio,
por lo que sí es verdad y sí es vendible: la arquitectura de privacidad, el
versionado normativo, la auditoría inmutable. *(No he modificado código: esta
acción queda pendiente de tu decisión.)*

---

## 2. El borrador del Modelo 650: riesgo penal evitable por diseño

### Marco

- El **ISD está cedido a las CCAA** (Ley 22/2009). La Orden HAP/2488/2014, que
  aprueba los modelos estatales 650/651/655, limita su uso en el art. 2.1 a los
  casos en que el rendimiento **no** esté cedido — es decir, obligación real y
  no residentes, vía Oficina Nacional de Gestión Tributaria. **[C]**
- Cada CCAA aprueba **su propio modelo** por orden autonómica. **[C]**
- Arts. **390 y 392 CP**: el particular que *simula* un documento oficial comete
  falsedad material (6 meses a 3 años + multa). La falsedad *ideológica* del
  particular es atípica; la *material* no. **[C]**
- **Precedente real y reciente:** Juzgado de lo Penal nº 1 de Alcalá de Henares,
  07/07/2025 — condena a dos personas que tramitaban sin colegiación. **La
  condena no fue por intrusismo (art. 403 CP) sino por estafa y falsedad en
  documento oficial**, y el hecho determinante fue **fabricar documentos que
  imitaban formatos que sólo el Consejo General de Gestores puede emitir**. **[C]**

### Implicación de producto

«Modelo 650» no es *un* formulario: son ~15 autonómicos más uno estatal. Un
generador único de PDF es técnicamente incorrecto para la mayoría de
expedientes, y **estéticamente peligroso si se parece al impreso oficial**.

### Regla de diseño obligatoria **[VALIDAR con penalista]**

El PDF debe ser inequívocamente **no oficial**:

- Titularlo **"Resumen de datos para cumplimentar el Modelo 650"**, no "Modelo 650".
- Maquetación visualmente distinta del impreso oficial.
- Marca de agua diagonal en todas las páginas: **BORRADOR — NO VÁLIDO PARA PRESENTACIÓN**.
- **Sin** escudos ni logotipos autonómicos, **sin** códigos de barras, **sin** CSV.
- Sin presentar la numeración de casillas como si fuera el impreso.

> Verificación pendiente sobre el código actual: revisar `src/lib/modelo650-pdf.ts`
> y `modelo651-pdf.ts` contra esta lista antes de publicar. El endpoint público
> `/api/public/modelo650-preview` amplifica el riesgo, porque genera el PDF **sin
> autenticación** y puede acabar en manos de cualquiera.

---

## 3. Responsabilidad por el cálculo: existe un precedente con tu caso de uso exacto

### El precedente

**SAP Navarra, Secc. 3ª, 17/03/2021.** Una gestoría fue condenada a pagar
**76.500 €** a su clienta (50 % de una sanción de 153.721,78 €) por presentar la
**autoliquidación del Impuesto de Sucesiones** con tipos incorrectos. El tribunal
razonó que la gestoría, al **determinar el contenido concreto** de la
declaración, hizo labor de asesoramiento y excedió la mera gestión, apreciando
falta de diligencia. El reparto fue 50/50 porque la clienta aceptó la propuesta. **[C]**

### Cómo llega esto a HEREDIA

Marco: responsabilidad contractual (art. 1101 CC); el contrato de asesoría es
arrendamiento de servicios (art. 1544 CC) → **obligación de medios, no de
resultado**; el estándar es la *lex artis*. La **LSSI no exonera** a HEREDIA: las
exenciones de sus arts. 14-17 son para intermediarios (caché, hosting, enlaces),
no para quien genera un cálculo propio. **[C]**

Ruta probable de la reclamación: heredero → gestoría → **la gestoría repite
contra HEREDIA** ex art. 1101 CC.

**Lo que acota el daño:** lo recuperable es **recargo + sanción + intereses**, no
la cuota tributaria (que el cliente debía igualmente). **[I]** Éste es el mejor
argumento para negociar límites de responsabilidad.

**Lo que limita la limitación:** el **art. 1102 CC** declara **nula** la renuncia
a la acción por dolo. Un tope contractual es válido entre empresarios para culpa
leve, pero no cubre dolo ni —según doctrina discutida— culpa grave. **[C]**

### Mitigaciones baratas y efectivas

1. **Disclaimer persistente en cada pantalla de cálculo**, no enterrado en los
   términos: *"Cifra orientativa. No constituye asesoramiento fiscal. Debe ser
   verificada por un profesional colegiado antes de presentar."*
2. **Registrar el acuse** (timestamp + usuario) de esa advertencia. Es
   exactamente la prueba que decidió el reparto 50/50 en la SAP Navarra: el
   cliente profesional aceptó y revisó.
3. **Versionado de reglas fiscales por CCAA con fecha de vigencia y fuente
   (BOE/BOJA/BOCM) visible en la interfaz.** Doble beneficio: es la mejor defensa
   probatoria de diligencia, y es un argumento comercial frente a competidores
   con tablas *hardcoded*.
4. **Límite de responsabilidad B2B** a 12 meses de cuotas, con exclusión de daño
   indirecto y **excepción expresa del dolo** (incluirla lo hace *más*
   defendible, no menos), y aceptación explícita de las condiciones para superar
   el control de incorporación de la LCGC.
5. **Cotizar RC profesional tech/E&O + ciber verificando que no excluyan el error
   de cálculo tributario** — que es justo el siniestro del caso Navarra. Rango
   estimado 1.500-5.000 €/año para este perfil **[ESTIMACIÓN, pedir 3 ofertas]**.

---

## 4. Presentación telemática: una promesa que HEREDIA no puede cumplir nunca

Éste es un riesgo de *expectativa*, y por eso es de alta probabilidad: el
comprador lo asume solo si el copy no lo desmiente.

- La colaboración social (art. 92 LGT) se articula con **colegios y asociaciones
  profesionales y sus colegiados**. **[C]**
- **La colaboración social de la AEAT no cubre el ISD autonómico.** Son convenios
  **autonómicos separados, uno por CCAA**. **[C]**
- **Comunidad de Madrid**: sólo miembros de asociaciones o colegios con convenio
  suscrito. **Andalucía (ATRIAN)**: firman Consejos, Colegios o entidades
  representativas de sectores profesionales. **Una sociedad mercantil ordinaria
  no puede adherirse.** **[C]**

### Conclusiones duras

1. **HEREDIA nunca será colaborador social.** El certificado y la adhesión son
   del colegiado.
2. **El producto debe asumir siempre que presenta el cliente colegiado con su
   certificado.** Esto es una restricción de arquitectura, no un detalle legal.
3. El copy no puede decir "presentamos por ti", "gestionamos tus impuestos" ni
   nada equivalente. Sí puede decir: *"tu gestoría presenta con su certificado;
   nosotros le dejamos el expediente listo"*.

> **Nota positiva:** esta restricción **refuerza** el posicionamiento correcto.
> HEREDIA es la capa de preparación y coordinación, no el canal de presentación.
> Ver documento 04.

---

## 5. `Heredia Managed` — el riesgo estructural del portfolio

### El problema

El servicio se vende a **490 €/expediente** como *"operación administrativa
coordinada por expediente… Sin asesoría legal/fiscal"*. El descargo es la
mitigación correcta, pero es frágil:

| Vector | Análisis |
|---|---|
| **Reserva de actividad** | No existe reserva legal expresa sobre "preparar y presentar declaraciones": la **asesoría fiscal no está regulada** en España, y el art. 92 LGT presupone asesores no colegiados. El Estatuto de los Gestores Administrativos (Decreto 424/1963, RD 1324/1979, RD 2532/1998) define la profesión y exige colegiación, **pero no contiene cláusula expresa que prohíba a terceros tramitar**. **[C/I]** |
| **La etiqueta no vence a los hechos** | Si el operador decide qué reducción aplicar o qué valor declarar, eso es asesoramiento material — el criterio exacto de la SAP Navarra. **[C]** |
| **Vía realista de ataque** | No el art. 403 CP (que probablemente no prospere por la doctrina del título académico), sino **competencia desleal, art. 15 LCD (violación de normas)**: más rápida y barata para un colegio. **[I]** |
| **Denominación** | Usar "abogado", "asesor fiscal" o "gestoría" sin serlo activa el art. 1.2 de la Ley 34/2006 y el tipo agravado del art. 403.2 CP. **[C]** |

### El conflicto que no es legal sino comercial

**HEREDIA vende software a gestorías y, con Managed, compite con ellas por el
mismo expediente.** Ese conflicto no lo arregla ninguna cláusula. Un comprador
colegiado que vea "Managed, 490 €/expediente" en la misma página de precios
donde se le pide 349 €/mes entiende, correctamente, que el proveedor es también
un competidor potencial.

### Estructuras, de menor a mayor blindaje

1. **BPO puro — recomendado.** El cliente es la gestoría; HEREDIA nunca contrata
   con la familia; la familia firma con el colegiado. HEREDIA es encargado del
   tratamiento y subcontratista operativo. Riesgo de intrusismo ≈ 0 porque no hay
   relación profesional-cliente, y **desaparece el conflicto de canal**.
2. **White-label a colegiado.** HEREDIA factura al colegiado; el colegiado
   factura al heredero y firma. Requiere marca del colegiado en el pack, el PDF
   y el portal.
3. **Marketplace con prestación por socio.** Más expuesto: HEREDIA aparece como
   prestador principal.
4. **NewCo sociedad profesional** con ≥50 %+1 del capital y votos en manos de
   colegiados (art. 4 Ley 2/2007). Máximo blindaje, máxima fricción societaria.
   Nota: **HEREDIA S.L. con capital de fundadores/inversores no puede ser
   sociedad profesional de abogacía.** **[C]**

### Si además se vende a familias (B2C), aparece un riesgo nuevo

**Art. 102 TRLGDCU: 14 días naturales de desistimiento.** Los servicios digitales
**no figuran** en el catálogo de excepciones del art. 103. En un expediente de
herencia el trabajo arranca de inmediato y el plazo fiscal corre: sin
consentimiento previo expreso al inicio inmediato y reconocimiento de la pérdida
o prorrateo del derecho, **un cliente puede consumir el servicio y desistir el
día 13**. **[C]**

---

## 6. Protección de datos

### 6.1 Datos del fallecido: el RGPD no aplica, pero el art. 3 LOPDGDD sí

- **Considerando 27 RGPD**: el Reglamento **no se aplica a datos de personas
  fallecidas**. **[C]**
- **Art. 3 LOPDGDD (LO 3/2018)**: personas vinculadas al fallecido por razones
  familiares o de hecho, y sus herederos, **pueden dirigirse al responsable o
  encargado** para solicitar acceso, rectificación o supresión. Si el fallecido
  lo prohibió, esa prohibición **no afecta al derecho de los herederos sobre los
  datos de carácter patrimonial**. **[C]**

**Requisito de producto que hoy no existe:** un flujo de *"solicitud art. 3
LOPDGDD"*, con verificación del vínculo familiar o hereditario, plazo de
respuesta y registro de la decisión. Debe poder atender a **familiares que no son
clientes** — escenario clásico: un heredero enfrentado con el albacea. Sin ese
flujo, una denuncia ante la AEPD es fácil y barata para el reclamante.

Y ojo: los datos de los **herederos vivos**, cónyuge, legatarios y acreedores
**sí están plenamente bajo RGPD**.

### 6.2 Copias del DNI en el portal familia

La AEPD considera que **pedir copia del DNI es excesivo y desproporcionado**
salvo habilitación normativa expresa, porque la imagen del documento de
identidad tiene naturaleza especialmente sensible. **[C]**

**Pero existe habilitación**: la Ley 10/2010 de prevención de blanqueo obliga a
identificación formal con documento fehaciente cuando el cliente es sujeto
obligado. **Usar esa base y documentarla** es mejor que recoger DNIs "por si
acaso". Ver §7.

**Categorías especiales (art. 9 RGPD):** el DNI y una escritura no lo son. Pero
en un expediente de herencia aparecen habitualmente el **certificado literal de
defunción** (causa de la muerte → dato de salud), documentación de discapacidad
o medidas de apoyo, y disposiciones testamentarias de contenido religioso.
**[VALIDAR caso por caso]** Con tratamiento a gran escala, IA e interesados
vulnerables, la **EIPD del art. 35 RGPD es muy probablemente obligatoria**.

### 6.3 Transferencias internacionales y el escenario Schrems III

- El **EU-US Data Privacy Framework sigue vigente**: el Tribunal General
  desestimó **Latombe (T-553/23) el 03/09/2025**. **[C]**
- **Pero está en casación: asunto C-703/25 P ante el TJUE, recurso de
  31/10/2025, sin fecha de vista.** **[C]**
- Anthropic: DPA con cláusulas contractuales tipo incorporado a los términos
  comerciales de los productos de pago; **sin residencia de datos en la UE**. **[I — verificar en el Trust Center antes de afirmarlo comercialmente]**

**Mitigación de coste cero: firmar SCCs con Anthropic, el proveedor de
almacenamiento y Stripe aunque estén certificados en DPF.** Es el seguro contra
una eventual anulación, y hoy no cuesta nada.

### 6.4 Reglamento de IA — hay una obligación **ya exigible hoy**

Base: Reglamento (UE) 2024/1689, modificado por el Reglamento (UE) 2026/1744
(*Digital Omnibus on AI*), en vigor desde el 27/07/2026. **[C]**

| Obligación | Estado a 21/09/2026 |
|---|---|
| Art. 5 (prácticas prohibidas) | En vigor desde 02/02/2025 |
| Obligaciones GPAI (arts. 51-56) | Recaen sobre **Anthropic**, no sobre HEREDIA |
| **Art. 50 (transparencia)** | **Aplicable desde el 02/08/2026 — NO aplazado.** Marcado legible por máquina: prórroga a 02/12/2026 |
| Alto riesgo (Anexo III) | Aplazado a 02/12/2027 — y HEREDIA **no encaja** en ningún supuesto del Anexo III **[I]** |

**Acción exigible hoy, no buena práctica:** etiquetar visiblemente todo texto
generado por el modelo en la interfaz (*"Generado con IA — revisar"*). El
producto ya tiene la arquitectura correcta (puerta única, minimización); le falta
la etiqueta.

**Aviso de la AEPD (orientaciones sobre IA agéntica, 18/02/2026):** usar un
agente *"puede cambiar la naturaleza del tratamiento, su alcance y los riesgos
asociados"*. Si HEREDIA pasa de "el modelo resume un documento" a "el modelo
ejecuta pasos del expediente" —que es exactamente lo que insinúa el módulo
`autopilot.ts`— cambia el análisis de riesgo y probablemente exige EIPD. **[C]**

---

## 7. La oportunidad escondida dentro del cumplimiento: módulo PBC

**HEREDIA no es sujeto obligado. Sus clientes sí.**

- **Art. 2.1.m) Ley 10/2010**: asesores fiscales y contables externos → sujetos
  obligados.
- **Art. 2.1.ñ)**: abogados y otros profesionales independientes cuando
  participen en compraventa de inmuebles, gestión de fondos, valores o activos, o
  apertura y gestión de cuentas.
- **Art. 4**: identificación del **titular real** (>25 % del capital o de los
  derechos de voto).
- **Art. 25**: conservación **10 años**; desde el año 5, acceso restringido a la
  unidad de cumplimiento y a la defensa jurídica. **[C]**

Un expediente de herencia típico —inmueble, cuentas bancarias, reparto entre
herederos— **activa estas obligaciones para el cliente de HEREDIA**. Y hoy las
cumplen mal, con carpetas y Excel.

**Un módulo PBC que capture identificación con documento fehaciente, registre el
propósito de la relación, determine y documente el titular real, aplique
retención a 10 años con restricción de acceso a los 5, y genere el expediente de
diligencia debida exportable ante inspección del SEPBLAC:**

1. es un **diferenciador vendible** que ni Ulpiano ni `a3ASESOR|her` destacan;
2. **da la base legal que hoy falta** para custodiar los DNIs del portal familia;
3. encaja con la infraestructura ya construida (`retention.ts`, `PurgeEvidence`,
   `AuditLog`, `file-policy.ts`).

**Dos problemas resueltos con una función.** Es la mejor oportunidad de producto
identificada en todo este análisis. Ver documento 04.

---

## 8. Facturación electrónica: dos exposiciones distintas

**No confundirlas.**

1. **HEREDIA como contribuyente.** Verifactu (RD 1007/2023, modificado por RD
   254/2025, con prórroga adicional): **contribuyentes de IS → 01/01/2027**;
   resto → 01/07/2027. **[C/I — verificar la referencia BOE exacta del RD-ley de
   prórroga]**. **Acción concreta: verificar si Stripe emite declaración
   responsable Verifactu para España.** Es un riesgo silencioso con menos de 15
   meses de plazo.
2. **HEREDIA como productor de software.** Si el SaaS llega a **emitir facturas
   de sus clientes** (p. ej. la minuta de la gestoría al heredero), HEREDIA pasa
   a ser productor de un sistema informático de facturación, con obligación de
   **declaración responsable**. **Consecuencia de hoja de ruta: no añadir
   facturación al producto sin presupuestar Verifactu.**

Factura electrónica B2B (Crea y Crece): el **RD 238/2026 (BOE 31/03/2026)**
desarrolla el sistema, pero **su aplicación efectiva está diferida** a la Orden
Ministerial que desarrolle la solución pública de la AEAT. Calendario esperado:
>8 M€ ~oct-2027; resto ~oct-2028. **[I — confirmar contra la Orden]**

---

## 9. ENS, ISO 27001 y NIS2: qué importa y qué no

| Norma | ¿Obliga a HEREDIA? | Lectura comercial |
|---|---|---|
| **ENS (RD 311/2022)** | **No** vendiendo a gestorías, abogados y funerarias privadas. Sí el día que venda a un colegio profesional de derecho público, una CCAA o un ayuntamiento | Vigilar, no invertir todavía |
| **ISO 27001** | Sin obligación legal | **De facto exigida** en compras corporativas, aseguradoras y due diligence. Es la que desbloquea el despacho de 10 personas y el grupo funerario. Hacerla cuando el primer contrato grande la pida, no antes |
| **NIS2** | España **sigue sin transponer** la Directiva (UE) 2022/2555; segundo requerimiento formal de la Comisión el 19/05/2026. HEREDIA queda por tamaño fuera del ámbito directo | Llegará por **cadena de suministro** si un cliente sí está sujeto |
| **RGPD / DPA art. 28** | **Obligatorio y hoy incumplido** — el DPA no está publicado (`README.md:308`) | **No es diferenciador: su ausencia es descalificatoria.** Debe existir antes de la primera llamada de ventas |

---

## 10. Plan de acción legal

### Esta semana (coste ≈ 0)

1. **Eliminar los testimonios fabricados** de `/portal-familia`.
2. **Rediseñar el PDF del borrador** con marca de agua y maquetación no oficial.
3. **Purgar el copy**: fuera "asesoramos", "gestionamos tus impuestos",
   "presentamos por ti". Dentro: "software para profesionales", "tu gestoría
   presenta con su certificado".
4. **Etiquetar todo output de IA** en la interfaz — obligación ya vigente.
5. **Cumplir el art. 10 LSSI** en el sitio: denominación social, domicilio, NIF,
   datos registrales.
6. **Disclaimer persistente + registro de aceptación** en cada pantalla de cálculo.
7. **Firmar SCCs** con Anthropic, almacenamiento y Stripe.

### Próximas 2-4 semanas (coste bajo)

8. **DPA del art. 28 con anexos reales**, no genéricos — la AEPD sanciona los
   anexos vacíos, no la falta de literatura contractual. Lista pública de
   subencargados con preaviso y derecho de oposición.
9. **Flujo "solicitud art. 3 LOPDGDD"** con verificación de vínculo.
10. **Condiciones B2B** con tope de responsabilidad, exclusión de daño indirecto,
    excepción expresa del dolo y aceptación explícita.
11. **Rellenar los textos legales con identidad real** (hoy llevan marcadores).
12. **Cotizar 3 pólizas RC/ciber** verificando que no excluyen el error de
    cálculo tributario.
13. **Versionado normativo por CCAA** con fecha de vigencia y fuente visible.

### Decisión de negocio, no de cumplimiento

14. **Elegir estructura para Managed** (recomendación: BPO puro) — ver doc. 04.
15. **Módulo PBC** — ver doc. 04.

### Pendiente de validar con abogado **[VALIDAR]**

- Diseño final del PDF borrador (penalista).
- Clasificación definitiva bajo el Reglamento de IA (lectura propia: riesgo
  limitado, sólo art. 50).
- Si el certificado **literal** de defunción introduce datos del art. 9 RGPD en
  el flujo, y si procede EIPD.
- Estructura societaria de Managed.
- Referencia BOE exacta del RD-ley que prorroga Verifactu a 2027.
