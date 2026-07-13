import { NextResponse } from 'next/server'
import { sendMail, getAdminEmail, aanmeldingKlantTemplate, aanmeldingAdminTemplate } from '@/lib/email'

// Wordt direct na een succesvolle registratie aangeroepen.
// Vereist een sessie van de zojuist geregistreerde gebruiker zelf —
// het is dus geen open endpoint dat willekeurige mails kan triggeren.
export async function POST() {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('naam, bedrijf, email, kvk, branche, status, aangemaakt_op')
    .eq('id', user.id)
    .single()

  // Alleen voor verse aanmeldingen die nog op review wachten.
  // De leeftijdscheck voorkomt dat een pending gebruiker dit endpoint
  // herhaaldelijk misbruikt om de admin-mailbox te spammen.
  const uurGeleden = Date.now() - 60 * 60 * 1000
  if (!profile || profile.status !== 'pending'
    || (profile.aangemaakt_op && new Date(profile.aangemaakt_op).getTime() < uurGeleden)) {
    return NextResponse.json({ ok: false })
  }

  const naam = profile.naam ?? user.email ?? 'klant'
  const klantMail = aanmeldingKlantTemplate({ naam })
  const adminMail = aanmeldingAdminTemplate({
    naam,
    bedrijf: profile.bedrijf ?? '',
    email: profile.email ?? user.email ?? '',
    kvk: profile.kvk,
    branche: profile.branche,
  })

  const [klantRes, adminRes] = await Promise.all([
    profile.email
      ? sendMail({ to: profile.email, subject: klantMail.subject, html: klantMail.html })
      : Promise.resolve({ ok: false, error: 'geen e-mailadres' }),
    sendMail({ to: getAdminEmail(), subject: adminMail.subject, html: adminMail.html }),
  ])
  if (!klantRes.ok) console.error('Aanmelding klant-mail mislukt:', klantRes.error)
  if (!adminRes.ok) console.error('Aanmelding admin-mail mislukt:', adminRes.error)

  return NextResponse.json({ ok: true })
}
