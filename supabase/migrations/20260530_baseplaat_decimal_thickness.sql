-- The full baseplate catalog includes fractional thicknesses such as 1.5 mm.
-- Existing demo schemas used INTEGER, which blocks the catalog backfill.

ALTER TABLE public.baseplaten
  ALTER COLUMN dikte_mm TYPE NUMERIC(6,2)
  USING dikte_mm::NUMERIC;
