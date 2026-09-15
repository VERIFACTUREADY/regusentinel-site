#!/usr/bin/env bash
# Prepara una base de datos DESECHABLE para las pruebas de integracion y
# ejecuta el comando que se le pase (por defecto, la suite de integracion).
#
#   ./scripts/test-db.sh                 # prepara y corre las pruebas
#   ./scripts/test-db.sh npm run build   # prepara y corre otra cosa
#
# Usa TEST_DATABASE_URL si esta definida; si no, una base local por defecto.
set -euo pipefail

export DATABASE_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/heredia_test}"

echo "[test-db] Base de pruebas: ${DATABASE_URL%%\?*}"

# Recrea el esquema desde las migraciones: asi tambien se comprueba que las
# migraciones aplican limpias sobre una base vacia.
npx prisma migrate reset --force --skip-seed --skip-generate

if [ "$#" -eq 0 ]; then
  npx vitest run --config vitest.integration.config.ts
else
  "$@"
fi
