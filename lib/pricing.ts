import type { ConfiguratorState, PricingData, PriceResult, StaffelRegel } from './types'

export function getMargeCoefficient(aantal: number, staffel: StaffelRegel[]): number {
  if (!staffel || staffel.length === 0) return 0.65
  const sorted = [...staffel].sort((a, b) => a.van_aantal - b.van_aantal)
  let coeff = sorted[0]?.marge_coefficient ?? 0.65
  for (const regel of sorted) {
    if (aantal >= regel.van_aantal) {
      if (regel.tot_aantal === null || aantal <= regel.tot_aantal) {
        coeff = regel.marge_coefficient
        break
      }
    }
  }
  return coeff
}

// Keep old name as alias for backward compat
export const getMultiplier = getMargeCoefficient

export function calculatePrice(
  state: ConfiguratorState,
  pricing: PricingData
): PriceResult {
  const { basisplaat, afmeting, categorie, fineer_voor, fineer_tegen, hpl_voor, hpl_tegen, bewerkingen, aantal } = state
  const plaat = afmeting ?? basisplaat

  if (!plaat || aantal <= 0) return emptyResult()

  const m2_per_plaat = (plaat.breedte_mm / 1000) * (plaat.lengte_mm / 1000)
  const totaal_m2 = m2_per_plaat * aantal
  const isLang = plaat.lengte_mm > 2800

  // Hotmelt check
  const useHotmelt = (pricing.hotmelt_combinaties ?? []).some(
    hc => hc.basisplaat_id === plaat.id && hc.categorie === categorie
  )

  // Marge coëfficiënt from staffel
  const marge_coefficient = getMargeCoefficient(aantal, pricing.staffel ?? [])
  // Base coëfficiënt = first tier (for staffelkorting comparison)
  const sorted = [...(pricing.staffel ?? [])].sort((a, b) => a.van_aantal - b.van_aantal)
  const base_marge_coefficient = sorted[0]?.marge_coefficient ?? marge_coefficient

  // ── Inkoop per m² ──
  const inkoop_basis_per_m2 = plaat.prijs_per_m2 ?? 0
  let inkoop_afwerking_per_m2 = 0

  if (categorie === 'fineer') {
    const voorPrijs = fineer_voor
      ? (isLang ? fineer_voor.prijs_voorzijde_lang : fineer_voor.prijs_voorzijde_kort)
      : 0
    const tegenPrijs = fineer_tegen
      ? (isLang ? fineer_tegen.prijs_tegenzijde_lang : fineer_tegen.prijs_tegenzijde_kort)
      : 0
    const lijm = useHotmelt
      ? (pricing.pu_hotmelt_per_m2 ?? 0)
      : (pricing.fineerlijm_per_m2 ?? 0)
    inkoop_afwerking_per_m2 = voorPrijs + tegenPrijs + lijm + (pricing.schuurbanden_per_m2 ?? 0)
  } else if (categorie === 'hpl') {
    const hplVoorPerM2 = hpl_voor
      ? (isLang ? hpl_voor.prijs_lang : hpl_voor.prijs_kort) / m2_per_plaat
      : 0
    const hplTegenPerM2 = hpl_tegen
      ? (isLang ? hpl_tegen.prijs_lang : hpl_tegen.prijs_kort) / m2_per_plaat
      : 0
    const lijm = useHotmelt
      ? (pricing.pu_hotmelt_per_m2 ?? 0)
      : (pricing.hpl_lijm_per_m2 ?? 0)
    inkoop_afwerking_per_m2 = hplVoorPerM2 + hplTegenPerM2 + lijm
  }

  const inkoop_totaal_per_m2 = inkoop_basis_per_m2 + inkoop_afwerking_per_m2

  // ── Verkoopprijs per m² ──
  // At BASE rate (for "subtotaal" display line — before staffelkorting)
  const verkoop_basis_per_m2 = base_marge_coefficient > 0
    ? inkoop_totaal_per_m2 / base_marge_coefficient
    : 0
  // At ACTUAL staffel rate
  const verkoop_per_m2 = marge_coefficient > 0
    ? inkoop_totaal_per_m2 / marge_coefficient
    : 0

  // ── Per-plaat costs ──
  const prijs_per_plaat_basis = verkoop_basis_per_m2 * m2_per_plaat
  const prijs_per_plaat_staffel = verkoop_per_m2 * m2_per_plaat

  // ── Bewerkingen: per_m2 (door marge) vs per_order (vast bedrag) ──
  const bw_per_m2 = (bewerkingen ?? []).filter(b => (b.prijs_type ?? 'per_m2') === 'per_m2')
  const bw_per_order = (bewerkingen ?? []).filter(b => b.prijs_type === 'per_order')
  const bewerkingen_per_m2_som = bw_per_m2.reduce((sum, b) => sum + (b.prijs ?? 0), 0)
  const bewerkingen_per_plaat = bewerkingen_per_m2_som * m2_per_plaat
  const bewerkingen_kosten = bewerkingen_per_plaat * aantal
  const vaste_toeslagen_kosten = bw_per_order.reduce((sum, b) => sum + (b.prijs ?? 0), 0)

  // ── Subtotalen ──
  const materiaal_basis = prijs_per_plaat_basis * aantal
  const materiaal_staffel = prijs_per_plaat_staffel * aantal
  const staffel_korting = materiaal_basis - materiaal_staffel

  // Vaste toeslagen vallen buiten staffelkorting
  const subtotaal = materiaal_basis + bewerkingen_kosten + vaste_toeslagen_kosten
  const subtotaal_na_staffel = materiaal_staffel + bewerkingen_kosten + vaste_toeslagen_kosten

  // staffel_multiplier for display percentage: base / actual
  const staffel_multiplier = base_marge_coefficient > 0
    ? base_marge_coefficient / marge_coefficient
    : 1

  // ── Component breakdown (at actual staffel rate, for display) ──
  const afwerking_frac = inkoop_totaal_per_m2 > 0
    ? inkoop_afwerking_per_m2 / inkoop_totaal_per_m2
    : 0
  const basis_frac = 1 - afwerking_frac

  const basisplaat_kosten = materiaal_staffel * basis_frac
  const fineer_kosten = categorie === 'fineer' ? materiaal_staffel * afwerking_frac : 0
  const hpl_kosten = categorie === 'hpl' ? materiaal_staffel * afwerking_frac : 0

  // ── Verzending ──
  const drempel = pricing.verzend_drempel ?? 1750
  const verzend_kosten_instelling = pricing.verzend_kosten ?? 25
  const verzending = subtotaal_na_staffel >= drempel ? 0 : verzend_kosten_instelling

  const totaal = subtotaal_na_staffel + verzending

  const round5 = (n: number) => Math.round(n * 100000) / 100000

  return {
    basisplaat_kosten: round5(basisplaat_kosten),
    fineer_kosten: round5(fineer_kosten),
    hpl_kosten: round5(hpl_kosten),
    bewerkingen_kosten: round5(bewerkingen_kosten),
    vaste_toeslagen_kosten: round5(vaste_toeslagen_kosten),
    subtotaal: round5(subtotaal),
    staffel_multiplier: round5(staffel_multiplier),
    staffel_korting: round5(staffel_korting),
    subtotaal_na_staffel: round5(subtotaal_na_staffel),
    verzending: round5(verzending),
    totaal: Math.round(totaal * 100) / 100,
    m2_per_plaat: round5(m2_per_plaat),
    totaal_m2: round5(totaal_m2),
  }
}

function emptyResult(): PriceResult {
  return {
    basisplaat_kosten: 0, fineer_kosten: 0, hpl_kosten: 0,
    bewerkingen_kosten: 0, vaste_toeslagen_kosten: 0, subtotaal: 0,
    staffel_multiplier: 1, staffel_korting: 0, subtotaal_na_staffel: 0,
    verzending: 0, totaal: 0, m2_per_plaat: 0, totaal_m2: 0,
  }
}
