# Plan de lanzamiento de Heredia — calendario día a día

> Estado de partida (21 jul 2026): el código está listo — 734 tests en verde, build de
> producción compila, migraciones automáticas en cada deploy, registro arreglado.
> Lo que falta para lanzar NO es código: es infraestructura real, legal, cobro y clientes.
> Cada día son 1–3 horas de trabajo. Sábados y domingos libres (o buffer si algo se atasca).

**El camino crítico es Stripe en modo live**: para cobrar necesitas una entidad legal
(autónomo o SL) y pasar la verificación KYC de Stripe, que tarda días. Por eso el alta
se arranca la primera semana aunque el resto vaya en paralelo.

---

## Semana 1 (21–25 jul) — Que la app viva de verdad en producción

### Martes 22 jul — Deploy definitivo
- En Vercel, apunta el deployment a la rama `claude/software-functionality-completion-u7ot0g`
  (o mergea esa rama a `main` desde GitHub y deja Vercel en `main`, que es lo limpio).
- Las migraciones se aplican solas durante el build — no toques la base de datos.
- Prueba en producción, con un email tuyo real: registro → crear organización → crear
  un expediente → subir un documento. Apunta cualquier cosa que falle.

### Miércoles 23 jul — Entidad legal (camino crítico) + dominio
- **Decide la forma jurídica y arranca el alta hoy.** Si vas a empezar como autónomo:
  alta en Hacienda (modelo 036/037, epígrafe IAE 763 o similar) + alta en RETA. Se puede
  hacer online con certificado digital/Cl@ve en el día. Si quieres SL, cuenta 2–4 semanas
  y ~3.000 € — para un piloto, autónomo primero y SL cuando facture.
- Compra el dominio definitivo (ej. `heredia.app` o el que uses) y conéctalo en
  Vercel → Settings → Domains.
- Actualiza en Vercel las variables `NEXTAUTH_URL` y `APP_URL` al dominio nuevo y redeploya.

### Jueves 24 jul — Email real
- Alta en un proveedor de email transaccional con SMTP (Resend, Brevo o Postmark).
- Verifica tu dominio en el proveedor: registros SPF, DKIM y DMARC en el DNS.
- Rellena en Vercel: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
  `EMAIL_FROM=notificaciones@tudominio.com`.
- Prueba: "he olvidado mi contraseña" en /login debe llegarte un email de verdad.
- Crea también un buzón real `soporte@tudominio.com` (Google Workspace o Zoho, gratis).

### Viernes 25 jul — Almacenamiento de documentos
- Crea un bucket S3 en Cloudflare R2 (sin coste de salida) o AWS S3, región europea.
- Rellena en Vercel: `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`,
  `S3_REGION`.
- Prueba en producción: subir un PDF a un expediente y volver a descargarlo.
- Rellena también `CRON_SECRET` (una cadena aleatoria larga) y `ADMIN_EMAILS` con tu
  email para poder entrar al panel /admin.

---

## Semana 2 (28 jul – 1 ago) — Cobrar y ser legales

### Lunes 28 jul — Stripe live: cuenta y productos
- Activa la cuenta de Stripe en modo live: datos fiscales de tu alta de autónomo,
  cuenta bancaria, verificación de identidad. (Si Stripe pide días para verificar,
  el resto de la semana no depende de esto.)
- Crea en modo live los productos y precios que ya existen en test: 3 planes
  (Inicia / Despacho / Firma) × mensual y anual, + 2 setup fees one-off.
- Rellena las 8 variables `STRIPE_PRICE_*` + `STRIPE_SECRET_KEY` live en Vercel.

### Martes 29 jul — Stripe live: webhook y facturas
- Crea el webhook live apuntando a `https://tudominio.com/api/stripe/webhook` y pon
  `STRIPE_WEBHOOK_SECRET` en Vercel.
- Configura en Stripe la facturación: tus datos fiscales en las facturas, numeración,
  e IVA (21 %) — activa Stripe Tax o configura el impuesto manualmente en los precios.
- Prueba real: contrata el plan Inicia con tu propia tarjeta, verifica que la
  organización queda activada y que llega la factura. Luego haz el refund desde Stripe.

### Miércoles 30 jul — Textos legales con tu identidad real
- Pídele a Claude Code que actualice `/legal/privacidad`, `/legal/terminos` y
  `/legal/cookies` y el aviso legal con tus datos reales: nombre/razón social, NIF,
  domicilio, email de contacto. Hoy ponen "Heredia Technologies S.L." que no existe.
- Añade una página de **DPA (contrato de encargado de tratamiento, art. 28 RGPD)**:
  tus clientes (gestorías/funerarias) te ceden datos de herederos y fallecidos, y ese
  contrato es lo primero que te pedirá cualquier gestoría seria. Claude Code puede
  redactarlo y enlazarlo desde los términos.

### Jueves 31 jul — RGPD operativo
- Redacta el registro de actividades de tratamiento (obligatorio, documento interno).
- Lista tus subencargados y verifica sus DPAs: Vercel, tu proveedor de Postgres,
  Cloudflare/AWS (R2/S3), Stripe, Anthropic, proveedor SMTP. Todos los tienen
  publicados — guarda los enlaces en el registro.
