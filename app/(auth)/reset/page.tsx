'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

// Landingspagina van de herstel-link uit de e-mail. De Supabase browser-client
// wisselt de code in de URL automatisch in voor een sessie (detectSessionInUrl);
// daarna kan de gebruiker hier een nieuw wachtwoord instellen.
export default function ResetPasswordPage() {
  const router = useRouter()
  const [sessionKlaar, setSessionKlaar] = useState<boolean | null>(null)
  const [wachtwoord, setWachtwoord] = useState('')
  const [bevestig, setBevestig] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
        if (!cancelled) setSessionKlaar(false)
        return
      }
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // De client verwerkt de recovery-code in de URL asynchroon;
      // poll kort tot er een sessie is (max ~5s)
      for (let i = 0; i < 10; i++) {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (session) { setSessionKlaar(true); return }
        await new Promise(r => setTimeout(r, 500))
      }
      if (!cancelled) setSessionKlaar(false)
    }
    check()
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (wachtwoord.length < 8) {
      toast.error('Wachtwoord moet minimaal 8 tekens bevatten')
      return
    }
    if (wachtwoord !== bevestig) {
      toast.error('Wachtwoorden komen niet overeen')
      return
    }
    setSaving(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: wachtwoord })
      if (error) {
        toast.error('Wijzigen mislukt: ' + error.message)
        return
      }
      toast.success('Wachtwoord gewijzigd — u kunt nu inloggen')
      await supabase.auth.signOut()
      router.push('/login')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-lg border border-stone-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-stone-900">Nieuw wachtwoord instellen</h1>
        </div>

        {sessionKlaar === null && (
          <p className="text-sm text-stone-500 text-center py-6">Herstel-link controleren…</p>
        )}

        {sessionKlaar === false && (
          <div className="text-center space-y-4">
            <p className="text-sm text-stone-600">
              Deze herstel-link is ongeldig of verlopen. Vraag een nieuwe aan.
            </p>
            <a href="/forgot" className="inline-block text-sm font-semibold text-blue-600 hover:underline">
              Nieuwe herstel-link aanvragen →
            </a>
          </div>
        )}

        {sessionKlaar === true && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Nieuw wachtwoord (min. 8 tekens)</label>
              <input
                type="password"
                value={wachtwoord}
                onChange={e => setWachtwoord(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Bevestig nieuw wachtwoord</label>
              <input
                type="password"
                value={bevestig}
                onChange={e => setBevestig(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Opslaan…' : 'Wachtwoord instellen'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
