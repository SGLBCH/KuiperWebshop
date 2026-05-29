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
  const staffel_multiplier = getStaffelDisplayMultiplier(aantal, pricing.staffel ?? [])

  // Hotmelt check
  const useHotmelt = (pricing.hotmelt_combinaties ?? []).some(
    hc => hc.basisplaat_id === plaat.id && hc.categorie === categorie
  )

  // The workbook data stores current material intake prices in €/m².
  // Calibration against Specials Fineer History Codex 1 shows the most stable
  // simple model is: basisplaat with a small markup, veneer with waste/margin,
  // and explicit press/handling overhead. Quantity effects are kept in staffel.
  const BASEPLAAT_MARKUP = categorie === 'kaal' ? 1.18 : 1.08
  const HPL_WASTE_AND_MARGIN = 1.15

  const basis_per_m2 = (plaat.prijs_per_m2 ?? 0) * BASEPLAAT_MARKUP
  let afwerking_per_m2 = 0

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
    const voorFactor = fineer_voor ? getFineerFactor(fineer_voor, voorPrijs) : 0
    const tegenFactor = fineer_tegen ? getFineerFactor(fineer_tegen, tegenPrijs) : 0
    const fineerMateriaal = (voorPrijs * voorFactor) + (tegenPrijs * tegenFactor)
    const overhead = getFineerOverheadPerM2({
      voorPrijs,
      tegenPrijs,
      voorOverhead: fineer_voor?.plak_overhead_per_m2,
      tegenOverhead: fineer_tegen?.plak_overhead_per_m2,
      voegmethode: state.voegmethode,
      fineerkeuze: state.fineerkeuze,
    })
    afwerking_per_m2 = fineerMateriaal
      + overhead
      + (lijm * 2)
      + (pricing.schuurbanden_per_m2 ?? 0)
  } else if (categorie === 'hpl') {
    const hplVoorPerM2 = hpl_voor
      ? (isLang ? hpl_voor.prijs_lang : hpl_voor.prijs_kort)
      : 0
    const hplTegenPerM2 = hpl_tegen
      ? (isLang ? hpl_tegen.prijs_lang : hpl_tegen.prijs_kort)
      : 0
    const lijm = useHotmelt
      ? (pricing.pu_hotmelt_per_m2 ?? 0)
      : (pricing.hpl_lijm_per_m2 ?? 0)
    const hplSides = (hpl_voor ? 1 : 0) + (hpl_tegen ? 1 : 0)
    afwerking_per_m2 = ((hplVoorPerM2 + hplTegenPerM2) * HPL_WASTE_AND_MARGIN)
      + (lijm * hplSides)
      + (hplSides > 0 ? 7.5 : 0)
  }

  // ── Bewerkingen: per_m2 (door marge) vs per_order (vast bedrag) ──
  const bw_per_m2 = (bewerkingen ?? []).filter(b => (b.prijs_type ?? 'per_m2') === 'per_m2')
  const bw_per_order = (bewerkingen ?? []).filter(b => b.prijs_type === 'per_order')
  const bewerkingen_per_m2_som = bw_per_m2.reduce((sum, b) => sum + (b.prijs ?? 0), 0)
  const bewerkingen_per_plaat = bewerkingen_per_m2_som * m2_per_plaat
  const bewerkingen_kosten = bewerkingen_per_plaat * aantal
  const vaste_toeslagen_kosten = bw_per_order.reduce((sum, b) => sum + (b.prijs ?? 0), 0)

  // ── Subtotalen ──
  const basisplaat_bruto = basis_per_m2 * totaal_m2
  const afwerking_bruto = afwerking_per_m2 * totaal_m2
  const materiaal_basis = basisplaat_bruto + afwerking_bruto
  const basisplaat_kosten = basisplaat_bruto * staffel_multiplier
  const afwerking_kosten = afwerking_bruto * staffel_multiplier
  const materiaal_staffel = basisplaat_kosten + afwerking_kosten
  const staffel_korting = materiaal_basis - materiaal_staffel

  // Vaste toeslagen vallen buiten staffelkorting
  const subtotaal = materiaal_basis + bewerkingen_kosten + vaste_toeslagen_kosten
  const subtotaal_na_staffel = materiaal_staffel + bewerkingen_kosten + vaste_toeslagen_kosten

  const fineer_kosten = categorie === 'fineer' ? afwerking_kosten : 0
  const hpl_kosten = categorie === 'hpl' ? afwerking_kosten : 0

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

function getStaffelDisplayMultiplier(aantal: number, staffel: StaffelRegel[]): number {
  const current = getMargeCoefficient(aantal, staffel)
  const sorted = [...(staffel ?? [])].sort((a, b) => a.van_aantal - b.van_aantal)
  const base = sorted[0]?.marge_coefficient ?? current

  if (current <= 0 || base <= 0) return 1

  // Existing admin data uses margin coefficients where higher numbers mean
  // sharper pricing at larger quantities. Convert that into a discount
  // multiplier for the new explicit-cost model. If future admin data is saved
  // as direct multipliers (<= 1), accept it as-is.
  if (current <= 1 && base <= 1 && current >= base) {
    return Math.min(1, base / current)
  }

  return Math.min(1, current)
}

function getFineerOverheadPerM2(input: {
  voorPrijs: number
  tegenPrijs: number
  voorOverhead?: number
  tegenOverhead?: number
  voegmethode?: string
  fineerkeuze?: ConfiguratorState['fineerkeuze']
}): number {
  const selectedSides = [input.voorPrijs, input.tegenPrijs].filter(v => v > 0)
  if (selectedSides.length === 0) return 0

  const explicitOverheads = [input.voorOverhead, input.tegenOverhead]
    .filter((value): value is number => typeof value === 'number' && value > 0)
  let overhead: number

  if (explicitOverheads.length > 0) {
    overhead = explicitOverheads.reduce((sum, value) => sum + value, 0) / explicitOverheads.length
  } else {
    const avgFineer = selectedSides.reduce((sum, value) => sum + value, 0) / selectedSides.length
    overhead = 10.5

    if (avgFineer <= 2.5) overhead -= 1.5
    else if (avgFineer >= 12) overhead += 3
    else if (avgFineer >= 7) overhead += 1.5
  }

  if (input.voegmethode === 'mixmatch') overhead += 1.5
  if (input.voegmethode === 'gedraaid_geschoven') overhead += 0.75

  if (input.fineerkeuze === 'foto_kuiper' || input.fineerkeuze === 'foto_klant') overhead += 0.5
  if (input.fineerkeuze === 'persoonlijk') overhead += 1.5

  return Math.max(6, Math.min(16, overhead))
}

function getFineerFactor(fineer: { calculatie_factor?: number }, prijs: number): number {
  if (typeof fineer.calculatie_factor === 'number' && fineer.calculatie_factor > 0) {
    return fineer.calculatie_factor
  }

  // Default curve when old Supabase rows do not have per-houtsoort parameters.
  // Low-priced transparent species get less markup; scarce/premium veneers get
  // more loss/risk coverage.
  if (prijs <= 2.5) return 1.45
  if (prijs <= 6) return 1.55
  if (prijs <= 12) return 1.7
  return 1.85
}
