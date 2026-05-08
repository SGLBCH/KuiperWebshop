'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui/Badge'
import { seedOrderlijsten } from '@/lib/seed-data'

type ProfileTab = 'persoonlijk' | 'bedrijf' | 'email' | 'beveiliging' | 'geschiedenis'

const DEMO_USER = {
  naam: 'Jan de Vries',
  email: 'jan@interieurbouw.nl',
  telefoon: '06-12345678',
  bedrijf: 'De Vries Interieurbouw B.V.',
  kvk: '12345678',
  branche: 'Interieurbouw',
  adres: 'Houtstraat 42, 1234 AB Amsterdam',
  rol: 'calculator' as const,
  order_confirm_email: 'orders@interieurbouw.nl',
  order_confirm_email_cc: '',
}

const ROL_LADDER = [
  { id: 'kijker', label: 'Kijker', beschrijving: 'Kan catalogus bekijken' },
  { id: 'calculator', label: 'Calculator', beschrijving: 'Kan prijzen berekenen en orderlijsten maken' },
  { id: 'inkoper', label: 'Inkoper', beschrijving: 'Kan bestellingen plaatsen en bevestigen' },
]

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('persoonlijk')

  // Persoonlijk state
  const [naam, setNaam] = useState(DEMO_USER.naam)
  const [telefoon, setTelefoon] = useState(DEMO_USER.telefoon)
  const [editingPersonal, setEditingPersonal] = useState(false)

  // Bedrijf state
  const [bedrijf, setBedrijf] = useState(DEMO_USER.bedrijf)
  const [kvk, setKvk] = useState(DEMO_USER.kvk)
  const [branche, setBranche] = useState(DEMO_USER.branche)
  const [adres, setAdres] = useState(DEMO_USER.adres)
  const [editingBedrijf, setEditingBedrijf] = useState(false)

  // Email state
  const [confirmEmail, setConfirmEmail] = useState(DEMO_USER.order_confirm_email)
  const [confirmEmailCc, setConfirmEmailCc] = useState(DEMO_USER.order_confirm_email_cc)

  // Beveiliging state
  const [huidigWachtwoord, setHuidigWachtwoord] = useState('')
  const [nieuwWachtwoord, setNieuwWachtwoord] = useState('')
  const [bevestigWachtwoord, setBevestigWachtwoord] = useState('')

  function savePersonal() {
    toast.success('Persoonlijke gegevens opgeslagen')
    setEditingPersonal(false)
  }

  function saveBedrijf() {
    toast.success('Bedrijfsgegevens opgeslagen')
    setEditingBedrijf(false)
  }

  function saveEmail() {
    toast.success('E-mailinstellingen opgeslagen')
  }

  function changePassword() {
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
    toast.success('Wachtwoord gewijzigd')
    setHuidigWachtwoord('')
    setNieuwWachtwoord('')
    setBevestigWachtwoord('')
  }

  const verstuurdeLijsten = seedOrderlijsten.filter(l => l.status === 'verstuurd' || l.status === 'gearchiveerd')

  const TABS: { id: ProfileTab; label: string }[] = [
    { id: 'persoonlijk', label: 'Persoonlijk' },
    { id: 'bedrijf', label: 'Bedrijf' },
    { id: 'email', label: 'E-mailinstellingen' },
    { id: 'beveiliging', label: 'Beveiliging' },
    { id: 'geschiedenis', label: 'Ordergeschiedenis' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-xl font-bold text-gray-800 mb-5">Mijn profiel</h1>

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
                <button
                  onClick={() => setEditingPersonal(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Bewerken
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Naam</label>
                {editingPersonal ? (
                  <input
                    type="text"
                    value={naam}
                    onChange={e => setNaam(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-800 font-medium">{naam}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">E-mailadres</label>
                <p className="text-gray-800">{DEMO_USER.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">E-mailadres kan niet worden gewijzigd</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Telefoonnummer</label>
                {editingPersonal ? (
                  <input
                    type="tel"
                    value={telefoon}
                    onChange={e => setTelefoon(e.target.value)}
                    placeholder="06-12345678"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
                <button onClick={() => setEditingPersonal(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Annuleren
                </button>
              </div>
            )}

            {/* Rol ladder */}
            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Uw rol</h3>
              <div className="flex items-stretch gap-2">
                {ROL_LADDER.map((rol, i) => {
                  const isActive = rol.id === DEMO_USER.rol
                  const isPast = ROL_LADDER.findIndex(r => r.id === DEMO_USER.rol) > i
                  return (
                    <div key={rol.id} className="flex items-stretch gap-2 flex-1">
                      <div
                        className={`flex-1 p-3 rounded-xl border-2 text-center
                          ${isActive ? 'border-blue-500 bg-blue-50' : isPast ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
                      >
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
                    <input
                      type="text"
                      value={field.value}
                      onChange={e => field.setter(e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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
                <button onClick={() => setEditingBedrijf(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
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
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={e => setConfirmEmail(e.target.value)}
                  placeholder="orders@bedrijf.nl"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CC (optioneel)</label>
                <input
                  type="email"
                  value={confirmEmailCc}
                  onChange={e => setConfirmEmailCc(e.target.value)}
                  placeholder="boekhouding@bedrijf.nl"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Huidig wachtwoord</label>
                <input
                  type="password"
                  value={huidigWachtwoord}
                  onChange={e => setHuidigWachtwoord(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nieuw wachtwoord (min. 8 tekens)</label>
                <input
                  type="password"
                  value={nieuwWachtwoord}
                  onChange={e => setNieuwWachtwoord(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bevestig nieuw wachtwoord</label>
                <input
                  type="password"
                  value={bevestigWachtwoord}
                  onChange={e => setBevestigWachtwoord(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button onClick={changePassword} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
              Wachtwoord wijzigen
            </button>
          </div>
        )}

        {/* ── GESCHIEDENIS ── */}
        {activeTab === 'geschiedenis' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Ordergeschiedenis</h2>
            {verstuurdeLijsten.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">Nog geen verstuurd orderlijsten.</p>
            )}
            {verstuurdeLijsten.map(lijst => (
              <div key={lijst.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-800">{lijst.naam}</p>
                  <p className="text-xs text-gray-400">{new Date(lijst.bijgewerkt_op).toLocaleDateString('nl-NL')}</p>
                </div>
                <Badge variant="verstuurd">Verstuurd</Badge>
              </div>
            ))}
            {seedOrderlijsten.filter(l => l.status === 'actueel' || l.status === 'concept').map(lijst => (
              <div key={lijst.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-800">{lijst.naam}</p>
                  <p className="text-xs text-gray-400">{new Date(lijst.bijgewerkt_op).toLocaleDateString('nl-NL')}</p>
                </div>
                <Badge variant={lijst.status === 'actueel' ? 'active' : 'concept'}>{lijst.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
