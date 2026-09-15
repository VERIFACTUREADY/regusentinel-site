-- Prerrequisito que faltaba en el historial historico.
--
-- PROBLEMA
-- --------
-- `20260524110000_add_outbound_integrations` ejecuta:
--     ALTER TYPE "NotificationChannel" ADD VALUE 'SLACK';
-- pero NINGUNA migracion del historial crea ese tipo. La cadena, por tanto,
-- nunca fue aplicable sobre una base vacia: fallaba con
-- `type "NotificationChannel" does not exist`.
--
-- En las bases donde funciono, el tipo existia porque en algun momento se
-- habia ejecutado `prisma db push`, que crea el esquema sin registrar
-- historial. Ese desfase fue justo lo que llevo a meter
-- `db push --accept-data-loss` en el deploy.
--
-- SOLUCION
-- --------
-- Se anade esta migracion NUEVA con una marca de tiempo anterior a la que
-- falla, en vez de reescribir una migracion que puede estar ya aplicada en
-- produccion. Es IDEMPOTENTE: en una base que ya tenga el tipo no hace nada,
-- asi que es segura tanto en instalaciones nuevas como en las existentes.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationChannel') THEN
    CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL_INTERNAL', 'EMAIL_FAMILY');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationKind') THEN
    CREATE TYPE "NotificationKind" AS ENUM (
      'ISD_60D', 'ISD_30D', 'ISD_7D', 'ISD_1D', 'ISD_PASSED', 'FAMILY_PENDING_DOCS'
    );
  END IF;
END
$$;
