#!/usr/bin/env bash
#
# Compila la aplicacion SIN DATABASE_URL y falla si el build toca la base de
# datos.
#
# POR QUE HACE FALTA COMPROBARLO
# -------------------------------
# `npm run build` a secas no sirve como comprobacion. Si un manejador de ruta
# consulta la base durante «Generating static pages» y captura el error, Prisma
# imprime el fallo por stderr, Next continua y el build termina con codigo 0.
# El problema queda escrito en el log y nadie lo mira.
#
# En Vercel eso no es inocuo: alli DATABASE_URL SI esta definida durante el
# build, asi que la consulta se intenta de verdad contra la base de produccion
# desde la maquina que compila. Si esa base solo admite conexiones desde la red
# de ejecucion —lista de IP permitidas, red privada, limite de conexiones del
# pooler—, el build espera hasta agotar su tiempo y el despliegue falla.
#
# Un despliegue no puede depender de que la base de datos sea alcanzable desde
# la red de compilacion. Este script convierte esa regla en un fallo de CI.
set -uo pipefail

REGISTRO="$(mktemp)"
trap 'rm -f "$REGISTRO"' EXIT

env -u DATABASE_URL npm run build 2>&1 | tee "$REGISTRO"
SALIDA=${PIPESTATUS[0]}

if [ "$SALIDA" -ne 0 ]; then
  echo "::error::El build ha fallado (codigo $SALIDA)."
  exit "$SALIDA"
fi

# Prisma imprime exactamente esto cuando alguien consulta sin DATABASE_URL.
# Que aparezca significa que el build ha ejecutado codigo que va a la base.
if grep -q "Environment variable not found: DATABASE_URL" "$REGISTRO"; then
  echo
  echo "::error::El build ha intentado consultar la base de datos."
  echo
  echo "Alguna pagina o manejador de ruta se esta generando estaticamente y"
  echo "consulta la base durante 'next build'. En Vercel esa consulta se"
  echo "intenta de verdad y puede colgar el despliegue."
  echo
  echo "Localiza la ruta en el registro de arriba y marcala como dinamica:"
  echo
  echo "  export const dynamic = \"force-dynamic\";"
  echo "  export const revalidate = 0;"
  echo
  exit 1
fi

echo
echo "Build correcto y sin acceso a la base de datos."
