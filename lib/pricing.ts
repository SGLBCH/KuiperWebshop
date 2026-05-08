import type { ConfiguratorState, PricingData, PriceResult, StaffelRegel } from './types'

export function getMultiplier(aantal: number, staffel: StaffelRegel[]): number {
  if (!staffel || staffel.length === 0) return 1
  // Sort ascending by van_aantal
  const sorted = [...staffel].sort((a, b) => a.van_aantal - b.van_aantal)
  let multiplier = 1
  for (const regel of sorted) {
    if (aantal >= regel.van_aantal) {
      if (regel.tot_aantal === null || aantal <= regel.tot_aantal) {
        multiplier = regel.multiplier
        break
      }
    }
  }
  return multiplier
}

export function calculatePrice(
  state: ConfiguratorState,
  pricing: PricingData
): PriceResult {
  const { basisplaat, afmeting, categorie, fineer_voor, fineer_tegen, hpl_voor, hpl_tegen, bewerkingen, aantal } = state

  // Use afmeting if available (has specific dimensions), else fallback to basisplaat
  const plaat = afmeting ?? basisplaat

  if (!plaat || aantal <= 0) {
    return emptyResult()
  }

  const breedte = plaat.breedte_mm / 1000  // convert to meters
  const lengte = plaat.lengte_mm / 1000
  const m2_per_plaat = breedte * lengte
  const totaal_m2 = m2_per_plaat * aantal
  const isLang = plaat.lengte_mm > 2800

  // ── Base cost ──
  const basisplaat_kosten = m2_per_plaat * (plaat.prijs_per_m2 ?? 0) * aantal

  // ── Fineer cost ──
  let fineer_kosten = 0
  if (categorie === 'fineer') {
    const voorPrijs = fineer_voor
      ? (isLang ? fineer_voor.prijs_voorzijde_lang : fineer_voor.prijs_voorzijde_kort)
      : 0
    const tegenPrijs = fineer_tegen
      ? (isLang ? fineer_tegen.prijs_tegenzijde_lang : fineer_tegen.prijs_tegenzijde_kort)
      : 0
    fineer_kosten = (voorPrijs + tegenPrijs) * totaal_m2
  }

  // ── HPL cost ──
  // HPL pricing is based on HPL plate dimensions (includes snijverlies)
  let hpl_kosten = 0
  if (categorie === 'hpl') {
    if (hpl_voor) {
      // HPL plate dimensions (mm → m²)
      const hplBreedte = isLang ? hpl_voor.hpl_afm_lang_b / 1000 : hpl_voor.hpl_afm_kort_b / 1000
      const hplLengte = isLang ? hpl_voor.hpl_afm_lang_l / 1000 : hpl_voor.hpl_afm_kort_l / 1000
      const hplM2 = hplBreedte * hplLengte
      const prijsPerM2Hpl = isLang ? hpl_voor.prijs_lang : hpl_voor.prijs_kort
      hpl_kosten += hplM2 * prijsPerM2Hpl * aantal
    }
    if (hpl_tegen) {
      const hplBreedte = isLang ? hpl_tegen.hpl_afm_lang_b / 1000 : hpl_tegen.hpl_afm_kort_b / 1000
      const hplLengte = isLang ? hpl_tegen.hpl_afm_lang_l / 1000 : hpl_tegen.hpl_afm_kort_l / 1000
      const hplM2 = hplBreedte * hplLengte
      const prijsPerM2Hpl = isLang ? hpl_tegen.prijs_lang : hpl_tegen.prijs_kort
      hpl_kosten += hplM2 * prijsPerM2Hpl * aantal
    }
  }

  // ── Bewerkingen cost ──
  const bewerkingen_kosten = (bewerkingen ?? []).reduce((sum, b) => {
    return sum + (b.prijs ?? 0) * m2_per_plaat * aantal
  }, 0)

  // ── Subtotaal ──
  const subtotaal = basisplaat_kosten + fineer_kosten + hpl_kosten + bewerkingen_kosten

  // ── Staffel ──
  const staffel_multiplier = getMultiplier(aantal, pricing.staffel ?? [])
  const staffel_korting = subtotaal * (1 - staffel_multiplier)
  const subtotaal_na_staffel = subtotaal * staffel_multiplier

  // ── Verzending ──
  const drempel = pricing.verzend_drempel ?? 1750
  const verzend_kosten = pricing.verzend_kosten ?? 25
  const verzending = subtotaal_na_staffel >= drempel ? 0 : verzend_kosten

  // ── Totaal ──
  const totaal = subtotaal_na_staffel + verzending

  return {
    basisplaat_kosten,
    fineer_kosten,
    hpl_kosten,
    bewerkingen_kosten,
    subtotaal,
    staffel_multiplier,
    staffel_korting,
    subtotaal_na_staffel,
    verzending,
    totaal,
    m2_per_plaat,
    totaal_m2,
  }
}

function emptyResult(): PriceResult {
  return {
    basisplaat_kosten: 0,
    fineer_kosten: 0,
    hpl_kosten: 0,
    bewerkingen_kosten: 0,
    subtotaal: 0,
    staffel_multiplier: 1,
    staffel_korting: 0,
    subtotaal_na_staffel: 0,
    verzending: 0,
    totaal: 0,
    m2_per_plaat: 0,
    totaal_m2: 0,
  }
}
