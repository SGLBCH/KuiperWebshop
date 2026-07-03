import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { calculatePrice, getMargeCoefficient, getStaffelDisplayMultiplier } from '@/lib/pricing'
import {
  seedVasteKosten,
  seedStaffelFineerHPL,
  seedStaffelKaal,
} from '@/lib/seed-data'
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/supabase/config'
import type {
  Baseplaat, Fineer, HPL, Bewerking, StaffelRegel,
  PricingData, HotmeltCombinatie, ConfiguratorState,
} from '@/lib/types'

// Server-side prijsberekening. Inkoopprijzen, calculatiefactoren en
// marge-coëfficiënten blijven op de server — de client krijgt alleen
// verkoopprijzen (PriceResult / regel-totalen) terug.

type ConfigInput = {
  basisplaat_id?: string | null
  categorie?: 'kaal' | 'fineer' | 'hpl' | null
  fineer_voor_id?: string | null
  fineer_tegen_id?: string | null
  hpl_voor_id?: string | null
  hpl_tegen_id?: string | null
  voegmethode?: string | null
  fineerkeuze?: 'fabriek' | 'foto_kuiper' | 'foto_klant' | 'persoonlijk' | null
  bewerking_ids?: string[]
  aantal?: number
}

type RegelInput = {
  id: string
  basisplaat_id: string
  categorie: string
  fineer_voor?: string | null
  fineer_tegen?: string | null
  hpl_voor?: string | null
  hpl_tegen?: string | null
  voegmethode?: string | null
  fineerkeuze?: string | null
  bewerkingen?: string[]
  aantal: number
}

type PricingContext = {
  baseplaten: Baseplaat[]
  fineers: Fineer[]
  hplList: HPL[]
  bewerkingen: Bewerking[]
  staffelFH: StaffelRegel[]
  staffelKaal: StaffelRegel[]
  hotmeltCombs: HotmeltCombinatie[]
  getIns: (key: string, def: number) => number
}

type StaffelDbRow = {
  id: string
  type?: string
  van_aantal: number
  tot_aantal: number | null
  marge_coefficient?: number
  multiplier?: number
}

function parseStaffelRows(rows: StaffelDbRow[]) {
  const toRegel = (row: StaffelDbRow): StaffelRegel | null => {
    if (typeof row.marge_coefficient !== 'number') return null
    return {
      id: row.id,
      van_aantal: row.van_aantal,
      tot_aantal: row.tot_aantal,
      marge_coefficient: row.marge_coefficient,
      multiplier: typeof row.multiplier === 'number' ? row.multiplier : undefined,
    }
  }
  return {
    fineerHpl: rows.filter(r => r.type === 'fineer_hpl').map(toRegel).filter((r): r is StaffelRegel => r !== null),
    kaal: rows.filter(r => r.type === 'kaal').map(toRegel).filter((r): r is StaffelRegel => r !== null),
  }
}

async function loadPricingContext(supabaseUrl: string, serviceRoleKey: string): Promise<PricingContext> {
  const supabase = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const [bpRes, fnRes, hplRes, bwRes, staffelRes, insRes, hmRes] = await Promise.all([
    supabase.from('baseplaten').select('*'),
    supabase.from('fineers').select('*'),
    supabase.from('hpl').select('*'),
    supabase.from('bewerkingen').select('*'),
    supabase.from('staffelregels').select('*').order('van_aantal'),
    supabase.from('instellingen').select('*'),
    supabase.from('hotmelt_combinaties').select('*'),
  ])

  const ins = (insRes.data ?? []) as { sleutel: string; waarde: string }[]
  const getIns = (key: string, def: number) => {
    const parsed = parseFloat(ins.find(i => i.sleutel === key)?.waarde ?? '')
    return Number.isFinite(parsed) ? parsed : def
  }

  let staffelFH = seedStaffelFineerHPL
  let staffelKaal = seedStaffelKaal
  const fhRaw = ins.find(i => i.sleutel === 'staffel_fineer_hpl')?.waarde
  const kaalRaw = ins.find(i => i.sleutel === 'staffel_kaal')?.waarde
  if (fhRaw) { try { staffelFH = JSON.parse(fhRaw) } catch { /* seed defaults */ } }
  if (kaalRaw) { try { staffelKaal = JSON.parse(kaalRaw) } catch { /* seed defaults */ } }
  if (staffelRes.data?.length) {
    const fromTable = parseStaffelRows(staffelRes.data as StaffelDbRow[])
    if (fromTable.fineerHpl.length > 0) staffelFH = fromTable.fineerHpl
    if (fromTable.kaal.length > 0) staffelKaal = fromTable.kaal
  }

  return {
    baseplaten: (bpRes.data ?? []) as Baseplaat[],
    fineers: (fnRes.data ?? []) as Fineer[],
    hplList: (hplRes.data ?? []) as HPL[],
    bewerkingen: (bwRes.data ?? []) as Bewerking[],
    staffelFH, staffelKaal,
    hotmeltCombs: (hmRes.data ?? []) as HotmeltCombinatie[],
    getIns,
  }
}

