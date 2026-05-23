-- Cambio de residencia del causante: alimenta la detección del art. 28
-- Ley 22/2009 (punto de conexión por residencia 5 años) en el Radar ISD.

ALTER TABLE "Case" ADD COLUMN "recentResidenceChange" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Case" ADD COLUMN "previousResidenceProvince" TEXT;
