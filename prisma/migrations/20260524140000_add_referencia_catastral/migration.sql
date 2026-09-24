-- Referencia catastral del inmueble principal del caudal. Sólo se
-- almacena el identificador (20 chars); las consultas al Catastro
-- son deep links del cliente.

ALTER TABLE "Case" ADD COLUMN "referenciaCatastral" TEXT;
