'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui/Badge'
import type { Orderlijst } from '@/lib/types'

type ProfileTab = 'persoonlijk' | 'bedrijf' | 'email' | 'beveiliging' | 'geschiedenis'

type Profile = {
  id: string
  email: string
  naam: string
  bedrijf: string
  branche: string
  adres: string
  kvk: string
  telefoon: string
  order_confirm_email: string
  order_confirm_email_cc: string
  rol: 'kijker' | 'calculator' | 'inkoper' | 'admin'
  status: string
}

const EMPTY_PROFILE: Profile = {
  id: '', email: '', naam: '', bedrijf: '', branche: '', adres: '',
  kvk: '', telefoon: '', order_confirm_email: '', order_confirm_email_cc: '',
  rol: 'kijker', status: 'goedgekeurd',
}

const ROL_LADDER = [
  { id: 'kijker', label: 'Kijker', beschrijving: 'Kan catalogus bekijken' },
  { id: 'calculator', label: 'Calculator', beschrijving: 'Kan prijzen berekenen en orderlijsten maken' },
  { id: 'inkoper', label: 'Inkoper', beschrijving: 'Kan bestellingen plaatsen en bevestigen' },
]

const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'persoonlijk', label: 'Persoonlijk' },
  { id: 'bedrijf', label: 'Bedrijf' },
  { id: 'email', label: 'E-mailinstellingen' },
  { id: 'beveiliging', label: 'Beveiliging' },
  { id: 'geschiedenis', label: 'Ordergeschiedenis' },
]

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('persoonlijk')
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [demoMode, setDemoMode] = useState(false)
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE)
  const [orderlijsten, setOrderlijsten] = useState<Orderlijst[]>([])

  // Persoonlijk edit state
  const [editingPersonal, setEditingPersonal] = useState(false)
  const [naam, setNaam] = useState('')
  const [telefoon, setTelefoon] = useState('')

  // Bedrijf edit state
  const [editingBedrijf, setEditingBedrijf] = useState(false)
  const [bedrijf, setBedrijf] = useState('')
  const [kvk, setKvk] = useState('')
  const [branche, setBranche] = useState('')
  const [adres, setAdres] = useState('')

  // Email state
  const [confirmEmail, setConfirmEmail] = useState('')
  const [confirmEmailCc, setConfirmEmailCc] = useState('')

  // Beveiliging state
  const [huidigWachtwoord, setHuidigWachtwoord] = useState('')
  const [nieuwWachtwoord, setNieuwWachtwoord] = useState('')
  const [bevestigWachtwoord, setBevestigWachtwoord] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const getSupabase = useCallback(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url || url === 'https://your-project.supabase.co') return null
    const { createClient } = await import('@/lib/supabase/client')
    return createClient()
  }, [])

  function applyProfile(p: Profile) {
    setProfile(p)
    setNaam(p.naam)
    setTelefoon(p.telefoon ?? '')
    setBedrijf(p.bedrijf ?? '')
    setKvk(p.kvk ?? '')
    setBranche(p.branche ?? '')
    setAdres(p.adres ?? '')
    setConfirmEmail(p.order_confirm_email ?? p.email)
    setConfirmEmailCc(p.order_confirm_email_cc ?? '')
  }

  useEffect(() => {
    async function load() {
      setLoadingProfile(true)
      const supabase = await getSupabase()
      if (!supabase) {
        setDemoMode(true)
        applyProfile({
          id: 'demo', email: 'demo@kuiperholland.nl', naam: 'Demo Gebruiker',
          bedrijf: 'Demo Interieurbouw B.V.', branche: 'Interieurbouw',
          adres: 'Demostraat 1, 1234 AB Amsterdam', kvk: '00000000',
          telefoon: '', order_confirm_email: 'demo@kuiperholland.nl',
          order_confirm_email_cc: '', rol: 'calculator', status: 'goedgekeurd',
        })
        setLoadingProfile(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoadingProfile(false); return }

      const [profileRes, lijstenRes] = await Promise.all([
        supabase.from('profiles')
          .select('id, email, naam, bedrijf, branche, adres, kvk, telefoon, order_confirm_email, order_confirm_email_cc, rol, status')
          .eq('id', user.id)
          .single(),
        supabase.from('orderlijsten')
          .select('*')
          .eq('user_id', user.id)
          .order('bijgewerkt_op', { ascending: false }),
      ])

      if (profileRes.data) {
        applyProfile({
          ...EMPTY_PROFILE,
          ...profileRes.data,
          email: profileRes.data.email ?? user.email ?? '',
        } as Profile)
      } else {
        // Profile bestaat nog niet — gebruik auth email als basis
        applyProfile({ ...EMPTY_PROFILE, id: user.id, email: user.email ?? '' })
      }

      if (lijstenRes.data) setOrderlijsten(lijstenRes.data)
      setLoadingProfile(false)
    }
    load()
  }, [getSupabase])

  async function savePersonal() {
    const supabase = await getSupabase()
    if (supabase) {
      const { error } = await supabase.from('profiles')
        .update({ naam, telefoon: telefoon || null })
        .eq('id', profile.id)
      if (error) { toast.error('Opslaan mislukt: ' + error.message); return }
    }
    setProfile(p => ({ ...p, naam, telefoon }))
    toast.success('Persoonlijke gegevens opgeslagen')
    setEditingPersonal(false)
  }

  function cancelPersonal() {
    setNaam(profile.naam)
    setTelefoon(profile.telefoon ?? '')
    setEditingPersonal(false)
  }

  async function saveBedrijf() {
    const supabase = await getSupabase()
    if (supabase) {
      const { error } = await supabase.from('profiles')
        .update({ bedrijf, kvk: kvk || null, branche: branche || null, adres: adres || null })
        .eq('id', profile.id)
      if (error) { toast.error('Opslaan mislukt: ' + error.message); return }
    }
    setProfile(p => ({ ...p, bedrijf, kvk, branche, adres }))
    toast.success('Bedrijfsgegevens opgeslagen')
    setEditingBedrijf(false)
  }

  function cancelBedrijf() {
    setBedrijf(profile.bedrijf ?? '')
    setKvk(profile.kvk ?? '')
    setBranche(profile.branche ?? '')
    setAdres(profile.adres ?? '')
    setEditingBedrijf(false)
  }

  async function saveEmail() {
    const supabase = await getSupabase()
    if (supabase) {
      const { error } = await supabase.from('profiles')
        .update({ order_confirm_email: confirmEmail || null, order_confirm_email_cc: confirmEmailCc || null })
        .eq('id', profile.id)
      if (error) { toast.error('Opslaan mislukt: ' + error.message); return }
    }
    setProfile(p => ({ ...p, order_confirm_email: confirmEmail, order_confirm_email_cc: confirmEmailCc }))
    toast.success('E-mailinstellingen opgeslagen')
  }

  async function changePassword() {
    if (!huidigWachtwoord || !nieuwWachtwoord) {
      toast.error('Vul alle velden in')
      return
    }
    if (nieuwWachtwoord !== bevestigWachtwoord) {
      toast.error('Nieuwe wachtwoorden komen niet overeen')
      return
    }
    if (nieuwWachtwoord.length < 8) {
      toast.error('Wachtwoord moet minimaal 8 tekens bevatten')
      return
    }

    setSavingPassword(true)
    try {
      const supabase = await getSupabase()
      if (!supabase) { toast.success('Wachtwoord gewijzigd (demo)'); return }

      // Verifieer huidig wachtwoord via re-authenticatie
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: huidigWachtwoord,
      })
      if (signInError) { toast.error('Huidig wachtwoord is onjuist'); return }

      const { error } = await supabase.auth.updateUser({ password: nieuwWachtwoord })
      if (error) { toast.error('Wijzigen mislukt: ' + error.message); return }

      toast.success('Wachtwoord gewijzigd')
      setHuidigWachtwoord('')
      setNieuwWachtwoord('')
      setBevestigWachtwoord('')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loadingProfile) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center py-20 text-gray-400 text-sm">Profiel laden…</div>
      </div>
    )
  }

  const verstuurd = orderlijsten.filter(l => l.status === 'verstuurd' || l.status === 'gearchiveerd')
  const actueel = orderlijsten.filter(l => l.status === 'actueel' || l.status === 'concept')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-800">Mijn profiel</h1>
        {demoMode && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">Demo modus</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors
              ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">

        {/* ── PERSOONLIJK ── */}
        {activeTab === 'persoonlijk' && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Persoonlijke gegevens</h2>
              {!editingPersonal && (
                <button onClick={() => setEditingPersonal(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Bewerken
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Naam</label>
                {editingPersonal ? (
                  <input type="text" value={naam} onChange={e => setNaam(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                ) : (
                  <p className="text-gray-800 font-medium">{naam || '—'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">E-mailadres</label>
                <p className="text-gray-800">{profile.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">E-mailadres kan niet worden gewijzigd</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Telefoonnummer</label>
                {editingPersonal ? (
                  <input type="tel" value={telefoon} onChange={e => setTelefoon(e.target.value)}
                    placeholder="06-12345678"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                ) : (
                  <p className="text-gray-800">{telefoon || '—'}</p>
                )}
              </div>
            </div>

            {editingPersonal && (
              <div className="flex gap-3">
                <button onClick={savePersonal} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
                  Opslaan
                </button>
                <button onClick={cancelPersonal} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Annuleren
                </button>
              </div>
            )}

            {/* Rol */}
            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Uw rol</h3>
              <div className="flex items-stretch gap-2">
                {ROL_LADDER.map((rol, i) => {
                  const isActive = rol.id === profile.rol
                  const isPast = ROL_LADDER.findIndex(r => r.id === profile.rol) > i
                  return (
                    <div key={rol.id} className="flex items-stretch gap-2 flex-1">
                      <div className={`flex-1 p-3 rounded-xl border-2 text-center
                        ${isActive ? 'border-blue-500 bg-blue-50' : isPast ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className={`w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-bold
                          ${isActive ? 'bg-blue-600 text-white' : isPast ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
                          {i + 1}
                        </div>
                        <p className={`text-xs font-semibold ${isActive ? 'text-blue-700' : isPast ? 'text-green-700' : 'text-gray-400'}`}>
                          {rol.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{rol.beschrijving}</p>
                      </div>
                      {i < ROL_LADDER.length - 1 && (
                        <div className="flex items-center text-gray-300 self-center">→</div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Wilt u meer rechten?{' '}
                <a href="mailto:info@kuiperholland.nl" className="text-blue-600 hover:underline">Upgrade aanvragen</a>
              </p>
            </div>
          </div>
        )}

        {/* ── BEDRIJF ── */}
        {activeTab === 'bedrijf' && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Bedrijfsgegevens</h2>
              {!editingBedrijf && (
                <button onClick={() => setEditingBedrijf(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Bewerken
                </button>
              )}
            </div>
            <div className="space-y-4">
              {[
                { label: 'Bedrijfsnaam', value: bedrijf, setter: setBedrijf, placeholder: 'Bedrijfsnaam B.V.' },
                { label: 'KvK-nummer', value: kvk, setter: setKvk, placeholder: '12345678' },
                { label: 'Branche', value: branche, setter: setBranche, placeholder: 'Interieurbouw' },
                { label: 'Adres', value: adres, setter: setAdres, placeholder: 'Straatnaam 1, 1234 AB Stad' },
              ].map(field => (
                <div key={field.label}>
                  <label className="block text-sm font-medium text-gray-500 mb-1">{field.label}</label>
                  {editingBedrijf ? (
                    <input type="text" value={field.value} onChange={e => field.setter(e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  ) : (
                    <p className="text-gray-800">{field.value || '—'}</p>
                  )}
                </div>
              ))}
            </div>
            {editingBedrijf && (
              <div className="flex gap-3">
                <button onClick={saveBedrijf} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
                  Opslaan
                </button>
                <button onClick={cancelBedrijf} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Annuleren
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── EMAIL ── */}
        {activeTab === 'email' && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-800">E-mailinstellingen</h2>
            <p className="text-sm text-gray-500">Stel in naar welke e-mailadressen orderbevestigingen worden verstuurd.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Orderbevestiging naar</label>
                <input type="email" value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)}
                  placeholder="orders@bedrijf.nl"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CC (optioneel)</label>
                <input type="email" value={confirmEmailCc} onChange={e => setConfirmEmailCc(e.target.value)}
                  placeholder="boekhouding@bedrijf.nl"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <button onClick={saveEmail} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
              Opslaan
            </button>
          </div>
        )}

        {/* ── BEVEILIGING ── */}
        {activeTab === 'beveiliging' && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-800">Wachtwoord wijzigen</h2>
            {demoMode && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                Wachtwoord wijzigen is niet beschikbaar in demo modus.
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Huidig wachtwoord</label>
                <input type="password" value={huidigWachtwoord} onChange={e => setHuidigWachtwoord(e.target.value)}
                  disabled={demoMode} placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nieuw wachtwoord (min. 8 tekens)</label>
                <input type="password" value={nieuwWachtwoord} onChange={e => setNieuwWachtwoord(e.target.value)}
                  disabled={demoMode} placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bevestig nieuw wachtwoord</label>
                <input type="password" value={bevestigWachtwoord} onChange={e => setBevestigWachtwoord(e.target.value)}
                  disabled={demoMode} placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
              </div>
            </div>
            <button
              onClick={changePassword}
              disabled={demoMode || savingPassword}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPassword ? 'Bezig…' : 'Wachtwoord wijzigen'}
            </button>
          </div>
        )}

        {/* ── GESCHIEDENIS ── */}
        {activeTab === 'geschiedenis' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Ordergeschiedenis</h2>

            {verstuurd.length === 0 && actueel.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">Nog geen orderlijsten aangemaakt.</p>
            )}

            {verstuurd.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Verstuurd</p>
                <div className="space-y-2">
                  {verstuurd.map(lijst => (
                    <div key={lijst.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
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

            {actueel.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Actieve lijsten</p>
                <div className="space-y-2">
                  {actueel.map(lijst => (
                    <div key={lijst.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
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
      </div>
    </div>
  )
}
