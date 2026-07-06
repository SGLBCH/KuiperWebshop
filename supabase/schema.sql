-- ─── Kuiper Holland B2B Webshop — Database Schema ──────────────────────────
-- Run this against your Supabase project SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users / Profiles ────────────────────────────────────────────────────────
-- Supabase auth.users is the base; this table extends it with business data
CREATE TABLE IF NOT EXISTS public.profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                  TEXT NOT NULL,
  naam                   TEXT NOT NULL,
  bedrijf                TEXT NOT NULL DEFAULT '',
  telefoon               TEXT,
  branche                TEXT,
  adres                  TEXT,
  kvk                    TEXT,
  rol                    TEXT NOT NULL DEFAULT 'kijker'
                         CHECK (rol IN ('kijker', 'calculator', 'inkoper', 'admin')),
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'goedgekeurd', 'afgewezen', 'gedeactiveerd')),
  order_confirm_email    TEXT,
  order_confirm_email_cc TEXT,
  aangemaakt_op          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_status ON public.profiles(status);
CREATE INDEX idx_profiles_rol    ON public.profiles(rol);

-- ─── Baseplaten ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.baseplaten (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  naam         TEXT NOT NULL,
  dikte_mm     NUMERIC(6,2) NOT NULL,
  breedte_mm   INTEGER NOT NULL,
  lengte_mm    INTEGER NOT NULL,
  prijs_per_m2 NUMERIC(10,2) NOT NULL,
  beschikbaar  BOOLEAN NOT NULL DEFAULT TRUE,
  gallery_foto_url TEXT,
  volgorde     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_baseplaten_beschikbaar ON public.baseplaten(beschikbaar);

-- ─── Fineers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fineers (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  naam                   TEXT NOT NULL,
  prijs_voorzijde_lang   NUMERIC(10,2) NOT NULL DEFAULT 0,
  prijs_voorzijde_kort   NUMERIC(10,2) NOT NULL DEFAULT 0,
  prijs_tegenzijde_lang  NUMERIC(10,2) NOT NULL DEFAULT 0,
  prijs_tegenzijde_kort  NUMERIC(10,2) NOT NULL DEFAULT 0,
  calculatie_factor      NUMERIC(6,3) NOT NULL DEFAULT 1.600,
  plak_overhead_per_m2   NUMERIC(10,2) NOT NULL DEFAULT 10.50,
  voegmethodes           TEXT[] NOT NULL DEFAULT '{}',
  voeg_standaard         TEXT NOT NULL DEFAULT 'gestolpt',
  fk_advies              TEXT NOT NULL DEFAULT 'fabriek'
                         CHECK (fk_advies IN ('fabriek', 'foto_kuiper', 'foto_klant', 'persoonlijk')),
  info                   TEXT,
  status_lang            TEXT NOT NULL DEFAULT 'beschikbaar'
                         CHECK (status_lang IN ('beschikbaar', 'tijdelijk_niet', 'niet_beschikbaar')),
  status_kort            TEXT NOT NULL DEFAULT 'beschikbaar'
                         CHECK (status_kort IN ('beschikbaar', 'tijdelijk_niet', 'niet_beschikbaar')),
  gallery_foto_url       TEXT,
  volgorde               INTEGER NOT NULL DEFAULT 0
);

-- ─── HPL ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hpl (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kleur            TEXT NOT NULL,
  prijs_lang       NUMERIC(10,2) NOT NULL DEFAULT 0,
  prijs_kort       NUMERIC(10,2) NOT NULL DEFAULT 0,
  hpl_afm_lang_b   INTEGER NOT NULL DEFAULT 1310,
  hpl_afm_lang_l   INTEGER NOT NULL DEFAULT 2800,
  hpl_afm_kort_b   INTEGER NOT NULL DEFAULT 1310,
  hpl_afm_kort_l   INTEGER NOT NULL DEFAULT 1300,
  info             TEXT,
  status_lang      TEXT NOT NULL DEFAULT 'beschikbaar'
                   CHECK (status_lang IN ('beschikbaar', 'tijdelijk_niet', 'niet_beschikbaar')),
  status_kort      TEXT NOT NULL DEFAULT 'beschikbaar'
                   CHECK (status_kort IN ('beschikbaar', 'tijdelijk_niet', 'niet_beschikbaar')),
  gallery_foto_url TEXT,
  volgorde         INTEGER NOT NULL DEFAULT 0
);

-- ─── Bewerkingen ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bewerkingen (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  naam             TEXT NOT NULL,
  beschrijving     TEXT NOT NULL DEFAULT '',
  prijs            NUMERIC(10,2) NOT NULL DEFAULT 0,
  prijs_type       TEXT NOT NULL DEFAULT 'per_m2' CHECK (prijs_type IN ('per_m2', 'per_order')),
  compatibiliteit  TEXT[] NOT NULL DEFAULT '{kaal,fineer,hpl}',
  beschikbaar      BOOLEAN NOT NULL DEFAULT TRUE,
  volgorde         INTEGER NOT NULL DEFAULT 0
);

-- ─── Staffelregels ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staffelregels (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        TEXT NOT NULL DEFAULT 'fineer_hpl'
              CHECK (type IN ('fineer_hpl', 'kaal')),
  van_aantal  INTEGER NOT NULL,
  tot_aantal  INTEGER,               -- NULL = onbeperkt
  marge_coefficient NUMERIC(6,4) NOT NULL DEFAULT 0.6500,
  multiplier  NUMERIC(6,4) NOT NULL DEFAULT 1.0
);

CREATE INDEX idx_staffelregels_type ON public.staffelregels(type);

-- ─── Instellingen ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.instellingen (
  sleutel   TEXT PRIMARY KEY,
  waarde    TEXT NOT NULL
);

-- ─── Orderlijsten ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orderlijsten (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  naam                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'actueel'
                      CHECK (status IN ('actueel', 'concept', 'verstuurd', 'gearchiveerd')),
  aangemaakt_op       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bijgewerkt_op       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fineerkeuze         TEXT,
  fineerkeuze_datum   DATE,
  fineer_afstemming   TEXT
);

CREATE INDEX idx_orderlijsten_user_id ON public.orderlijsten(user_id);
CREATE INDEX idx_orderlijsten_status  ON public.orderlijsten(status);

-- ─── Orderlijst Regels ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orderlijst_regels (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orderlijst_id    UUID NOT NULL REFERENCES public.orderlijsten(id) ON DELETE CASCADE,
  basisplaat_id    UUID NOT NULL REFERENCES public.baseplaten(id) ON UPDATE CASCADE,
  categorie        TEXT NOT NULL CHECK (categorie IN ('kaal', 'fineer', 'hpl')),
  fineer_voor      UUID REFERENCES public.fineers(id),
  fineer_tegen     UUID REFERENCES public.fineers(id),
  hpl_voor         UUID REFERENCES public.hpl(id),
  hpl_tegen        UUID REFERENCES public.hpl(id),
  voegmethode      TEXT,
  bewerkingen      UUID[] NOT NULL DEFAULT '{}',
  ruimte_indeling  TEXT NOT NULL DEFAULT 'geen'
                   CHECK (ruimte_indeling IN ('geen', 'per_ruimte')),
  ruimtes          JSONB DEFAULT '[]',
  aantal           INTEGER NOT NULL DEFAULT 1,
  prijs_per_stuk   NUMERIC(10,2) NOT NULL DEFAULT 0,
  totaal_prijs     NUMERIC(10,2) NOT NULL DEFAULT 0,
  aangemaakt_op    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_regels_orderlijst_id ON public.orderlijst_regels(orderlijst_id);

-- ─── Aanvragen ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.aanvragen (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id),
  orderlijst_ids    UUID[] NOT NULL DEFAULT '{}',
  type              TEXT NOT NULL DEFAULT 'offerte'
                    CHECK (type IN ('offerte', 'order')),
  bericht           TEXT,
  fineerkeuze_tekst TEXT,
  totaal_waarde     NUMERIC(10,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'nieuw'
                    CHECK (status IN ('nieuw', 'in_behandeling', 'afgerond', 'geannuleerd')),
  verstuurd_op      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aanvragen_user_id ON public.aanvragen(user_id);
CREATE INDEX idx_aanvragen_status  ON public.aanvragen(status);

-- ─── Orders ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES public.profiles(id),
  ordernummer        TEXT NOT NULL UNIQUE,
  aanvraag_id        UUID REFERENCES public.aanvragen(id),
  status             TEXT NOT NULL DEFAULT 'bevestigd'
                     CHECK (status IN ('bevestigd', 'in_productie', 'verzonden', 'geleverd', 'geannuleerd')),
  track_trace        TEXT,
  verwachte_levering DATE,
  totaal             NUMERIC(10,2) NOT NULL DEFAULT 0,
  bevestigd_op       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status  ON public.orders(status);

-- ─── Uitsluitingen ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.uitsluitingen (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_type     TEXT NOT NULL CHECK (subject_type IN ('basisplaat', 'fineer', 'hpl', 'bewerking')),
  subject_id       UUID NOT NULL,
  uitgesloten_type TEXT NOT NULL CHECK (uitgesloten_type IN ('basisplaat', 'fineer', 'hpl', 'bewerking')),
  uitgesloten_id   UUID NOT NULL,
  reden            TEXT
);

CREATE INDEX idx_uitsluitingen_subject  ON public.uitsluitingen(subject_type, subject_id);
CREATE INDEX idx_uitsluitingen_excluded ON public.uitsluitingen(uitgesloten_type, uitgesloten_id);

-- ─── Insluitingen ─────────────────────────────────────────────────────────────
-- If a subject has inclusions for a given type, ONLY those items of that type are shown.
-- If no inclusions are defined, all items are available (minus any uitsluitingen).
CREATE TABLE IF NOT EXISTS public.insluitingen (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_type     TEXT NOT NULL CHECK (subject_type IN ('basisplaat', 'fineer', 'hpl', 'bewerking')),
  subject_id       UUID NOT NULL,
  ingesloten_type  TEXT NOT NULL CHECK (ingesloten_type IN ('basisplaat', 'fineer', 'hpl', 'bewerking')),
  ingesloten_id    UUID NOT NULL,
  reden            TEXT
);

CREATE INDEX idx_insluitingen_subject  ON public.insluitingen(subject_type, subject_id);
CREATE INDEX idx_insluitingen_included ON public.insluitingen(ingesloten_type, ingesloten_id);

-- ─── Trigger: auto-create profile on signup ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, naam, bedrijf, branche, adres, kvk, order_confirm_email, rol, status)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'naam', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'bedrijf', ''),
    NULLIF(new.raw_user_meta_data->>'branche', ''),
    NULLIF(new.raw_user_meta_data->>'adres', ''),
    NULLIF(new.raw_user_meta_data->>'kvk', ''),
    COALESCE(NULLIF(new.raw_user_meta_data->>'order_confirm_email', ''), new.email),
    'kijker',
    'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    bedrijf             = EXCLUDED.bedrijf,
    branche             = EXCLUDED.branche,
    adres               = EXCLUDED.adres,
    kvk                 = EXCLUDED.kvk,
    order_confirm_email = EXCLUDED.order_confirm_email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orderlijsten       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orderlijst_regels  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aanvragen          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders             ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admin can see all profiles
CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- Orderlijsten: users can only see their own
CREATE POLICY "Users can manage own orderlijsten"
  ON public.orderlijsten FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all orderlijsten"
  ON public.orderlijsten FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- Orderlijst regels: through orderlijst ownership
CREATE POLICY "Users can manage own regels"
  ON public.orderlijst_regels FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.orderlijsten
      WHERE id = orderlijst_id AND user_id = auth.uid()
    )
  );

