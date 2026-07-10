'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { StepStepper } from '@/components/ui/StepStepper'
import { Badge } from '@/components/ui/Badge'
import {
  seedBaseplaten,
  seedFineers,
  seedHPL,
  seedBewerkingen,
  seedOrderlijsten,
} from '@/lib/seed-data'
import type { ConfiguratorState, Baseplaat, Fineer, HPL, Bewerking, RuimteRegel, Orderlijst } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────
type UitsluitingRow = { id: string; subject_type: string; subject_id: string; uitgesloten_type: string; uitgesloten_id: string; reden: string | null }
type InsluitingRow = { id: string; subject_type: string; subject_id: string; ingesloten_type: string; ingesloten_id: string; reden: string | null }

// Indicatieve richtprijs zoals de server die teruggeeft: een afgeronde
// range plus een vanaf-prijs per stuk. De exacte calculatie (inkoopprijzen,
// marges, staffels, prijsopbouw) verlaat de server nooit.
type PrijsIndicatie = {
  m2_per_plaat: number
  totaal_m2: number
  range_laag: number
  range_hoog: number
  per_stuk_vanaf: number
  per_m2_laag: number
  per_m2_hoog: number
  verzending_gratis: boolean
  verzend_drempel: number
  verzend_kosten: number
}

const LEGE_INDICATIE: PrijsIndicatie = {
  m2_per_plaat: 0, totaal_m2: 0, range_laag: 0, range_hoog: 0,
  per_stuk_vanaf: 0, per_m2_laag: 0, per_m2_hoog: 0,
  verzending_gratis: false, verzend_drempel: 1750, verzend_kosten: 25,
}

// €/m² netjes weergeven (halve euro's toegestaan)
const euroM2 = (n: number) => n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const euro = (n: number) => n.toLocaleString('nl-NL')

// Kolommen die klanten mogen zien — bewust zonder inkoopprijzen en
// calculatiefactoren (fallback zolang de catalogus-views nog niet bestaan)
const BP_SAFE_COLS = 'id, naam, dikte_mm, breedte_mm, lengte_mm, beschikbaar, gallery_foto_url, volgorde'
const FN_SAFE_COLS = 'id, naam, voegmethodes, voeg_standaard, fk_advies, info, status_lang, status_kort, gallery_foto_url, volgorde'
const HPL_SAFE_COLS = 'id, kleur, hpl_afm_lang_b, hpl_afm_lang_l, hpl_afm_kort_b, hpl_afm_kort_l, info, status_lang, status_kort, gallery_foto_url'

function isUitgesloten(list: UitsluitingRow[], tA: string, idA: string, tB: string, idB: string) {
  return list.some(u =>
    (u.subject_type === tA && u.subject_id === idA && u.uitgesloten_type === tB && u.uitgesloten_id === idB) ||
    (u.subject_type === tB && u.subject_id === idB && u.uitgesloten_type === tA && u.uitgesloten_id === idA)
  )
}

// Returns true if the item is blocked by inclusions (i.e. inclusions exist for this subject+type combo but this item is not in the list)
function isNietIngesloten(list: InsluitingRow[], subjectType: string, subjectId: string, itemType: string, itemId: string): boolean {
  const relevant = list.filter(u => u.subject_type === subjectType && u.subject_id === subjectId && u.ingesloten_type === itemType)
  if (relevant.length === 0) return false
  return !relevant.some(u => u.ingesloten_id === itemId)
}

// ─── Wood color map ──────────────────────────────────────────────────────────
const WOOD_COLORS: Record<string, string> = {
  'Okoumé': '#C4855A',
  'Mahonie': '#8B3A1C',
  'Berken': '#D4B896',
  'Eik': '#B8885A',
  'Teak': '#9B7040',
}

const HPL_COLORS: Record<string, string> = {
  'Wit (U1101)': '#F5F5F5',
  'Antraciet (U961)': '#3A3A3A',
  'Lichtgrijs (U763)': '#C0BDC0',
  'Eiken decor (D3436)': '#B8885A',
}

const VOEGMETHODES = [
  {
    id: 'gestolpt',
    label: 'Gestolpt',
    beschrijving: 'Rustig beeld met gespiegeld ritme',
    afbeelding: '/voegmethodes/gestolpt.jpg',
    uitleg: 'Fineervellen worden gespiegeld verwerkt. Dit geeft een herkenbaar patroon dat vaak bij fronten en zichtwerk wordt gekozen.',
  },
  {
    id: 'geschoven',
    label: 'Geschoven',
    beschrijving: 'Doorlopend nerfbeeld',
    afbeelding: '/voegmethodes/geschoven.jpg',
    uitleg: 'Fineervellen worden in dezelfde richting naast elkaar gelegd. Praktisch wanneer een rustige, lineaire uitstraling gewenst is.',
  },
  {
    id: 'mixmatch',
    label: 'Mix Match',
    beschrijving: 'Natuurlijk en minder repeterend',
    afbeelding: '/voegmethodes/mixmatch.jpg',
    uitleg: 'Vellen worden bewust gemixt zodat kleur- en nerfverschillen minder als patroon opvallen. Geschikt voor grotere vlakken.',
  },
  {
    id: 'gedraaid_geschoven',
    label: 'Gedraaid geschoven',
    beschrijving: 'Levendiger tekening',
    afbeelding: '/voegmethodes/gedraaid-geschoven.jpg',
    uitleg: 'Een combinatie van draaien en schuiven. Dit geeft een dynamischer beeld en vraagt extra aandacht bij zichtzijden.',
  },
]

const BASEPLAAT_GROUPS = [
  { key: 'multiplex', label: 'Multiplex', match: ['multiplex', 'berken', 'okoume', 'populier', 'garant'] },
  { key: 'mdf', label: 'MDF', match: ['mdf', 'vezel'] },
  { key: 'spaan', label: 'Spaanplaat', match: ['spaan'] },
  { key: 'overig', label: 'Overige plaatmaterialen', match: [] },
]

const FINEERKEUZE_OPTIONS = [
  { id: 'fabriek', label: 'Fabriek kiest', beschrijving: 'Kuiper kiest het mooiste fineer' },
  { id: 'foto_kuiper', label: "Foto van Kuiper", beschrijving: 'Wij sturen u een foto ter goedkeuring' },
  { id: 'foto_klant', label: 'Foto van klant', beschrijving: 'U stuurt ons een foto als referentie' },
  { id: 'persoonlijk', label: 'Persoonlijk uitzoeken', beschrijving: 'U komt langs om fineer te kiezen' },
]

const initialState: ConfiguratorState = {
  bewerkingen: [],
  invoer_modus: 'aantal',
  ruimte_indeling: 'geen',
  aantal: 1,
  ruimtes: [],
  prijs_per_stuk: 0,
  totaal_prijs: 0,
}

