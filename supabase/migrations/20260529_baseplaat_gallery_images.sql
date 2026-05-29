-- Baseplaat gallery images from Producten-Export-2026-May-29-1928.csv.
-- Matches are intentionally made on the webshop baseplaat names.

UPDATE public.baseplaten
SET gallery_foto_url = CASE naam
  WHEN 'Populieren' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/04/kuiper-holland-basic-poplar-plywood.jpg'
  WHEN 'Populieren FR' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/04/kuiper-holland-protect-poplar-ply-fr.jpg'
  WHEN 'Queenply' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/04/kuiper-holland-basic-queenply-marine-plywood.jpg'
  WHEN 'Ocoume Multiplex Gold' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/04/kuiper-holland-basic-okoume-plywood.jpg'
  WHEN 'Ocoume Multiplex Silver' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/04/kuiper-holland-basic-okoume-plywood.jpg'
  WHEN 'MDF' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/04/kuiper-holland-basic-mdf.jpg'
  WHEN 'MDF V313 (Vochtwerend)' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/04/kuiper-holland-basic-mdf-v313.jpg'
  WHEN 'MDF Zwart' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/04/kuiper-holland-basic-mdf-black.jpg'
  WHEN 'MDF FR' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/04/kuiper-holland-protect-mdf-fr.jpg'
  WHEN 'Berken Multiplex' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/04/kuiper-holland-basic-birch-plywood.jpg'
  WHEN 'FIPRO' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/04/kuiper-holland-protect-fipro-b15.jpg'
  WHEN 'Ceiba Buigtriplex' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/05/kuiper-holland-basic-ceiba-bending-ply.jpg'
  WHEN 'Buigtriplex' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/04/kuiper-holland-basic-bending-ply.jpg'
  WHEN 'Banova Balsa Ply' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/03/kuiper-holland-air-balsa-w80.jpg'
  ELSE gallery_foto_url
END
WHERE naam IN (
  'Populieren',
  'Populieren FR',
  'Queenply',
  'Ocoume Multiplex Gold',
  'Ocoume Multiplex Silver',
  'MDF',
  'MDF V313 (Vochtwerend)',
  'MDF Zwart',
  'MDF FR',
  'Berken Multiplex',
  'FIPRO',
  'Ceiba Buigtriplex',
  'Buigtriplex',
  'Banova Balsa Ply'
);