- Crea el buzón `privacidad@tudominio.com` y ponlo en la política de privacidad.
- Verifica que la retención de documentos configurable por organización funciona
  (el cron semanal `retention-cleanup` ya existe).

### Viernes 1 ago — Copias de seguridad
- Verifica los backups de tu Postgres de producción (Neon/Supabase tienen
  point-in-time recovery; actívalo si no lo está).
- **Haz una prueba de restauración real**: restaura a una rama/DB temporal y comprueba
  que los datos están. Un backup no probado no es un backup.
- Apunta en un doc: qué harías si mañana se borra la DB (pasos exactos, en orden).

---

## Semana 3 (4–8 ago) — Operación: que no se caiga y que te enteres si se cae

### Lunes 4 ago — Monitorización
- Alta en Sentry (plan gratis) y pídele a Claude Code que lo integre en Next.js.
- Alta en UptimeRobot (gratis): monitor de `https://tudominio.com` y del login,
  con alerta a tu email/móvil.
- Comprueba en los logs de Vercel que los 9 crons están disparando (briefing diario,
  notificaciones, trials, retención…).

### Martes 5 ago — Soporte y admin
- Enlaza `soporte@tudominio.com` en la web (/contacto) y define tu compromiso de
  respuesta (ej. <24 h laborables) en los términos.
- Entra en /admin/metrics y /admin/funnel con tu email de `ADMIN_EMAILS` y
  familiarízate con el panel: es tu cuadro de mando de leads y trials.

### Miércoles 6 ago — Ensayo general como cliente
- Hazte pasar por un cliente nuevo de principio a fin: registro → organización →
  primer expediente completo → invitar a un segundo usuario (rol OPERATOR) → generar
  documentos → portal familia con un email de otra persona.
- Apunta TODA fricción, texto confuso o paso que te haga dudar. Pásale la lista a
  Claude Code para corregirla. Este día suele dar la mayor mejora de conversión.

### Jueves 7 ago — Contenido y analítica
- Revisa landing, /precios y páginas de sector (gestorías, funerarias, abogados) con
  ojos de comprador; sustituye capturas por capturas reales de producción.
- Alta en Google Search Console (el sitemap ya existe en /sitemap.xml) y en una
  analítica (Plausible o GA4).

### Viernes 8 ago — Cierre de seguridad
- Rota todos los secretos que hayan pasado por chats/emails: `NEXTAUTH_SECRET`,
  claves S3, SMTP, `CRON_SECRET`.
- Activa 2FA en: Vercel, GitHub, Stripe, registrador del dominio, proveedor DB, email.
- Pídele a Claude Code un `/security-review` final del repo.

---

## Semana 4 (11–15 ago) — Pilotos: primeras empresas reales

### Lunes 11 ago — Material comercial
- Prepara una demo de 15 minutos sobre la organización demo (`DEMO_ENABLED` ya
  existe): guión de 5 pantallas máximo, centrado en "cuánto tiempo te ahorra por
  expediente".
- Un one-pager PDF: qué es, para quién, precio, y tu contacto. Claude Code te lo genera.

### Martes 12 – Miércoles 13 ago — Conseguir 2–3 pilotos
- Haz una lista de 15–20 gestorías/funerarias/despachos alcanzables (conocidos,
  locales, LinkedIn). Contacta ofreciendo 2–3 meses gratis como piloto a cambio de
  feedback quincenal.
- Objetivo: 2–3 síes con fecha de onboarding puesta en el calendario.

### Jueves 14 – Viernes 15 ago — Onboarding de pilotos
- Sesión de 45 min con cada piloto: tú compartes pantalla y creas con ellos su
  organización y su primer expediente real. No les mandes un enlace y ya: acompáñalos.
- Cada fallo o duda que salga en estas sesiones va a una lista → Claude Code.

---

## Semana 5 (18–22 ago) — Lanzamiento

### Lunes 18 – Miércoles 20 ago — Estabilizar con pilotos dentro
- Uso real de los pilotos: responde soporte el mismo día, corrige lo que reporten,
  vigila Sentry y los crons.
- Pide a cada piloto una frase de testimonio si están contentos → a la landing.

### Jueves 21 ago — Go/No-Go
Repasa la checklist final; lanza solo si TODO está en sí:
- [ ] Registro, pago, expediente y portal familia funcionan en producción
- [ ] Stripe live cobra y factura con IVA correctamente
- [ ] Legal con identidad real + DPA publicado
- [ ] Backups probados con restauración real
- [ ] Sentry + uptime avisándote a ti
- [ ] Al menos 1 piloto usándolo sin que le tengas que ayudar a diario

### Viernes 22 ago — Lanzar
- Quita restricciones de acceso si las hay, precios públicos visibles.
- Anuncio: LinkedIn personal, email a tu red, colegios profesionales de gestores
  administrativos, foros del sector funerario.
- A partir de aquí el trabajo diario cambia: mañanas soporte + ventas, tardes mejoras.

---

## Qué NO hace falta antes de lanzar (para que no te disperses)

- SSO/SAML empresarial, apps móviles, más idiomas, integraciones bancarias reales,
  workflow engine — todo eso está documentado como limitación del MVP y ningún
  piloto lo va a bloquear.
- Más contenido SEO/blog: suma a medio plazo, no bloquea el lanzamiento.
- SL: puedes operar como autónomo y transformar cuando haya facturación recurrente.