-- Aanvragen: users can see their own
CREATE POLICY "Users can manage own aanvragen"
  ON public.aanvragen FOR ALL
  USING (auth.uid() = user_id);

-- Orders: users can see their own
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- Public read for catalog tables
ALTER TABLE public.baseplaten    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fineers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpl           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bewerkingen   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staffelregels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instellingen  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read catalog"
  ON public.baseplaten FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read fineers"
  ON public.fineers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read hpl"
  ON public.hpl FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read bewerkingen"
  ON public.bewerkingen FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read staffel"
  ON public.staffelregels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read instellingen"
  ON public.instellingen FOR SELECT TO authenticated USING (true);

-- Admin write access to catalog
CREATE POLICY "Admin can manage catalog baseplaten"
  ON public.baseplaten FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "Admin can manage catalog fineers"
  ON public.fineers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "Admin can manage catalog hpl"
  ON public.hpl FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "Admin can manage bewerkingen"
  ON public.bewerkingen FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "Admin can manage staffel"
  ON public.staffelregels FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "Admin can manage instellingen"
  ON public.instellingen FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));

-- ─── Seed data ───────────────────────────────────────────────────────────────

-- Instellingen
INSERT INTO public.instellingen (sleutel, waarde) VALUES
  ('verzend_drempel', '1750'),
  ('verzend_kosten', '25'),
  ('btw_percentage', '21'),
  ('bedrijf_naam', 'Kuiper Holland B.V.'),
  ('bedrijf_email', 'info@kuiperholland.nl'),
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

