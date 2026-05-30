-- Keep existing order lines valid if a referenced baseplate id is corrected.
-- Deletes remain restricted so historical order lines cannot lose their baseplate.

ALTER TABLE public.orderlijst_regels
  DROP CONSTRAINT IF EXISTS orderlijst_regels_basisplaat_id_fkey;

ALTER TABLE public.orderlijst_regels
  ADD CONSTRAINT orderlijst_regels_basisplaat_id_fkey
  FOREIGN KEY (basisplaat_id)
  REFERENCES public.baseplaten(id)
  ON UPDATE CASCADE;
