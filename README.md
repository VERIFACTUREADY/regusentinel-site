# BARITUR PRO - MVP

Software SaaS B2B (multi-tenant) para gestorias administrativas y funerarias que automatiza y orquesta la gestion administrativa post-fallecimiento.

## RESUMEN ARQUITECTURA

- **Frontend + Backend**: Next.js 14 (App Router) + TypeScript
- **ORM**: Prisma con PostgreSQL
- **Auth**: NextAuth.js (Credentials + magic link stub)
- **UI**: Tailwind CSS + shadcn/ui components
- **Storage**: S3 compatible (MinIO en local)
- **Email**: Nodemailer (SMTP)
- **PDF**: pdf-lib
- **Payments**: Stripe (checkout + webhooks)
- **IA/Autopilot**: Anthropic Claude (con stub determinista si no hay API key)
- **Containerizacion**: Docker Compose (postgres, redis, minio)

Monorepo single-app con todas las rutas API en `/src/app/api/` y paginas en `/src/app/`.
RBAC real en API con 5 roles: OWNER, MANAGER, OPERATOR, VIEWER, MANAGED_OPS.
Audit logs en todas las acciones clave. Consentimiento por expediente.

## SUPUESTOS

1. MVP no incluye envios reales a bancos/administraciones (prepara documentos + registra "enviado por canal X")
2. Background jobs (BullMQ + Redis) se dejan como placeholder; las tareas criticas se ejecutan en API routes
3. Magic link auth se implementa como stub (genera token pero no envia email real en dev)
4. Stripe funciona en modo test; se necesitan API keys reales para checkout
5. Sin ANTHROPIC_API_KEY, el autopilot usa un stub determinista que genera checklists basados en reglas
6. Precios: Starter 49 EUR/mes, Pro 149 EUR/mes, Enterprise a medida
7. Retencion por defecto: 90 dias tras cierre (configurable por org)
8. MinIO simula S3 en local; en produccion se usaria AWS S3 o compatible
9. Rate limiting basico por email/IP en demo-request; en produccion se recomienda middleware dedicado

## LIMITACIONES MVP

- No hay envio real de emails a terceros (bancos, administraciones)
- No hay integracion real con APIs de bancos/telecom/suministros
- No hay SSO/SAML empresarial
- No hay notificaciones push/WebSocket en tiempo real
- No hay workflow engine complejo (se usa estado + reglas simples)
- No hay internacionalizacion (solo espanol)
- El modulo fiscal es solo coordinacion (checklist + plazos), no calculo
- No hay multi-idioma en plantillas

## INSTRUCCIONES DE EJECUCION LOCAL (Quickstart)

### Prerrequisitos
- Node.js 18+
- Docker + Docker Compose
- npm

### 1. Clonar y configurar

```bash
git clone <repo-url>
cd baritur-pro

# Copiar variables de entorno
cp .env.example .env
```

### 2. Levantar servicios (PostgreSQL, Redis, MinIO)

```bash
docker-compose up -d
```

### 3. Instalar dependencias

```bash
npm install --legacy-peer-deps
```

### 4. Configurar base de datos

```bash
# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev --name init

# Poblar datos de demo
npx tsx prisma/seed.ts
```

### 5. Configurar MinIO (bucket)

Accede a http://localhost:9001 (minioadmin / minioadmin123) y crea un bucket llamado `baritur-docs`.

O via CLI:
```bash
# Si tienes mc (MinIO Client)
mc alias set local http://localhost:9000 minioadmin minioadmin123
mc mb local/baritur-docs
```

### 6. Arrancar la aplicacion

```bash
npm run dev
```

Accede a http://localhost:3000

### 7. Credenciales de demo

- **Email**: admin@baritur.com
- **Password**: admin123
- **Org**: Gestoria Demo

## PANTALLAS PRINCIPALES

| Ruta | Descripcion |
|------|-------------|
| `/` | Landing page + formulario de demo |
| `/login` | Inicio de sesion |
| `/onboarding` | Registro de nueva organizacion |
| `/dashboard` | KPIs y actividad reciente |
| `/cases` | Lista de expedientes |
| `/cases/new` | Wizard para crear expediente |
| `/cases/[id]` | Detalle del expediente (tabs: Resumen, Tareas, Documentos, Plantillas, Actividad, Exportar) |
| `/billing` | Plan y facturacion |
| `/settings/users` | Gestion de usuarios y roles |
| `/portal/[token]` | Portal familia (sin auth, via token) |

## STRIPE (Modo Test)

1. Configura `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` en `.env`
2. Para webhooks locales, usa Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3000/api/billing/webhook
   ```
3. Usa tarjeta de test: `4242 4242 4242 4242`

## TESTS

```bash
npm test
```

Ejecuta 3 suites de tests:
- **RBAC**: Verifica permisos por rol (OWNER, MANAGER, OPERATOR, VIEWER, MANAGED_OPS)
- **Checklist**: Generacion de tareas por categoria
- **Validaciones**: Schemas de Zod para creacion de expedientes y demo requests

## SIGUIENTES PASOS

1. **Integraciones reales**: APIs de bancos, telecom, suministros
2. **BullMQ workers**: Procesamiento asincrono de emails, recordatorios, retries
3. **Notificaciones**: WebSocket/SSE para actualizaciones en tiempo real
4. **SSO/SAML**: Integracion con proveedores de identidad empresariales
5. **Multi-idioma**: i18n para internacionalizacion
6. **Workflow engine**: Motor de reglas mas sofisticado con dependencias entre tareas
7. **Mobile app**: App nativa para portal familia
8. **OCR/IA docs**: Extraccion automatica de datos de documentos subidos
9. **Compliance avanzado**: Cifrado at-rest, key rotation, data residency EU
10. **Testing E2E**: Playwright para tests end-to-end