function buildPricingData(ctx: PricingContext, categorie: string | undefined, staffelOverride?: StaffelRegel[]): PricingData {
  const g = ctx.getIns
  return {
    staffel: staffelOverride ?? (categorie === 'kaal' ? ctx.staffelKaal : ctx.staffelFH),
    verzend_drempel: g('verzend_drempel', 1750),
    verzend_kosten: g('verzend_kosten', 25),
    fineerlijm_per_m2: g('fineerlijm_per_m2', seedVasteKosten.fineerlijm_per_m2),
    schuurbanden_per_m2: g('schuurbanden_per_m2', seedVasteKosten.schuurbanden_per_m2),
    hpl_lijm_per_m2: g('hpl_lijm_per_m2', seedVasteKosten.hpl_lijm_per_m2),
    pu_hotmelt_per_m2: g('pu_hotmelt_per_m2', seedVasteKosten.pu_hotmelt_per_m2),
    basisplaat_markup_fineer_hpl: g('basisplaat_markup_fineer_hpl', seedVasteKosten.basisplaat_markup_fineer_hpl),
    basisplaat_markup_kaal: g('basisplaat_markup_kaal', seedVasteKosten.basisplaat_markup_kaal),
    hpl_calculatie_factor: g('hpl_calculatie_factor', seedVasteKosten.hpl_calculatie_factor),
    hpl_overhead_per_m2: g('hpl_overhead_per_m2', seedVasteKosten.hpl_overhead_per_m2),
    fineer_overhead_min_per_m2: g('fineer_overhead_min_per_m2', seedVasteKosten.fineer_overhead_min_per_m2),
    fineer_overhead_max_per_m2: g('fineer_overhead_max_per_m2', seedVasteKosten.fineer_overhead_max_per_m2),
    toeslag_mixmatch_per_m2: g('toeslag_mixmatch_per_m2', seedVasteKosten.toeslag_mixmatch_per_m2),
    toeslag_gedraaid_geschoven_per_m2: g('toeslag_gedraaid_geschoven_per_m2', seedVasteKosten.toeslag_gedraaid_geschoven_per_m2),
    toeslag_foto_fineerkeuze_per_m2: g('toeslag_foto_fineerkeuze_per_m2', seedVasteKosten.toeslag_foto_fineerkeuze_per_m2),
    toeslag_persoonlijk_fineerkeuze_per_m2: g('toeslag_persoonlijk_fineerkeuze_per_m2', seedVasteKosten.toeslag_persoonlijk_fineerkeuze_per_m2),
    hotmelt_combinaties: ctx.hotmeltCombs,
  }
}

function buildState(ctx: PricingContext, input: {
  basisplaat_id?: string | null
  categorie?: string | null
  fineer_voor_id?: string | null
  fineer_tegen_id?: string | null
  hpl_voor_id?: string | null
  hpl_tegen_id?: string | null
  voegmethode?: string | null
  fineerkeuze?: string | null
  bewerking_ids?: string[]
  aantal: number
}): ConfiguratorState {
  const plaat = ctx.baseplaten.find(b => b.id === input.basisplaat_id)
  return {
    basisplaat: plaat,
    afmeting: plaat,
    categorie: (input.categorie ?? undefined) as ConfiguratorState['categorie'],
    fineer_voor: input.fineer_voor_id ? ctx.fineers.find(f => f.id === input.fineer_voor_id) : undefined,
    fineer_tegen: input.fineer_tegen_id ? ctx.fineers.find(f => f.id === input.fineer_tegen_id) : undefined,
    hpl_voor: input.hpl_voor_id ? ctx.hplList.find(h => h.id === input.hpl_voor_id) : undefined,
    hpl_tegen: input.hpl_tegen_id ? ctx.hplList.find(h => h.id === input.hpl_tegen_id) : undefined,
    voegmethode: input.voegmethode ?? undefined,
    fineerkeuze: (input.fineerkeuze ?? undefined) as ConfiguratorState['fineerkeuze'],
    bewerkingen: ctx.bewerkingen.filter(b => (input.bewerking_ids ?? []).includes(b.id)),
    invoer_modus: 'aantal',
    ruimte_indeling: 'geen',
    ruimtes: [],
    aantal: input.aantal,
    prijs_per_stuk: 0,
    totaal_prijs: 0,
  }
}

