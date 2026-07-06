'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { seedOrderlijsten } from '@/lib/seed-data'
import type { Orderlijst, Baseplaat, Fineer, HPL, Bewerking } from '@/lib/types'
import toast from 'react-hot-toast'

type OrderlijstRegel = {
  id: string
  basisplaat_id: string
  categorie: string
  fineer_voor: string | null
  fineer_tegen: string | null
  hpl_voor: string | null
  hpl_tegen: string | null
  voegmethode: string | null
  fineerkeuze: string | null
  fineerkeuze_datum: string | null
  bewerkingen: string[]
  ruimte_indeling: string
  aantal: number
  prijs_per_stuk: number
  totaal_prijs: number
}

// Catalogus voor weergave (namen, foto's) — bewust ZONDER inkoopprijzen,
// staffels en calculatiefactoren. Prijzen worden server-side berekend
// via /api/prijs.
type CatalogCache = {
  baseplaten: Baseplaat[]
  fineers: Fineer[]
  hplList: HPL[]
  bewerkingen: Bewerking[]
  verzendDrempel: number
  verzendKosten: number
}

// Veilige kolommen als fallback zolang de catalogus-views nog niet bestaan
const BP_SAFE_COLS = 'id, naam, dikte_mm, breedte_mm, lengte_mm, beschikbaar, gallery_foto_url, volgorde'
const FN_SAFE_COLS = 'id, naam, voegmethodes, voeg_standaard, fk_advies, info, status_lang, status_kort, gallery_foto_url, volgorde'
const HPL_SAFE_COLS = 'id, kleur, hpl_afm_lang_b, hpl_afm_lang_l, hpl_afm_kort_b, hpl_afm_kort_l, info, status_lang, status_kort, gallery_foto_url'

const FINEERKEUZE_LABELS: Record<string, string> = {
  fabriek: 'Fabriek kiest',
  foto_kuiper: 'Foto van Kuiper',
  foto_klant: 'Foto van klant',
  persoonlijk: 'Persoonlijk uitzoeken',
}

type Tab = 'shop' | 'orders' | 'orderlijst'

