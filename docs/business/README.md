# HEREDIA — Estrategia de negocio

Análisis de negocio, mercado, pricing, portfolio, go-to-market, economía y riesgo
legal, realizado el **21-22 de septiembre de 2026** sobre la rama
`claude/heredia-security-hardening-v1` (commit `da998a9`).

**Empieza por [`00-RESUMEN-EJECUTIVO.md`](00-RESUMEN-EJECUTIVO.md).**

> **Para decidir y actuar, ve directamente a
> [`11-CURRENT-DECISION-BRIEF.md`](11-CURRENT-DECISION-BRIEF.md).**
> Contiene lo que sabemos, lo que no, la comparación con Ulpiano, la posición de
> precio, las decisiones de producto, el plan autoritativo de 14 días y los
> umbrales go/no-go.
>
> ✅ **Correcciones aplicadas el 22-sep-2026.** La auditoría
> [`10-CLAIMS-AND-EVIDENCE-AUDIT.md`](10-CLAIMS-AND-EVIDENCE-AUDIT.md) encontró
> tres errores materiales y siete sobreafirmaciones en los documentos 00-08. **Ya
> están corregidas**; el detalle de cada cambio está en
> [`CHANGELOG-CORRECTIONS.md`](CHANGELOG-CORRECTIONS.md). El documento 10 se
> conserva **sin modificar** como traza de auditoría.

---

## Documentos

| # | Documento | Qué contesta |
|---|---|---|
| **00** | [Resumen ejecutivo](00-RESUMEN-EJECUTIVO.md) | El diagnóstico, los cinco hallazgos, y las 13 preguntas de la puerta de decisión |
| 01 | [Auditoría de producto](01-AUDITORIA-PRODUCTO.md) | Qué existe realmente en el código, y dónde el marketing dice otra cosa |
| 02 | [Mercado y competencia](02-MERCADO-Y-COMPETENCIA.md) | Tamaño del mercado, Ulpiano, `a3ASESOR\|her`, aseguradoras de decesos, huecos competitivos |
| 03 | [Pricing](03-PRICING.md) | Comparables reales, test de estrés, métrica de valor, packaging, límites, setup, pilotos, recomendación v1 |
| 04 | [Portfolio de servicios](04-PORTFOLIO-SERVICIOS.md) | Qué vender, qué retirar, qué añadir, producto mínimo vendible, servicio vs software |
| 05 | [GTM y ventas](05-GTM-Y-VENTAS.md) | ICP único, canales por evidencia, guion de demo, plan de 90 días |
| 06 | [Economía y modelo financiero](06-ECONOMIA-Y-MODELO-FINANCIERO.md) | El modelo propio ejecutado y estresado, unit economics, cuántos clientes hacen falta |
| 07 | [Riesgo legal y de negocio](07-RIESGO-LEGAL-Y-NEGOCIO.md) | Intrusismo, falsedad documental, responsabilidad por cálculo, RGPD, Reglamento de IA, PBC |
| 08 | [Experimentos de 14 días](08-EXPERIMENTOS-14-DIAS.md) | El plan concreto para convertir hipótesis en datos |
| **10** | [**Auditoría de afirmaciones y evidencia**](10-CLAIMS-AND-EVIDENCE-AUDIT.md) | **Falsación de los documentos anteriores: qué es fiable para actuar y qué no.** Sin modificar, como traza |
| **11** | [**Brief de decisión**](11-CURRENT-DECISION-BRIEF.md) ⭐ | **EMPIEZA AQUÍ.** Qué sabemos, qué no, HEREDIA vs Ulpiano, precio, producto, plan de 14 días, umbrales go/no-go |
| — | [Changelog de correcciones](CHANGELOG-CORRECTIONS.md) | Qué se corrigió, por qué, y su impacto en la estrategia |

---

## Método y convenciones

**Etiquetas de evidencia**, usadas en todos los documentos:

| Etiqueta | Significado |
|---|---|
| **[CONFIRMADO]** | Leído en una fuente primaria, con URL o referencia al fichero del repositorio |
| **[ESTIMADO]** | Inferido, con la aritmética o el supuesto a la vista |
| **[HIPÓTESIS]** | Sin evidencia todavía; pendiente de experimento |
| **[DESCONOCIDO]** | No se ha podido establecer. **No se ha rellenado con estimaciones** |
| **[VALIDAR]** | Requiere confirmación de un profesional (abogado, normalmente) |

**Lo que no se ha hecho:** no se ha inventado ningún cliente, testimonio, dato de
mercado, capacidad de producto ni cifra financiera. No se ha modificado código de
la aplicación. Las cifras del modelo financiero proceden de ejecutar
`src/lib/financial-model.ts` tal cual, sin alterar constantes.

**Una limitación declarada:** el agente de investigación asignado al
dimensionamiento de mercado se interrumpió por límite de uso. Las cifras
principales se recuperaron después por consulta directa, pero varios huecos
siguen abiertos y están listados en [`02-MERCADO-Y-COMPETENCIA.md`](02-MERCADO-Y-COMPETENCIA.md), §7.

---

## Si sólo tienes cinco minutos

1. **El precio está 22-27 % por debajo de la tarifa pública de un competidor
   directo español (Ulpiano)** — *pero* ese competidor ofrece **−15 % a
   colegiados** (que es todo el ICP) y **−25 % de por vida a sus 20 primeros
   clientes hasta el 31-dic-2026**, con lo que la ventaja de HEREDIA cae a ~3 % o
   se invierte. **El precio de un competidor no valida el nuestro.** Ver doc. 10 §2.
2. **La fricción de entrada sí lo es.** Sin plan gratuito, con setup de 299/990 €
   frente a los 0 € del competidor, y con una página de precios desde la que no
   se puede comprar aunque el registro self-service con trial de 14 días esté
   construido y funcionando.
3. **La métrica de valor está rota.** Los topes son expedientes *al mes*; deberían
   ser expedientes *activos*. Hoy ningún plan alcanza jamás su propio límite.
4. **Hay cuatro afirmaciones publicadas que el código no sostiene**, incluidos
   cuatro testimonios fabricados en `/portal-familia`.
5. **Nada de esto importa hasta que el sitio esté publicado:** el dominio que el
   código usa como URL canónica no resuelve en DNS.

→ Las ocho acciones de esta semana están en
[`00-RESUMEN-EJECUTIVO.md`](00-RESUMEN-EJECUTIVO.md), §3.
