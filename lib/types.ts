// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  naam: string
  bedrijf: string
  telefoon?: string
  rol: 'kijker' | 'calculator' | 'inkoper' | 'admin'
  status: 'pending' | 'goedgekeurd' | 'afgewezen' | 'gedeactiveerd'
  order_confirm_email?: string
  order_confirm_email_cc?: string
  aangemaakt_op: string
}

// ─── Baseplaat ─────────────────────────────────────────────────────────────────
export interface Baseplaat {
  id: string
  naam: string
  dikte_mm: number
  breedte_mm: number
  lengte_mm: number
  prijs_per_m2: number
  beschikbaar: boolean
  gallery_foto_url?: string | null
  volgorde?: number
}

// ─── Fineer ────────────────────────────────────────────────────────────────────
export interface Fineer {
  id: string
  naam: string
  prijs_voorzijde_lang: number
  prijs_voorzijde_kort: number
  prijs_tegenzijde_lang: number
  prijs_tegenzijde_kort: number
  voegmethodes: string[]          // ['gestolpt','geschoven','mixmatch','gedraaid_geschoven']
  voeg_standaard: string          // one of the above
  fk_advies: 'fabriek' | 'foto_kuiper' | 'foto_klant' | 'persoonlijk'
  info?: string
  status_lang: 'beschikbaar' | 'tijdelijk_niet' | 'niet_beschikbaar'
  status_kort: 'beschikbaar' | 'tijdelijk_niet' | 'niet_beschikbaar'
  gallery_foto_url?: string
}

// ─── HPL ───────────────────────────────────────────────────────────────────────
export interface HPL {
  id: string
  kleur: string
  prijs_lang: number
  prijs_kort: number
  hpl_afm_lang_b: number          // mm
  hpl_afm_lang_l: number          // mm
  hpl_afm_kort_b: number          // mm
  hpl_afm_kort_l: number          // mm
  info?: string
  status_lang: 'beschikbaar' | 'tijdelijk_niet' | 'niet_beschikbaar'
  status_kort: 'beschikbaar' | 'tijdelijk_niet' | 'niet_beschikbaar'
  gallery_foto_url?: string
}

// ─── Bewerking ─────────────────────────────────────────────────────────────────
export interface Bewerking {
  id: string
  naam: string
  beschrijving: string
  prijs: number
  prijs_type: 'per_m2' | 'per_order'
  compatibiliteit: ('kaal' | 'fineer' | 'hpl')[]
  beschikbaar: boolean
  standaard_geselecteerd: boolean
  volgorde: number
}

// ─── Staffel ───────────────────────────────────────────────────────────────────
export interface StaffelRegel {
  id: string
  van_aantal: number
  tot_aantal: number | null       // null = onbeperkt
  marge_coefficient: number
}

export interface HotmeltCombinatie {
  id: string
  basisplaat_id: string
  categorie: 'fineer' | 'hpl'
}

// ─── Instelling ────────────────────────────────────────────────────────────────
export interface Instelling {
  sleutel: string
  waarde: string
}

// ─── Orderlijst ────────────────────────────────────────────────────────────────
export interface Orderlijst {
  id: string
  user_id: string
  naam: string
  status: 'actueel' | 'concept' | 'verstuurd' | 'gearchiveerd'
  aangemaakt_op: string
  bijgewerkt_op: string
  fineerkeuze?: string
  fineerkeuze_datum?: string
  fineer_afstemming?: string
  combinatie_groep_id?: string | null
}

// ─── OrderlijstRegel ──────────────────────────────────────────────────────────
export interface OrderlijstRegel {
  id: string
  orderlijst_id: string
  basisplaat_id: string
  categorie: 'kaal' | 'fineer' | 'hpl'
  fineer_voor?: string            // fineer id
  fineer_tegen?: string           // fineer id
  hpl_voor?: string               // hpl id
  hpl_tegen?: string              // hpl id
  voegmethode?: string
  bewerkingen: string[]           // bewerking ids
  ruimte_indeling: 'geen' | 'per_ruimte'
  ruimtes?: RuimteRegel[]
  aantal: number
  prijs_per_stuk: number
  totaal_prijs: number
}

export interface RuimteRegel {
  naam: string
  aantal: number
  afwerking: 'blankwerk' | 'donker_gebeitst'
}

// ─── Aanvraag ─────────────────────────────────────────────────────────────────
export interface Aanvraag {
  id: string
  user_id: string
  orderlijst_ids: string[]
  type: 'offerte' | 'order'
  bericht?: string
  fineerkeuze_tekst?: string
  totaal_waarde: number
  status: 'nieuw' | 'in_behandeling' | 'afgerond' | 'geannuleerd'
  verstuurd_op: string
}

// ─── Order ─────────────────────────────────────────────────────────────────────
export interface Order {
  id: string
  user_id: string
  ordernummer: string
  aanvraag_id?: string
  status: 'bevestigd' | 'in_productie' | 'verzonden' | 'geleverd' | 'geannuleerd'
  track_trace?: string
  verwachte_levering?: string
  totaal: number
  bevestigd_op: string
}

// ─── Configurator State ────────────────────────────────────────────────────────
export interface ConfiguratorState {
  // Step 0
  orderlijst_id?: string
  orderlijst_naam?: string

  // Step 1
  basisplaat?: Baseplaat

  // Step 2
  afmeting?: Baseplaat   // selected size variant

  // Step 3
  categorie?: 'kaal' | 'fineer' | 'hpl'

  // Step 4 - Fineer
  fineer_voor?: Fineer
  fineer_tegen?: Fineer
  voegmethode?: string
  fineerkeuze?: 'fabriek' | 'foto_kuiper' | 'foto_klant' | 'persoonlijk'
  fineerkeuze_datum?: string

  // Step 4 - HPL
  hpl_voor?: HPL
  hpl_tegen?: HPL

  // Step 5
  bewerkingen: Bewerking[]

  // Step 6
  invoer_modus: 'aantal' | 'm2'
  ruimte_indeling: 'geen' | 'per_ruimte'
  aantal: number
  ruimtes: RuimteRegel[]

  // Step 7
  prijs_per_stuk: number
  totaal_prijs: number
}

// ─── Pricing ───────────────────────────────────────────────────────────────────
export interface PricingData {
  staffel: StaffelRegel[]
  verzend_drempel: number
  verzend_kosten: number
  fineerlijm_per_m2: number
  schuurbanden_per_m2: number
  hpl_lijm_per_m2: number
  pu_hotmelt_per_m2: number
  hotmelt_combinaties: HotmeltCombinatie[]
}

export interface PriceResult {
  basisplaat_kosten: number
  fineer_kosten: number
  hpl_kosten: number
  bewerkingen_kosten: number
  vaste_toeslagen_kosten: number
  subtotaal: number
  staffel_multiplier: number
  staffel_korting: number
  subtotaal_na_staffel: number
  verzending: number
  totaal: number
  m2_per_plaat: number
  totaal_m2: number
}
