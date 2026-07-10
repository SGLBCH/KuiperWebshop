import { NextResponse } from 'next/server'
import { sendMail, getAdminEmail } from '@/lib/email'
import { getOfferteByToken, getServiceClient, isVerlopen } from '@/lib/offerte-service'

// Klantreactie op een offerte via de knoppen in de e-mail of op de
// offertepagina: accepteren of afwachten. Token = autorisatie.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') ?? ''
  const keuze = url.searchParams.get('keuze') ?? ''

  if (keuze !== 'geaccepteerd' && keuze !== 'afgewacht') {
    return NextResponse.json({ error: 'Ongeldige keuze.' }, { status: 400 })
  }

  const resultaat = await getOfferteByToken(token)
  if (!resultaat) return NextResponse.json({ error: 'Offerte niet gevonden.' }, { status: 404 })
  const { offerte, profiel } = resultaat

  const terug = NextResponse.redirect(new URL(`/offerte/${token}`, url.origin))

  // Alleen reageren op verstuurde (of eerder afgewachte) offertes die niet
  // verlopen of al geaccepteerd zijn
  if (offerte.status === 'geaccepteerd' || offerte.status === 'concept' || isVerlopen(offerte)) {
    return terug
  }

  const supabase = getServiceClient()
  if (!supabase) return NextResponse.json({ error: 'Service niet geconfigureerd.' }, { status: 503 })

  await supabase.from('offertes').update({
    status: keuze,
    reactie_op: new Date().toISOString(),
  }).eq('id', offerte.id)

  // Admin informeren (best effort)
  const label = keuze === 'geaccepteerd' ? 'GEACCEPTEERD ✓' : 'afwachten'
  sendMail({
    to: getAdminEmail(),
    subject: `Offerte ${offerte.offertenummer ?? ''} — klantreactie: ${label}`,
    html: `<p>Klant <strong>${profiel.naam ?? profiel.email ?? offerte.user_id}</strong> (${profiel.bedrijf ?? '—'})
      heeft op offerte <strong>${offerte.offertenummer ?? offerte.token.slice(0, 8)}</strong> gereageerd met:
      <strong>${label}</strong>.</p>`,
  }).catch(() => {})

  return terug
}
