-- Añade campos fiscales adicionales al expediente para alimentar Radar ISD
-- con plusvalía municipal (IIVTNU) y tramos del coeficiente multiplicador.

ALTER TABLE "Case" ADD COLUMN "hasUrbanProperty" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Case" ADD COLUMN "propertyAcquisitionValue" DOUBLE PRECISION;
ALTER TABLE "Case" ADD COLUMN "propertyTransmissionValue" DOUBLE PRECISION;
ALTER TABLE "Case" ADD COLUMN "preexistingPatrimony" DOUBLE PRECISION;
