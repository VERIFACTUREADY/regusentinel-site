-- Tracking de mantenimiento de reducciones del art. 20 Ley 29/1987.
-- Estructura JSON con cada reducción aplicada y su fecha de inicio.

ALTER TABLE "Case" ADD COLUMN "appliedReductions" JSONB;
