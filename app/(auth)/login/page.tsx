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
        router.push('/dashboard')
      }
    } catch {
      toast.error('Er is een fout opgetreden. Probeer het later opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-3xl">🪵</span>
            <h1 className="text-2xl font-bold" style={{ color: '#8B6F47' }}>
              Kuiper Holland
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            Webshop voor interieurbouw professionals
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
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
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Wachtwoord
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Math CAPTCHA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verificatie
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-center font-mono font-semibold text-gray-700 select-none">
                {captcha.a} + {captcha.b} = ?
              </div>
              <input
                type="number"
                value={captchaAnswer}
                onChange={e => setCaptchaAnswer(e.target.value)}
                required
                placeholder="?"
                className="w-20 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={refreshCaptcha}
                title="Nieuwe berekening"
                className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {loading ? 'Bezig met inloggen…' : 'Inloggen'}
          </button>
        </form>

        {/* Links */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Nog geen account?{' '}
          <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
            Registreren
          </Link>
        </div>
      </div>
    </div>
  )
}
