-- ═══════════════════════════════════════════════════════════════════════════
-- UX v1.1 — voer dit éénmalig uit in de Supabase SQL editor
--
-- 1. Bewerkingen: keuzeparen (Gezaagd/Ongezaagd, Geschuurd/Ongeschuurd)
-- 2. Fineers: snijwijze Quartier/Dosse + admin-advies
-- 3. Orderlijst-regels: gekozen snijwijze opslaan
-- 4. Offertes-tabel voor de admin offerte-module
-- 5. Queenply en Banova Balsa verbergen voor klanten
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Bewerkingen: keuzeparen ──────────────────────────────────────────────
ALTER TABLE public.bewerkingen
  ADD COLUMN IF NOT EXISTS keuzegroep TEXT;

-- Bestaande zaag/schuur-bewerkingen aan een groep koppelen
UPDATE public.bewerkingen SET keuzegroep = 'zagen'   WHERE naam ILIKE 'Zaagwerk%'   AND keuzegroep IS NULL;
UPDATE public.bewerkingen SET keuzegroep = 'schuren' WHERE naam ILIKE 'Schuurwerk%' AND keuzegroep IS NULL;

-- Gratis tegenhangers toevoegen (één per groep verplicht te kiezen)
INSERT INTO public.bewerkingen (naam, beschrijving, prijs, prijs_type, compatibiliteit, beschikbaar, standaard_geselecteerd, volgorde, keuzegroep)
SELECT 'Ongezaagd', 'Plaat wordt niet op maat gezaagd (volledige plaatafmeting).', 0, 'per_m2', ARRAY['kaal','fineer','hpl'], TRUE, FALSE, 90, 'zagen'
WHERE NOT EXISTS (SELECT 1 FROM public.bewerkingen WHERE naam = 'Ongezaagd');

INSERT INTO public.bewerkingen (naam, beschrijving, prijs, prijs_type, compatibiliteit, beschikbaar, standaard_geselecteerd, volgorde, keuzegroep)
SELECT 'Ongeschuurd', 'Oppervlak wordt niet geschuurd.', 0, 'per_m2', ARRAY['kaal','fineer'], TRUE, FALSE, 91, 'schuren'
WHERE NOT EXISTS (SELECT 1 FROM public.bewerkingen WHERE naam = 'Ongeschuurd');

-- ─── 2. Fineers: snijwijze (Quartier / Dosse) ────────────────────────────────
ALTER TABLE public.fineers
  ADD COLUMN IF NOT EXISTS snijwijzes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS snijwijze_advies TEXT[] NOT NULL DEFAULT '{}';

-- Catalogus-view bijwerken zodat klanten de snijwijze-opties zien
-- (view bevat nog steeds géén prijzen of calculatiefactoren).
-- DROP + CREATE omdat Postgres geen kolommen mag tussenvoegen via
-- CREATE OR REPLACE VIEW.
DROP VIEW IF EXISTS public.catalogus_fineers;
CREATE VIEW public.catalogus_fineers AS
  SELECT id, naam, voegmethodes, voeg_standaard, snijwijzes, snijwijze_advies,
         fk_advies, info, status_lang, status_kort, gallery_foto_url, volgorde
  FROM public.fineers;

-- Rechten opnieuw zetten (gaan verloren bij DROP)
REVOKE ALL ON public.catalogus_fineers FROM PUBLIC, anon;
GRANT SELECT ON public.catalogus_fineers TO authenticated;

-- ─── 3. Orderlijst-regels: gekozen snijwijze ─────────────────────────────────
ALTER TABLE public.orderlijst_regels
  ADD COLUMN IF NOT EXISTS snijwijze TEXT;

-- ─── 4. Offertes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.offertes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aanvraag_id   UUID REFERENCES public.aanvragen(id) ON DELETE SET NULL,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token         UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  offertenummer TEXT,
  status        TEXT NOT NULL DEFAULT 'concept'
                CHECK (status IN ('concept', 'verstuurd', 'geaccepteerd', 'afgewacht', 'verlopen')),
  regels        JSONB NOT NULL DEFAULT '[]',
  opmerking     TEXT,
  vervaldatum   DATE,
  verstuurd_op  TIMESTAMPTZ,
  reactie_op    TIMESTAMPTZ,
  aangemaakt_op TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offertes_user   ON public.offertes(user_id);
CREATE INDEX IF NOT EXISTS idx_offertes_status ON public.offertes(status);

ALTER TABLE public.offertes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage offertes" ON public.offertes;
CREATE POLICY "Admin can manage offertes"
  ON public.offertes FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own offertes" ON public.offertes;
CREATE POLICY "Users can view own offertes"
  ON public.offertes FOR SELECT USING (auth.uid() = user_id);

-- ─── 5. Producten verbergen voor klanten ─────────────────────────────────────
UPDATE public.baseplaten SET beschikbaar = FALSE WHERE naam ILIKE '%Queenply%';
UPDATE public.baseplaten SET beschikbaar = FALSE WHERE naam ILIKE '%Banova%';
