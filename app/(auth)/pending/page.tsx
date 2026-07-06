import Link from 'next/link'

// Toont een status-specifieke boodschap: in afwachting, afgewezen of
// gedeactiveerd. De status wordt server-side opgehaald zodat een afgewezen
// gebruiker niet misleidend "in afwachting" te zien krijgt.
async function getStatus(): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') return 'pending'
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'pending'
    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single()
    return profile?.status ?? 'pending'
  } catch {
    return 'pending'
  }
}

const TEKSTEN: Record<string, { icoon: string; titel: string; tekst: string }> = {
  pending: {
    icoon: '⏳',
    titel: 'Account in afwachting',
    tekst: 'Uw account is aangemaakt maar wacht nog op goedkeuring door een beheerder van Kuiper Holland. U ontvangt een e-mail zodra uw account is goedgekeurd.',
  },
  afgewezen: {
    icoon: '🚫',
    titel: 'Aanvraag afgewezen',
    tekst: 'Uw accountaanvraag is helaas afgewezen. Denkt u dat dit een vergissing is, neem dan contact met ons op.',
  },
  gedeactiveerd: {
    icoon: '🔒',
    titel: 'Account gedeactiveerd',
    tekst: 'Uw account is gedeactiveerd. Neem contact met ons op als u uw account opnieuw wilt activeren.',
  },
}

export default async function PendingPage() {
  const status = await getStatus()
  const t = TEKSTEN[status] ?? TEKSTEN.pending

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="text-5xl mb-4">{t.icoon}</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">{t.titel}</h1>
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">{t.tekst}</p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
          <div className="flex gap-2 items-start">
            <span className="text-amber-500 text-base">ℹ️</span>
            <p className="text-sm text-amber-700">
              {status === 'pending'
                ? 'Heeft u al meer dan 2 werkdagen gewacht? Neem dan contact op via '
                : 'Vragen? Neem contact op via '}
              <a href="mailto:info@kuiperholland.nl" className="font-medium underline">
                info@kuiperholland.nl
              </a>
            </p>
          </div>
        </div>
        <Link
          href="/login"
          className="inline-block px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          ← Terug naar inloggen
        </Link>
      </div>
    </div>
  )
}
