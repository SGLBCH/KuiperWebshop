'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import {
  seedBaseplaten,
  seedOrderlijsten,
  seedOrders,
  seedVasteKosten,
  seedStaffelFineerHPL,
  seedStaffelKaal,
} from '@/lib/seed-data'
import type { Orderlijst, Order, Baseplaat, Fineer, HPL, Bewerking, StaffelRegel, PricingData, HotmeltCombinatie } from '@/lib/types'
import { calculatePrice, getMargeCoefficient } from '@/lib/pricing'
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
  bewerkingen: string[]
  ruimte_indeling: string
  aantal: number
  prijs_per_stuk: number
  totaal_prijs: number
  baseplaten?: { naam: string; dikte_mm: number }
  fineers_voor?: { naam: string; gallery_foto_url?: string | null } | null
  fineers_tegen?: { naam: string; gallery_foto_url?: string | null } | null
  hpl_voor_data?: { kleur: string; gallery_foto_url?: string | null } | null
  hpl_tegen_data?: { kleur: string; gallery_foto_url?: string | null } | null
}

type CatalogCache = {
  baseplaten: Baseplaat[]
  fineers: Fineer[]
  hplList: HPL[]
  bewerkingen: Bewerking[]
  staffelFH: StaffelRegel[]
  staffelKaal: StaffelRegel[]
  verzendDrempel: number
  verzendKosten: number
  fineerlijm: number
  schuurbanden: number
  hplLijm: number
  puHotmelt: number
  hotmeltCombs: HotmeltCombinatie[]
}

type Tab = 'shop' | 'orders' | 'orderlijst'
type OrderStatus = 'alle' | 'bevestigd' | 'in_productie' | 'verzonden' | 'geleverd'

const ORDER_STATUS_LABELS: Record<string, string> = {
  bevestigd: 'Bevestigd',
  in_productie: 'In productie',
  verzonden: 'Verzonden',
  geleverd: 'Geleverd',
  geannuleerd: 'Geannuleerd',
}

const ORDER_STATUS_STEPS = ['Bevestigd', 'In productie', 'Ingepakt', 'Verzonden', 'Geleverd']

function getOrderStep(status: string): number {
  switch (status) {
    case 'bevestigd': return 0
    case 'in_productie': return 1
    case 'verzonden': return 3
    case 'geleverd': return 4
    default: return 0
  }
}

