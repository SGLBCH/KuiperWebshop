'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui/Badge'
import {
  seedBaseplaten,
  seedFineers,
  seedHPL,
  seedBewerkingen,
  seedStaffelFineerHPL,
  seedStaffelKaal,
  seedInstellingen,
} from '@/lib/seed-data'
import type { Baseplaat, Fineer, HPL, Bewerking, StaffelRegel } from '@/lib/types'

type AdminTab =
  | 'aanmeldingen'
  | 'klanten'
  | 'aanvragen'
  | 'prijzen'
  | 'staffel'
  | 'galerij_basisplaat'
  | 'galerij_fineer'
  | 'galerij_hpl'
  | 'bewerkingen'

const DEMO_AANMELDINGEN = [
  { id: 'a1', naam: 'Pieter Smit', bedrijf: 'Smit Interieur', email: 'p.smit@smitinterieur.nl', datum: '2026-05-07', rol: 'kijker' as const },
  { id: 'a2', naam: 'Lisa van der Berg', bedrijf: 'VDB Keukens B.V.', email: 'l.vdberg@vdbkeukens.nl', datum: '2026-05-06', rol: 'kijker' as const },
  { id: 'a3', naam: 'Mark Jansen', bedrijf: 'Jansen Meubelmakerij', email: 'm.jansen@jansen.nl', datum: '2026-05-05', rol: 'kijker' as const },
]

const DEMO_KLANTEN = [
  { id: 'k1', naam: 'Jan de Vries', bedrijf: 'De Vries Interieurbouw', rol: 'calculator', status: 'goedgekeurd', last_seen: '2026-05-08', clicks: 142 },
  { id: 'k2', naam: 'Sandra Peters', bedrijf: 'Peters & Zn.', rol: 'inkoper', status: 'goedgekeurd', last_seen: '2026-05-07', clicks: 89 },
  { id: 'k3', naam: 'Tom van Dijk', bedrijf: 'Van Dijk Timmerwerk', rol: 'kijker', status: 'gedeactiveerd', last_seen: '2026-04-20', clicks: 12 },
]

const DEMO_AANVRAGEN = [
  { id: 'av1', project: 'Keuken Renovatie', klant: 'Jan de Vries', waarde: 3480, aangemaakt: '2026-04-28', verstuurd: '2026-04-28', bericht: true, fineerkeuze: 'fabriek' },
  { id: 'av2', project: 'Kastenwand Slaapkamer', klant: 'Sandra Peters', waarde: 1875, aangemaakt: '2026-04-10', verstuurd: '2026-04-10', bericht: false, fineerkeuze: 'persoonlijk' },
  { id: 'av3', project: 'Wandpanelen Woonkamer', klant: 'Jan de Vries', waarde: 920, aangemaakt: '2026-03-22', verstuurd: '2026-03-22', bericht: false, fineerkeuze: 'foto_kuiper' },
]

