-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY LOCKDOWN — inkoopprijzen en marges afschermen voor klanten
-- Voer dit éénmalig uit in de Supabase SQL editor.
--
-- Wat dit doet:
--  1. is_admin() helper (security definer — voorkomt ook RLS-recursie)
--  2. Klanten verliezen leestoegang tot tabellen met inkoopprijzen/marges:
--     baseplaten, fineers, hpl, staffelregels, instellingen (en hotmelt)
--  3. Nieuwe catalogus-VIEWS zonder gevoelige kolommen voor klanten
--  4. RLS op uitsluitingen/insluitingen
--  5. Admin behoudt volledige toegang via RLS-policies op de basistabellen
--
-- De app is hier al op voorbereid: klanten lezen de views, prijzen worden
-- server-side berekend via /api/prijs (service role).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Admin-helper (security definer voorkomt profiles-recursie) ──────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol = 'admin'
  )
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ─── 2. Recursieve profiles-policy vervangen ────────────────────────────────
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can view all orderlijsten" ON public.orderlijsten;
CREATE POLICY "Admin can view all orderlijsten"
  ON public.orderlijsten FOR SELECT
  USING (public.is_admin());

-- Admin moet aanvragen, regels en orders van alle klanten kunnen inzien
DROP POLICY IF EXISTS "Admin can manage all aanvragen" ON public.aanvragen;
CREATE POLICY "Admin can manage all aanvragen"
  ON public.aanvragen FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can view all regels" ON public.orderlijst_regels;
CREATE POLICY "Admin can view all regels"
  ON public.orderlijst_regels FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can manage all orders" ON public.orders;
CREATE POLICY "Admin can manage all orders"
  ON public.orders FOR ALL
  USING (public.is_admin());

-- ─── 3. Leestoegang klanten intrekken op gevoelige tabellen ─────────────────
-- (bewerkingen blijft leesbaar: die prijzen zijn klantgerichte verkoopprijzen)
DROP POLICY IF EXISTS "Authenticated users can read catalog"      ON public.baseplaten;
DROP POLICY IF EXISTS "Authenticated users can read fineers"      ON public.fineers;
DROP POLICY IF EXISTS "Authenticated users can read hpl"          ON public.hpl;
DROP POLICY IF EXISTS "Authenticated users can read staffel"      ON public.staffelregels;
DROP POLICY IF EXISTS "Authenticated users can read instellingen" ON public.instellingen;

-- Admin-policies opnieuw opzetten via is_admin()
DROP POLICY IF EXISTS "Admin can manage catalog baseplaten" ON public.baseplaten;
CREATE POLICY "Admin can manage catalog baseplaten"
  ON public.baseplaten FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can manage catalog fineers" ON public.fineers;
CREATE POLICY "Admin can manage catalog fineers"
  ON public.fineers FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can manage catalog hpl" ON public.hpl;
CREATE POLICY "Admin can manage catalog hpl"
  ON public.hpl FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can manage staffel" ON public.staffelregels;
CREATE POLICY "Admin can manage staffel"
  ON public.staffelregels FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can manage instellingen" ON public.instellingen;
CREATE POLICY "Admin can manage instellingen"
  ON public.instellingen FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can manage bewerkingen" ON public.bewerkingen;
CREATE POLICY "Admin can manage bewerkingen"
  ON public.bewerkingen FOR ALL USING (public.is_admin());

-- Hotmelt-combinaties (productie-configuratie): alleen admin, indien aanwezig
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'hotmelt_combinaties') THEN
    EXECUTE 'ALTER TABLE public.hotmelt_combinaties ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can read hotmelt" ON public.hotmelt_combinaties';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage hotmelt" ON public.hotmelt_combinaties';
    EXECUTE 'CREATE POLICY "Admin can manage hotmelt" ON public.hotmelt_combinaties FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- ─── 4. Catalogus-views voor klanten (ZONDER inkoopprijzen/factoren) ────────
-- Views draaien standaard met rechten van de eigenaar (postgres) en lezen
-- dus langs RLS heen — daarom bevatten ze uitsluitend veilige kolommen.
CREATE OR REPLACE VIEW public.catalogus_baseplaten AS
  SELECT id, naam, dikte_mm, breedte_mm, lengte_mm, beschikbaar,
         gallery_foto_url, volgorde
  FROM public.baseplaten;

CREATE OR REPLACE VIEW public.catalogus_fineers AS
  SELECT id, naam, voegmethodes, voeg_standaard, fk_advies, info,
         status_lang, status_kort, gallery_foto_url, volgorde
  FROM public.fineers;

CREATE OR REPLACE VIEW public.catalogus_hpl AS
  SELECT id, kleur, hpl_afm_lang_b, hpl_afm_lang_l, hpl_afm_kort_b,
         hpl_afm_kort_l, info, status_lang, status_kort,
         gallery_foto_url, volgorde
  FROM public.hpl;

-- Alleen niet-gevoelige instellingen (géén staffels, marges of kostprijzen)
CREATE OR REPLACE VIEW public.instellingen_publiek AS
  SELECT sleutel, waarde
  FROM public.instellingen
  WHERE sleutel IN ('verzend_drempel', 'verzend_kosten', 'btw_percentage',
                    'bedrijf_naam', 'bedrijf_email');

REVOKE ALL ON public.catalogus_baseplaten, public.catalogus_fineers,
              public.catalogus_hpl, public.instellingen_publiek
  FROM PUBLIC, anon;
GRANT SELECT ON public.catalogus_baseplaten, public.catalogus_fineers,
                public.catalogus_hpl, public.instellingen_publiek
  TO authenticated;

-- ─── 5. RLS op uitsluitingen & insluitingen ─────────────────────────────────
ALTER TABLE public.uitsluitingen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insluitingen  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read uitsluitingen" ON public.uitsluitingen;
CREATE POLICY "Authenticated users can read uitsluitingen"
  ON public.uitsluitingen FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin can manage uitsluitingen" ON public.uitsluitingen;
CREATE POLICY "Admin can manage uitsluitingen"
  ON public.uitsluitingen FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can read insluitingen" ON public.insluitingen;
CREATE POLICY "Authenticated users can read insluitingen"
  ON public.insluitingen FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin can manage insluitingen" ON public.insluitingen;
CREATE POLICY "Admin can manage insluitingen"
  ON public.insluitingen FOR ALL USING (public.is_admin());
