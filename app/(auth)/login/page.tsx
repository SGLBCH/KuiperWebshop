'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

function generateCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1
  const b = Math.floor(Math.random() * 10) + 1
  return { a, b, answer: a + b }
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [captcha, setCaptcha] = useState({ a: 7, b: 5, answer: 12 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setCaptcha(generateCaptcha())
  }, [])

  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha())
    setCaptchaAnswer('')
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (parseInt(captchaAnswer) !== captcha.answer) {
      toast.error('Verificatiecode is onjuist. Probeer opnieuw.')
      refreshCaptcha()
      return
    }

    setLoading(true)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
        // Demo mode
        toast.success('Demo modus — doorgestuurd naar dashboard')
        router.push('/dashboard')
        return
      }

      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        toast.error(error.message === 'Invalid login credentials'
          ? 'Onjuist e-mailadres of wachtwoord.'
          : error.message)
        return
      }

      if (data.session) {
        // Check profile status before granting access
        const { data: profile } = await supabase
          .from('profiles')
          .select('status, rol')
          .eq('id', data.user.id)
          .single()

        // Only block on explicit non-approved statuses
        // If profile is null (fetch error), allow through
        if (profile?.status === 'pending') {
          await supabase.auth.signOut()
          router.push('/pending')
          return
        }

        if (profile?.status === 'afgewezen') {
          await supabase.auth.signOut()
          toast.error('Uw aanvraag is helaas afgewezen. Neem contact op met Kuiper Holland.')
          return
        }

        if (profile?.status === 'gedeactiveerd') {
          await supabase.auth.signOut()
          toast.error('Uw account is gedeactiveerd. Neem contact op met Kuiper Holland.')
          return
        }

        router.push('/dashboard')
      }
    } catch {
      toast.error('Er is een fout opgetreden. Probeer het later opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-5xl">
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xl shadow-stone-900/10">
        <div className="grid min-h-[620px] lg:grid-cols-[1.08fr_0.92fr]">
          <section className="relative hidden min-h-full bg-stone-900 lg:block">
            <img
              src="/auth/login-panel.jpg"
              alt="Berken multiplex plaatmateriaal"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-stone-950/25 via-stone-950/35 to-stone-950/75" />
            <div className="relative flex h-full flex-col justify-between p-8 text-white">
              <div className="inline-flex w-fit items-center gap-3 rounded-md bg-white/92 px-3 py-2 text-stone-900 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded bg-[var(--color-primary)] text-sm font-bold text-white">
                  KH
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-bold">Kuiper Holland</span>
                  <span className="block text-xs text-stone-500">B2B Webshop</span>
                </span>
              </div>

              <div className="max-w-md">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/75">
                  Voor interieurbouw inkopers
                </p>
                <h1 className="text-3xl font-bold leading-tight">
                  Plaatmateriaal configureren zonder losse mailrondes.
                </h1>
                <p className="mt-3 text-sm leading-6 text-white/82">
                  Maak projectlijsten, controleer aantallen en vraag offertes aan met dezelfde praktische werkwijze als in de werkplaats.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                {[
                  ['50+', 'fineersoorten'],
                  ['Direct', 'prijsindicatie'],
                  ['B2B', 'offerteflow'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-md border border-white/18 bg-white/12 p-3 backdrop-blur">
                    <p className="text-lg font-bold">{value}</p>
                    <p className="mt-0.5 text-xs text-white/72">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex items-center px-5 py-8 sm:px-8 lg:px-10">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-7 lg:hidden">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--color-primary)] font-bold text-white">
                    KH
                  </span>
                  <span className="leading-tight">
                    <span className="block font-bold text-stone-900">Kuiper Holland</span>
                    <span className="block text-xs text-stone-500">B2B Webshop</span>
                  </span>
                </div>
                <img
                  src="/auth/login-panel.jpg"
                  alt="Berken multiplex plaatmateriaal"
                  className="h-28 w-full rounded-lg border border-stone-200 object-cover"
                />
              </div>

              <div className="mb-7">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                  Zakelijk portaal
                </p>
                <h2 className="text-2xl font-bold text-stone-950">Inloggen</h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Ga verder met uw projectlijsten, staffelkorting en offerteaanvragen.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
                    E-mailadres
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="naam@bedrijf.nl"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm kuiper-focus"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="password" className="block text-sm font-medium text-stone-700">
                      Wachtwoord
                    </label>
                    <Link href="/forgot" className="text-xs text-[var(--color-primary)] hover:underline">
                      Wachtwoord vergeten?
                    </Link>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm kuiper-focus"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Verificatie
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 select-none rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5 text-center font-mono font-semibold text-stone-700">
                      {captcha.a} + {captcha.b} = ?
                    </div>
                    <input
                      type="number"
                      value={captchaAnswer}
                      onChange={e => setCaptchaAnswer(e.target.value)}
                      required
                      placeholder="?"
                      className="w-20 rounded-lg border border-stone-300 px-3 py-2.5 text-center text-sm kuiper-focus"
                    />
                    <button
                      type="button"
                      onClick={refreshCaptcha}
                      title="Nieuwe berekening"
                      className="rounded-lg p-2.5 text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
                >
                  {loading ? 'Bezig met inloggen…' : 'Inloggen'}
                </button>
              </form>

              <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                <ul className="space-y-2 text-sm text-stone-700">
                  {[
                    'Projectlijsten bewaren per klant of werk',
                    'Fineerkeuze met foto of persoonlijke afspraak',
                    'Offerteaanvraag met controle vóór verzending',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#2f5d50]" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.31a1 1 0 0 1-1.42.001L3.29 9.235a1 1 0 1 1 1.42-1.41l4.04 4.07 6.54-6.6a1 1 0 0 1 1.414-.006Z" clipRule="evenodd" />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 text-center text-sm text-stone-500">
                Nog geen zakelijk account?{' '}
                <Link href="/signup" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]">
                  Account aanvragen
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
