#!/usr/bin/env bash
# Prepara una base DESECHABLE, arranca la aplicacion y ejecuta los smoke tests
# de navegador. Uso: ./scripts/e2e.sh [-- args de playwright]
set -euo pipefail

export DATABASE_URL="${E2E_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/heredia_e2e}"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-e2e-secret-con-mas-de-32-caracteres-para-nextauth}"
export NEXTAUTH_URL="${E2E_BASE_URL:-http://127.0.0.1:3000}"
export APP_URL="$NEXTAUTH_URL"
export CRON_SECRET="${CRON_SECRET:-e2e-cron}"
export SECRETS_ENCRYPTION_KEY="${SECRETS_ENCRYPTION_KEY:-MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=}"
export NODE_ENV=production

# La aplicacion enviara correo DE VERDAD contra el SMTP de pruebas. Sin esto,
# `sendEmail` fallaba con ECONNREFUSED y las pruebas solo podian comprobar el
# camino del fallo; el flujo que ve el usuario —recibir el correo, pinchar el
# enlace— quedaba sin cubrir.
# Almacenamiento de objetos REAL (MinIO). Sin esto, `src/lib/s3.ts` se carga con
# las variables vacias y cualquier subida desde el navegador muere con un 500,
# de modo que la funcionalidad de documentos no se puede probar de verdad.
#
# NO hay simulador ni respaldo en memoria a proposito: si MinIO no esta, las
# pruebas de documentos deben FALLAR, no pasar contra un doble.
export S3_ENDPOINT="${S3_ENDPOINT:-http://127.0.0.1:9000}"
export S3_ACCESS_KEY="${S3_ACCESS_KEY:-minioadmin}"
export S3_SECRET_KEY="${S3_SECRET_KEY:-minioadmin123}"
export S3_BUCKET="${S3_BUCKET:-heredia-e2e}"
export S3_REGION="${S3_REGION:-us-east-1}"

export SMTP_HOST="${SMTP_HOST:-127.0.0.1}"
export SMTP_PORT="${SMTP_PORT:-1025}"
export SMTP_USER="${SMTP_USER:-pruebas}"
export SMTP_PASS="${SMTP_PASS:-pruebas}"
export SMTP_FROM="${SMTP_FROM:-heredia@ejemplo.test}"
export BANDEJA_URL="${BANDEJA_URL:-http://127.0.0.1:8025}"

# El navegador esta preinstalado en la imagen. Si la version del binario no
# coincide con la que espera @playwright/test, se usa el que existe en vez de
# descargar otro (la descarga esta deshabilitada a proposito).
if [ -z "${PLAYWRIGHT_CHROMIUM_PATH:-}" ]; then
  DETECTADO="$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1 || true)"
  if [ -n "$DETECTADO" ]; then
    export PLAYWRIGHT_CHROMIUM_PATH="$DETECTADO"
    echo "[e2e] Chromium: $PLAYWRIGHT_CHROMIUM_PATH"
  fi
fi

echo "[e2e] Base de datos: ${DATABASE_URL}"
echo "[e2e] Almacenamiento: ${S3_ENDPOINT} (bucket ${S3_BUCKET})"

# Se avisa MUY claro si no hay almacenamiento, pero no se sustituye por nada:
# las pruebas de documentos fallaran, que es exactamente lo que deben hacer.
if curl -sf "${S3_ENDPOINT}/minio/health/live" >/dev/null 2>&1; then
  node scripts/init-bucket.mjs
else
  echo "[e2e] AVISO: no hay almacenamiento de objetos en ${S3_ENDPOINT}." >&2
  echo "[e2e] Las pruebas de documentos FALLARAN. No se sustituye S3 por un doble." >&2
fi

# Cierra las conexiones abiertas antes de recrear el esquema. Sin esto, una
# ejecucion anterior deja sesiones vivas, el reset falla en parte y la suite
# arranca con estado residual (consentimientos ya aceptados, tokens revocados)
# que hace fallar pruebas por motivos equivocados.
if command -v psql >/dev/null 2>&1; then
  DB_NAME="$(basename "${DATABASE_URL%%\?*}")"
  ADMIN_URL="${DATABASE_URL%/*}/postgres"
  psql "$ADMIN_URL" -tAc \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid()" \
    >/dev/null 2>&1 || true
fi

npx prisma migrate reset --force --skip-seed --skip-generate
npx tsx e2e/seed-e2e.ts

echo "[e2e] Construyendo la aplicacion…"
npm run build

# Fallar rapido si el puerto ya esta ocupado: un servidor obsoleto sirviendo
# un build antiguo hace que la suite pase o falle por motivos equivocados.
if curl -sf "$NEXTAUTH_URL/api/health" >/dev/null 2>&1; then
  echo "[e2e] ERROR: ya hay algo escuchando en $NEXTAUTH_URL." >&2
  echo "[e2e] Deten ese proceso antes de ejecutar la suite." >&2
  exit 1
fi

# Mata un proceso y toda su descendencia.
#
# POR QUE HACE FALTA
# ------------------
# `npx next start` no es el servidor: lanza `next-server` como proceso aparte.
# El `trap` mataba solo al envoltorio, y el nieto quedaba huerfano ocupando el
# puerto 3000. La siguiente ejecucion moria en el guardia de puerto ("ya hay
# algo escuchando") despues de haber reconstruido la aplicacion entera, y habia
# que buscar y matar el proceso a mano.
matar_arbol() {
  local pid="${1:-}"
  [ -n "$pid" ] || return 0
  local hijo
  for hijo in $(pgrep -P "$pid" 2>/dev/null || true); do
    matar_arbol "$hijo"
  done
  kill "$pid" 2>/dev/null || true
}

limpiar() {
  matar_arbol "${SERVER_PID:-}"
  matar_arbol "${SMTP_PID:-}"
}

echo "[e2e] Arrancando el SMTP de pruebas…"
node e2e/smtp-de-pruebas.mjs --smtp "$SMTP_PORT" --http 8025 &
SMTP_PID=$!
trap limpiar EXIT

for i in $(seq 1 20); do
  if curl -sf "$BANDEJA_URL/salud" >/dev/null 2>&1; then
    echo "[e2e] Bandeja de pruebas lista."
    break
  fi
  sleep 0.5
done

if ! curl -sf "$BANDEJA_URL/salud" >/dev/null 2>&1; then
  echo "[e2e] ERROR: el SMTP de pruebas no ha arrancado." >&2
  exit 1
fi

echo "[e2e] Arrancando el servidor…"
npx next start -p 3000 -H 127.0.0.1 &
SERVER_PID=$!

for i in $(seq 1 60); do
  if curl -sf "$NEXTAUTH_URL/api/health" >/dev/null 2>&1; then
    echo "[e2e] Servidor listo."
    break
  fi
  sleep 1
done

npx playwright test "$@"
