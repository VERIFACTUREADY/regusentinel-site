#!/usr/bin/env bash
#
# Comprueba el CAMINO DE ACTUALIZACION: una base que ya tenia aplicadas las
# migraciones antiguas debe poder llegar al esquema final sin perder datos y
# sin drift.
#
# POR QUE EXISTE
# --------------
# En esta rama el historial de migraciones habia sido REEMPLAZADO por un
# baseline nuevo. Sobre una base vacia todo parecia correcto —y la CI solo
# probaba ese caso—, pero sobre una base existente `migrate deploy` fallaba con
# P3005, y el deploy "resolvia" ese fallo ejecutando
# `prisma db push --accept-data-loss`, que destruye columnas sin revision.
#
# Probar solo la instalacion desde cero no detecta nada de eso. Este script
# reproduce el caso real:
#
#   1. Crea una base y le aplica SOLO las migraciones que existian en la rama
#      base (el historial "antiguo").
#   2. Siembra datos: si una migracion posterior fuese destructiva, se pierden.
#   3. Aplica el resto de migraciones con `migrate deploy`.
#   4. Comprueba que los datos siguen ahi y que no queda drift respecto al
#      esquema.
#
# Uso:  DATABASE_URL=... ./scripts/verify-upgrade-path.sh
set -euo pipefail

: "${DATABASE_URL:?Hace falta DATABASE_URL}"

# Migraciones que ya existian en la rama base `claude/setup-baritur-pro-oOo9E`
# (commit 23cfc08). Una base de produccion las tiene aplicadas.
readonly HISTORIAL_ANTIGUO=(
  20260406193236_init
  20260524000000_add_case_fiscal_fields
  20260524100000_add_residence_change
  20260524105000_notification_channel_prerequisites
  20260524110000_add_outbound_integrations
  20260524120000_add_teams_webhook
  20260524130000_add_applied_reductions
  20260524140000_add_referencia_catastral
  20260529000000_add_stripe_event_idempotency
)

BASE_ADMIN="${DATABASE_URL%/*}/postgres"
BASE_ANTIGUA="${DATABASE_URL%/*}/heredia_upgrade_check"

echo "[upgrade] Base de prueba: heredia_upgrade_check"

psql "$BASE_ADMIN" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS heredia_upgrade_check" >/dev/null
psql "$BASE_ADMIN" -v ON_ERROR_STOP=1 -c "CREATE DATABASE heredia_upgrade_check" >/dev/null

# ── 1. Estado ANTIGUO: solo las migraciones que existian en la rama base ─────
echo "[upgrade] Aplicando el historial antiguo (${#HISTORIAL_ANTIGUO[@]} migraciones)…"
for m in "${HISTORIAL_ANTIGUO[@]}"; do
  psql "$BASE_ANTIGUA" -v ON_ERROR_STOP=1 -q -f "prisma/migrations/${m}/migration.sql"
done

# Se registran como aplicadas, igual que estarian en una base real.
for m in "${HISTORIAL_ANTIGUO[@]}"; do
  DATABASE_URL="$BASE_ANTIGUA" npx prisma migrate resolve --applied "$m" >/dev/null
done

# ── 2. Datos que NO se pueden perder ────────────────────────────────────────
echo "[upgrade] Sembrando datos de control…"
psql "$BASE_ANTIGUA" -v ON_ERROR_STOP=1 -q <<'SQL'
INSERT INTO "Organization" ("id","name","slug","createdAt","updatedAt")
VALUES ('org-upgrade','Despacho Historico','despacho-historico', NOW(), NOW());

INSERT INTO "User" ("id","email","name","createdAt","updatedAt")
VALUES ('user-upgrade','titular@historico.test','Titular Historico', NOW(), NOW());

INSERT INTO "Membership" ("id","userId","orgId","role","createdAt")
VALUES ('mem-upgrade','user-upgrade','org-upgrade','OWNER', NOW());

INSERT INTO "Case" ("id","orgId","ref","status","createdAt","updatedAt","portalToken")
VALUES ('case-upgrade','org-upgrade','EXP-2026-0001','INTAKE', NOW(), NOW(), 'token-upgrade');

INSERT INTO "Deceased" ("id","caseId","fullName")
VALUES ('dec-upgrade','case-upgrade','Persona Historica');
SQL

CONTEO_ANTES="$(psql "$BASE_ANTIGUA" -tAc 'SELECT COUNT(*) FROM "Case"')"
echo "[upgrade] Expedientes antes de actualizar: $CONTEO_ANTES"

# ── 3. Actualizacion incremental ────────────────────────────────────────────
echo "[upgrade] Aplicando las migraciones pendientes con migrate deploy…"
DATABASE_URL="$BASE_ANTIGUA" npx prisma migrate deploy

# ── 4. Comprobaciones ───────────────────────────────────────────────────────
CONTEO_DESPUES="$(psql "$BASE_ANTIGUA" -tAc 'SELECT COUNT(*) FROM "Case"')"
NOMBRE="$(psql "$BASE_ANTIGUA" -tAc $'SELECT "fullName" FROM "Deceased" WHERE id = \'dec-upgrade\'')"

if [ "$CONTEO_ANTES" != "$CONTEO_DESPUES" ]; then
  echo "::error::La actualizacion ha PERDIDO datos: $CONTEO_ANTES expedientes antes, $CONTEO_DESPUES despues."
  exit 1
fi

if [ "$NOMBRE" != "Persona Historica" ]; then
  echo "::error::La actualizacion ha alterado datos existentes (Deceased.fullName = '$NOMBRE')."
  exit 1
fi

echo "[upgrade] Datos intactos: $CONTEO_DESPUES expediente(s), nombre conservado."

# Sin drift: el esquema resultante debe coincidir con schema.prisma.
echo "[upgrade] Comprobando que no queda drift…"
if npx prisma migrate diff \
     --from-url "$BASE_ANTIGUA" \
     --to-schema-datamodel prisma/schema.prisma \
     --exit-code >/dev/null; then
  echo "[upgrade] Sin drift: la base actualizada coincide con el esquema."
else
  echo "::error::Tras actualizar queda drift respecto a schema.prisma."
  npx prisma migrate diff --from-url "$BASE_ANTIGUA" --to-schema-datamodel prisma/schema.prisma
  exit 1
fi

psql "$BASE_ADMIN" -q -c "DROP DATABASE IF EXISTS heredia_upgrade_check" >/dev/null
echo "[upgrade] Camino de actualizacion verificado."
