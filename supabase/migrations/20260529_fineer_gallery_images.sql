-- Fineer gallery images from Fineer-Export-2026-May-29-1931.csv.
-- Matches are made on the webshop fineer names, with A/B quality suffixes
-- sharing the same wood species image.

UPDATE public.fineers
SET gallery_foto_url = CASE
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Afzelia' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Afzelia.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Ahorn' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Ahorn.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Amazakoue' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Amazakoue.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Anigre' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Anigre.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Bamboe plain naturel' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Bamboo_Plain_Naturel.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Bamboe plain caramel' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Bamboo_plain_Caramel.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Bamboe side naturel' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Bamboo_Naturel_SidePressed.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Bamboe side caramel' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Bamboo_Caramel_SidePressed.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Berken' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Berken.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Beuken gestoomd' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Beuken_Gestoomd.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Bubinga quartier' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Bubinga.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Canadian maple' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Canadian_Maple.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Carolina pine' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Grenen_Dosse.jpg'
  WHEN naam IN ('Eiken 33', 'Eiken 35') THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Eiken_Dosse_01.jpg'
  WHEN naam = 'Eiken 37' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Eiken_Rift1.jpg'
  WHEN naam = 'Eiken 38 backing gevoegd ingekocht' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Eiken_Mix_Match_01.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Erle' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Erle.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Essen' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Essen_dosse-1.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Eucalyptus naturel' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Eucalyptus.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Eucalyptus gerookt' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Eucalyptus_Gerookt.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Frans noten' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Noten_Frans_2.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Genoest esdoorn' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Genoest_esdoorn.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Gerookt eiken' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Eiken_Gerookt_2.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Hemlock' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Hemlock.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Iepen' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Iepen.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Iroko' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Iroko_01.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Italiaans noten' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Noten_ITALIAANS.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Jatoba' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Jatoba.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Kastanje' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Kastanje.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') IN ('Kersen amerikaans', 'Kersen europees') THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Kersen.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Khaya mahonie' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Khaya.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Koto' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Koto.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Lariks' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Lariks.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Limba' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Limba.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Macore' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Macore.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Mahonie sapeli' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Mahonie_Quartier.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Mansonia' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Mansonia.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Moeraseiken' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Moeras_Eiken.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Movinqui' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Movinqui.jpg'
  WHEN naam IN ('Noten amerikaans 33', 'Noten amerikaans 35', 'Noten amerikaans 37') THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Noten_AM_quartier.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Ocoume' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Okoume.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Olijf' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Olijf.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Olijfessen' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Olijf_Essen_mixmatch.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Ongestoomd beuken' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Beuken-ongestoomd.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Oregon pine' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Oregon_Pine.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Padouk' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Padouk.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Peren dosse' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Peren.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Plataan' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Plataan.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Pommele mahonie' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Pommele.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Red ceder' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Red_Ceder.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Santos palissander' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Santos-1.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Satijn noten' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/NOTEN_SATIJN_redgum.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Sucupira' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Sucupira.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Teak' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Teak.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Tineo' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Tineo.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Tobasco ceder' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Tabasco_Ceder.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Vuren genoest' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Vuren_Genoest_01.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Wenge' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Wenge_quartier.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Yellow poplar dosse' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Yellow_Poplar.jpg'
  WHEN regexp_replace(naam, ' (A|B)$', '') = 'Zebrano' THEN 'https://kuiperholland.nl/wp-content/uploads/2018/07/Zebrano.jpg'
  ELSE gallery_foto_url
END
WHERE regexp_replace(naam, ' (A|B)$', '') IN (
  'Afzelia',
  'Ahorn',
  'Amazakoue',
  'Anigre',
  'Bamboe plain naturel',
  'Bamboe plain caramel',
  'Bamboe side naturel',
  'Bamboe side caramel',
  'Berken',
  'Beuken gestoomd',
  'Bubinga quartier',
  'Canadian maple',
  'Carolina pine',
  'Erle',
  'Essen',
  'Eucalyptus naturel',
  'Eucalyptus gerookt',
  'Frans noten',
  'Genoest esdoorn',
  'Gerookt eiken',
  'Hemlock',
  'Iepen',
  'Iroko',
  'Italiaans noten',
  'Jatoba',
  'Kastanje',
  'Kersen amerikaans',
  'Kersen europees',
  'Khaya mahonie',
  'Koto',
  'Lariks',
  'Limba',
  'Macore',
  'Mahonie sapeli',
  'Mansonia',
  'Moeraseiken',
  'Movinqui',
  'Ocoume',
  'Olijf',
  'Olijfessen',
  'Ongestoomd beuken',
  'Oregon pine',
  'Padouk',
  'Peren dosse',
  'Plataan',
  'Pommele mahonie',
  'Red ceder',
  'Santos palissander',
  'Satijn noten',
  'Sucupira',
  'Teak',
  'Tineo',
  'Tobasco ceder',
  'Vuren genoest',
  'Wenge',
  'Yellow poplar dosse',
  'Zebrano'
) OR naam IN (
  'Eiken 33',
  'Eiken 35',
  'Eiken 37',
  'Eiken 38 backing gevoegd ingekocht',
  'Noten amerikaans 33',
  'Noten amerikaans 35',
  'Noten amerikaans 37'
);