function getStatusBadgeVariant(status: string): 'info' | 'warning' | 'active' | 'inactive' | 'approved' | 'danger' | 'pending' | 'verstuurd' | 'concept' | 'gearchiveerd' {
  switch (status) {
    case 'bevestigd': return 'info'
    case 'in_productie': return 'warning'
    case 'verzonden': return 'verstuurd'
    case 'geleverd': return 'approved'
    case 'geannuleerd': return 'danger'
    default: return 'inactive'
  }
}

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
    'Ik heb alle regels gecontroleerd op juistheid',
    'Ik begrijp dat wijzigingen na verzending niet meer mogelijk zijn',
    'Ik ga akkoord met de leverings- en betalingsvoorwaarden',
    'Ik bevestig dat de bestelling namens mijn bedrijf wordt geplaatst',
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
    <Modal open={open} onClose={handleClose} title={`Verstuur: ${naam}`} maxWidth="md">
      {modalStep === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Voeg een optioneel bericht toe aan uw aanvraag.
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
          <p className="text-sm font-medium text-gray-700">Bevestig de volgende punten om te versturen:</p>
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
          <h3 className="text-lg font-bold text-gray-800 mb-2">Aanvraag verstuurd!</h3>
          <p className="text-sm text-gray-600 mb-4">
            Uw orderlijst <strong>{naam}</strong> is succesvol verstuurd. U ontvangt een bevestiging per e-mail.
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
  const [orderFilter, setOrderFilter] = useState<OrderStatus>('alle')
  const [orderlijsten, setOrderlijsten] = useState<Orderlijst[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedLists, setSelectedLists] = useState<string[]>([])
  const [sendModal, setSendModal] = useState<{ open: boolean; naam: string; id?: string }>({ open: false, naam: '' })
  const [newListModal, setNewListModal] = useState(false)
  const [viewModal, setViewModal] = useState<{
    open: boolean
    lijst: Orderlijst | null
    regels: OrderlijstRegel[]
    loading: boolean
    catalog: CatalogCache | null
    hasChanges: boolean
    saving: boolean
    deleteConfirm: { regelId: string; label: string } | null
  }>({
    open: false, lijst: null, regels: [], loading: false,
    catalog: null, hasChanges: false, saving: false, deleteConfirm: null,
  })

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
        setOrderlijsten(seedOrderlijsten)
        setOrders(seedOrders)
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

      const { data: ords } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('bevestigd_op', { ascending: false })
      if (ords) setOrders(ords)
      else setOrders(seedOrders)
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

  function herbereken(regels: OrderlijstRegel[], catalog: CatalogCache): OrderlijstRegel[] {
    // 1. Aggregeer volumes voor staffel lookup
    const totaalFH = regels
      .filter(r => r.categorie === 'fineer' || r.categorie === 'hpl')
      .reduce((s, r) => s + r.aantal, 0)
    const totaalKaal = regels
      .filter(r => r.categorie === 'kaal')
      .reduce((s, r) => s + r.aantal, 0)

    // 2. Zoek de juiste marge_coëfficiënt op per categorie
    const coeffFH = getMargeCoefficient(totaalFH, catalog.staffelFH)
    const coeffKaal = getMargeCoefficient(totaalKaal, catalog.staffelKaal)

    // 3. Herbereken elke regel
    return regels.map(regel => {
      const plaat = catalog.baseplaten.find(b => b.id === regel.basisplaat_id)
      if (!plaat || regel.aantal <= 0) return regel

      const coeff = regel.categorie === 'kaal' ? coeffKaal : coeffFH

      // Één-rij staffel met exact het berekende coëfficiënt
      const mockStaffel: StaffelRegel[] = [
        { id: '_mock', van_aantal: 1, tot_aantal: null, marge_coefficient: coeff },
      ]

      // PricingData — verzending op 99999999 want die berekenen we apart op orderniveau
      const pricingData: PricingData = {
        staffel: mockStaffel,
        verzend_drempel: 99_999_999,
        verzend_kosten: 0,
        fineerlijm_per_m2: catalog.fineerlijm,
        schuurbanden_per_m2: catalog.schuurbanden,
        hpl_lijm_per_m2: catalog.hplLijm,
        pu_hotmelt_per_m2: catalog.puHotmelt,
        hotmelt_combinaties: catalog.hotmeltCombs,
      }

      // ConfiguratorState opbouwen vanuit de opgeslagen IDs
      const configuratorState = {
        basisplaat: plaat,
        afmeting: plaat,
        categorie: regel.categorie as 'kaal' | 'fineer' | 'hpl',
        fineer_voor: regel.fineer_voor
          ? catalog.fineers.find(f => f.id === regel.fineer_voor)
          : undefined,
        fineer_tegen: regel.fineer_tegen
          ? catalog.fineers.find(f => f.id === regel.fineer_tegen)
          : undefined,
        hpl_voor: regel.hpl_voor
          ? catalog.hplList.find(h => h.id === regel.hpl_voor)
          : undefined,
        hpl_tegen: regel.hpl_tegen
          ? catalog.hplList.find(h => h.id === regel.hpl_tegen)
          : undefined,
        bewerkingen: catalog.bewerkingen.filter(b =>
          (regel.bewerkingen ?? []).includes(b.id)
        ),
        voegmethode: regel.voegmethode ?? undefined,
        invoer_modus: 'aantal' as const,
        ruimte_indeling: (regel.ruimte_indeling ?? 'geen') as 'geen' | 'per_ruimte',
        ruimtes: [],
        aantal: regel.aantal,
        prijs_per_stuk: 0,
        totaal_prijs: 0,
      }

      const result = calculatePrice(configuratorState, pricingData)

      return {
        ...regel,
        prijs_per_stuk: Math.round((result.subtotaal_na_staffel / regel.aantal) * 100) / 100,
        totaal_prijs: Math.round(result.subtotaal_na_staffel * 100) / 100,
      }
    })
  }

  async function openBekijk(lijst: Orderlijst) {
    setViewModal({ open: true, lijst, regels: [], loading: true, catalog: null, hasChanges: false, saving: false, deleteConfirm: null })
    const supabase = await getSupabase()
    if (!supabase) { setViewModal(v => ({ ...v, loading: false })); return }

    // Laad regels + volledige catalogus parallel
    const [regelRes, bpRes, fnRes, hplRes, bwRes, insRes, hmRes] = await Promise.all([
      supabase.from('orderlijst_regels').select(`
        *,
        baseplaten ( naam, dikte_mm ),
        fineers_voor:fineers!orderlijst_regels_fineer_voor_fkey ( naam, gallery_foto_url ),
        fineers_tegen:fineers!orderlijst_regels_fineer_tegen_fkey ( naam, gallery_foto_url ),
        hpl_voor_data:hpl!orderlijst_regels_hpl_voor_fkey ( kleur, gallery_foto_url ),
        hpl_tegen_data:hpl!orderlijst_regels_hpl_tegen_fkey ( kleur, gallery_foto_url )
      `).eq('orderlijst_id', lijst.id).order('id'),
      supabase.from('baseplaten').select('*'),
      supabase.from('fineers').select('*'),
      supabase.from('hpl').select('*'),
      supabase.from('bewerkingen').select('*'),
      supabase.from('instellingen').select('*'),
      supabase.from('hotmelt_combinaties').select('*'),
    ])

    // Bouw catalog op vanuit instellingen
    const ins = insRes.data ?? []
    const getIns = (key: string, def: number) =>
      parseFloat(ins.find(i => i.sleutel === key)?.waarde ?? String(def))

    let staffelFH = seedStaffelFineerHPL
    let staffelKaal = seedStaffelKaal
    try {
      const fhRaw = ins.find(i => i.sleutel === 'staffel_fineer_hpl')?.waarde
      const kaalRaw = ins.find(i => i.sleutel === 'staffel_kaal')?.waarde
      if (fhRaw) staffelFH = JSON.parse(fhRaw)
      if (kaalRaw) staffelKaal = JSON.parse(kaalRaw)
    } catch { /* gebruik seed defaults */ }

    const catalog: CatalogCache = {
      baseplaten: (bpRes.data ?? []) as Baseplaat[],
      fineers: (fnRes.data ?? []) as Fineer[],
      hplList: (hplRes.data ?? []) as HPL[],
      bewerkingen: (bwRes.data ?? []) as Bewerking[],
      staffelFH,
      staffelKaal,
      verzendDrempel: getIns('verzend_drempel', 1750),
      verzendKosten: getIns('verzend_kosten', 25),
      fineerlijm: getIns('fineerlijm_per_m2', seedVasteKosten.fineerlijm_per_m2),
      schuurbanden: getIns('schuurbanden_per_m2', seedVasteKosten.schuurbanden_per_m2),
      hplLijm: getIns('hpl_lijm_per_m2', seedVasteKosten.hpl_lijm_per_m2),
      puHotmelt: getIns('pu_hotmelt_per_m2', seedVasteKosten.pu_hotmelt_per_m2),
      hotmeltCombs: (hmRes.data ?? []) as HotmeltCombinatie[],
    }

    setViewModal(v => ({ ...v, regels: regelRes.data ?? [], catalog, loading: false }))
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
      const herberekend = v.catalog ? herbereken(newRegels, v.catalog) : newRegels
      return { ...v, regels: herberekend, hasChanges: true }
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
      const herberekend = v.catalog ? herbereken(newRegels, v.catalog) : newRegels
      return { ...v, regels: herberekend, deleteConfirm: null, hasChanges: newRegels.length !== v.regels.length ? v.hasChanges : false }
    })
    toast.success('Regel verwijderd')
  }

  function toggleSelectList(id: string) {
    setSelectedLists(sel =>
      sel.includes(id) ? sel.filter(s => s !== id) : [...sel, id]
    )
  }

  const filteredOrders = orders.filter(o =>
    orderFilter === 'alle' || o.status === orderFilter
  )

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
            <div>
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-lg font-bold text-gray-800">Productcatalogus</h1>
                <Link
                  href="/configurator"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Nieuwe configuratie
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {seedBaseplaten.map(plaat => (
                  <div key={plaat.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                    {/* Image placeholder */}
                    <div className="h-32 bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center">
                      <span className="text-4xl">🪵</span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-800">{plaat.naam}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{plaat.dikte_mm}mm — {plaat.breedte_mm}×{plaat.lengte_mm}mm</p>
                      <div className="flex items-center justify-between mt-3">
                        <div>
                          <span className="text-lg font-bold text-gray-900">€ {plaat.prijs_per_m2.toFixed(2)}</span>
                          <span className="text-xs text-gray-400 ml-1">/ m²</span>
                        </div>
                        <Link
                          href="/configurator"
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Configureer
                        </Link>
                      </div>
                      {!plaat.beschikbaar && (
                        <Badge variant="inactive" className="mt-2">Niet beschikbaar</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <div>
              <h1 className="text-lg font-bold text-gray-800 mb-4">Mijn orders</h1>

              {/* Filter */}
              <div className="flex flex-wrap gap-2 mb-4">
                {(['alle', 'bevestigd', 'in_productie', 'verzonden', 'geleverd'] as OrderStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setOrderFilter(s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors
                      ${orderFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                  >
                    {s === 'alle' ? 'Alle' : ORDER_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredOrders.map(order => {
                  const step = getOrderStep(order.status)
                  return (
                    <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <p className="font-semibold text-gray-800">{order.ordernummer}</p>
                          <p className="text-sm text-gray-500">Bevestigd: {new Date(order.bevestigd_op).toLocaleDateString('nl-NL')}</p>
                          {order.verwachte_levering && (
                            <p className="text-xs text-gray-400">Verwachte levering: {order.verwachte_levering}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-gray-900">€ {order.totaal.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</p>
                          <Badge variant={getStatusBadgeVariant(order.status)}>
                            {ORDER_STATUS_LABELS[order.status] ?? order.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-3">
                        <div className="flex items-center gap-1">
                          {ORDER_STATUS_STEPS.map((label, i) => (
                            <div key={i} className="flex items-center flex-1">
                              <div
                                className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-blue-500' : 'bg-gray-200'}`}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between mt-1">
                          {ORDER_STATUS_STEPS.map((label, i) => (
                            <span key={i} className={`text-xs ${i === step ? 'text-blue-600 font-medium' : 'text-gray-300'}`} style={{ fontSize: '10px' }}>
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>

                      {order.track_trace && (
                        <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                          <span className="text-xs text-blue-700">📦 Track & trace: {order.track_trace}</span>
                          <button className="text-xs text-blue-600 font-medium hover:underline">
                            Volgen →
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {filteredOrders.length === 0 && (
                  <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
                    <p className="text-4xl mb-2">📦</p>
                    <p className="text-sm">Geen orders gevonden voor dit filter.</p>
                  </div>
                )}
              </div>
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
                  <span className="text-sm text-blue-700 font-medium">{selectedLists.length} lijsten geselecteerd</span>
                  <button className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
                    Combineer
                  </button>
                  <button onClick={() => setSelectedLists([])} className="text-sm text-blue-500 hover:underline ml-auto">
                    Selectie opheffen
                  </button>
                </div>
              )}

              {/* Actuele lijsten */}
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Actuele orderlijsten</h2>
                <div className="space-y-3">
                  {actueleListjes.map(lijst => (
                    <div
                      key={lijst.id}
                      className={`bg-white rounded-xl border p-4 transition-all ${
                        selectedLists.includes(lijst.id) ? 'border-blue-400 shadow-sm' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedLists.includes(lijst.id)}
                          onChange={() => toggleSelectList(lijst.id)}
                          className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-800">{lijst.naam}</p>
                            <button
                              onClick={() => toggleListStatus(lijst.id)}
                              className="cursor-pointer"
                            >
                              <Badge variant={lijst.status === 'actueel' ? 'active' : 'concept'}>
                                {lijst.status === 'actueel' ? 'Actueel' : 'Concept'}
                              </Badge>
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Aangemaakt: {new Date(lijst.aangemaakt_op).toLocaleDateString('nl-NL')}
                            {' · '}Bijgewerkt: {new Date(lijst.bijgewerkt_op).toLocaleDateString('nl-NL')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
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
                  ))}
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
                onClick={() => setViewModal(v => ({ ...v, open: false, lijst: null, regels: [], catalog: null, hasChanges: false }))}
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
                    const plaatNaam = (regel.baseplaten as { naam: string; dikte_mm: number } | null)?.naam ?? '—'
                    const plaatDikte = (regel.baseplaten as { naam: string; dikte_mm: number } | null)?.dikte_mm ?? '—'
                    const fotoUrl = (regel.fineers_voor as { gallery_foto_url?: string | null } | null)?.gallery_foto_url
                      ?? (regel.hpl_voor_data as { gallery_foto_url?: string | null } | null)?.gallery_foto_url
                    const afwerkingLabel = regel.categorie === 'fineer'
                      ? `Fineer: ${(regel.fineers_voor as { naam: string } | null)?.naam ?? '—'} / ${(regel.fineers_tegen as { naam: string } | null)?.naam ?? '—'}`
                      : regel.categorie === 'hpl'
                      ? `HPL: ${(regel.hpl_voor_data as { kleur: string } | null)?.kleur ?? '—'} / ${(regel.hpl_tegen_data as { kleur: string } | null)?.kleur ?? '—'}`
                      : 'Kaal'
                    return (
                      <div key={regel.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-4 relative">
                          {fotoUrl && (
                            <img src={fotoUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200 shrink-0" />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm text-gray-800">#{i + 1} — {plaatNaam} {plaatDikte}mm</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                ${regel.categorie === 'fineer' ? 'bg-amber-100 text-amber-700'
                                  : regel.categorie === 'hpl' ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-200 text-gray-600'}`}>
                                {regel.categorie}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">{afwerkingLabel}</p>
                            {regel.voegmethode && (
                              <p className="text-xs text-gray-400 mt-0.5">Voeg: {regel.voegmethode}</p>
                            )}
                            {regel.bewerkingen?.length > 0 && (
                              <p className="text-xs text-gray-400 mt-0.5">Bewerkingen: {regel.bewerkingen.join(', ')}</p>
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
                      <span>Totaal</span>
                      <span>€ {totaal.toFixed(2)}</span>
                    </div>
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
