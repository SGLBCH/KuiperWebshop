-- ═══════════════════════════════════════════════════════════════════════════
-- LAUNCH FIXES — voer dit éénmalig uit in de Supabase SQL editor
--
-- 1. handle_new_user leest nu ALLE registratievelden uit de user-metadata
--    (bedrijf, branche, adres, kvk, order_confirm_email gingen eerder
--    verloren omdat de client-insert door RLS werd geweigerd)
-- ═══════════════════════════════════════════════════════════════════════════

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
