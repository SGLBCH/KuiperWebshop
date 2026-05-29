-- Pricing calculation settings for the Kuiper webshop configurator.
-- Run this once in Supabase SQL editor for existing projects.

ALTER TABLE public.fineers
  ADD COLUMN IF NOT EXISTS calculatie_factor NUMERIC(6,3) NOT NULL DEFAULT 1.600,
  ADD COLUMN IF NOT EXISTS plak_overhead_per_m2 NUMERIC(10,2) NOT NULL DEFAULT 10.50;

ALTER TABLE public.staffelregels
  ADD COLUMN IF NOT EXISTS marge_coefficient NUMERIC(6,4) NOT NULL DEFAULT 0.6500,
  ADD COLUMN IF NOT EXISTS multiplier NUMERIC(6,4) NOT NULL DEFAULT 1.0000;

INSERT INTO public.instellingen (sleutel, waarde) VALUES
  ('fineerlijm_per_m2', '0.46'),
  ('schuurbanden_per_m2', '0.14'),
  ('hpl_lijm_per_m2', '0.50'),
  ('pu_hotmelt_per_m2', '1.60'),
  ('basisplaat_markup_fineer_hpl', '1.08'),
  ('basisplaat_markup_kaal', '1.18'),
  ('hpl_calculatie_factor', '1.15'),
  ('hpl_overhead_per_m2', '7.50'),
  ('fineer_overhead_min_per_m2', '6'),
  ('fineer_overhead_max_per_m2', '16'),
  ('toeslag_mixmatch_per_m2', '1.50'),
  ('toeslag_gedraaid_geschoven_per_m2', '0.75'),
  ('toeslag_foto_fineerkeuze_per_m2', '0.50'),
  ('toeslag_persoonlijk_fineerkeuze_per_m2', '1.50')
ON CONFLICT (sleutel) DO UPDATE SET waarde = EXCLUDED.waarde;

DELETE FROM public.staffelregels WHERE type IN ('fineer_hpl', 'kaal');

INSERT INTO public.staffelregels (type, van_aantal, tot_aantal, marge_coefficient, multiplier) VALUES
  ('fineer_hpl', 1,  9,    0.6500, 1.0000),
  ('fineer_hpl', 10, 24,   0.7000, 0.9286),
  ('fineer_hpl', 25, 49,   0.7500, 0.8667),
  ('fineer_hpl', 50, NULL, 0.8000, 0.8125),
  ('kaal',       1,  9,    0.8000, 1.0000),
  ('kaal',       10, 24,   0.8200, 0.9756),
  ('kaal',       25, 49,   0.8400, 0.9524),
  ('kaal',       50, NULL, 0.8600, 0.9302);
