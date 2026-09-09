-- Contador numérico de referencias por organización y año.
--
-- Antes la siguiente referencia se deducía de `ORDER BY ref DESC`, es decir de
-- una comparación de CADENAS. Con menos de 10.000 expedientes al año el relleno
-- a cuatro dígitos hacía que el orden lexicográfico coincidiera con el
-- numérico, así que funcionaba por accidente. Superada esa cifra,
-- `EXP-2026-10000` es lexicográficamente MENOR que `EXP-2026-9999`: el máximo
-- leído sería 9999 y el alta fallaría en bucle con P2002.
--
-- Migración aditiva. El contador se siembra a partir del máximo REAL existente,
-- calculado numéricamente, para que ninguna organización reutilice referencias.

CREATE TABLE IF NOT EXISTS "CaseCounter" (
  "orgId"      TEXT NOT NULL,
  "year"       INTEGER NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CaseCounter_pkey" PRIMARY KEY ("orgId", "year")
);

ALTER TABLE "CaseCounter"
  ADD CONSTRAINT "CaseCounter_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Siembra: máximo numérico por (organización, año) a partir de las referencias
-- con el formato EXP-<año>-<número>.
INSERT INTO "CaseCounter" ("orgId", "year", "lastNumber")
SELECT
  "orgId",
  CAST(SUBSTRING("ref" FROM 5 FOR 4) AS INTEGER)  AS "year",
  MAX(CAST(SUBSTRING("ref" FROM 10) AS INTEGER))  AS "lastNumber"
FROM "Case"
WHERE "ref" ~ '^EXP-[0-9]{4}-[0-9]+$'
GROUP BY "orgId", CAST(SUBSTRING("ref" FROM 5 FOR 4) AS INTEGER)
ON CONFLICT ("orgId", "year") DO NOTHING;
