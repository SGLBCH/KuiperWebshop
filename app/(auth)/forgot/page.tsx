'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [verzonden, setVerzonden] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
        setVerzonden(true)
        return
      }
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset`,
      })
      if (error) {
        toast.error('Versturen mislukt: ' + error.message)
        return
      }
      setVerzonden(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-lg border border-stone-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-stone-900">Wachtwoord vergeten</h1>
          <p className="text-sm text-stone-500 mt-1">
            Vul uw e-mailadres in — u ontvangt een link om een nieuw wachtwoord in te stellen.
          </p>
        </div>

        {verzonden ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">📬</div>
            <p className="text-sm text-stone-600">
              Als er een account bestaat voor <strong>{email}</strong>, is er zojuist
              een e-mail verstuurd met een herstel-link. Check ook uw spamfolder.
            </p>
            <Link href="/login" className="inline-block text-sm font-semibold text-blue-600 hover:underline">
              ← Terug naar inloggen
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">E-mailadres</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="u@bedrijf.nl"
                required
                autoFocus
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Versturen…' : 'Verstuur herstel-link'}
            </button>
            <p className="text-center text-sm text-stone-500">
              <Link href="/login" className="text-blue-600 hover:underline">← Terug naar inloggen</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