-- Baseplaten
INSERT INTO public.baseplaten (naam, dikte_mm, breedte_mm, lengte_mm, prijs_per_m2, beschikbaar, volgorde) VALUES
  ('MDF',       12, 1220, 2440, 18.50, true, 1),
  ('MDF',       18, 1220, 2440, 24.00, true, 2),
  ('Multiplex', 15, 1220, 2440, 32.00, true, 3),
  ('Multiplex', 18, 1220, 2440, 38.50, true, 4),
  ('MDF Groot', 18, 1220, 3050, 26.00, true, 5);

-- Fineers
INSERT INTO public.fineers
  (naam, prijs_voorzijde_lang, prijs_voorzijde_kort, prijs_tegenzijde_lang, prijs_tegenzijde_kort,
   voegmethodes, voeg_standaard, fk_advies, info, status_lang, status_kort, volgorde)
VALUES
  ('Okoumé',  12.50, 14.00,  8.00,  9.50,
   ARRAY['gestolpt','geschoven','mixmatch','gedraaid_geschoven'], 'gestolpt', 'fabriek',
   'Afrikaans hout, licht roodbruin, goed bewerkbaar.', 'beschikbaar', 'beschikbaar', 1),
  ('Mahonie',  18.00, 20.00, 11.00, 13.00,
   ARRAY['gestolpt','geschoven','gedraaid_geschoven'], 'geschoven', 'foto_kuiper',
   'Klassiek interieurhout, warme rode tint.', 'beschikbaar', 'tijdelijk_niet', 2),
  ('Berken',   10.00, 11.50,  7.00,  8.00,
   ARRAY['gestolpt','geschoven','mixmatch'], 'gestolpt', 'fabriek',
   'Licht hout met fijne nerf, populair voor modern interieur.', 'beschikbaar', 'beschikbaar', 3),
  ('Eik',      22.00, 25.00, 14.00, 16.00,
   ARRAY['gestolpt','geschoven','mixmatch','gedraaid_geschoven'], 'geschoven', 'persoonlijk',
   'Tijdloos eikenhout, uitgesproken nerf, meerdere kwaliteiten.', 'beschikbaar', 'beschikbaar', 4),
  ('Teak',     35.00, 40.00, 22.00, 26.00,
   ARRAY['gestolpt','geschoven'], 'gestolpt', 'foto_klant',
   'Exotisch hout, goudbruin van kleur, duurzame kwaliteit.', 'beschikbaar', 'niet_beschikbaar', 5);