type AanmeldingRow = { id: string; naam: string; bedrijf: string; email: string; datum: string; rol: 'kijker' | 'calculator' | 'inkoper' }
type KlantRow = { id: string; naam: string; bedrijf: string; rol: string; status: string; last_seen: string; clicks: number }
type AanvraagRow = {
  id: string
  project: string
  klant: string
  waarde: number
  aangemaakt: string
  verstuurd: string
  bericht: string | null
  fineerkeuze: string | null
}
type ConceptRow = { id: string; naam: string; klant: string; status: string; bijgewerkt: string }

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('aanmeldingen')
  const [loadingData, setLoadingData] = useState(true)

  // Aanmeldingen state
  const [aanmeldingen, setAanmeldingen] = useState<AanmeldingRow[]>([])
  const [rolKeuzes, setRolKeuzes] = useState<Record<string, string>>({})

  // Klanten state
  const [klanten, setKlanten] = useState<KlantRow[]>(DEMO_KLANTEN)

  // Aanvragen state
  const [aanvragen, setAanvragen] = useState<AanvraagRow[]>([])
  const [concepten, setConcepten] = useState<ConceptRow[]>([])

  // Load real data from Supabase on mount
  useEffect(() => {
    async function loadData() {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
          // Demo mode fallback
          setAanmeldingen(DEMO_AANMELDINGEN)
          setRolKeuzes(Object.fromEntries(DEMO_AANMELDINGEN.map(a => [a.id, 'kijker'])))
          setKlanten(DEMO_KLANTEN)
          setLoadingData(false)
          return
        }

        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()

        // Fetch pending registrations
        const { data: pendingData } = await supabase
          .from('profiles')
          .select('id, naam, bedrijf, email, aangemaakt_op')
          .eq('status', 'pending')
          .order('aangemaakt_op', { ascending: false })

        if (pendingData) {
          const rows: AanmeldingRow[] = pendingData.map(p => ({
            id: p.id,
            naam: p.naam ?? '—',
            bedrijf: p.bedrijf ?? '—',
            email: p.email,
            datum: p.aangemaakt_op?.split('T')[0] ?? '—',
            rol: 'kijker' as const,
          }))
          setAanmeldingen(rows)
          setRolKeuzes(Object.fromEntries(rows.map(r => [r.id, 'kijker'])))
        }

        // Fetch approved customers
        const { data: klantenData } = await supabase
          .from('profiles')
          .select('id, naam, bedrijf, rol, status, aangemaakt_op')
          .in('status', ['goedgekeurd', 'gedeactiveerd'])
          .order('aangemaakt_op', { ascending: false })

        if (klantenData && klantenData.length > 0) {
          setKlanten(klantenData.map(k => ({
            id: k.id,
            naam: k.naam ?? '—',
            bedrijf: k.bedrijf ?? '—',
            rol: k.rol ?? 'kijker',
            status: k.status,
            last_seen: '—',
            clicks: 0,
          })))
        }

        // Fetch aanvragen (verstuurd door klanten)
        const { data: aanvraagData } = await supabase
          .from('aanvragen')
          .select(`
            id, bericht, totaal_waarde, verstuurd_op,
            fineerkeuze_tekst, orderlijst_ids,
            profiles ( naam, bedrijf )
          `)
          .eq('status', 'nieuw')
          .order('verstuurd_op', { ascending: false })

        if (aanvraagData) {
          // Haal orderlijstnamen op via aparte query
          const aanvraagRows: AanvraagRow[] = await Promise.all(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            aanvraagData.map(async (a: any) => {
              let projectNaam = '—'
              const ids = (a.orderlijst_ids as string[]) ?? []
              if (ids.length > 0) {
                const { data: ol } = await supabase
                  .from('orderlijsten')
                  .select('naam')
                  .in('id', ids)
                if (ol?.length) projectNaam = ol.map((o: { naam: string }) => o.naam).join(', ')
              }
              const profiel = a.profiles as { naam: string; bedrijf: string } | null
              return {
                id: a.id,
                project: projectNaam,
                klant: profiel?.naam ?? '—',
                waarde: a.totaal_waarde ?? 0,
                aangemaakt: a.verstuurd_op?.split('T')[0] ?? '—',
                verstuurd: a.verstuurd_op?.split('T')[0] ?? '—',
                bericht: a.bericht ?? null,
                fineerkeuze: a.fineerkeuze_tekst ?? null,
              }
            })
          )
          setAanvragen(aanvraagRows)
        }

        // Fetch concepten (actieve orderlijsten van alle klanten)
        const { data: conceptData } = await supabase
          .from('orderlijsten')
          .select('id, naam, status, bijgewerkt_op, profiles ( naam )')
          .in('status', ['actueel', 'concept'])
          .order('bijgewerkt_op', { ascending: false })

        if (conceptData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setConcepten(conceptData.map((c: any) => ({
            id: c.id,
            naam: c.naam,
            klant: (c.profiles as { naam: string } | { naam: string }[] | null) instanceof Array
              ? (c.profiles as { naam: string }[])[0]?.naam ?? '—'
              : (c.profiles as { naam: string } | null)?.naam ?? '—',
            status: c.status,
            bijgewerkt: c.bijgewerkt_op?.split('T')[0] ?? '—',
          })))
        }

      } catch (err) {
        console.error('Failed to load admin data:', err)
        // Keep demo data on error
        setAanmeldingen(DEMO_AANMELDINGEN)
        setRolKeuzes(Object.fromEntries(DEMO_AANMELDINGEN.map(a => [a.id, 'kijker'])))
      } finally {
        setLoadingData(false)
      }
    }
    loadData()
  }, [])

  // Prijzen state
  const [baseplaten, setBaseplaten] = useState<Baseplaat[]>(seedBaseplaten)
  const [fineers, setFineers] = useState<Fineer[]>(seedFineers)
  const [hplList, setHplList] = useState<HPL[]>(seedHPL)

  // Staffel state
  const [staffelFH, setStaffelFH] = useState<StaffelRegel[]>(seedStaffelFineerHPL)
  const [staffelKaal, setStaffelKaal] = useState<StaffelRegel[]>(seedStaffelKaal)
  const [verzendDrempel, setVerzendDrempel] = useState(
    parseFloat(seedInstellingen.find(i => i.sleutel === 'verzend_drempel')?.waarde ?? '1750')
  )
  const [verzendKosten, setVerzendKosten] = useState(
    parseFloat(seedInstellingen.find(i => i.sleutel === 'verzend_kosten')?.waarde ?? '25')
  )

  // Bewerkingen state
  const [bewerkingen, setBewerkingen] = useState<Bewerking[]>(seedBewerkingen)
  const [newBewerking, setNewBewerking] = useState({ naam: '', beschrijving: '', prijs: '' })

  // Aanvragen sub-tab
  const [aanvraagSubTab, setAanvraagSubTab] = useState<'definitief' | 'concepten'>('definitief')

  const TABS: { id: AdminTab; label: string }[] = [
    { id: 'aanmeldingen', label: 'Aanmeldingen' },
    { id: 'klanten', label: 'Klanten' },
    { id: 'aanvragen', label: 'Aanvragen' },
    { id: 'prijzen', label: 'Prijzen' },
    { id: 'staffel', label: 'Staffel' },
    { id: 'galerij_basisplaat', label: 'Galerij Basisplaat' },
    { id: 'galerij_fineer', label: 'Galerij Fineer' },
    { id: 'galerij_hpl', label: 'Galerij HPL' },
    { id: 'bewerkingen', label: 'Bewerkingen' },
  ]

  async function approveAanmelding(id: string) {
    const gekozenRol = rolKeuzes[id] ?? 'kijker'
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (supabaseUrl && supabaseUrl !== 'https://your-project.supabase.co') {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { error } = await supabase
          .from('profiles')
          .update({ status: 'goedgekeurd', rol: gekozenRol })
          .eq('id', id)
        if (error) { toast.error('Opslaan mislukt: ' + error.message); return }
      }
    } catch { /* ignore network errors in demo */ }
    setAanmeldingen(a => a.filter(x => x.id !== id))
    toast.success('Aanmelding goedgekeurd als ' + gekozenRol)
  }

  async function rejectAanmelding(id: string) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (supabaseUrl && supabaseUrl !== 'https://your-project.supabase.co') {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        await supabase.from('profiles').update({ status: 'afgewezen' }).eq('id', id)
      }
    } catch { /* ignore */ }
    setAanmeldingen(a => a.filter(x => x.id !== id))
    toast.error('Aanmelding afgewezen')
  }

  function toggleKlantStatus(id: string) {
    setKlanten(k => k.map(x => x.id === id
      ? { ...x, status: x.status === 'goedgekeurd' ? 'gedeactiveerd' : 'goedgekeurd' }
      : x
    ))
  }

  function addStaffelRow(type: 'fh' | 'kaal') {
    const newRow: StaffelRegel = { id: `sr-${Date.now()}`, van_aantal: 0, tot_aantal: null, multiplier: 1.0 }
    if (type === 'fh') setStaffelFH(s => [...s, newRow])
    else setStaffelKaal(s => [...s, newRow])
  }

  function removeStaffelRow(type: 'fh' | 'kaal', id: string) {
    if (type === 'fh') setStaffelFH(s => s.filter(r => r.id !== id))
    else setStaffelKaal(s => s.filter(r => r.id !== id))
  }

  function addBewerking() {
    if (!newBewerking.naam || !newBewerking.prijs) {
      toast.error('Vul minimaal naam en prijs in')
      return
    }
    const bew: Bewerking = {
      id: `bw-${Date.now()}`,
      naam: newBewerking.naam,
      beschrijving: newBewerking.beschrijving,
      prijs: parseFloat(newBewerking.prijs),
      compatibiliteit: ['kaal', 'fineer', 'hpl'],
      beschikbaar: true,
      volgorde: bewerkingen.length + 1,
    }
    setBewerkingen(b => [...b, bew])
    setNewBewerking({ naam: '', beschrijving: '', prijs: '' })
    toast.success('Bewerking toegevoegd')
  }

  function toggleBewerking(id: string) {
    setBewerkingen(b => b.map(x => x.id === id ? { ...x, beschikbaar: !x.beschikbaar } : x))
  }

  function exportCsv(data: Record<string, unknown>[], filename: string) {
    if (!data.length) return
    const keys = Object.keys(data[0])
    const csv = [keys.join(','), ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${filename} geëxporteerd`)
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gray-500 text-sm">Gegevens laden…</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-xl font-bold text-gray-800">Beheerpaneel</h1>
        <Badge variant="info">Admin</Badge>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors
              ${activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'}`}
          >
            {tab.label}
            {tab.id === 'aanmeldingen' && aanmeldingen.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{aanmeldingen.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {/* ─── AANMELDINGEN ─── */}
        {activeTab === 'aanmeldingen' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Nieuwe aanmeldingen</h2>
            {aanmeldingen.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-sm">Geen openstaande aanmeldingen</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Naam</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Bedrijf</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">E-mail</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Datum</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Rol toekennen</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Actie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aanmeldingen.map(a => (
                      <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium text-gray-800">{a.naam}</td>
                        <td className="py-3 px-3 text-gray-600">{a.bedrijf}</td>
                        <td className="py-3 px-3 text-gray-500">{a.email}</td>
                        <td className="py-3 px-3 text-gray-400">{a.datum}</td>
                        <td className="py-3 px-3">
                          <select
                            value={rolKeuzes[a.id]}
                            onChange={e => setRolKeuzes(r => ({ ...r, [a.id]: e.target.value }))}
                            className="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none"
                          >
                            <option value="kijker">Kijker</option>
                            <option value="calculator">Calculator</option>
                            <option value="inkoper">Inkoper</option>
                          </select>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => approveAanmelding(a.id)}
                              className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
                            >
                              Goedkeuren
                            </button>
                            <button
                              onClick={() => rejectAanmelding(a.id)}
                              className="px-3 py-1 bg-red-100 text-red-600 text-xs font-medium rounded-lg hover:bg-red-200"
                            >
                              Afwijzen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── KLANTEN ─── */}
        {activeTab === 'klanten' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Klantenbeheer</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Naam</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Bedrijf</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Rol</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Laatste sessie</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Kliks</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {klanten.map(k => (
                    <tr key={k.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium text-gray-800">{k.naam}</td>
                      <td className="py-3 px-3 text-gray-600">{k.bedrijf}</td>
                      <td className="py-3 px-3">
                        <Badge variant={k.rol === 'inkoper' ? 'approved' : k.rol === 'calculator' ? 'info' : 'inactive'}>
                          {k.rol}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <button onClick={() => toggleKlantStatus(k.id)}>
                          <Badge variant={k.status === 'goedgekeurd' ? 'active' : 'inactive'}>
                            {k.status}
                          </Badge>
                        </button>
                      </td>
                      <td className="py-3 px-3 text-gray-400 text-xs">{k.last_seen}</td>
                      <td className="py-3 px-3 text-gray-600">{k.clicks}</td>
                      <td className="py-3 px-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleKlantStatus(k.id)}
                            className={`px-2 py-1 text-xs font-medium rounded-lg ${
                              k.status === 'goedgekeurd'
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : 'bg-green-50 text-green-600 hover:bg-green-100'
                            }`}
                          >
                            {k.status === 'goedgekeurd' ? 'Deactiveer' : 'Activeer'}
                          </button>
                          <button className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                            Profiel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── AANVRAGEN ─── */}
        {activeTab === 'aanvragen' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Aanvragen</h2>
            <div className="flex gap-2 mb-4">
              {(['definitief', 'concepten'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setAanvraagSubTab(st)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
                    ${aanvraagSubTab === st ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {st === 'definitief' ? 'Definitief' : 'Concepten'}
                </button>
              ))}
            </div>

            {aanvraagSubTab === 'definitief' && (
              aanvragen.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-3xl mb-2">📬</p>
                  <p className="text-sm">Nog geen verstuurde aanvragen.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Project</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Klant</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600">Waarde</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Verstuurd</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-600">Bericht</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Fineerkeuze</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aanvragen.map(a => (
                        <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium text-gray-800">{a.project}</td>
                          <td className="py-3 px-3 text-gray-600">{a.klant}</td>
                          <td className="py-3 px-3 text-right font-medium">€ {a.waarde.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 px-3 text-gray-400 text-xs">{a.verstuurd}</td>
                          <td className="py-3 px-3 text-center" title={a.bericht ?? ''}>{a.bericht ? '💬' : '—'}</td>
                          <td className="py-3 px-3 text-xs text-gray-500">{a.fineerkeuze ? `🪵 ${a.fineerkeuze}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {aanvraagSubTab === 'concepten' && (
              concepten.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-3xl mb-2">📋</p>
                  <p className="text-sm">Geen actieve concepten van klanten.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Orderlijst</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Klant</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Status</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Bijgewerkt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {concepten.map(c => (
                        <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium text-gray-800">{c.naam}</td>
                          <td className="py-3 px-3 text-gray-600">{c.klant}</td>
                          <td className="py-3 px-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                              ${c.status === 'actueel' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-400 text-xs">{c.bijgewerkt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}

        {/* ─── PRIJZEN ─── */}
        {activeTab === 'prijzen' && (
          <div className="p-6 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Prijsbeheer</h2>
            </div>

            {/* Basisplaten */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Basisplaten</h3>
                <button
                  onClick={() => exportCsv(baseplaten as unknown as Record<string, unknown>[], 'basisplaten.csv')}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                >
                  CSV Exporteren
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Naam</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Dikte</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Breedte</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Lengte</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">€/m²</th>
                      <th className="text-center py-2 px-2 font-semibold text-gray-500">Actief</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baseplaten.map(p => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{p.naam}</td>
                        <td className="py-2 px-2 text-right text-gray-600">{p.dikte_mm}mm</td>
                        <td className="py-2 px-2 text-right text-gray-600">{p.breedte_mm}</td>
                        <td className="py-2 px-2 text-right text-gray-600">{p.lengte_mm}</td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            value={p.prijs_per_m2}
                            step="0.01"
                            onChange={e => setBaseplaten(b => b.map(x => x.id === p.id ? { ...x, prijs_per_m2: parseFloat(e.target.value) || 0 } : x))}
                            className="w-20 text-right px-1 py-0.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={p.beschikbaar}
                            onChange={() => setBaseplaten(b => b.map(x => x.id === p.id ? { ...x, beschikbaar: !x.beschikbaar } : x))}
                            className="w-4 h-4"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fineers */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Fineers</h3>
                <button
                  onClick={() => exportCsv(fineers as unknown as Record<string, unknown>[], 'fineers.csv')}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                >
                  CSV Exporteren
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Naam</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Voor lang</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Voor kort</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Tegen lang</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Tegen kort</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">FK Advies</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Status lang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fineers.map(f => (
                      <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{f.naam}</td>
                        {[
                          { key: 'prijs_voorzijde_lang', val: f.prijs_voorzijde_lang },
                          { key: 'prijs_voorzijde_kort', val: f.prijs_voorzijde_kort },
                          { key: 'prijs_tegenzijde_lang', val: f.prijs_tegenzijde_lang },
                          { key: 'prijs_tegenzijde_kort', val: f.prijs_tegenzijde_kort },
                        ].map(field => (
                          <td key={field.key} className="py-2 px-2 text-right">
                            <input
                              type="number"
                              value={field.val}
                              step="0.01"
                              onChange={e => setFineers(arr => arr.map(x => x.id === f.id ? { ...x, [field.key]: parseFloat(e.target.value) || 0 } : x))}
                              className="w-20 text-right px-1 py-0.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                        ))}
                        <td className="py-2 px-2">
                          <select
                            value={f.fk_advies}
                            onChange={e => setFineers(arr => arr.map(x => x.id === f.id ? { ...x, fk_advies: e.target.value as Fineer['fk_advies'] } : x))}
                            className="text-xs px-1 py-0.5 border border-gray-300 rounded bg-white focus:outline-none"
                          >
                            <option value="fabriek">Fabriek</option>
                            <option value="foto_kuiper">Foto Kuiper</option>
                            <option value="foto_klant">Foto klant</option>
                            <option value="persoonlijk">Persoonlijk</option>
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant={f.status_lang === 'beschikbaar' ? 'active' : f.status_lang === 'tijdelijk_niet' ? 'warning' : 'inactive'}>
                            {f.status_lang}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* HPL */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">HPL</h3>
                <button
                  onClick={() => exportCsv(hplList as unknown as Record<string, unknown>[], 'hpl.csv')}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                >
                  CSV Exporteren
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Kleur</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">€ lang</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">€ kort</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Plaat B lang</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-500">Plaat L lang</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500">Status lang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hplList.map(h => (
                      <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{h.kleur}</td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            value={h.prijs_lang}
                            step="0.01"
                            onChange={e => setHplList(arr => arr.map(x => x.id === h.id ? { ...x, prijs_lang: parseFloat(e.target.value) || 0 } : x))}
                            className="w-20 text-right px-1 py-0.5 border border-gray-300 rounded text-sm focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            value={h.prijs_kort}
                            step="0.01"
                            onChange={e => setHplList(arr => arr.map(x => x.id === h.id ? { ...x, prijs_kort: parseFloat(e.target.value) || 0 } : x))}
                            className="w-20 text-right px-1 py-0.5 border border-gray-300 rounded text-sm focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-2 text-right text-gray-500 text-xs">{h.hpl_afm_lang_b}mm</td>
                        <td className="py-2 px-2 text-right text-gray-500 text-xs">{h.hpl_afm_lang_l}mm</td>
                        <td className="py-2 px-2">
                          <Badge variant={h.status_lang === 'beschikbaar' ? 'active' : h.status_lang === 'tijdelijk_niet' ? 'warning' : 'inactive'}>
                            {h.status_lang}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={() => toast.success('Prijzen opgeslagen')}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700"
            >
              Prijzen opslaan
            </button>
          </div>
        )}

        {/* ─── STAFFEL ─── */}
        {activeTab === 'staffel' && (
          <div className="p-6 space-y-8">
            <h2 className="text-lg font-semibold text-gray-800">Staffel & verzendkosten</h2>

            {/* Fineer & HPL staffel */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Staffel Fineer & HPL</h3>
                <button onClick={() => addStaffelRow('fh')} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  + Rij toevoegen
                </button>
              </div>
              <StaffelTable
                staffel={staffelFH}
                onChange={setStaffelFH}
                onRemove={id => removeStaffelRow('fh', id)}
              />
            </div>

            {/* Kaal staffel */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Staffel Kaal</h3>
                <button onClick={() => addStaffelRow('kaal')} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  + Rij toevoegen
                </button>
              </div>
              <StaffelTable
                staffel={staffelKaal}
                onChange={setStaffelKaal}
                onRemove={id => removeStaffelRow('kaal', id)}
              />
            </div>

            {/* Verzendkosten */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Verzendkosten</h3>
              <div className="grid sm:grid-cols-2 gap-4 max-w-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Gratis boven (€)</label>
                  <input
                    type="number"
                    value={verzendDrempel}
                    onChange={e => setVerzendDrempel(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Kosten onder drempel (€)</label>
                  <input
                    type="number"
                    value={verzendKosten}
                    onChange={e => setVerzendKosten(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Preview: Bestelling van € {(verzendDrempel - 1).toFixed(0)} → € {verzendKosten.toFixed(2)} verzendkosten
                &nbsp;|&nbsp; Bestelling van € {verzendDrempel.toFixed(0)} → Gratis verzending
              </p>
            </div>

            <button
              onClick={() => toast.success('Staffel opgeslagen')}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700"
            >
              Opslaan
            </button>
          </div>
        )}

        {/* ─── GALERIJEN ─── */}
        {(activeTab === 'galerij_basisplaat' || activeTab === 'galerij_fineer' || activeTab === 'galerij_hpl') && (
          <GallerijTab
            title={
              activeTab === 'galerij_basisplaat' ? 'Galerij Basisplaat' :
              activeTab === 'galerij_fineer' ? 'Galerij Fineer' : 'Galerij HPL'
            }
            items={
              activeTab === 'galerij_basisplaat' ? seedBaseplaten.map(p => ({ id: p.id, naam: p.naam, url: undefined })) :
              activeTab === 'galerij_fineer' ? seedFineers.map(f => ({ id: f.id, naam: f.naam, url: f.gallery_foto_url })) :
              seedHPL.map(h => ({ id: h.id, naam: h.kleur, url: h.gallery_foto_url }))
            }
          />
        )}

        {/* ─── BEWERKINGEN ─── */}
        {activeTab === 'bewerkingen' && (
          <div className="p-6 space-y-6">
            <h2 className="text-lg font-semibold text-gray-800">Bewerkingen beheren</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-500">Naam</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-500">Beschrijving</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500">€/m²</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-500">Compatibiliteit</th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-500">Beschikbaar</th>
                  </tr>
                </thead>
                <tbody>
                  {bewerkingen.map(b => (
                    <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium">{b.naam}</td>
                      <td className="py-3 px-3 text-gray-500 text-xs max-w-48">{b.beschrijving}</td>
                      <td className="py-3 px-3 text-right">€ {b.prijs.toFixed(2)}</td>
                      <td className="py-3 px-3">
                        <div className="flex gap-1 flex-wrap">
                          {b.compatibiliteit.map(c => (
                            <Badge key={c} variant="info">{c}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => toggleBewerking(b.id)}
                          className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                            b.beschikbaar
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {b.beschikbaar ? '✓ Actief' : '✗ Inactief'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add bewerking form */}
            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Nieuwe bewerking toevoegen</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newBewerking.naam}
                  onChange={e => setNewBewerking(n => ({ ...n, naam: e.target.value }))}
                  placeholder="Naam *"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={newBewerking.beschrijving}
                  onChange={e => setNewBewerking(n => ({ ...n, beschrijving: e.target.value }))}
                  placeholder="Beschrijving"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={newBewerking.prijs}
                    onChange={e => setNewBewerking(n => ({ ...n, prijs: e.target.value }))}
                    placeholder="€/m² *"
                    step="0.01"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addBewerking}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
                  >
                    + Voeg toe
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StaffelTable({
  staffel,
  onChange,
  onRemove,
}: {
  staffel: StaffelRegel[]
  onChange: (s: StaffelRegel[]) => void
  onRemove: (id: string) => void
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="text-left py-2 px-2 font-semibold text-gray-500">Van aantal</th>
          <th className="text-left py-2 px-2 font-semibold text-gray-500">Tot aantal</th>
          <th className="text-left py-2 px-2 font-semibold text-gray-500">Multiplier</th>
          <th className="text-left py-2 px-2 font-semibold text-gray-500">Korting</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {staffel.map(r => (
          <tr key={r.id} className="border-b border-gray-100">
            <td className="py-1.5 px-2">
              <input
                type="number"
                value={r.van_aantal}
                onChange={e => onChange(staffel.map(x => x.id === r.id ? { ...x, van_aantal: parseInt(e.target.value) || 0 } : x))}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none"
              />
            </td>
            <td className="py-1.5 px-2">
              <input
                type="number"
                value={r.tot_aantal ?? ''}
                placeholder="∞"
                onChange={e => onChange(staffel.map(x => x.id === r.id ? { ...x, tot_aantal: e.target.value ? parseInt(e.target.value) : null } : x))}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none"
              />
            </td>
            <td className="py-1.5 px-2">
              <input
                type="number"
                value={r.multiplier}
                step="0.01"
                min="0"
                max="1"
                onChange={e => onChange(staffel.map(x => x.id === r.id ? { ...x, multiplier: parseFloat(e.target.value) || 1 } : x))}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none"
              />
            </td>
            <td className="py-1.5 px-2 text-sm">
              {r.multiplier < 1 ? (
                <Badge variant="approved">−{Math.round((1 - r.multiplier) * 100)}%</Badge>
              ) : (
                <span className="text-gray-400">Geen</span>
              )}
            </td>
            <td className="py-1.5 px-2">
              <button
                onClick={() => onRemove(r.id)}
                className="text-red-400 hover:text-red-600 text-xs px-2 py-0.5 hover:bg-red-50 rounded"
              >
                ✕
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function GallerijTab({
  title,
  items,
}: {
  title: string
  items: { id: string; naam: string; url: string | undefined }[]
}) {
  const [images, setImages] = useState<Record<string, string>>(
    Object.fromEntries(items.filter(i => i.url).map(i => [i.id, i.url!]))
  )

  function handleUpload(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setImages(imgs => ({ ...imgs, [id]: ev.target?.result as string }))
    }
    reader.readAsDataURL(file)
  }

  function deleteImage(id: string) {
    setImages(imgs => {
      const copy = { ...imgs }
      delete copy[id]
      return copy
    })
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(item => (
          <div key={item.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="h-32 bg-gray-50 flex items-center justify-center relative">
              {images[item.id] ? (
                <>
                  <img
                    src={images[item.id]}
                    alt={item.naam}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => deleteImage(item.id)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <span className="text-3xl opacity-30">🪵</span>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs font-medium text-gray-700 truncate">{item.naam}</p>
              <label className="mt-1 block">
                <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded cursor-pointer hover:bg-blue-100 inline-block">
                  Upload
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleUpload(item.id, e)}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
