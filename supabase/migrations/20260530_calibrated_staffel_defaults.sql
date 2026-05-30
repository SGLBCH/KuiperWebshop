-- Update staffel defaults after validation against Specials Fineer History.
-- Material prices remain unchanged; only quantity discounts are made more conservative.

DELETE FROM public.staffelregels WHERE type IN ('fineer_hpl', 'kaal');

INSERT INTO public.staffelregels (type, van_aantal, tot_aantal, marge_coefficient, multiplier) VALUES
  ('fineer_hpl', 1,  9,    0.6500, 1.0000),
  ('fineer_hpl', 10, 24,   0.6633, 0.9800),
  ('fineer_hpl', 25, 49,   0.6915, 0.9400),
  ('fineer_hpl', 50, NULL, 0.7065, 0.9200),
  ('kaal',       1,  9,    0.8000, 1.0000),
  ('kaal',       10, 24,   0.8163, 0.9800),
  ('kaal',       25, 49,   0.8333, 0.9600),
  ('kaal',       50, NULL, 0.8511, 0.9400);