-- HPL
INSERT INTO public.hpl
  (kleur, prijs_lang, prijs_kort, hpl_afm_lang_b, hpl_afm_lang_l, hpl_afm_kort_b, hpl_afm_kort_l,
   info, status_lang, status_kort, volgorde)
VALUES
  ('Wit (U1101)',       28.00, 32.00, 1310, 2800, 1310, 1300,
   'Standaard wit HPL, glad oppervlak.', 'beschikbaar', 'beschikbaar', 1),
  ('Antraciet (U961)',  32.00, 36.00, 1310, 2800, 1310, 1300,
   'Donker antraciet HPL, modern uitstraling.', 'beschikbaar', 'beschikbaar', 2),
  ('Lichtgrijs (U763)', 30.00, 34.00, 1310, 2800, 1310, 1300,
   'Neutraal lichtgrijs, veelzijdig inzetbaar.', 'beschikbaar', 'tijdelijk_niet', 3),
  ('Eiken decor (D3436)', 38.00, 43.00, 1310, 2800, 1310, 1300,
   'Houtdecor eiken, structuur oppervlak.', 'beschikbaar', 'beschikbaar', 4);

-- Bewerkingen
INSERT INTO public.bewerkingen (naam, beschrijving, prijs, compatibiliteit, beschikbaar, volgorde) VALUES
  ('Zaagwerk',    'Plaat op maat gezaagd. Netto maat: breedte −10mm × lengte −20mm.',
   3.50, ARRAY['kaal','fineer','hpl'], true, 1),
  ('Schuurwerk',  'Fijn schuren van het oppervlak voor een gladde afwerking.',
   2.00, ARRAY['kaal','fineer'], true, 2),
  ('Grunderen',   'Voorzien van een grondlaag voor betere verfhechting.',
   4.50, ARRAY['kaal'], true, 3),
  ('Kantenbanden','ABS kantenbanden rondom aangebracht.',
   5.00, ARRAY['kaal','hpl'], true, 4);

-- Staffelregels — Fineer & HPL
INSERT INTO public.staffelregels (type, van_aantal, tot_aantal, marge_coefficient, multiplier) VALUES
  ('fineer_hpl', 1,  9,    0.6500, 1.0000),
  ('fineer_hpl', 10, 24,   0.6633, 0.9800),
  ('fineer_hpl', 25, 49,   0.6915, 0.9400),
  ('fineer_hpl', 50, NULL, 0.7065, 0.9200);

-- Staffelregels — Kaal
INSERT INTO public.staffelregels (type, van_aantal, tot_aantal, marge_coefficient, multiplier) VALUES
  ('kaal', 1,  9,    0.8000, 1.0000),
  ('kaal', 10, 24,   0.8163, 0.9800),
  ('kaal', 25, 49,   0.8333, 0.9600),
  ('kaal', 50, NULL, 0.8511, 0.9400);
