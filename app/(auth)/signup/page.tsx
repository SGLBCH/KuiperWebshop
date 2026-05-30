'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const BRANCHES = [
  'Interieurbouw',
  'Keukenbouw',
  'Meubelmakerij',
  'Timmerwerk',
  'Schildersbedrijf',
  'Aannemersbedrijf',
  'Architect / Ontwerper',
  'Overig',
]

const STEPS = [
  'Persoonlijk',
  'Bedrijf',
  'Locatie',
  'Account',
  'Klaar',
]

function generateCaptcha() {
  const a = Math.floor(Math.random() * 12) + 1
  const b = Math.floor(Math.random() * 12) + 1
  return { a, b, answer: a + b }
}

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)

  // Step 1
  const [voornaam, setVoornaam] = useState('')
  const [achternaam, setAchternaam] = useState('')
  const [captcha, setCaptcha] = useState({ a: 4, b: 8, answer: 12 })
  const [captchaAnswer, setCaptchaAnswer] = useState('')

  // Step 2
  const [bedrijfsnaam, setBedrijfsnaam] = useState('')
  const [kvk, setKvk] = useState('')

  // Step 3
  const [branche, setBranche] = useState('')
  const [adres, setAdres] = useState('')
  const [stad, setStad] = useState('')
  const [postcode, setPostcode] = useState('')
  const [factuurZelfdeAdres, setFactuurZelfdeAdres] = useState(true)

  // Step 4
  const [factuurEmail, setFactuurEmail] = useState('')
  const [persoonlijkEmail, setPersoonlijkEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [wachtwoordBevestigen, setWachtwoordBevestigen] = useState('')

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setCaptcha(generateCaptcha())
  }, [])

  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha())
    setCaptchaAnswer('')
  }, [])

  function validateStep(): boolean {
    if (step === 0) {
      if (!voornaam.trim() || !achternaam.trim()) {
        toast.error('Vul uw voor- en achternaam in.')
        return false
      }
      if (parseInt(captchaAnswer) !== captcha.answer) {
        toast.error('Verificatiecode is onjuist.')
        refreshCaptcha()
        return false
      }
    }
    if (step === 1) {
      if (!bedrijfsnaam.trim()) {
        toast.error('Vul uw bedrijfsnaam in.')
        return false
      }
    }
    if (step === 2) {
      if (!branche) {
        toast.error('Selecteer uw branche.')
        return false
      }
      if (!adres.trim() || !stad.trim() || !postcode.trim()) {
        toast.error('Vul uw volledig bedrijfsadres in.')
        return false
      }
    }
    if (step === 3) {
      if (!persoonlijkEmail.trim()) {
        toast.error('Vul uw e-mailadres in.')
        return false
      }
      if (!wachtwoord || wachtwoord.length < 8) {
        toast.error('Wachtwoord moet minimaal 8 tekens bevatten.')
        return false
      }
      if (wachtwoord !== wachtwoordBevestigen) {
        toast.error('Wachtwoorden komen niet overeen.')
        return false
      }
    }
    return true
  }

  async function handleNext() {
    if (!validateStep()) return

    if (step === 3) {
      await handleSubmit()
    } else {
      setStep(s => s + 1)
    }
  }

  async function handleSubmit() {
    setLoading(true)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

      if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
        await new Promise(r => setTimeout(r, 800))
        setStep(4)
        return
      }

      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: persoonlijkEmail,
        password: wachtwoord,
        options: {
          data: {
            naam: `${voornaam} ${achternaam}`,
            bedrijf: bedrijfsnaam,
          },
        },
      })

      if (authError) {
        toast.error(authError.message)
        return
      }

      if (!authData.user) {
        toast.error('Aanmaken mislukt, probeer opnieuw.')
        return
      }

      // 2. Insert into public.profiles so admin can see the pending request
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: persoonlijkEmail,
        naam: `${voornaam} ${achternaam}`,
        bedrijf: bedrijfsnaam,
        branche,
        adres: `${adres}, ${postcode} ${stad}`,
        kvk: kvk || null,
        order_confirm_email: factuurEmail || persoonlijkEmail,
        rol: 'kijker',
        status: 'pending',
      })

      if (profileError) {
        // Auth user was created but profile failed — still show success,
        // admin can fix manually via Supabase dashboard
        console.error('Profile insert error:', profileError.message)
      }

      setStep(4)
    } catch {
      toast.error('Er is een fout opgetreden. Probeer het later opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-lg">
      <div className="bg-white rounded-lg shadow-lg border border-stone-200 p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="h-11 w-11 rounded-md bg-[var(--color-primary)] text-white flex items-center justify-center font-bold">KH</span>
            <span className="text-left leading-tight">
              <span className="block font-bold text-stone-900">Kuiper Holland</span>
              <span className="block text-xs text-stone-500">B2B Webshop</span>
            </span>
          </div>
          <p className="text-sm text-gray-500">Zakelijk account aanvragen</p>
        </div>

        {/* Stepper */}
        {step < 4 && (
          <div className="flex items-center justify-center mb-8">
            {STEPS.slice(0, 4).map((label, i) => (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                      ${i < step ? 'bg-[#2f5d50] text-white' : i === step ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-200 text-gray-500'}`}
                  >
                    {i < step ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className="text-xs text-gray-400 mt-1 hidden sm:block">{label}</span>
                </div>
                {i < 3 && (
                  <div className={`w-8 sm:w-12 h-0.5 mx-1 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step 0: Persoonlijk */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Persoonlijke gegevens</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Voornaam *</label>
                <input
                  type="text"
                  value={voornaam}
                  onChange={e => setVoornaam(e.target.value)}
                  placeholder="Jan"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Achternaam *</label>
                <input
                  type="text"
                  value={achternaam}
                  onChange={e => setAchternaam(e.target.value)}
                  placeholder="de Vries"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* CAPTCHA */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verificatie *</label>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-center font-mono font-semibold text-gray-700 select-none">
                  {captcha.a} + {captcha.b} = ?
                </div>
                <input
                  type="number"
                  value={captchaAnswer}
                  onChange={e => setCaptchaAnswer(e.target.value)}
                  placeholder="?"
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Bedrijf */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Bedrijfsgegevens</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bedrijfsnaam *</label>
              <input
                type="text"
                value={bedrijfsnaam}
                onChange={e => setBedrijfsnaam(e.target.value)}
                placeholder="Uw Bedrijf B.V."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">KvK-nummer (optioneel)</label>
              <input
                type="text"
                value={kvk}
                onChange={e => setKvk(e.target.value)}
                placeholder="12345678"
                maxLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Step 2: Locatie */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Locatie & branche</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branche *</label>
              <select
                value={branche}
                onChange={e => setBranche(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Selecteer branche —</option>
                {BRANCHES.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bedrijfsadres *</label>
              <input
                type="text"
                value={adres}
                onChange={e => setAdres(e.target.value)}
                placeholder="Straatnaam 12"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                <input
                  type="text"
                  value={postcode}
                  onChange={e => setPostcode(e.target.value)}
                  placeholder="1234 AB"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stad *</label>
                <input
                  type="text"
                  value={stad}
                  onChange={e => setStad(e.target.value)}
                  placeholder="Amsterdam"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={factuurZelfdeAdres}
                onChange={e => setFactuurZelfdeAdres(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-600">Dit is ook het factuuradres</span>
            </label>
          </div>
        )}

        {/* Step 3: Account */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Accountgegevens</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Factuur e-mailadres</label>
              <input
                type="email"
                value={factuurEmail}
                onChange={e => setFactuurEmail(e.target.value)}
                placeholder="facturen@bedrijf.nl"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Persoonlijk e-mailadres *</label>
              <input
                type="email"
                value={persoonlijkEmail}
                onChange={e => setPersoonlijkEmail(e.target.value)}
                placeholder="u@bedrijf.nl"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wachtwoord * (min. 8 tekens)</label>
              <input
                type="password"
                value={wachtwoord}
                onChange={e => setWachtwoord(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wachtwoord bevestigen *</label>
              <input
                type="password"
                value={wachtwoordBevestigen}
                onChange={e => setWachtwoordBevestigen(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Profiel aangemaakt!</h2>
            <p className="text-gray-600 mb-2">
              Welkom, <strong>{voornaam}</strong>!
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-4 text-left">
              <div className="flex gap-2">
                <span className="text-amber-500 text-lg">⏳</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Profiel wordt beoordeeld</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Uw aanvraag voor een Kuiper Holland account is ontvangen. U ontvangt een e-mail zodra uw account is goedgekeurd.
                  </p>
                </div>
              </div>
            </div>
            <Link
              href="/login"
              className="inline-block mt-2 px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              Terug naar start
            </Link>
          </div>
        )}

        {/* Navigation buttons */}
        {step < 4 && (
          <div className="flex justify-between mt-8">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Terug
              </button>
            ) : (
              <div />
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className="px-6 py-2 text-sm font-semibold text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-60 transition-colors"
            >
              {loading ? 'Bezig…' : step === 3 ? 'Account aanmaken →' : 'Volgende →'}
            </button>
          </div>
        )}

        {/* Sign-in link */}
        {step < 4 && (
          <div className="mt-5 text-center text-sm text-gray-500">
            Al een account?{' '}
            <Link href="/login" className="text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium">
              Inloggen
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