export default function ConfiguratorPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [state, setState] = useState<ConfiguratorState>(initialState)
  const [orderlijsten, setOrderlijsten] = useState<Orderlijst[]>([])
  const [newListNaam, setNewListNaam] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  const [m2Input, setM2Input] = useState('')
  const [openBaseplaatGroups, setOpenBaseplaatGroups] = useState<Record<string, boolean>>({
    multiplex: false,
    mdf: false,
    spaan: false,
    overig: false,
  })
  const [openAfmetingLengths, setOpenAfmetingLengths] = useState<Record<string, boolean>>({})
  const [voegInfoOpen, setVoegInfoOpen] = useState(false)

  // Catalog state — geladen uit Supabase; start leeg zodat productie-klanten
  // nooit (kort) demo-data zien. Seeds worden alleen in demo-modus gezet.
  const [baseplaten, setBaseplaten] = useState<Baseplaat[]>([])
  const [fineers, setFineers] = useState<Fineer[]>([])
  const [hplList, setHplList] = useState<HPL[]>([])
  const [bewerkingen, setBewerkingen] = useState<Bewerking[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [uitsluitingen, setUitsluitingen] = useState<UitsluitingRow[]>([])
  const [insluitingen, setInsluitingen] = useState<InsluitingRow[]>([])
  const [fotoZoom, setFotoZoom] = useState<{ url: string; naam: string } | null>(null)

  // Regels die al in de gekozen projectlijst zitten (getoond op stap 7)
  type LijstRegel = { id: string; basisplaat_id: string; categorie: string; fineer_voor: string | null; hpl_voor: string | null; aantal: number }
  const [lijstRegels, setLijstRegels] = useState<LijstRegel[]>([])

  useEffect(() => {
    const lijstId = state.orderlijst_id
    if (step !== 7 || !lijstId) { setLijstRegels([]); return }
    let cancelled = false
    async function laadLijstRegels() {
      const supabase = await getSupabase()
      if (!supabase) return
      const { data } = await supabase
        .from('orderlijst_regels')
        .select('id, basisplaat_id, categorie, fineer_voor, hpl_voor, aantal')
        .eq('orderlijst_id', lijstId)
        .order('id')
      if (!cancelled && data) setLijstRegels(data as LijstRegel[])
    }
    laadLijstRegels()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, state.orderlijst_id])

  // Prijs komt van de server (/api/prijs) — geen inkoopprijzen of marges in de browser
  const [indicatie, setIndicatie] = useState<PrijsIndicatie>(LEGE_INDICATIE)
  const [priceLoading, setPriceLoading] = useState(false)
  const [priceError, setPriceError] = useState(false)
  const [priceRetry, setPriceRetry] = useState(0)

  const plaatVoorPrijs = state.afmeting ?? state.basisplaat
  const priceKey = JSON.stringify({
    p: plaatVoorPrijs?.id ?? null,
    c: state.categorie ?? null,
    fv: state.fineer_voor?.id ?? null,
    ft: state.fineer_tegen?.id ?? null,
    hv: state.hpl_voor?.id ?? null,
    ht: state.hpl_tegen?.id ?? null,
    vg: state.voegmethode ?? null,
    fk: state.fineerkeuze ?? null,
    bw: state.bewerkingen.map(b => b.id),
    n: state.aantal,
  })

  useEffect(() => {
    const cfg = JSON.parse(priceKey)
    if (!cfg.p || !cfg.n || cfg.n <= 0) {
      setIndicatie(LEGE_INDICATIE)
      return
    }
    let cancelled = false
    setPriceLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/prijs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'configurator',
            config: {
              basisplaat_id: cfg.p,
              categorie: cfg.c,
              fineer_voor_id: cfg.fv,
              fineer_tegen_id: cfg.ft,
              hpl_voor_id: cfg.hv,
              hpl_tegen_id: cfg.ht,
              voegmethode: cfg.vg,
              fineerkeuze: cfg.fk,
              bewerking_ids: cfg.bw,
              aantal: cfg.n,
            },
          }),
        })
        if (res.ok) {
          const json = await res.json()
          if (!cancelled && json.indicatie) {
            setIndicatie(json.indicatie)
            setPriceError(false)
          }
        } else if (!cancelled) {
          setPriceError(true)
        }
      } catch {
        // Behoud de laatste bekende prijs, maar meld dat verversen mislukte
        if (!cancelled) setPriceError(true)
      }
      finally { if (!cancelled) setPriceLoading(false) }
    }, 350)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [priceKey, priceRetry])

  const getSupabase = useCallback(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url || url === 'https://your-project.supabase.co') return null
    const { createClient } = await import('@/lib/supabase/client')
    return createClient()
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = await getSupabase()
      if (!supabase) {
        // Demo-modus (geen Supabase-env): toon seed-data
        setBaseplaten(seedBaseplaten)
        setFineers(seedFineers)
        setHplList(seedHPL)
        setBewerkingen(seedBewerkingen)
        setOrderlijsten(seedOrderlijsten)
        setCatalogLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCatalogLoading(false); return }

      // Load orderlijsten
      const { data: lijsten } = await supabase
        .from('orderlijsten')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['actueel', 'concept'])
        .order('bijgewerkt_op', { ascending: false })
      if (lijsten) setOrderlijsten(lijsten)

      // Catalogus laden via veilige views (zonder inkoopprijzen).
      // Fallback naar basistabellen met expliciete veilige kolommen
      // zolang de views nog niet in Supabase zijn aangemaakt.
      async function fetchCatalog(sb: NonNullable<Awaited<ReturnType<typeof getSupabase>>>) {
        const [bp, fn, hpl] = await Promise.all([
          sb.from('catalogus_baseplaten').select('*').eq('beschikbaar', true).order('volgorde'),
          sb.from('catalogus_fineers').select('*').order('volgorde'),
          sb.from('catalogus_hpl').select('*').order('kleur'),
        ])
        if (!bp.error && !fn.error && !hpl.error) {
          return { bp: bp.data ?? [], fn: fn.data ?? [], hpl: hpl.data ?? [] }
        }
        const [bp2, fn2, hpl2] = await Promise.all([
          sb.from('baseplaten').select(BP_SAFE_COLS).eq('beschikbaar', true).order('volgorde'),
          sb.from('fineers').select(FN_SAFE_COLS).order('volgorde'),
          sb.from('hpl').select(HPL_SAFE_COLS).order('kleur'),
        ])
        return { bp: bp2.data ?? [], fn: fn2.data ?? [], hpl: hpl2.data ?? [] }
      }

      const [catalog, bwRes, uitRes, inslRes] = await Promise.all([
        fetchCatalog(supabase),
        supabase.from('bewerkingen').select('*').eq('beschikbaar', true).order('volgorde'),
        supabase.from('uitsluitingen').select('*'),
        supabase.from('insluitingen').select('*'),
      ])

      const bpData = catalog.bp as unknown as Baseplaat[]
      const fnData = catalog.fn as unknown as Fineer[]
      const hplData = catalog.hpl as unknown as HPL[]
      const bwData = (bwRes.data ?? []) as Bewerking[]

      // In productie tonen we uitsluitend database-rijen — nooit seed-data.
      // (Seed-IDs zijn geen UUIDs en zouden bij opslaan bovendien fouten geven.)
      setBaseplaten(bpData)
      setFineers(fnData)
      setHplList(hplData)
      setBewerkingen(bwData)
      if (uitRes.data) setUitsluitingen(uitRes.data as UitsluitingRow[])
      if (inslRes.data) setInsluitingen(inslRes.data as InsluitingRow[])
      if (bwData.length) {
        // Pre-select standaard bewerkingen for fresh configurations
        setState(s => s.bewerkingen.length === 0
          ? { ...s, bewerkingen: bwData.filter((b: Bewerking) => b.standaard_geselecteerd) }
          : s
        )
      }
      setCatalogLoading(false)
    }
    load()
  }, [getSupabase])

  const dimmedSteps = (state.categorie === 'kaal') ? [4, 5] : []

  function nextStep() {
    if (step === 3 && state.categorie === 'kaal') {
      setStep(6)
      return
    }
    if (step === 5 && state.categorie === 'kaal') {
      setStep(6)
      return
    }
    setStep(s => s + 1)
  }

  function prevStep() {
    if (step === 6 && state.categorie === 'kaal') {
      setStep(3)
      return
    }
    setStep(s => s - 1)
  }

  // Bewerkingen die met de huidige selectie beschikbaar/toegestaan zijn
  function zichtbareBewerkingen(): Bewerking[] {
    return bewerkingen.filter(b =>
      b.beschikbaar &&
      (!state.categorie || b.compatibiliteit.includes(state.categorie)) &&
      (!state.afmeting || !isUitgesloten(uitsluitingen, 'basisplaat', state.afmeting.id, 'bewerking', b.id)) &&
      (!state.afmeting || !isNietIngesloten(insluitingen, 'basisplaat', state.afmeting.id, 'bewerking', b.id)) &&
      (!state.fineer_voor || !isUitgesloten(uitsluitingen, 'fineer', state.fineer_voor.id, 'bewerking', b.id)) &&
      (!state.fineer_voor || !isNietIngesloten(insluitingen, 'fineer', state.fineer_voor.id, 'bewerking', b.id)) &&
      (!state.hpl_voor || !isUitgesloten(uitsluitingen, 'hpl', state.hpl_voor.id, 'bewerking', b.id)) &&
      (!state.hpl_voor || !isNietIngesloten(insluitingen, 'hpl', state.hpl_voor.id, 'bewerking', b.id))
    )
  }

  function canNext(): boolean {
    if (step === 0) return !!state.orderlijst_id
    if (step === 1) return !!state.basisplaat
    if (step === 2) return !!state.afmeting
    if (step === 3) return !!state.categorie
    if (step === 4) {
      if (state.categorie === 'fineer') {
        return !!state.fineer_voor && !!state.voegmethode && !!state.fineerkeuze
          // Snijwijze is verplicht zodra het gekozen fineer opties heeft
          && (!(state.fineer_voor.snijwijzes?.length) || !!state.snijwijze)
      }
      if (state.categorie === 'hpl') return !!state.hpl_voor
    }
    if (step === 5) {
      // Elk keuzepaar (Gezaagd/Ongezaagd, Geschuurd/Ongeschuurd) vereist een keuze
      const groepen = new Map<string, Bewerking[]>()
      zichtbareBewerkingen().forEach(b => {
        if (b.keuzegroep) groepen.set(b.keuzegroep, [...(groepen.get(b.keuzegroep) ?? []), b])
      })
      for (const opties of groepen.values()) {
        if (opties.length >= 2 && !opties.some(o => state.bewerkingen.some(sb => sb.id === o.id))) {
          return false
        }
      }
      return true
    }
    if (step === 6) return state.aantal > 0
    return true
  }

  // Na een selectie automatisch doorscrollen naar de Volgende-knop onderaan
  function scrollNaarVolgende() {
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }, 150)
  }

  function selectAfmeting(p: Baseplaat) {
    setOpenAfmetingLengths(groups => ({ ...groups, [String(p.lengte_mm)]: true }))
    scrollNaarVolgende()
    setState(s => {
      const newState = { ...s, afmeting: p, basisplaat: p }
      newState.bewerkingen = s.bewerkingen.filter(b =>
        !isUitgesloten(uitsluitingen, 'basisplaat', p.id, 'bewerking', b.id) &&
        !isNietIngesloten(insluitingen, 'basisplaat', p.id, 'bewerking', b.id)
      )
      if (s.fineer_voor && (isUitgesloten(uitsluitingen, 'basisplaat', p.id, 'fineer', s.fineer_voor.id) || isNietIngesloten(insluitingen, 'basisplaat', p.id, 'fineer', s.fineer_voor.id)))
        newState.fineer_voor = undefined
      if (s.fineer_tegen && (isUitgesloten(uitsluitingen, 'basisplaat', p.id, 'fineer', s.fineer_tegen.id) || isNietIngesloten(insluitingen, 'basisplaat', p.id, 'fineer', s.fineer_tegen.id)))
        newState.fineer_tegen = undefined
      if (s.hpl_voor && (isUitgesloten(uitsluitingen, 'basisplaat', p.id, 'hpl', s.hpl_voor.id) || isNietIngesloten(insluitingen, 'basisplaat', p.id, 'hpl', s.hpl_voor.id)))
        newState.hpl_voor = undefined
      if (s.hpl_tegen && (isUitgesloten(uitsluitingen, 'basisplaat', p.id, 'hpl', s.hpl_tegen.id) || isNietIngesloten(insluitingen, 'basisplaat', p.id, 'hpl', s.hpl_tegen.id)))
        newState.hpl_tegen = undefined
      return newState
    })
  }

  async function saveRegel(keepListForNext?: boolean) {
    if (!state.orderlijst_id || !state.basisplaat || !state.afmeting) {
      toast.error('Onvolledige configuratie')
      return
    }
    if (priceLoading || indicatie.range_hoog <= 0) {
      toast.error('Prijs wordt nog berekend — probeer het zo opnieuw')
      return
    }
    const supabase = await getSupabase()
    if (supabase) {
      // Opslaan gebeurt server-side: daar wordt de exacte prijs berekend
      // en direct in de orderlijst geschreven (RLS: alleen eigen lijsten).
      const res = await fetch('/api/prijs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'opslaan',
          orderlijst_id: state.orderlijst_id,
          config: {
            basisplaat_id: (state.afmeting ?? state.basisplaat).id,
            categorie: state.categorie,
            fineer_voor_id: state.fineer_voor?.id ?? null,
            fineer_tegen_id: state.fineer_tegen?.id ?? null,
            hpl_voor_id: state.hpl_voor?.id ?? null,
            hpl_tegen_id: state.hpl_tegen?.id ?? null,
            voegmethode: state.voegmethode ?? null,
            fineerkeuze: state.fineerkeuze ?? null,
            fineerkeuze_datum: state.fineerkeuze_datum ?? null,
            snijwijze: state.snijwijze ?? null,
            bewerking_ids: (state.bewerkingen ?? []).map(b => b.id),
            ruimte_indeling: state.ruimte_indeling ?? 'geen',
            ruimtes: state.ruimtes ?? [],
            aantal: state.aantal,
          },
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error('Opslaan mislukt: ' + (json.error ?? 'onbekende fout'))
        return
      }
    }
    toast.success(`Regel toegevoegd aan "${state.orderlijst_naam ?? 'Projectlijst'}"`)
    if (keepListForNext) {
      const keepList = { orderlijst_id: state.orderlijst_id, orderlijst_naam: state.orderlijst_naam }
      setState({ ...initialState, ...keepList })
      setStep(1)
    } else {
      setState(initialState)
      setStep(0)
      router.push('/dashboard?tab=orderlijst')
    }
  }

  function handleAddToList() { saveRegel(false) }
  function handleAddAndNew() { saveRegel(true) }

  function handleReset() {
    setState(initialState)
    setStep(0)
  }

  async function createNewOrderlijst() {
    if (!newListNaam.trim()) return
    const supabase = await getSupabase()
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('orderlijsten')
          .insert({ user_id: user.id, naam: newListNaam.trim(), status: 'actueel' })
          .select()
          .single()
        if (error) { toast.error('Aanmaken mislukt: ' + error.message); return }
        if (data) {
          setOrderlijsten(l => [data, ...l])
          setState(s => ({ ...s, orderlijst_id: data.id, orderlijst_naam: data.naam }))
          setNewListNaam('')
          setCreatingList(false)
          return
        }
      }
    }
    // Demo fallback
    const newList: Orderlijst = {
      id: `ol-${Date.now()}`, user_id: 'demo-user', naam: newListNaam.trim(),
      status: 'actueel', aangemaakt_op: new Date().toISOString(), bijgewerkt_op: new Date().toISOString(),
    }
    setOrderlijsten(l => [newList, ...l])
    setState(s => ({ ...s, orderlijst_id: newList.id, orderlijst_naam: newList.naam }))
    setNewListNaam('')
    setCreatingList(false)
  }

  // Group baseplaten by name
  const baseplatenByNaam = baseplaten.reduce<Record<string, Baseplaat[]>>((acc, p) => {
    if (!acc[p.naam]) acc[p.naam] = []
    acc[p.naam].push(p)
    return acc
  }, {})

  const baseplaatGroupEntries = BASEPLAAT_GROUPS.map(group => {
    const entries = Object.entries(baseplatenByNaam).filter(([naam]) => {
      const lower = naam.toLowerCase()
      if (group.key === 'overig') {
        return !BASEPLAAT_GROUPS.some(other =>
          other.key !== 'overig' && other.match.some(term => lower.includes(term))
        )
      }
      return group.match.some(term => lower.includes(term))
    })
    return { ...group, entries }
  }).filter(group => group.entries.length > 0)

  // Group afmetingen by lang/kort
  const isLang = state.afmeting ? state.afmeting.lengte_mm > 2800 : false

  return (
    <>
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Stepper */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 overflow-x-auto">
        <StepStepper currentStep={step} totalSteps={8} dimmedSteps={dimmedSteps} />
      </div>

      {/* Card */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm">
        {/* ─── STEP 0: Orderlijst kiezen ─── */}
        {step === 0 && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Projectlijst kiezen</h2>
            <p className="text-sm text-gray-500 mb-6">Selecteer een bestaand project of maak een nieuwe projectlijst aan.</p>

            <div className="space-y-3 mb-4">
              {orderlijsten.filter(l => l.status === 'actueel' || l.status === 'concept').map(lijst => (
                <button
                  key={lijst.id}
                  onClick={() => setState(s => ({ ...s, orderlijst_id: lijst.id, orderlijst_naam: lijst.naam }))}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all
                    ${state.orderlijst_id === lijst.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'}`}
                >
                  <div>
                    <p className="font-semibold text-gray-800">{lijst.naam}</p>
                    <p className="text-xs text-gray-400">{new Date(lijst.bijgewerkt_op).toLocaleDateString('nl-NL')}</p>
                  </div>
                  <Badge variant={lijst.status === 'actueel' ? 'active' : 'concept'}>
                    {lijst.status}
                  </Badge>
                </button>
              ))}
            </div>

            {!creatingList ? (
              <button
                onClick={() => setCreatingList(true)}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                + Nieuwe projectlijst aanmaken
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newListNaam}
                  onChange={e => setNewListNaam(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createNewOrderlijst() }}
                  placeholder="Projectnaam of referentie"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={createNewOrderlijst}
                  disabled={!newListNaam.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40"
                >
                  Aanmaken
                </button>
                <button onClick={() => setCreatingList(false)} className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── STEP 1: Basisplaat ─── */}
        {step === 1 && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Kies een basisplaat</h2>
            <p className="text-sm text-gray-500 mb-4">
              Open de materiaalgroep die past bij uw werk. Na de materiaalkeuze kiest u dikte en plaatafmeting.
            </p>

            {catalogLoading && (
              <div className="text-center py-10 text-gray-400 text-sm">
                Catalogus laden…
              </div>
            )}
            {!catalogLoading && baseplaten.length === 0 && (
              <div className="text-center py-10 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800 font-medium mb-1">De catalogus kon niet worden geladen.</p>
                <p className="text-xs text-amber-700">Vernieuw de pagina of probeer het later opnieuw.</p>
              </div>
            )}

            <div className="space-y-3">
              {baseplaatGroupEntries.map(group => (
                <section key={group.key} className="rounded-lg border border-stone-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenBaseplaatGroups(groups => ({ ...groups, [group.key]: !groups[group.key] }))}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50 rounded-lg"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-stone-900">{group.label}</span>
                      <span className="text-xs text-stone-500">{group.entries.length} materiaalsoort{group.entries.length !== 1 ? 'en' : ''}</span>
                    </span>
                    <svg className={`w-4 h-4 text-stone-500 transition-transform ${openBaseplaatGroups[group.key] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openBaseplaatGroups[group.key] && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 pt-0">
                      {group.entries.map(([naam, variants]) => {
                        const isSelected = state.basisplaat?.naam === naam
                        const diktes = [...new Set(variants.map(v => v.dikte_mm))].sort((a, b) => a - b)
                        return (
                          <button
                            key={naam}
                            onClick={() => {
                              setOpenAfmetingLengths({})
                              setState(s => ({ ...s, basisplaat: variants[0], afmeting: undefined }))
                              scrollNaarVolgende()
                            }}
                            className={`relative p-3 rounded-lg border text-left transition-all hover:shadow-sm
                              ${isSelected ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-stone-200 hover:border-[var(--color-primary-muted)]'}`}
                          >
                            {variants[0]?.gallery_foto_url ? (
                              <img
                                src={variants[0].gallery_foto_url}
                                alt={naam}
                                className="w-full h-20 object-cover rounded-md mb-2 border border-stone-100"
                              />
                            ) : (
                              <div className="h-20 rounded-md mb-2 border border-stone-100 bg-gradient-to-br from-stone-100 to-amber-100" />
                            )}
                            <p className="font-semibold text-stone-900 text-sm">{naam}</p>
                            <p className="text-xs text-stone-500 mt-0.5">{diktes.join(', ')} mm beschikbaar</p>
                            {isSelected && (
                              <div className="absolute top-2 right-2 w-5 h-5 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        )}

        {/* ─── STEP 2: Afmetingen ─── */}
        {step === 2 && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Kies afmetingen</h2>
            <p className="text-sm text-gray-500 mb-6">Selecteer de dikte en plaatgrootte.</p>

            {(() => {
              const plaatVariants = baseplaten
                .filter(p => p.naam === state.basisplaat?.naam)
                .sort((a, b) => a.lengte_mm - b.lengte_mm || a.dikte_mm - b.dikte_mm || a.breedte_mm - b.breedte_mm)
              const lengthGroups = Object.entries(
                plaatVariants.reduce<Record<string, Baseplaat[]>>((acc, p) => {
                  const key = String(p.lengte_mm)
                  if (!acc[key]) acc[key] = []
                  acc[key].push(p)
                  return acc
                }, {})
              ).sort(([a], [b]) => Number(a) - Number(b))

              return (
                <div className="space-y-3">
                  {lengthGroups.map(([lengthKey, variants]) => {
                    const lengthMm = Number(lengthKey)
                    const isOpen = !!openAfmetingLengths[lengthKey]
                    const hasSelected = variants.some(p => state.afmeting?.id === p.id)
                    const labelCm = Number.isInteger(lengthMm / 10)
                      ? `${lengthMm / 10} cm`
                      : `${(lengthMm / 10).toFixed(1)} cm`

                    return (
                      <section key={lengthKey} className="rounded-lg border border-stone-200 bg-white">
                        <button
                          type="button"
                          onClick={() => setOpenAfmetingLengths(groups => ({ ...groups, [lengthKey]: !groups[lengthKey] }))}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50 rounded-lg"
                        >
                          <span>
                            <span className="block text-sm font-semibold text-stone-900">
                              Lengte {labelCm}
                              {hasSelected && <span className="ml-2 text-xs font-normal text-blue-600">geselecteerd</span>}
                            </span>
                            <span className="text-xs text-stone-500">
                              {variants.length} plaatvariant{variants.length !== 1 ? 'en' : ''}
                            </span>
                          </span>
                          <svg className={`w-4 h-4 text-stone-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isOpen && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 pt-0">
                            {variants.map(p => {
                              const isSelected = state.afmeting?.id === p.id
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => selectAfmeting(p)}
                                  className={`p-4 rounded-xl border-2 text-left transition-all
                                    ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                                >
                                  <p className="text-2xl font-bold text-gray-800">{p.dikte_mm}<span className="text-base font-normal">mm</span></p>
                                  <p className="text-xs text-gray-500 mt-0.5">{p.lengte_mm}×{p.breedte_mm}mm</p>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </section>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}

        {/* ─── STEP 3: Categorie ─── */}
        {step === 3 && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Kies categorie</h2>
            <p className="text-sm text-gray-500 mb-6">Hoe wilt u de plaat afwerken?</p>
            <div className="grid grid-cols-3 gap-4">
              {([
                { id: 'kaal',  label: 'Kaal',   beschrijving: 'Onbehandeld basismateriaal', swatch: '#D1D5DB' },
                { id: 'fineer', label: 'Fineer', beschrijving: 'Natuurlijk houtfineer',      swatch: '#D4B896' },
                { id: 'hpl',   label: 'HPL',    beschrijving: 'High Pressure Laminate',      swatch: '#F0EDE8' },
              ] as const).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setState(s => ({ ...s, categorie: cat.id }))}
                  className={`p-5 rounded-xl border-2 text-center transition-all hover:shadow-sm
                    ${state.categorie === cat.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                >
                  <div className="w-10 h-10 rounded-lg mx-auto mb-3 border border-gray-200" style={{ backgroundColor: cat.swatch }} />
                  <p className="font-semibold text-gray-800">{cat.label}</p>
                  <p className="text-xs text-gray-400 mt-1">{cat.beschrijving}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── STEP 4: Fineer / HPL ─── */}
        {step === 4 && (
          <div className="p-6 space-y-6">
            {state.categorie === 'fineer' && (
              <>
                <h2 className="text-xl font-bold text-gray-800">Fineer instellen</h2>

                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                  ℹ️ Fineer is een natuurproduct. Kleur en nerf op de foto zijn indicatief — elk vel fineer is uniek van kleur en tekening.
                </div>

                {/* Voorzijde / Tegenzijde */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Voorzijde</label>
                    <select
                      value={state.fineer_voor?.id ?? ''}
                      onChange={e => {
                        const f = fineers.find(fn => fn.id === e.target.value)
                        // Snijwijze reset: opties verschillen per houtsoort
                        setState(s => ({ ...s, fineer_voor: f, snijwijze: undefined }))
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">— Geen fineer —</option>
                      {fineers.filter(f =>
                        (f.status_lang !== 'niet_beschikbaar' || f.status_kort !== 'niet_beschikbaar') &&
                        (!state.afmeting || !isUitgesloten(uitsluitingen, 'basisplaat', state.afmeting.id, 'fineer', f.id)) &&
                        (!state.afmeting || !isNietIngesloten(insluitingen, 'basisplaat', state.afmeting.id, 'fineer', f.id))
                      ).map(f => (
                        <option key={f.id} value={f.id}>{f.naam}</option>
                      ))}
                    </select>
                    {state.fineer_voor && (
                      <div className="mt-3 relative group w-fit">
                        {state.fineer_voor.gallery_foto_url ? (
                          <img src={state.fineer_voor.gallery_foto_url} alt={state.fineer_voor.naam} className="w-32 h-32 rounded-lg border border-gray-200 object-cover" />
                        ) : (
                          <div className="w-32 h-32 rounded-lg border border-gray-200" style={{ backgroundColor: WOOD_COLORS[state.fineer_voor.naam] ?? '#D4B896' }} />
                        )}
                        {state.fineer_voor.gallery_foto_url && (
                          <button
                            onClick={() => setFotoZoom({ url: state.fineer_voor!.gallery_foto_url!, naam: state.fineer_voor!.naam })}
                            className="absolute top-1.5 right-1.5 bg-white/80 hover:bg-white rounded-full p-1 shadow transition-opacity opacity-0 group-hover:opacity-100"
                            title="Vergroot"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tegenzijde</label>
                    <select
                      value={state.fineer_tegen?.id ?? ''}
                      onChange={e => {
                        const f = fineers.find(fn => fn.id === e.target.value)
                        setState(s => ({ ...s, fineer_tegen: f }))
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">— Geen fineer —</option>
                      {fineers.filter(f =>
                        (!state.afmeting || !isUitgesloten(uitsluitingen, 'basisplaat', state.afmeting.id, 'fineer', f.id)) &&
                        (!state.afmeting || !isNietIngesloten(insluitingen, 'basisplaat', state.afmeting.id, 'fineer', f.id))
                      ).map(f => (
                        <option key={f.id} value={f.id}>{f.naam}</option>
                      ))}
                    </select>
                    {state.fineer_tegen && (
                      <div className="mt-3 relative group w-fit">
                        {state.fineer_tegen.gallery_foto_url ? (
                          <img src={state.fineer_tegen.gallery_foto_url} alt={state.fineer_tegen.naam} className="w-32 h-32 rounded-lg border border-gray-200 object-cover" />
                        ) : (
                          <div className="w-32 h-32 rounded-lg border border-gray-200" style={{ backgroundColor: WOOD_COLORS[state.fineer_tegen.naam] ?? '#D4B896' }} />
                        )}
                        {state.fineer_tegen.gallery_foto_url && (
                          <button
                            onClick={() => setFotoZoom({ url: state.fineer_tegen!.gallery_foto_url!, naam: state.fineer_tegen!.naam })}
                            className="absolute top-1.5 right-1.5 bg-white/80 hover:bg-white rounded-full p-1 shadow transition-opacity opacity-0 group-hover:opacity-100"
                            title="Vergroot"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Voegmethode */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <label className="block text-sm font-semibold text-gray-700">Voegmethode *</label>
                    <button
                      type="button"
                      onClick={() => setVoegInfoOpen(open => !open)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Welke voegmethode?
                    </button>
                  </div>
                  {voegInfoOpen && (
                    <div className="mb-3 grid sm:grid-cols-2 gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                      {VOEGMETHODES.map(vm => (
                        <article key={vm.id} className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                          <img src={vm.afbeelding} alt={vm.label} className="w-full h-28 object-cover" />
                          <div className="p-3">
                            <p className="text-sm font-semibold text-stone-900">{vm.label}</p>
                            <p className="text-xs text-stone-600 mt-1">{vm.uitleg}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {VOEGMETHODES.filter(vm =>
                      !state.fineer_voor || state.fineer_voor.voegmethodes.includes(vm.id)
                    ).map(vm => {
                      const isStandaard = state.fineer_voor?.voeg_standaard === vm.id
                      return (
                        <button
                          key={vm.id}
                          onClick={() => setState(s => ({ ...s, voegmethode: vm.id }))}
                          className={`p-3 rounded-xl border-2 text-left relative transition-all
                            ${state.voegmethode === vm.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-gray-200 hover:border-[var(--color-primary-muted)]'}`}
                        >
                          {isStandaard && (
                            <span className="absolute top-1.5 right-1.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Standaard</span>
                          )}
                          <p className="font-medium text-sm text-gray-800">{vm.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{vm.beschrijving}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Fineerkeuze */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-semibold text-gray-700">Fineerkeuze *</label>
                    <span className="text-xs text-red-500">(verplicht)</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {FINEERKEUZE_OPTIONS.map(opt => {
                      const isAdvised = state.fineer_voor?.fk_advies === opt.id
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setState(s => ({
                            ...s,
                            fineerkeuze: opt.id as ConfiguratorState['fineerkeuze'],
                            fineerkeuze_datum: opt.id !== 'persoonlijk' ? undefined : s.fineerkeuze_datum,
                          }))}
                          className={`p-3 rounded-xl border-2 text-left relative transition-all
                            ${state.fineerkeuze === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                        >
                          {isAdvised && (
                            <span className="absolute top-1.5 right-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Aanbevolen</span>
                          )}
                          <p className="font-medium text-sm text-gray-800">{opt.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{opt.beschrijving}</p>
                        </button>
                      )
                    })}
                  </div>
                  {state.fineerkeuze === 'persoonlijk' && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Datum inplannen</label>
                      <input
                        type="date"
                        value={state.fineerkeuze_datum ?? ''}
                        onChange={e => setState(s => ({ ...s, fineerkeuze_datum: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
                    <p className="font-semibold mb-0.5">Let op: foto ter indicatie</p>
                    <p>De foto op de webshop is ter indicatie. Elke boom is anders, dus het eindresultaat kan afwijken. Mocht u willen weten welke stam Kuiper gebruikt, vraag dan om een foto met de keuze hierboven.</p>
                  </div>
                </div>

                {/* Snijwijze (Quartier / Dosse) — alleen als het gekozen fineer opties heeft */}
                {(state.fineer_voor?.snijwijzes?.length ?? 0) > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-semibold text-gray-700">Snijwijze *</label>
                      <span className="text-xs text-red-500">(verplicht)</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {(state.fineer_voor?.snijwijzes ?? []).map(sw => {
                        const isAdvies = (state.fineer_voor?.snijwijze_advies ?? []).includes(sw)
                        const label = sw === 'quartier' ? 'Quartier' : 'Dosse'
                        const beschrijving = sw === 'quartier'
                          ? 'Kwartiers gesneden — strak, rechtlijnig nerfbeeld'
                          : 'Op dosse gesneden — levendige vlamtekening'
                        return (
                          <button
                            key={sw}
                            onClick={() => setState(s => ({ ...s, snijwijze: sw as 'quartier' | 'dosse' }))}
                            className={`p-3 rounded-xl border-2 text-left relative transition-all
                              ${state.snijwijze === sw ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                          >
                            {isAdvies && (
                              <span className="absolute top-1.5 right-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Aanbevolen</span>
                            )}
                            <p className="font-medium text-sm text-gray-800">{label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{beschrijving}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {state.categorie === 'hpl' && (
              <>
                <h2 className="text-xl font-bold text-gray-800">HPL instellen</h2>

                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                  ℹ️ HPL-prijs wordt berekend op basis van de plaatafmetingen van de HPL-leverancier (inclusief snijverlies).
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Voorzijde *</label>
                    <div className="space-y-2">
                      {hplList.filter(h =>
                        (!state.afmeting || !isUitgesloten(uitsluitingen, 'basisplaat', state.afmeting.id, 'hpl', h.id)) &&
                        (!state.afmeting || !isNietIngesloten(insluitingen, 'basisplaat', state.afmeting.id, 'hpl', h.id))
                      ).map(h => {
                        const isSelected = state.hpl_voor?.id === h.id
                        return (
                          <button
                            key={h.id}
                            onClick={() => setState(s => ({ ...s, hpl_voor: h }))}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all
                              ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                          >
                            {h.gallery_foto_url ? (
                              <img src={h.gallery_foto_url} alt={h.kleur} className="w-8 h-8 rounded border border-gray-300 shrink-0 object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded border border-gray-300 shrink-0" style={{ backgroundColor: HPL_COLORS[h.kleur] ?? '#ccc' }} />
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-800">{h.kleur}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tegenzijde (optioneel)</label>
                    <div className="space-y-2">
                      <button
                        onClick={() => setState(s => ({ ...s, hpl_tegen: undefined }))}
                        className={`w-full p-2.5 rounded-xl border-2 text-sm text-left transition-all text-gray-400
                          ${!state.hpl_tegen ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        — Geen tegenzijde —
                      </button>
                      {hplList.filter(h =>
                        (!state.afmeting || !isUitgesloten(uitsluitingen, 'basisplaat', state.afmeting.id, 'hpl', h.id)) &&
                        (!state.afmeting || !isNietIngesloten(insluitingen, 'basisplaat', state.afmeting.id, 'hpl', h.id))
                      ).map(h => {
                        const isSelected = state.hpl_tegen?.id === h.id
                        return (
                          <button
                            key={h.id}
                            onClick={() => setState(s => ({ ...s, hpl_tegen: h }))}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all
                              ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                          >
                            {h.gallery_foto_url ? (
                              <img src={h.gallery_foto_url} alt={h.kleur} className="w-8 h-8 rounded border border-gray-300 shrink-0 object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded border border-gray-300 shrink-0" style={{ backgroundColor: HPL_COLORS[h.kleur] ?? '#ccc' }} />
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-800">{h.kleur}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── STEP 5: Bewerkingen ─── */}
        {step === 5 && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Bewerkingen</h2>
            <p className="text-sm text-gray-500 mb-6">Selecteer gewenste bewerkingen (optioneel).</p>

            {state.bewerkingen.some(b => b.naam === 'Zaagwerk') && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 mb-4">
                📐 <strong>Zaagwerk geselecteerd:</strong> Netto maat = breedte −10mm × lengte −20mm (op basis van uw afmetingen)
              </div>
            )}

            {(() => {
              const zichtbaar = zichtbareBewerkingen()
              const groepen = new Map<string, Bewerking[]>()
              const los: Bewerking[] = []
              zichtbaar.forEach(b => {
                if (b.keuzegroep) groepen.set(b.keuzegroep, [...(groepen.get(b.keuzegroep) ?? []), b])
                else los.push(b)
              })

              const bewerkingKaart = (b: Bewerking, isSelected: boolean, onClick: () => void) => (
                <button
                  key={b.id}
                  onClick={onClick}
                  className={`p-4 rounded-xl border-2 text-left transition-all relative
                    ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{b.naam}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{b.beschrijving}</p>
                    </div>
                    {b.prijs > 0 && (
                      <div className="shrink-0 ml-2">
                        <span className="text-sm font-bold text-blue-600">
                          + € {b.prijs.toFixed(2)}{(b.prijs_type ?? 'per_m2') === 'per_order' ? '/order' : '/m²'}
                        </span>
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              )

              return (
                <>
                  {/* Keuzeparen: precies één optie per groep verplicht */}
                  {[...groepen.entries()].map(([groep, opties]) => {
                    const geenKeuze = !opties.some(o => state.bewerkingen.some(sb => sb.id === o.id))
                    return (
                      <div key={groep} className="mb-5">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-semibold text-gray-700 capitalize">{groep}</label>
                          <span className="text-xs text-red-500">(maak een keuze)</span>
                          {geenKeuze && opties.length >= 2 && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">nog niet gekozen</span>
                          )}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {opties.map(b => {
                            const isSelected = state.bewerkingen.some(sb => sb.id === b.id)
                            return bewerkingKaart(b, isSelected, () => setState(s => ({
                              ...s,
                              // Exclusief binnen de groep: de andere optie vervalt
                              bewerkingen: [
                                ...s.bewerkingen.filter(sb => !opties.some(o => o.id === sb.id)),
                                b,
                              ],
                            })))
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {/* Overige (optionele) bewerkingen */}
                  {los.length > 0 && (
                    <>
                      {groepen.size > 0 && (
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Extra bewerkingen (optioneel)</label>
                      )}
                      <div className="grid sm:grid-cols-2 gap-3">
                        {los.map(b => {
                          const isSelected = state.bewerkingen.some(sb => sb.id === b.id)
                          return bewerkingKaart(b, isSelected, () => setState(s => ({
                            ...s,
                            bewerkingen: isSelected
                              ? s.bewerkingen.filter(sb => sb.id !== b.id)
                              : [...s.bewerkingen, b],
                          })))
                        })}
                      </div>
                    </>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {/* ─── STEP 6: Aantal & m² ─── */}
        {step === 6 && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Aantal & m²</h2>
            <p className="text-sm text-gray-500 mb-6">Hoeveel platen heeft u nodig?</p>

            {/* Invoer modus toggle */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
              {(['aantal', 'm2'] as const).map(modus => (
                <button
                  key={modus}
                  onClick={() => setState(s => ({ ...s, invoer_modus: modus }))}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
                    ${state.invoer_modus === modus ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {modus === 'aantal' ? 'Aantal platen' : 'Vierkante meters'}
                </button>
              ))}
            </div>

            {/* Ruimte indeling */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Ruimte-indeling</label>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 mb-3">
                💡 <strong>Tip:</strong> deel uw platen in per ruimte (bijv. keuken, woonkamer,
                slaapkamer). Wij houden het fineer dan per ruimte bij elkaar, zodat de
                houttekening en kleur binnen één ruimte altijd mooi op elkaar aansluiten
                en u geen kleurverschil krijgt.
              </div>
              <div className="flex gap-2">
                {(['geen', 'per_ruimte'] as const).map(ind => (
                  <button
                    key={ind}
                    onClick={() => setState(s => ({ ...s, ruimte_indeling: ind, ruimtes: ind === 'geen' ? [] : s.ruimtes }))}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all
                      ${state.ruimte_indeling === ind ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                  >
                    {ind === 'geen' ? 'Geen indeling' : 'Per ruimte'}
                  </button>
                ))}
              </div>
            </div>

            {state.ruimte_indeling === 'geen' && (
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => setState(s => ({ ...s, aantal: Math.max(1, s.aantal - 1) }))}
                  className="w-10 h-10 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-xl flex items-center justify-center"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={state.invoer_modus === 'aantal' ? state.aantal : m2Input}
                  onChange={e => {
                    if (state.invoer_modus === 'aantal') {
                      setState(s => ({ ...s, aantal: Math.max(1, parseInt(e.target.value) || 1) }))
                    } else {
                      setM2Input(e.target.value)
                      const m2 = parseFloat(e.target.value) || 0
                      const m2pp = indicatie.m2_per_plaat
                      // Zolang de plaat-m² nog niet bekend is (prijs laadt),
                      // niet omrekenen — anders klopt het aantal niet
                      if (m2pp > 0) {
                        setState(s => ({ ...s, aantal: Math.max(1, Math.ceil(m2 / m2pp)) }))
                      }
                    }
                  }}
                  className="w-24 text-center text-2xl font-bold border border-gray-300 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setState(s => ({ ...s, aantal: s.aantal + 1 }))}
                  className="w-10 h-10 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-xl flex items-center justify-center"
                >
                  +
                </button>
                <span className="text-sm text-gray-500">
                  {state.invoer_modus === 'aantal' ? 'platen' : 'm²'}
                </span>
              </div>
            )}

            {state.ruimte_indeling === 'per_ruimte' && (
              <div className="space-y-2 mb-4">
                {state.ruimtes.map((ruimte, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <input
                      type="text"
                      value={ruimte.naam}
                      onChange={e => {
                        const newRuimtes = [...state.ruimtes]
                        newRuimtes[i] = { ...newRuimtes[i], naam: e.target.value }
                        setState(s => ({ ...s, ruimtes: newRuimtes }))
                      }}
                      placeholder="Ruimtenaam"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      min={1}
                      value={ruimte.aantal}
                      onChange={e => {
                        const newRuimtes = [...state.ruimtes]
                        newRuimtes[i] = { ...newRuimtes[i], aantal: parseInt(e.target.value) || 1 }
                        const totalAantal = newRuimtes.reduce((sum, r) => sum + r.aantal, 0)
                        setState(s => ({ ...s, ruimtes: newRuimtes, aantal: totalAantal }))
                      }}
                      className="w-16 text-center px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={ruimte.afwerking}
                      onChange={e => {
                        const newRuimtes = [...state.ruimtes]
                        newRuimtes[i] = { ...newRuimtes[i], afwerking: e.target.value as RuimteRegel['afwerking'] }
                        setState(s => ({ ...s, ruimtes: newRuimtes }))
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="blankwerk">Blankwerk</option>
                      <option value="donker_gebeitst">Donker gebeitst</option>
                    </select>
                    <button
                      onClick={() => {
                        const newRuimtes = state.ruimtes.filter((_, j) => j !== i)
                        const totalAantal = newRuimtes.reduce((sum, r) => sum + r.aantal, 0)
                        setState(s => ({ ...s, ruimtes: newRuimtes, aantal: Math.max(1, totalAantal) }))
                      }}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {state.ruimtes.length < 20 && (
                  <button
                    onClick={() => {
                      const newRuimte: RuimteRegel = { naam: `Ruimte ${state.ruimtes.length + 1}`, aantal: 1, afwerking: 'blankwerk' }
                      const newRuimtes = [...state.ruimtes, newRuimte]
                      const totalAantal = newRuimtes.reduce((sum, r) => sum + r.aantal, 0)
                      setState(s => ({ ...s, ruimtes: newRuimtes, aantal: totalAantal }))
                    }}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                  >
                    + Ruimte toevoegen
                  </button>
                )}
              </div>
            )}

            {/* Green total bar */}
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs text-green-700 font-medium">Totaal platen</span>
                  <p className="text-xl font-bold text-green-800">{state.aantal}</p>
                </div>
                <div className="w-px h-8 bg-green-200" />
                <div>
                  <span className="text-xs text-green-700 font-medium">Totaal m²</span>
                  <p className="text-xl font-bold text-green-800">{indicatie.totaal_m2.toFixed(2)}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-green-700">Indicatieve richtprijs</span>
                <p className="text-lg font-bold text-green-800">
                  {indicatie.per_m2_hoog > 0
                    ? `€ ${euroM2(indicatie.per_m2_hoog)} / m²`
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 7: Overzicht & Prijs ─── */}
        {step === 7 && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Overzicht & prijs</h2>

            {/* Summary */}
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Configuratie</h3>
                <SummaryRow label="Projectlijst" value={state.orderlijst_naam ?? '-'} />
                <SummaryRow label="Basisplaat" value={state.afmeting ? `${state.afmeting.naam} ${state.afmeting.dikte_mm}mm` : '-'} />
                <SummaryRow label="Afmeting" value={state.afmeting ? `${state.afmeting.lengte_mm}×${state.afmeting.breedte_mm}mm` : '-'} />
                <SummaryRow label="Categorie" value={state.categorie ?? '-'} />
                {state.categorie === 'fineer' && (
                  <>
                    <SummaryRow label="Fineer voor" value={state.fineer_voor?.naam ?? 'Geen'} />
                    <SummaryRow label="Fineer tegen" value={state.fineer_tegen?.naam ?? 'Geen'} />
                    <SummaryRow label="Voegmethode" value={state.voegmethode ?? '-'} />
                    <SummaryRow label="Fineerkeuze" value={state.fineerkeuze ?? '-'} />
                    {state.snijwijze && <SummaryRow label="Snijwijze" value={state.snijwijze} />}
                  </>
                )}
                {state.categorie === 'hpl' && (
                  <>
                    <SummaryRow label="HPL voor" value={state.hpl_voor?.kleur ?? 'Geen'} />
                    <SummaryRow label="HPL tegen" value={state.hpl_tegen?.kleur ?? 'Geen'} />
                  </>
                )}
                <SummaryRow label="Bewerkingen" value={state.bewerkingen.length > 0 ? state.bewerkingen.map(b => b.naam).join(', ') : 'Geen'} />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Aantal</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setState(s => ({ ...s, aantal: Math.max(1, s.aantal - 1) }))}
                      className="w-7 h-7 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold flex items-center justify-center"
                    >−</button>
                    <span className="w-10 text-center font-semibold text-gray-800">{state.aantal}</span>
                    <button
                      onClick={() => setState(s => ({ ...s, aantal: s.aantal + 1 }))}
                      className="w-7 h-7 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold flex items-center justify-center"
                    >+</button>
                    <span className="text-gray-500">platen</span>
                  </div>
                </div>
                <SummaryRow label="Totaal m²" value={`${indicatie.totaal_m2.toFixed(2)} m²`} />
              </div>

              {/* Indicatieve richtprijs */}
              <div className="bg-gray-50 rounded-xl p-4 flex flex-col">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Uw richtprijs</h3>

                <div className="bg-white rounded-xl border border-blue-100 p-5 text-center mb-4">
                  <p className="text-xs text-gray-500 mb-1">Indicatieve richtprijs excl. BTW</p>
                  <p className={`text-2xl font-bold text-blue-700 ${priceLoading ? 'opacity-40' : ''}`}>
                    {indicatie.per_m2_hoog > 0
                      ? `€ ${euroM2(indicatie.per_m2_hoog)} / m²`
                      : priceError ? '—' : 'Wordt berekend…'}
                  </p>
                  {indicatie.totaal_m2 > 0 && (
                    <p className="text-sm text-gray-500 mt-1.5">
                      Totale oppervlakte: <strong>{indicatie.totaal_m2.toFixed(2)} m²</strong> ({state.aantal} platen)
                    </p>
                  )}
                  {priceError && !priceLoading && (
                    <div className="mt-2">
                      <p className="text-xs text-red-600 mb-1.5">
                        De prijs kon niet worden berekend.
                      </p>
                      <button
                        onClick={() => setPriceRetry(n => n + 1)}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Opnieuw proberen
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Verzending</span>
                    <span className={indicatie.verzending_gratis ? 'text-green-600 font-medium' : ''}>
                      {indicatie.verzending_gratis
                        ? 'Gratis'
                        : `€ ${euro(indicatie.verzend_kosten)}`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Gratis verzending vanaf € {euro(indicatie.verzend_drempel)}
                  </p>
                </div>

                <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-blue-700">
                    💡 Grotere aantallen verlagen de prijs per stuk.
                  </p>
                </div>

                <p className="text-xs text-gray-400 mt-auto pt-4">
                  Dit is een indicatieve richtprijs per m² excl. BTW. De definitieve
                  prijs ontvangt u in de offerte van Kuiper Holland.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleAddToList}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors"
              >
                ✓ Toevoegen aan projectlijst en bekijk totale lijst
              </button>
              <button
                onClick={handleAddAndNew}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
              >
                ➕ Voeg toe en configureer nog een plaat
              </button>
              <button
                onClick={handleReset}
                className="sm:w-auto py-3 px-5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl border border-red-200 transition-colors"
              >
                🗑️ Verwijder en begin opnieuw
              </button>
            </div>

            {/* Reeds toegevoegde regels in deze projectlijst */}
            {lijstRegels.length > 0 && (
              <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                  Al in &quot;{state.orderlijst_naam ?? 'deze projectlijst'}&quot; ({lijstRegels.length})
                </h3>
                <div className="space-y-2">
                  {lijstRegels.map((r, i) => {
                    const plaat = baseplaten.find(b => b.id === r.basisplaat_id)
                    const afwerking = r.categorie === 'fineer'
                      ? fineers.find(f => f.id === r.fineer_voor)?.naam ?? 'fineer'
                      : r.categorie === 'hpl'
                        ? hplList.find(h => h.id === r.hpl_voor)?.kleur ?? 'HPL'
                        : 'kaal'
                    return (
                      <div key={r.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2 text-sm">
                        <span className="text-gray-700 truncate">
                          <span className="text-gray-400 mr-1.5">#{i + 1}</span>
                          {plaat ? `${plaat.naam} ${plaat.dikte_mm}mm` : 'Plaat'} — {afwerking}
                        </span>
                        <span className="text-gray-500 shrink-0 ml-3">{r.aantal}×</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Navigation ─── */}
        {step < 7 && (
          <div className="px-6 pb-6 flex justify-between items-center border-t border-gray-100 pt-4">
            <button
              onClick={prevStep}
              disabled={step === 0}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Terug
            </button>
            <span className="text-xs text-gray-400">Stap {step + 1} van 8</span>
            <button
              onClick={nextStep}
              disabled={!canNext()}
              className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Volgende →
            </button>
          </div>
        )}
      </div>
    </div>

    {/* ─── Foto zoom modal ─── */}
    {fotoZoom && (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setFotoZoom(null)}>
        <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
          <img src={fotoZoom.url} alt={fotoZoom.naam} className="w-full rounded-2xl object-contain max-h-[80vh]" />
          <div className="absolute bottom-3 left-3 bg-black/50 text-white text-sm px-3 py-1 rounded-full">{fotoZoom.naam}</div>
          <button onClick={() => setFotoZoom(null)} className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg leading-none">✕</button>
        </div>
      </div>
    )}
    </>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 capitalize">{value}</span>
    </div>
  )
}
