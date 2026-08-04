-- Referencia de expediente unica por organizacion.
--
-- La referencia se generaba con `count + 1` fuera de transaccion, asi que dos
-- altas simultaneas podian producir la misma. Sin restriccion en base de datos
-- nada lo impedia.
--
-- Antes de crear el indice hay que resolver los duplicados que puedan existir
-- ya en produccion: a partir del segundo caso de cada (orgId, ref) se le anade
-- un sufijo -D2, -D3... conservando el mas antiguo con su referencia original.
-- No se borra ni se fusiona ningun expediente.

WITH duplicados AS (
  SELECT
    "id",
    "ref" || '-D' || ROW_NUMBER() OVER (
      PARTITION BY "orgId", "ref" ORDER BY "createdAt", "id"
    ) AS nueva_ref,
    ROW_NUMBER() OVER (PARTITION BY "orgId", "ref" ORDER BY "createdAt", "id") AS posicion
  FROM "Case"
)
UPDATE "Case" c
SET "ref" = d.nueva_ref
FROM duplicados d
WHERE c."id" = d."id"
  AND d.posicion > 1;

CREATE UNIQUE INDEX "Case_orgId_ref_key" ON "Case"("orgId", "ref");