export async function POST(request: Request) {
  const supabaseUrl = getSupabaseUrl()
  const serviceRoleKey = getSupabaseServiceRoleKey()
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Prijsservice niet geconfigureerd.' }, { status: 503 })
  }

  // Alleen ingelogde, goedgekeurde gebruikers mogen prijzen opvragen
  const { createClient: createAuthClient } = await import('@/lib/supabase/server')
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 })

  const { data: profile } = await authClient
    .from('profiles')
    .select('rol, status')
    .eq('id', user.id)
    .single()
  if (profile && profile.status !== 'goedgekeurd') {
    return NextResponse.json({ error: 'Account nog niet goedgekeurd.' }, { status: 403 })
  }

  let body: { mode?: string; config?: ConfigInput; regels?: RegelInput[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldige request body.' }, { status: 400 })
  }

  const ctx = await loadPricingContext(supabaseUrl, serviceRoleKey)

  // ── Mode: configurator — één configuratie, volledige PriceResult ──
  if (body.mode === 'configurator') {
    const cfg = body.config ?? {}
    const aantal = Math.min(Math.max(Math.floor(cfg.aantal ?? 0), 0), 1_000_000)
    const state = buildState(ctx, { ...cfg, aantal })
    const pricingData = buildPricingData(ctx, cfg.categorie ?? undefined)
    const result = calculatePrice(state, pricingData)
    return NextResponse.json({ result })
  }

  // ── Mode: orderlijst — regels herberekenen met (gecombineerde) staffel ──
  if (body.mode === 'orderlijst') {
    const regels = (body.regels ?? []).slice(0, 500)

    const totaalFH = regels
      .filter(r => r.categorie === 'fineer' || r.categorie === 'hpl')
      .reduce((s, r) => s + Math.max(0, Math.floor(r.aantal ?? 0)), 0)
    const totaalKaal = regels
      .filter(r => r.categorie === 'kaal')
      .reduce((s, r) => s + Math.max(0, Math.floor(r.aantal ?? 0)), 0)

    // Bepaal de staffelkorting op groepsniveau en injecteer die als
    // expliciete multiplier zodat elke regel dezelfde korting krijgt.
    const multFH = getStaffelDisplayMultiplier(totaalFH, ctx.staffelFH)
    const multKaal = getStaffelDisplayMultiplier(totaalKaal, ctx.staffelKaal)
    const coeffFH = getMargeCoefficient(totaalFH, ctx.staffelFH)
    const coeffKaal = getMargeCoefficient(totaalKaal, ctx.staffelKaal)

    const computed = regels.map(regel => {
      const aantal = Math.min(Math.max(Math.floor(regel.aantal ?? 0), 0), 1_000_000)
      if (aantal <= 0) return { id: regel.id, prijs_per_stuk: 0, totaal_prijs: 0 }

      const isKaal = regel.categorie === 'kaal'
      const mockStaffel: StaffelRegel[] = [{
        id: '_groep',
        van_aantal: 1,
        tot_aantal: null,
        marge_coefficient: isKaal ? coeffKaal : coeffFH,
        multiplier: isKaal ? multKaal : multFH,
      }]

      const state = buildState(ctx, {
        basisplaat_id: regel.basisplaat_id,
        categorie: regel.categorie,
        fineer_voor_id: regel.fineer_voor,
        fineer_tegen_id: regel.fineer_tegen,
        hpl_voor_id: regel.hpl_voor,
        hpl_tegen_id: regel.hpl_tegen,
        voegmethode: regel.voegmethode,
        fineerkeuze: regel.fineerkeuze,
        bewerking_ids: regel.bewerkingen ?? [],
        aantal,
      })

      // Verzending wordt op orderniveau berekend, niet per regel
      const pricingData = buildPricingData(ctx, regel.categorie, mockStaffel)
      pricingData.verzend_drempel = 0
      pricingData.verzend_kosten = 0

      const result = calculatePrice(state, pricingData)
      return {
        id: regel.id,
        prijs_per_stuk: Math.round((result.subtotaal_na_staffel / aantal) * 100) / 100,
        totaal_prijs: Math.round(result.subtotaal_na_staffel * 100) / 100,
      }
    })

    return NextResponse.json({
      regels: computed,
      verzend_drempel: ctx.getIns('verzend_drempel', 1750),
      verzend_kosten: ctx.getIns('verzend_kosten', 25),
    })
  }

  return NextResponse.json({ error: 'Onbekende mode.' }, { status: 400 })
}
