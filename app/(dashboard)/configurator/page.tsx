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
  seedStaffelFineerHPL,
  seedStaffelKaal,
  seedOrderlijsten,
  seedInstellingen,
  seedVasteKosten,
} from '@/lib/seed-data'
import { calculatePrice } from '@/lib/pricing'
import type { ConfiguratorState, Baseplaat, Fineer, HPL, Bewerking, RuimteRegel, Orderlijst, PricingData, HotmeltCombinatie } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────
type UitsluitingRow = { id: string; subject_type: string; subject_id: string; uitgesloten_type: string; uitgesloten_id: string; reden: string | null }
type InsluitingRow = { id: string; subject_type: string; subject_id: string; ingesloten_type: string; ingesloten_id: string; reden: string | null }

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
  { id: 'gestolpt', label: 'Gestolpt', beschrijving: 'Nerven lopen parallel' },
  { id: 'geschoven', label: 'Geschoven', beschrijving: 'Nerven lopen tegengesteld' },
  { id: 'mixmatch', label: 'Mix Match', beschrijving: 'Willekeurige verdeling' },
  { id: 'gedraaid_geschoven', label: 'Gedraaid Geschoven', beschrijving: 'Gedraaid en tegengesteld' },
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

  // Catalog state — loaded from Supabase, fallback to seed
  const [baseplaten, setBaseplaten] = useState<Baseplaat[]>(seedBaseplaten)
  const [fineers, setFineers] = useState<Fineer[]>(seedFineers)
  const [hplList, setHplList] = useState<HPL[]>(seedHPL)
  const [bewerkingen, setBewerkingen] = useState<Bewerking[]>(seedBewerkingen)
  const [uitsluitingen, setUitsluitingen] = useState<UitsluitingRow[]>([])
  const [insluitingen, setInsluitingen] = useState<InsluitingRow[]>([])
  const [staffelFH, setStaffelFH] = useState(seedStaffelFineerHPL)
  const [staffelKaal, setStaffelKaal] = useState(seedStaffelKaal)
  const [verzendDrempel, setVerzendDrempel] = useState(1750)
  const [verzendKosten, setVerzendKosten] = useState(25)
  const [fineerlijm, setFineerlijm] = useState(seedVasteKosten.fineerlijm_per_m2)
  const [schuurbanden, setSchuurbanden] = useState(seedVasteKosten.schuurbanden_per_m2)
  const [hplLijm, setHplLijm] = useState(seedVasteKosten.hpl_lijm_per_m2)
  const [puHotmelt, setPuHotmelt] = useState(seedVasteKosten.pu_hotmelt_per_m2)
  const [hotmeltCombs, setHotmeltCombs] = useState<HotmeltCombinatie[]>([])
  const [fotoZoom, setFotoZoom] = useState<{ url: string; naam: string } | null>(null)

  const pricingData: PricingData = {
    staffel: state.categorie === 'kaal' ? staffelKaal : staffelFH,
    verzend_drempel: verzendDrempel,
    verzend_kosten: verzendKosten,
    fineerlijm_per_m2: fineerlijm,
    schuurbanden_per_m2: schuurbanden,
    hpl_lijm_per_m2: hplLijm,
    pu_hotmelt_per_m2: puHotmelt,
    hotmelt_combinaties: hotmeltCombs,
  }

  const priceResult = calculatePrice(state, pricingData)

  const getSupabase = useCallback(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url || url === 'https://your-project.supabase.co') return null
    const { createClient } = await import('@/lib/supabase/client')
    return createClient()
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = await getSupabase()
      if (!supabase) { setOrderlijsten(seedOrderlijsten); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setOrderlijsten(seedOrderlijsten); return }

      // Load orderlijsten
      const { data: lijsten } = await supabase
        .from('orderlijsten')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['actueel', 'concept'])
        .order('bijgewerkt_op', { ascending: false })
      if (lijsten) setOrderlijsten(lijsten)

      // Load catalog (baseplaten, fineers, hpl, bewerkingen)
      const [bpRes, fnRes, hplRes, bwRes, insRes, uitRes, inslRes, hmRes] = await Promise.all([
        supabase.from('baseplaten').select('*').eq('beschikbaar', true).order('volgorde'),
        supabase.from('fineers').select('*').order('volgorde'),
        supabase.from('hpl').select('*').order('kleur'),
        supabase.from('bewerkingen').select('*').eq('beschikbaar', true).order('volgorde'),
        supabase.from('instellingen').select('*'),
        supabase.from('uitsluitingen').select('*'),
        supabase.from('insluitingen').select('*'),
        supabase.from('hotmelt_combinaties').select('*'),
      ])

      if (bpRes.data?.length) setBaseplaten(bpRes.data)
      if (fnRes.data?.length) setFineers(fnRes.data)
      if (hplRes.data?.length) setHplList(hplRes.data)
      if (uitRes.data) setUitsluitingen(uitRes.data as UitsluitingRow[])
      if (inslRes.data) setInsluitingen(inslRes.data as InsluitingRow[])
      if (bwRes.data?.length) {
        setBewerkingen(bwRes.data)
        // Pre-select standaard bewerkingen for fresh configurations
        setState(s => s.bewerkingen.length === 0
          ? { ...s, bewerkingen: bwRes.data.filter((b: Bewerking) => b.standaard_geselecteerd) }
          : s
        )
      }
      if (insRes.data?.length) {
        const ins = insRes.data
        const get = (key: string, def: number) =>
          parseFloat(ins.find(i => i.sleutel === key)?.waarde ?? String(def))
        setVerzendDrempel(get('verzend_drempel', 1750))
        setVerzendKosten(get('verzend_kosten', 25))
        setFineerlijm(get('fineerlijm_per_m2', seedVasteKosten.fineerlijm_per_m2))
        setSchuurbanden(get('schuurbanden_per_m2', seedVasteKosten.schuurbanden_per_m2))
        setHplLijm(get('hpl_lijm_per_m2', seedVasteKosten.hpl_lijm_per_m2))
        setPuHotmelt(get('pu_hotmelt_per_m2', seedVasteKosten.pu_hotmelt_per_m2))
        const fhRaw = ins.find(i => i.sleutel === 'staffel_fineer_hpl')?.waarde
        const kaalRaw = ins.find(i => i.sleutel === 'staffel_kaal')?.waarde
        if (fhRaw) { try { setStaffelFH(JSON.parse(fhRaw)) } catch { /* keep seed */ } }
        if (kaalRaw) { try { setStaffelKaal(JSON.parse(kaalRaw)) } catch { /* keep seed */ } }
      }
      if (hmRes.data) setHotmeltCombs(hmRes.data as HotmeltCombinatie[])
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

  function canNext(): boolean {
    if (step === 0) return !!state.orderlijst_id
    if (step === 1) return !!state.basisplaat
    if (step === 2) return !!state.afmeting
    if (step === 3) return !!state.categorie
    if (step === 4) {
      if (state.categorie === 'fineer') {
        return !!state.fineer_voor && !!state.voegmethode && !!state.fineerkeuze
      }
      if (state.categorie === 'hpl') return !!state.hpl_voor
    }
    if (step === 6) return state.aantal > 0
    return true
  }

  async function saveRegel(keepListForNext?: boolean) {
    if (!state.orderlijst_id || !state.basisplaat || !state.afmeting) {
      toast.error('Onvolledige configuratie')
      return
    }
    const supabase = await getSupabase()
    if (supabase) {
      const { error } = await supabase.from('orderlijst_regels').insert({
        orderlijst_id: state.orderlijst_id,
        basisplaat_id: state.basisplaat.id,
        categorie: state.categorie,
        fineer_voor: state.fineer_voor?.id ?? null,
        fineer_tegen: state.fineer_tegen?.id ?? null,
        hpl_voor: state.hpl_voor?.id ?? null,
        hpl_tegen: state.hpl_tegen?.id ?? null,
        voegmethode: state.voegmethode ?? null,
        bewerkingen: (state.bewerkingen ?? []).map(b => b.id),
        ruimte_indeling: state.ruimte_indeling ?? 'geen',
        ruimtes: state.ruimtes ?? [],
        aantal: state.aantal,
        prijs_per_stuk: priceResult.totaal / (state.aantal || 1),
        totaal_prijs: priceResult.totaal,
      })
      if (error) { toast.error('Opslaan mislukt: ' + error.message); return }
      // Update bijgewerkt_op on the orderlijst
      await supabase.from('orderlijsten')
        .update({ bijgewerkt_op: new Date().toISOString() })
        .eq('id', state.orderlijst_id)
    }
    toast.success(`Regel toegevoegd aan "${state.orderlijst_naam ?? 'Orderlijst'}"`)
    if (keepListForNext) {
      const keepList = { orderlijst_id: state.orderlijst_id, orderlijst_naam: state.orderlijst_naam }
      setState({ ...initialState, ...keepList })
      setStep(1)
    } else {
      setState(initialState)
      setStep(0)
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

  // Group afmetingen by lang/kort
  const isLang = state.afmeting ? state.afmeting.lengte_mm > 2800 : false

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Stepper */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 overflow-x-auto">
        <StepStepper currentStep={step} totalSteps={8} dimmedSteps={dimmedSteps} />
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-gray-200">
        {/* ─── STEP 0: Orderlijst kiezen ─── */}
        {step === 0 && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Orderlijst kiezen</h2>
            <p className="text-sm text-gray-500 mb-6">Selecteer een bestaande orderlijst of maak een nieuwe aan.</p>

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
                + Nieuwe orderlijst aanmaken
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newListNaam}
                  onChange={e => setNewListNaam(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createNewOrderlijst() }}
                  placeholder="Naam nieuwe orderlijst"
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
            <p className="text-sm text-gray-500 mb-6">Selecteer het materiaaltype.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(baseplatenByNaam).map(([naam, variants]) => {
                const isSelected = state.basisplaat?.naam === naam
                const diktes = [...new Set(variants.map(v => v.dikte_mm))].sort((a, b) => a - b)
                return (
                  <button
                    key={naam}
                    onClick={() => setState(s => ({ ...s, basisplaat: variants[0], afmeting: undefined }))}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all hover:shadow-sm
                      ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                  >
                    {variants[0]?.gallery_foto_url ? (
                      <img
                        src={variants[0].gallery_foto_url}
                        alt={naam}
                        className="w-full h-20 object-cover rounded-lg mb-2 border border-gray-100"
                      />
                    ) : (
                      <div className="text-2xl mb-2">🪵</div>
                    )}
                    <p className="font-semibold text-gray-800">{naam}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{diktes.join(', ')}mm</p>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── STEP 2: Afmetingen ─── */}
        {step === 2 && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Kies afmetingen</h2>
            <p className="text-sm text-gray-500 mb-6">Selecteer de dikte en plaatgrootte.</p>

            {(() => {
              const plaatVariants = baseplaten.filter(p => p.naam === state.basisplaat?.naam)
              const langPlaaten = plaatVariants.filter(p => p.lengte_mm > 2800)
              const kortPlaaten = plaatVariants.filter(p => p.lengte_mm <= 2800)

              return (
                <div className="space-y-6">
                  {kortPlaaten.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Kort (≤2800mm)
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {kortPlaaten.map(p => {
                          const isSelected = state.afmeting?.id === p.id
                          return (
                            <button
                              key={p.id}
                              onClick={() => setState(s => {
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
                              })}
                              className={`p-4 rounded-xl border-2 text-left transition-all
                                ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                            >
                              <p className="text-2xl font-bold text-gray-800">{p.dikte_mm}<span className="text-base font-normal">mm</span></p>
                              <p className="text-xs text-gray-500 mt-0.5">{p.breedte_mm}×{p.lengte_mm}mm</p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {langPlaaten.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Lang (&gt;2800mm)
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {langPlaaten.map(p => {
                          const isSelected = state.afmeting?.id === p.id
                          return (
                            <button
                              key={p.id}
                              onClick={() => setState(s => {
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
                              })}
                              className={`p-4 rounded-xl border-2 text-left transition-all
                                ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                            >
                              <p className="text-2xl font-bold text-gray-800">{p.dikte_mm}<span className="text-base font-normal">mm</span></p>
                              <p className="text-xs text-gray-500 mt-0.5">{p.breedte_mm}×{p.lengte_mm}mm</p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
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
                        setState(s => ({ ...s, fineer_voor: f }))
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Voegmethode *</label>
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
                            ${state.voegmethode === vm.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
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
                    <p>De foto op de webshop is ter indicatie. Elke boom is anders, dus het eindresultaat kan afwijken. Mocht u willen weten welke stam Kuiper gebruikt, vraag dan om een foto met de keuze hieronder.</p>
                  </div>
                </div>
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
                              <p className="text-xs text-gray-400">
                                {isLang ? `€ ${h.prijs_lang.toFixed(2)}/m²` : `€ ${h.prijs_kort.toFixed(2)}/m²`}
                              </p>
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

            <div className="grid sm:grid-cols-2 gap-3">
              {bewerkingen
                .filter(b =>
                  b.beschikbaar &&
                  (!state.categorie || b.compatibiliteit.includes(state.categorie)) &&
                  (!state.afmeting || !isUitgesloten(uitsluitingen, 'basisplaat', state.afmeting.id, 'bewerking', b.id)) &&
                  (!state.afmeting || !isNietIngesloten(insluitingen, 'basisplaat', state.afmeting.id, 'bewerking', b.id)) &&
                  (!state.fineer_voor || !isUitgesloten(uitsluitingen, 'fineer', state.fineer_voor.id, 'bewerking', b.id)) &&
                  (!state.fineer_voor || !isNietIngesloten(insluitingen, 'fineer', state.fineer_voor.id, 'bewerking', b.id)) &&
                  (!state.hpl_voor || !isUitgesloten(uitsluitingen, 'hpl', state.hpl_voor.id, 'bewerking', b.id)) &&
                  (!state.hpl_voor || !isNietIngesloten(insluitingen, 'hpl', state.hpl_voor.id, 'bewerking', b.id))
                )
                .map(b => {
                  const isSelected = state.bewerkingen.some(sb => sb.id === b.id)
                  return (
                    <button
                      key={b.id}
                      onClick={() => setState(s => ({
                        ...s,
                        bewerkingen: isSelected
                          ? s.bewerkingen.filter(sb => sb.id !== b.id)
                          : [...s.bewerkingen, b],
                      }))}
                      className={`p-4 rounded-xl border-2 text-left transition-all relative
                        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">{b.naam}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{b.beschrijving}</p>
                        </div>
                        <div className="shrink-0 ml-2">
                          <span className="text-sm font-bold text-blue-600">+ € {b.prijs.toFixed(2)}/m²</span>
                        </div>
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
                })}
            </div>
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
                      const m2pp = priceResult.m2_per_plaat || 1
                      setState(s => ({ ...s, aantal: Math.max(1, Math.ceil(m2 / m2pp)) }))
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
                  <p className="text-xl font-bold text-green-800">{priceResult.totaal_m2.toFixed(2)}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-green-700">Indicatie</span>
                <p className="text-lg font-bold text-green-800">€ {priceResult.totaal.toFixed(2)}</p>
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
                <SummaryRow label="Orderlijst" value={state.orderlijst_naam ?? '-'} />
                <SummaryRow label="Basisplaat" value={state.afmeting ? `${state.afmeting.naam} ${state.afmeting.dikte_mm}mm` : '-'} />
                <SummaryRow label="Afmeting" value={state.afmeting ? `${state.afmeting.breedte_mm}×${state.afmeting.lengte_mm}mm` : '-'} />
                <SummaryRow label="Categorie" value={state.categorie ?? '-'} />
                {state.categorie === 'fineer' && (
                  <>
                    <SummaryRow label="Fineer voor" value={state.fineer_voor?.naam ?? 'Geen'} />
                    <SummaryRow label="Fineer tegen" value={state.fineer_tegen?.naam ?? 'Geen'} />
                    <SummaryRow label="Voegmethode" value={state.voegmethode ?? '-'} />
                    <SummaryRow label="Fineerkeuze" value={state.fineerkeuze ?? '-'} />
                  </>
                )}
                {state.categorie === 'hpl' && (
                  <>
                    <SummaryRow label="HPL voor" value={state.hpl_voor?.kleur ?? 'Geen'} />
                    <SummaryRow label="HPL tegen" value={state.hpl_tegen?.kleur ?? 'Geen'} />
                  </>
                )}
                <SummaryRow label="Bewerkingen" value={state.bewerkingen.length > 0 ? state.bewerkingen.map(b => b.naam).join(', ') : 'Geen'} />
                <SummaryRow label="Aantal" value={`${state.aantal} platen`} />
                <SummaryRow label="Totaal m²" value={`${priceResult.totaal_m2.toFixed(2)} m²`} />
              </div>

              {/* Price breakdown */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Prijsopbouw</h3>
                <div className="space-y-2">
                  <PriceRow label="Basisplaat" value={priceResult.basisplaat_kosten} />
                  {priceResult.fineer_kosten > 0 && <PriceRow label="Fineer" value={priceResult.fineer_kosten} />}
                  {priceResult.hpl_kosten > 0 && <PriceRow label="HPL" value={priceResult.hpl_kosten} />}
                  {priceResult.bewerkingen_kosten > 0 && <PriceRow label="Bewerkingen" value={priceResult.bewerkingen_kosten} />}
                  <div className="border-t border-gray-200 pt-2">
                    <PriceRow label="Subtotaal" value={priceResult.subtotaal} bold />
                  </div>
                  {priceResult.staffel_korting > 0 && (
                    <div className="flex justify-between text-sm text-green-700">
                      <span>Staffelkorting ({Math.round((1 - priceResult.staffel_multiplier) * 100)}%)</span>
                      <span className="font-semibold">− € {priceResult.staffel_korting.toFixed(2)}</span>
                    </div>
                  )}
                  <PriceRow
                    label="Verzending"
                    value={priceResult.verzending}
                    override={priceResult.verzending === 0 ? 'Gratis' : undefined}
                  />
                  <div className="border-t-2 border-gray-300 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="font-bold text-gray-800">TOTAAL excl. BTW</span>
                      <span className="font-bold text-lg text-blue-700">€ {priceResult.totaal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleAddToList}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors"
              >
                ✓ Toevoegen aan orderlijst
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

function PriceRow({ label, value, bold, override }: { label: string; value: number; bold?: boolean; override?: string }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className={bold ? 'text-gray-800' : 'text-gray-600'}>{label}</span>
      <span className={bold ? 'text-gray-900' : 'text-gray-700'}>
        {override ?? `€ ${value.toFixed(2)}`}
      </span>
    </div>
  )
}