function SendOrderlijstModal({ open, onClose, naam, orderlijstId, onSent }: {
  open: boolean
  onClose: () => void
  naam: string
  orderlijstId?: string
  onSent?: () => void
}) {
  const [modalStep, setModalStep] = useState(0)
  const [bericht, setBericht] = useState('')
  const [checks, setChecks] = useState([false, false, false, false])
  const [sending, setSending] = useState(false)

  const checkLabels = [
    'Ik heb alle offerte regels gecontroleerd op juistheid',
    'Ik begrijp dat wijzigingen tijdens het productieproces niet meer mogelijk zijn',
                'Ik ga akkoord met de leverings- en betalingsvoorwaarden van Kuiper Holland',
    'Ik bevestig dat deze offerte en mogelijke bestelling namens mijn bedrijf wordt geplaatst',
  ]

  function toggleCheck(i: number) {
    setChecks(c => c.map((v, j) => (j === i ? !v : v)))
  }

  const allChecked = checks.every(Boolean)

  async function handleSend() {
    setSending(true)
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (url && url !== 'https://your-project.supabase.co' && orderlijstId) {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { toast.error('Niet ingelogd'); setSending(false); return }

        // Haal totaalwaarde op uit regels
        const { data: regels } = await supabase
          .from('orderlijst_regels')
          .select('totaal_prijs')
          .eq('orderlijst_id', orderlijstId)
        const totaal = (regels ?? []).reduce((s, r) => s + (r.totaal_prijs ?? 0), 0)

        // Insert aanvraag
        const { error: aanvraagError } = await supabase.from('aanvragen').insert({
          user_id: user.id,
          orderlijst_ids: [orderlijstId],
          type: 'offerte',
          bericht: bericht || null,
          totaal_waarde: totaal,
          status: 'nieuw',
        })
        if (aanvraagError) { toast.error('Versturen mislukt: ' + aanvraagError.message); setSending(false); return }

        // Update orderlijst status naar verstuurd
        await supabase.from('orderlijsten').update({ status: 'verstuurd' }).eq('id', orderlijstId)

        onSent?.()
      }
      setModalStep(2)
    } finally {
      setSending(false)
    }
  }

  function handleClose() {
    setModalStep(0)
    setBericht('')
    setChecks([false, false, false, false])
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Offerte aanvragen: ${naam}`} maxWidth="md">
      {modalStep === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            U staat op het punt een <strong>offerte aanvraag</strong> te versturen naar Kuiper Holland. Voeg eventueel een bericht toe.
          </p>
          <textarea
            value={bericht}
            onChange={e => setBericht(e.target.value)}
            placeholder="Bijv. speciale instructies, leveringsdatum voorkeur…"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-between pt-2">
            <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              Annuleren
            </button>
            <button
              onClick={() => setModalStep(1)}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Volgende →
            </button>
          </div>
        </div>
      )}

      {modalStep === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">Bevestig de volgende punten om uw offerte aanvraag te versturen:</p>
          <p className="text-xs text-gray-500">
            Lees de voorwaarden voor verzending: {' '}
            <a className="font-semibold text-[var(--color-primary)] hover:underline" href="/voorwaarden/algemene-verkoop-en-leveringsvoorwaarden-nl.pdf" target="_blank">
              Nederlands
            </a>
            {' '}of{' '}
            <a className="font-semibold text-[var(--color-primary)] hover:underline" href="/voorwaarden/algemene-verkoop-en-leveringsvoorwaarden-en.pdf" target="_blank">
              English
            </a>.
          </p>
          <div className="space-y-3">
            {checkLabels.map((label, i) => (
              <label key={i} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checks[i]}
                  onChange={() => toggleCheck(i)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setModalStep(0)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              ← Terug
            </button>
            <button
              onClick={handleSend}
              disabled={!allChecked || sending}
              className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? 'Versturen…' : 'Verstuur aanvraag'}
            </button>
          </div>
        </div>
      )}

      {modalStep === 2 && (
        <div className="text-center py-6">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Offerte aanvraag verstuurd!</h3>
          <p className="text-sm text-gray-600 mb-4">
            Uw offerte aanvraag voor <strong>{naam}</strong> is succesvol verstuurd. Kuiper Holland neemt zo snel mogelijk contact met u op.
          </p>
          <button
            onClick={handleClose}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
          >
            Sluiten
          </button>
        </div>
      )}
    </Modal>
  )
}

function NewOrderlijstModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (naam: string) => void }) {
  const [naam, setNaam] = useState('')

  function handleCreate() {
    if (!naam.trim()) return
    onCreate(naam.trim())
    setNaam('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Nieuwe orderlijst" maxWidth="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Projectnaam *</label>
          <input
            type="text"
            value={naam}
            onChange={e => setNaam(e.target.value)}
            placeholder="Bijv. Keuken renovatie klant X"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Annuleren
          </button>
          <button
            onClick={handleCreate}
            disabled={!naam.trim()}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
          >
            Aanmaken
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('shop')
  const [orderlijsten, setOrderlijsten] = useState<Orderlijst[]>([])
  const [selectedLists, setSelectedLists] = useState<string[]>([])
  const [combining, setCombining] = useState(false)
  const [sendModal, setSendModal] = useState<{ open: boolean; naam: string; id?: string }>({ open: false, naam: '' })
  const [newListModal, setNewListModal] = useState(false)
  const [viewModal, setViewModal] = useState<{
    open: boolean
    lijst: Orderlijst | null
    regels: OrderlijstRegel[]
    siblingRegels: OrderlijstRegel[]
    loading: boolean
    catalog: CatalogCache | null
    hasChanges: boolean
    saving: boolean
    deleteConfirm: { regelId: string; label: string } | null
  }>({
    open: false, lijst: null, regels: [], siblingRegels: [], loading: false,
    catalog: null, hasChanges: false, saving: false, deleteConfirm: null,
  })

  const getSupabase = useCallback(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url || url === 'https://your-project.supabase.co') return null
    const { createClient } = await import('@/lib/supabase/client')
    return createClient()
  }, [])

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab')
    if (requestedTab === 'orders' || requestedTab === 'orderlijst') {
      setActiveTab(requestedTab)
    }

    async function load() {
      const supabase = await getSupabase()
      if (!supabase) {
        setOrderlijsten(seedOrderlijsten)
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: lijsten } = await supabase
        .from('orderlijsten')
        .select('*')
        .eq('user_id', user.id)
        .order('bijgewerkt_op', { ascending: false })
      if (lijsten) setOrderlijsten(lijsten)
    }
    load()
  }, [getSupabase])

  async function toggleListStatus(id: string) {
    const lijst = orderlijsten.find(l => l.id === id)
    if (!lijst) return
    const newStatus = lijst.status === 'actueel' ? 'concept' : 'actueel'
    setOrderlijsten(lists => lists.map(l => l.id === id ? { ...l, status: newStatus as Orderlijst['status'] } : l))
    const supabase = await getSupabase()
    if (supabase) await supabase.from('orderlijsten').update({ status: newStatus }).eq('id', id)
  }

  async function deleteList(id: string) {
    setOrderlijsten(lists => lists.filter(l => l.id !== id))
    const supabase = await getSupabase()
    if (supabase) await supabase.from('orderlijsten').delete().eq('id', id)
  }

  async function createNewList(naam: string) {
    const supabase = await getSupabase()
    if (!supabase) {
      const newList: Orderlijst = {
        id: `ol-${Date.now()}`, user_id: 'demo-user', naam,
        status: 'actueel', aangemaakt_op: new Date().toISOString(), bijgewerkt_op: new Date().toISOString(),
      }
      setOrderlijsten(lists => [newList, ...lists])
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Niet ingelogd'); return }

    const { data, error } = await supabase
      .from('orderlijsten')
      .insert({ user_id: user.id, naam, status: 'actueel' })
      .select()
      .single()

    if (error) { toast.error('Aanmaken mislukt: ' + error.message); return }
    if (data) setOrderlijsten(lists => [data, ...lists])
    toast.success(`Orderlijst "${naam}" aangemaakt`)
  }

  // Herberekent regelprijzen server-side (gecombineerde staffel incl.
  // zusterlijsten). Inkoopprijzen en marges blijven op de server.
  async function herberekenViaApi(regels: OrderlijstRegel[]): Promise<OrderlijstRegel[]> {
    try {
      const res = await fetch('/api/prijs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'orderlijst',
          // Alleen IDs + aantallen — de server laadt de specificaties
          // zelf uit de database (RLS: alleen eigen regels)
          regels: regels.map(r => ({ id: r.id, aantal: r.aantal })),
        }),
      })
      if (!res.ok) return regels
      const json: { regels?: { id: string; prijs_per_stuk: number; totaal_prijs: number }[] } = await res.json()
      const byId = new Map((json.regels ?? []).map(r => [r.id, r]))
      return regels.map(r => {
        const p = byId.get(r.id)
        return p ? { ...r, prijs_per_stuk: p.prijs_per_stuk, totaal_prijs: p.totaal_prijs } : r
      })
    } catch {
      return regels
    }
  }

  // Debounced herberekening voor +/- klikken in de bekijk-modal
  const herberekenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function scheduleHerbereken(regels: OrderlijstRegel[], siblingRegels: OrderlijstRegel[]) {
    if (herberekenTimer.current) clearTimeout(herberekenTimer.current)
    herberekenTimer.current = setTimeout(async () => {
      const herberekend = await herberekenViaApi([...regels, ...siblingRegels])
      const byId = new Map(herberekend.map(r => [r.id, r]))
      setViewModal(v => {
        if (!v.open) return v
        return {
          ...v,
          regels: v.regels.map(r => {
            const u = byId.get(r.id)
            // Alleen overnemen als het aantal niet alweer is gewijzigd
            return u && u.aantal === r.aantal
              ? { ...r, prijs_per_stuk: u.prijs_per_stuk, totaal_prijs: u.totaal_prijs }
              : r
          }),
        }
      })
    }, 400)
  }

  // Gedeelde catalogus-loader voor weergave (namen + foto's, geen prijzen).
  // Views eerst; fallback naar basistabellen met veilige kolommen zolang
  // de views nog niet in Supabase bestaan.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function loadCatalog(supabase: any): Promise<CatalogCache> {
    let [bpRes, fnRes, hplRes] = await Promise.all([
      supabase.from('catalogus_baseplaten').select('*'),
      supabase.from('catalogus_fineers').select('*'),
      supabase.from('catalogus_hpl').select('*'),
    ])
    if (bpRes.error || fnRes.error || hplRes.error) {
      ;[bpRes, fnRes, hplRes] = await Promise.all([
        supabase.from('baseplaten').select(BP_SAFE_COLS),
        supabase.from('fineers').select(FN_SAFE_COLS),
        supabase.from('hpl').select(HPL_SAFE_COLS),
      ])
    }

    const [bwRes, insViewRes] = await Promise.all([
      supabase.from('bewerkingen').select('*'),
      supabase.from('instellingen_publiek').select('*'),
    ])
    let ins = insViewRes.data ?? []
    if (insViewRes.error) {
      const insRes = await supabase.from('instellingen').select('sleutel, waarde').in('sleutel', ['verzend_drempel', 'verzend_kosten'])
      ins = insRes.data ?? []
    }
    const getIns = (key: string, def: number) => {
      const parsed = parseFloat(ins.find((i: { sleutel: string; waarde: string }) => i.sleutel === key)?.waarde ?? '')
      return Number.isFinite(parsed) ? parsed : def
    }

    return {
      baseplaten: (bpRes.data ?? []) as Baseplaat[],
      fineers: (fnRes.data ?? []) as Fineer[],
      hplList: (hplRes.data ?? []) as HPL[],
      bewerkingen: (bwRes.data ?? []) as Bewerking[],
      verzendDrempel: getIns('verzend_drempel', 1750),
      verzendKosten: getIns('verzend_kosten', 25),
    }
  }

  async function openBekijk(lijst: Orderlijst) {
    setViewModal({ open: true, lijst, regels: [], siblingRegels: [], loading: true, catalog: null, hasChanges: false, saving: false, deleteConfirm: null })
    const supabase = await getSupabase()
    if (!supabase) { setViewModal(v => ({ ...v, loading: false })); return }

    const [regelRes, catalog] = await Promise.all([
      supabase.from('orderlijst_regels').select(`
        id, basisplaat_id, categorie,
        fineer_voor, fineer_tegen, hpl_voor, hpl_tegen,
        voegmethode, fineerkeuze, fineerkeuze_datum,
        bewerkingen, ruimte_indeling, ruimtes,
        aantal, prijs_per_stuk, totaal_prijs
      `).eq('orderlijst_id', lijst.id).order('id'),
      loadCatalog(supabase),
    ])

    const eigenRegels = (regelRes.data ?? []) as unknown as OrderlijstRegel[]
    let siblingRegels: OrderlijstRegel[] = []

    // Zusterlijsten in dezelfde combinatiegroep meenemen voor de staffel
    if (lijst.combinatie_groep_id) {
      const zusterLijsten = orderlijsten.filter(
        l => l.combinatie_groep_id === lijst.combinatie_groep_id && l.id !== lijst.id
      )
      if (zusterLijsten.length > 0) {
        const zusterRes = await Promise.all(
          zusterLijsten.map(l =>
            supabase.from('orderlijst_regels')
              .select('id, basisplaat_id, categorie, fineer_voor, fineer_tegen, hpl_voor, hpl_tegen, voegmethode, fineerkeuze, bewerkingen, ruimte_indeling, aantal, prijs_per_stuk, totaal_prijs')
              .eq('orderlijst_id', l.id)
          )
        )
        siblingRegels = zusterRes.flatMap(r => (r.data ?? []) as unknown as OrderlijstRegel[])
      }
    }

    // Prijzen altijd live server-side herberekenen (incl. gecombineerde staffel)
    const herberekend = await herberekenViaApi([...eigenRegels, ...siblingRegels])
    const eigenIds = new Set(eigenRegels.map(r => r.id))
    const displayRegels = herberekend.filter(r => eigenIds.has(r.id))

    setViewModal(v => ({ ...v, regels: displayRegels, siblingRegels, catalog, loading: false }))
  }

  async function combineer() {
    if (selectedLists.length < 2 || combining) return
    setCombining(true)
    const toastId = toast.loading('Orderlijsten koppelen…')
    try {
      const supabase = await getSupabase()
      if (!supabase) { toast.error('Geen verbinding', { id: toastId }); return }

      const groepId = crypto.randomUUID()
      await Promise.all(selectedLists.map(id =>
        supabase.from('orderlijsten').update({ combinatie_groep_id: groepId }).eq('id', id)
      ))

      setOrderlijsten(lists => lists.map(l =>
        selectedLists.includes(l.id) ? { ...l, combinatie_groep_id: groepId } : l
      ))
      setSelectedLists([])
      toast.success('Gekoppeld — gecombineerde staffelkorting wordt live berekend bij "Bekijk"', { id: toastId })
    } catch (e) {
      toast.error('Combineren mislukt', { id: toastId })
      console.error(e)
    } finally {
      setCombining(false)
    }
  }

  async function loskoppel(lijstId: string) {
    const lijst = orderlijsten.find(l => l.id === lijstId)
    const groepId = lijst?.combinatie_groep_id
    if (!groepId || combining) return

    const groepLijsten = orderlijsten.filter(l => l.combinatie_groep_id === groepId)
    setCombining(true)
    const toastId = toast.loading('Loskoppelen…')
    try {
      const supabase = await getSupabase()
      if (!supabase) { toast.error('Geen verbinding', { id: toastId }); return }

      await Promise.all(groepLijsten.map(l =>
        supabase.from('orderlijsten').update({ combinatie_groep_id: null }).eq('id', l.id)
      ))

      setOrderlijsten(lists => lists.map(l =>
        l.combinatie_groep_id === groepId ? { ...l, combinatie_groep_id: null } : l
      ))
      toast.success('Losgekoppeld — staffelkorting wordt individueel berekend bij "Bekijk"', { id: toastId })
    } catch (e) {
      toast.error('Loskoppelen mislukt', { id: toastId })
      console.error(e)
    } finally {
      setCombining(false)
    }
  }

  async function saveAantalWijzigingen() {
    const { regels, lijst, catalog } = viewModal
    if (!lijst || !catalog) return
    setViewModal(v => ({ ...v, saving: true }))
    try {
      const supabase = await getSupabase()
      if (!supabase) { toast.error('Geen verbinding'); setViewModal(v => ({ ...v, saving: false })); return }

      // Update alle regels parallel (alleen prijsrelevante velden)
      await Promise.all(regels.map(r =>
        supabase.from('orderlijst_regels')
          .update({ aantal: r.aantal, prijs_per_stuk: r.prijs_per_stuk, totaal_prijs: r.totaal_prijs })
          .eq('id', r.id)
      ))

      // Update bijgewerkt_op op de orderlijst
      await supabase.from('orderlijsten')
        .update({ bijgewerkt_op: new Date().toISOString() })
        .eq('id', lijst.id)

      // Sync orderlijst in lokale state
      setOrderlijsten(lists => lists.map(l =>
        l.id === lijst.id ? { ...l, bijgewerkt_op: new Date().toISOString() } : l
      ))

      toast.success('Wijzigingen opgeslagen')
      setViewModal(v => ({ ...v, hasChanges: false, saving: false }))
    } catch (e) {
      toast.error('Opslaan mislukt')
      console.error(e)
      setViewModal(v => ({ ...v, saving: false }))
    }
  }

  function changeAantal(regelId: string, delta: number) {
    setViewModal(v => {
      const newRegels = v.regels.map(r =>
        r.id === regelId ? { ...r, aantal: Math.max(1, r.aantal + delta) } : r
      )
      scheduleHerbereken(newRegels, v.siblingRegels)
      return { ...v, regels: newRegels, hasChanges: true }
    })
  }

  async function deleteRegel(regelId: string) {
    // Verwijder meteen uit DB (niet wachten op "opslaan")
    const supabase = await getSupabase()
    if (supabase) {
      const { error } = await supabase.from('orderlijst_regels').delete().eq('id', regelId)
      if (error) { toast.error('Verwijderen mislukt: ' + error.message); return }
    }
    setViewModal(v => {
      const newRegels = v.regels.filter(r => r.id !== regelId)
      scheduleHerbereken(newRegels, v.siblingRegels)
      return { ...v, regels: newRegels, deleteConfirm: null, hasChanges: newRegels.length !== v.regels.length ? v.hasChanges : false }
    })
    toast.success('Regel verwijderd')
  }

  function toggleSelectList(id: string) {
    setSelectedLists(sel =>
      sel.includes(id) ? sel.filter(s => s !== id) : [...sel, id]
    )
  }

  const actueleListjes = orderlijsten.filter(l => l.status === 'actueel' || l.status === 'concept')
  const verstuurdListjes = orderlijsten.filter(l => l.status === 'verstuurd' || l.status === 'gearchiveerd')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-1 w-48 shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">Menu</p>
          {(['shop', 'orders', 'orderlijst'] as Tab[]).map(tab => {
            const labels: Record<Tab, string> = { shop: 'Shop', orders: 'Orders', orderlijst: 'Orderlijsten' }
            const icons: Record<Tab, string> = { shop: '🛒', orders: '📦', orderlijst: '📋' }
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors
                  ${activeTab === tab ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <span>{icons[tab]}</span>
                {labels[tab]}
              </button>
            )
          })}
          <div className="mt-4 border-t border-gray-200 pt-4">
            <Link
              href="/configurator"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <span>⚙️</span>
              Configurator
            </Link>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Tab bar (mobile) */}
          <div className="flex gap-1 md:hidden mb-4 bg-white rounded-xl p-1 border border-gray-200">
            {(['shop', 'orders', 'orderlijst'] as Tab[]).map(tab => {
              const labels: Record<Tab, string> = { shop: 'Shop', orders: 'Orders', orderlijst: 'Lijsten' }
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors
                    ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {labels[tab]}
                </button>
              )
            })}
          </div>

          {/* SHOP TAB */}
          {activeTab === 'shop' && (
            <div className="space-y-4">

              {/* ── Rij 1: volle breedte — configurator uitleg ── */}
              <div className="bg-white rounded-lg border border-stone-200 p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)] mb-2">Kuiper Holland webshop</p>
                <h1 className="text-xl font-bold mb-1 text-stone-900">Configureer plaatmateriaal voor interieurbouw</h1>
                <p className="text-stone-600 text-sm mb-4">
                  Kies uw basisplaat, selecteer de voor- en tegenzijde in fineer of HPL, en bekijk direct uw prijs. Binnen een paar stappen een complete offerte.
                </p>
                <div className="flex flex-wrap gap-3 text-sm text-stone-700 mb-5">
                  <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center text-xs font-bold">1</span> Kies basisplaat</span>
                  <span className="text-stone-300">→</span>
                  <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center text-xs font-bold">2</span> Fineer of HPL</span>
                  <span className="text-stone-300">→</span>
                  <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center text-xs font-bold">3</span> Bewerkingen</span>
                  <span className="text-stone-300">→</span>
                  <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center text-xs font-bold">4</span> Verstuur offerteaanvraag</span>
                </div>
                <Link
                  href="/configurator"
                  className="inline-block px-5 py-2.5 bg-[var(--color-primary)] text-white text-sm font-bold rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
                >
                  + Nieuwe configuratie starten
                </Link>
              </div>

              {/* ── Rij 2: twee kolommen ── */}
              <div className="grid sm:grid-cols-2 gap-4">

                {/* Actieve orderlijsten */}
                <div className="bg-white rounded-lg border border-stone-200 p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Mijn orderlijsten</h2>
                  {(() => {
                    const actief = orderlijsten.filter(l => l.status === 'actueel' || l.status === 'concept')
                    if (actief.length === 0) {
                      return (
                        <div className="text-center py-6">
                          <p className="text-gray-400 text-sm mb-3">Geen actieve orderlijsten.</p>
                          <button
                            onClick={() => setActiveTab('orderlijst')}
                            className="text-sm text-blue-600 font-semibold hover:underline"
                          >
                            Ga naar orderlijsten →
                          </button>
                        </div>
                      )
                    }
                    return (
                      <div className="space-y-2">
                        {actief.slice(0, 4).map(l => (
                          <button
                            key={l.id}
                            onClick={() => setActiveTab('orderlijst')}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-blue-50 transition-colors text-left"
                          >
                            <span className="text-sm font-medium text-gray-800 truncate">{l.naam}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0 ${l.status === 'actueel' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {l.status}
                            </span>
                          </button>
                        ))}
                        {actief.length > 4 && (
                          <button onClick={() => setActiveTab('orderlijst')} className="text-xs text-blue-600 hover:underline mt-1">
                            + {actief.length - 4} meer bekijken
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* USP's */}
                <div className="bg-white rounded-lg border border-stone-200 p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Waarom Kuiper Holland</h2>
                  <ul className="space-y-2.5">
                    {[
                      'Fineer van de hoogste kwaliteit in 50+ soorten',
                      'Bijna elke combinatie is mogelijk',
                      'Scherpe prijzen',
                      'Bekijk het in onze fabriek of krijg een foto vóór productie',
                      'Productietijd van ongeveer 2 weken',
                    ].map((usp, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                          </svg>
                        </span>
                        {usp}
                      </li>
                    ))}
                  </ul>
                </div>

              </div>

              <div className="grid lg:grid-cols-[1fr_320px] gap-4">
                <section className="bg-white rounded-lg border border-stone-200 p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Veelgestelde vragen</h2>
                  <div className="divide-y divide-stone-200">
                    {[
                      ['Kan ik eerst een offerte aanvragen?', 'Ja. De webshop maakt een orderlijst met prijsindicatie. Na versturen controleert Kuiper Holland de aanvraag en volgt de offertebevestiging.'],
                      ['Wanneer kies ik foto van Kuiper?', 'Kies dit wanneer kleur en nerftekening belangrijk zijn voor zichtbaar werk. Wij sturen dan een foto ter goedkeuring voor productie.'],
                      ['Kan ik meerdere projecten combineren?', 'Ja. Selecteer twee of meer orderlijsten om aantallen samen te voegen voor staffelkorting.'],
                      ['Wat betekent de prijs?', 'Alle bedragen zijn indicatief en exclusief btw. In de verzendstap bevestigt u de voorwaarden voordat de aanvraag wordt verstuurd.'],
                    ].map(([vraag, antwoord]) => (
                      <details key={vraag} className="group py-3">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-stone-800">
                          {vraag}
                          <span className="text-stone-400 group-open:rotate-180 transition-transform">⌄</span>
                        </summary>
                        <p className="mt-2 text-sm text-stone-600">{antwoord}</p>
                      </details>
                    ))}
                  </div>
                </section>

                <aside className="bg-[#f6efe8] rounded-lg border border-[#decab6] p-5">
                  <h2 className="text-sm font-semibold text-stone-900 mb-2">Voorwaarden</h2>
                  <p className="text-sm text-stone-600 mb-4">Download de algemene verkoop- en leveringsvoorwaarden voordat u een offerteaanvraag verstuurt.</p>
                  <div className="space-y-2">
                    <a className="block px-3 py-2 bg-white rounded-md border border-[#decab6] text-sm font-semibold text-[var(--color-primary)] hover:bg-stone-50" href="/voorwaarden/algemene-verkoop-en-leveringsvoorwaarden-nl.pdf" target="_blank">
                      Nederlandse voorwaarden
                    </a>
                    <a className="block px-3 py-2 bg-white rounded-md border border-[#decab6] text-sm font-semibold text-[var(--color-primary)] hover:bg-stone-50" href="/voorwaarden/algemene-verkoop-en-leveringsvoorwaarden-en.pdf" target="_blank">
                      English terms
                    </a>
                  </div>
                </aside>
              </div>
            </div>
          )}

          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="space-y-5">
              <h1 className="text-lg font-bold text-gray-800">Ordergeschiedenis</h1>

              {verstuurdListjes.length === 0 && actueleListjes.length === 0 && (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
                  <p className="text-3xl mb-2">📦</p>
                  <p className="text-sm">Nog geen orderlijsten aangemaakt.</p>
                </div>
              )}

              {verstuurdListjes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Verstuurd</p>
                  <div className="space-y-2">
                    {verstuurdListjes.map(lijst => (
                      <div key={lijst.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{lijst.naam}</p>
                          <p className="text-xs text-gray-400">{new Date(lijst.bijgewerkt_op).toLocaleDateString('nl-NL')}</p>
                        </div>
                        <Badge variant="verstuurd">Verstuurd</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {actueleListjes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Actieve lijsten</p>
                  <div className="space-y-2">
                    {actueleListjes.map(lijst => (
                      <div key={lijst.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{lijst.naam}</p>
                          <p className="text-xs text-gray-400">{new Date(lijst.bijgewerkt_op).toLocaleDateString('nl-NL')}</p>
                        </div>
                        <Badge variant={lijst.status === 'actueel' ? 'active' : 'concept'}>
                          {lijst.status === 'actueel' ? 'Actueel' : 'Concept'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ORDERLIJST TAB */}
          {activeTab === 'orderlijst' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-lg font-bold text-gray-800">Orderlijsten</h1>
                <button
                  onClick={() => setNewListModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Voeg orderlijst toe
                </button>
              </div>

              {/* Combine toolbar */}
              {selectedLists.length >= 2 && (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
                  <div className="flex-1">
                    <p className="text-sm text-blue-700 font-medium">{selectedLists.length} lijsten geselecteerd</p>
                    <p className="text-xs text-blue-500 mt-0.5">Aantallen worden samengeteld voor een gunstigere staffelkorting</p>
                  </div>
                  <button
                    onClick={combineer}
                    disabled={combining}
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {combining ? 'Bezig…' : 'Combineer'}
                  </button>
                  <button onClick={() => setSelectedLists([])} className="text-sm text-blue-500 hover:underline">
                    Annuleer
                  </button>
                </div>
              )}

              {/* Actuele lijsten */}
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Actuele orderlijsten</h2>
                <div className="space-y-3">
                  {actueleListjes.map(lijst => {
                    const isCombined = !!lijst.combinatie_groep_id
                    const partnerNamen = isCombined
                      ? actueleListjes
                          .filter(l => l.combinatie_groep_id === lijst.combinatie_groep_id && l.id !== lijst.id)
                          .map(l => l.naam)
                      : []
                    const isSelected = selectedLists.includes(lijst.id)
                    // Gecombineerde lijsten kunnen niet geselecteerd worden voor een nieuwe combinatie
                    const canSelect = !isCombined
                    return (
                      <div
                        key={lijst.id}
                        className={`bg-white rounded-xl border p-4 transition-all ${
                          isSelected ? 'border-blue-400 shadow-sm'
                          : isCombined ? 'border-indigo-200 bg-indigo-50/30'
                          : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => canSelect && toggleSelectList(lijst.id)}
                            disabled={!canSelect}
                            title={isCombined ? 'Koppel eerst los om te herselectioneren' : undefined}
                            className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-gray-800">{lijst.naam}</p>
                              <button onClick={() => toggleListStatus(lijst.id)} className="cursor-pointer">
                                <Badge variant={lijst.status === 'actueel' ? 'active' : 'concept'}>
                                  {lijst.status === 'actueel' ? 'Actueel' : 'Concept'}
                                </Badge>
                              </button>
                              {isCombined && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                  </svg>
                                  Gecombineerd
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Bijgewerkt: {new Date(lijst.bijgewerkt_op).toLocaleDateString('nl-NL')}
                            </p>
                            {isCombined && partnerNamen.length > 0 && (
                              <p className="text-xs text-indigo-500 mt-0.5">
                                Gecombineerd met: {partnerNamen.join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                            {isCombined && (
                              <button
                                onClick={() => loskoppel(lijst.id)}
                                disabled={combining}
                                className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
                              >
                                🔗 Loskoppel
                              </button>
                            )}
                            <button
                              onClick={() => openBekijk(lijst)}
                              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              Bekijk
                            </button>
                            <button
                              onClick={() => setSendModal({ open: true, naam: lijst.naam, id: lijst.id })}
                              className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                            >
                              Verstuur
                            </button>
                            <button
                              onClick={() => deleteList(lijst.id)}
                              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              Verwijder
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {actueleListjes.length === 0 && (
                    <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-200">
                      <p className="text-3xl mb-2">📋</p>
                      <p className="text-sm">Geen actieve orderlijsten. Maak een nieuwe aan!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Verstuurd */}
              {verstuurdListjes.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Orderlijst Historie</h2>
                  <div className="space-y-2">
                    {verstuurdListjes.map(lijst => (
                      <div key={lijst.id} className="bg-white rounded-xl border border-gray-200 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700">{lijst.naam}</p>
                            <p className="text-xs text-gray-400">{new Date(lijst.bijgewerkt_op).toLocaleDateString('nl-NL')}</p>
                          </div>
                          <Badge variant="verstuurd">Verstuurd</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <SendOrderlijstModal
        open={sendModal.open}
        naam={sendModal.naam}
        orderlijstId={sendModal.id}
        onClose={() => setSendModal({ open: false, naam: '' })}
        onSent={() => {
          // Verplaats verstuurde lijst naar historie
          setOrderlijsten(lists => lists.map(l =>
            l.id === sendModal.id ? { ...l, status: 'verstuurd' as Orderlijst['status'] } : l
          ))
        }}
      />
      <NewOrderlijstModal
        open={newListModal}
        onClose={() => setNewListModal(false)}
        onCreate={createNewList}
      />

      {/* Bekijk modal */}
      {viewModal.open && viewModal.lijst && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{viewModal.lijst.naam}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Orderlijst overzicht</p>
              </div>
              <button
                onClick={() => setViewModal(v => ({ ...v, open: false, lijst: null, regels: [], siblingRegels: [], catalog: null, hasChanges: false }))}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >✕</button>
            </div>

            {/* Regels */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {viewModal.loading ? (
                <p className="text-sm text-gray-400 text-center py-8">Laden…</p>
              ) : viewModal.regels.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-3xl mb-2">📋</p>
                  <p className="text-sm text-gray-400 mb-4">Nog geen platen in deze orderlijst.</p>
                  <button
                    onClick={() => { setViewModal(v => ({ ...v, open: false })); router.push('/configurator') }}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    + Voeg platen toe
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {viewModal.regels.map((regel, i) => {
                    const cat = viewModal.catalog
                    const plaat = cat?.baseplaten.find(b => b.id === regel.basisplaat_id)
                    const plaatNaam = plaat?.naam ?? '—'
                    const plaatDikte = plaat?.dikte_mm ?? '—'
                    const fineerVoor = regel.fineer_voor ? cat?.fineers.find(f => f.id === regel.fineer_voor) : undefined
                    const fineerTegen = regel.fineer_tegen ? cat?.fineers.find(f => f.id === regel.fineer_tegen) : undefined
                    const hplVoor = regel.hpl_voor ? cat?.hplList.find(h => h.id === regel.hpl_voor) : undefined
                    const hplTegen = regel.hpl_tegen ? cat?.hplList.find(h => h.id === regel.hpl_tegen) : undefined
                    const fotoUrl = fineerVoor?.gallery_foto_url ?? hplVoor?.gallery_foto_url
                    const fineerVoorNaam = fineerVoor?.naam
                    const fineerTegenNaam = fineerTegen?.naam
                    const hplVoorKleur = hplVoor?.kleur
                    const hplTegenKleur = hplTegen?.kleur
                    const bewerkingNamen = (regel.bewerkingen ?? [])
                      .map(id => viewModal.catalog?.bewerkingen.find(b => b.id === id)?.naam ?? id)
                      .join(', ')
                    const fineerkeuzeLabel = regel.fineerkeuze ? (FINEERKEUZE_LABELS[regel.fineerkeuze] ?? regel.fineerkeuze) : null
                    return (
                      <div key={regel.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-4 relative">
                          {fotoUrl && (
                            <img src={fotoUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="font-semibold text-sm text-gray-800">#{i + 1} — {plaatNaam} {plaatDikte}mm</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                ${regel.categorie === 'fineer' ? 'bg-amber-100 text-amber-700'
                                  : regel.categorie === 'hpl' ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-200 text-gray-600'}`}>
                                {regel.categorie}
                              </span>
                            </div>

                            {/* Fineer details */}
                            {regel.categorie === 'fineer' && (
                              <div className="space-y-0.5">
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium">Voorzijde:</span> {fineerVoorNaam ?? '—'}
                                </p>
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium">Tegenzijde:</span> {fineerTegenNaam ?? '—'}
                                </p>
                                {regel.voegmethode && (
                                  <p className="text-xs text-gray-500">
                                    <span className="font-medium">Voeg:</span> {regel.voegmethode}
                                  </p>
                                )}
                                {fineerkeuzeLabel && (
                                  <p className="text-xs text-gray-500">
                                    <span className="font-medium">Fineerkeuze:</span> {fineerkeuzeLabel}
                                    {regel.fineerkeuze === 'persoonlijk' && regel.fineerkeuze_datum && (
                                      <span className="ml-1 text-blue-600 font-medium">
                                        — {new Date(regel.fineerkeuze_datum).toLocaleDateString('nl-NL')}
                                      </span>
                                    )}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* HPL details */}
                            {regel.categorie === 'hpl' && (
                              <div className="space-y-0.5">
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium">Voorzijde:</span> {hplVoorKleur ?? '—'}
                                </p>
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium">Tegenzijde:</span> {hplTegenKleur ?? '—'}
                                </p>
                              </div>
                            )}

                            {/* Kaal */}
                            {regel.categorie === 'kaal' && (
                              <p className="text-xs text-gray-500">Geen afwerking</p>
                            )}

                            {/* Bewerkingen */}
                            {bewerkingNamen && (
                              <p className="text-xs text-gray-500 mt-1">
                                <span className="font-medium">Bewerkingen:</span> {bewerkingNamen}
                              </p>
                            )}
                            <button
                              onClick={() => setViewModal(v => ({ ...v, deleteConfirm: { regelId: regel.id, label: `#${i + 1} — ${plaatNaam} ${plaatDikte}mm` } }))}
                              className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Verwijder regel
                            </button>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {/* +/- controls */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => changeAantal(regel.id, -1)}
                                disabled={regel.aantal <= 1}
                                className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-base font-bold leading-none"
                              >−</button>
                              <span className="w-8 text-center text-sm font-semibold text-gray-800">{regel.aantal}</span>
                              <button
                                onClick={() => changeAantal(regel.id, +1)}
                                className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 text-base font-bold leading-none"
                              >+</button>
                            </div>
                            <p className="text-xs text-gray-500">
                              {regel.prijs_per_stuk != null
                                ? `€ ${regel.prijs_per_stuk.toFixed(2)} / stuk`
                                : ''}
                            </p>
                            <p className="text-xs font-semibold text-gray-700">
                              € {regel.totaal_prijs?.toFixed(2) ?? '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {viewModal.regels.length > 0 && (() => {
              const materiaalkosten = viewModal.regels.reduce((s, r) => s + (r.totaal_prijs ?? 0), 0)
              const drempel = viewModal.catalog?.verzendDrempel ?? 1750
              const verzendKosten = viewModal.catalog?.verzendKosten ?? 25
              const verzending = materiaalkosten >= drempel ? 0 : verzendKosten
              const totaal = materiaalkosten + verzending
              return (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl space-y-3">
                  {/* Prijsoverzicht */}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Materiaalkosten</span>
                      <span>€ {materiaalkosten.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Verzendkosten {materiaalkosten >= drempel && <span className="text-green-600 text-xs">(gratis boven € {drempel})</span>}</span>
                      <span className={verzending === 0 ? 'text-green-600' : ''}>
                        {verzending === 0 ? 'Gratis' : `€ ${verzending.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-800 pt-1 border-t border-gray-200">
                      <span>Totaal (indicatief)</span>
                      <span>€ {totaal.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-gray-400 pt-1">
                      Indicatieve prijzen — definitief na bevestiging van uw offerteaanvraag.
                    </p>
                  </div>

                  {/* Acties */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs text-gray-400">{viewModal.regels.length} regel{viewModal.regels.length !== 1 ? 's' : ''}</p>
                    <div className="flex gap-2 flex-wrap">
                      {viewModal.hasChanges && (
                        <button
                          onClick={saveAantalWijzigingen}
                          disabled={viewModal.saving}
                          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
                        >
                          {viewModal.saving ? 'Opslaan…' : '💾 Wijzigingen opslaan'}
                        </button>
                      )}
                      <button
                        onClick={() => { setViewModal(v => ({ ...v, open: false })); router.push('/configurator') }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        + Voeg platen toe
                      </button>
                      <button
                        onClick={() => {
                          setViewModal(v => ({ ...v, open: false }))
                          setSendModal({ open: true, naam: viewModal.lijst!.naam, id: viewModal.lijst!.id })
                        }}
                        className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg"
                      >
                        📤 Verstuur
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Bevestiging verwijderen — overlay binnen de modal */}
            {viewModal.deleteConfirm && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10 p-6">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 max-w-sm w-full text-center">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-gray-800 mb-1">Regel verwijderen?</h3>
                  <p className="text-sm text-gray-500 mb-5">
                    <span className="font-medium text-gray-700">{viewModal.deleteConfirm.label}</span> wordt permanent verwijderd uit deze orderlijst.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => setViewModal(v => ({ ...v, deleteConfirm: null }))}
                      className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Annuleren
                    </button>
                    <button
                      onClick={() => deleteRegel(viewModal.deleteConfirm!.regelId)}
                      className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
                    >
                      Ja, verwijder
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
