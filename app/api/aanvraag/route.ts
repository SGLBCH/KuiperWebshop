import { NextResponse } from 'next/server'
import { sendMail, getAdminEmail, aanvraagAdminTemplate, aanvraagKlantTemplate } from '@/lib/email'

// Server-side afhandeling van een offerteaanvraag:
// - berekent de totaalwaarde correct (regels + verzendkosten)
// - schrijft de aanvraag en zet de orderlijst op 'verstuurd'
// - mailt de admin en stuurt de klant een bevestiging
// Alles via de RLS-sessie van de gebruiker: alleen eigen lijsten.

export async function POST(request: Request) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('naam, bedrijf, email, status, order_confirm_email, order_confirm_email_cc')
    .eq('id', user.id)
    .single()
  if (profile && profile.status !== 'goedgekeurd') {
    return NextResponse.json({ error: 'Account nog niet goedgekeurd.' }, { status: 403 })
  }

  let body: { orderlijst_id?: string; bericht?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldige request body.' }, { status: 400 })
  }
  const orderlijstId = body.orderlijst_id
  if (!orderlijstId) {
    return NextResponse.json({ error: 'Orderlijst ontbreekt.' }, { status: 400 })
  }
  const bericht = (body.bericht ?? '').slice(0, 2000) || null

  // Orderlijst moet van de gebruiker zijn (RLS filtert, maar expliciet checken
  // geeft een nette foutmelding)
  const { data: lijst } = await supabase
    .from('orderlijsten')
    .select('id, naam, user_id')
    .eq('id', orderlijstId)
    .single()
  if (!lijst || lijst.user_id !== user.id) {
    return NextResponse.json({ error: 'Orderlijst niet gevonden.' }, { status: 404 })
  }

  const { data: regels } = await supabase
    .from('orderlijst_regels')
    .select('totaal_prijs')
    .eq('orderlijst_id', orderlijstId)
  if (!regels || regels.length === 0) {
    return NextResponse.json({ error: 'Deze orderlijst bevat nog geen regels.' }, { status: 400 })
  }

  // Verzendinstellingen via de publieke view (fallback op defaults)
  let verzendDrempel = 1750
  let verzendKosten = 25
  const { data: ins } = await supabase.from('instellingen_publiek').select('*')
  if (ins) {
    const get = (k: string, d: number) => {
      const v = parseFloat(ins.find((i: { sleutel: string; waarde: string }) => i.sleutel === k)?.waarde ?? '')
      return Number.isFinite(v) ? v : d
    }
    verzendDrempel = get('verzend_drempel', 1750)
    verzendKosten = get('verzend_kosten', 25)
  }

  const materiaal = regels.reduce((s, r) => s + (r.totaal_prijs ?? 0), 0)
  const verzending = materiaal >= verzendDrempel ? 0 : verzendKosten
  const totaal = Math.round((materiaal + verzending) * 100) / 100

  // Aanvraag opslaan + lijst op 'verstuurd'
  const { error: insertError } = await supabase.from('aanvragen').insert({
    user_id: user.id,
    orderlijst_ids: [orderlijstId],
    type: 'offerte',
    bericht,
    totaal_waarde: totaal,
    status: 'nieuw',
  })
  if (insertError) {
    return NextResponse.json({ error: 'Opslaan mislukt: ' + insertError.message }, { status: 400 })
  }
  await supabase.from('orderlijsten').update({ status: 'verstuurd' }).eq('id', orderlijstId)

  // E-mails: best-effort — de aanvraag staat al veilig in de database
  const klantNaam = profile?.naam ?? user.email ?? 'klant'
  const klantEmail = profile?.order_confirm_email || profile?.email || user.email || ''
  const cc = profile?.order_confirm_email_cc ? [profile.order_confirm_email_cc] : undefined

  const adminMail = aanvraagAdminTemplate({
    klantNaam,
    klantBedrijf: profile?.bedrijf ?? '',
    klantEmail: profile?.email ?? user.email ?? '',
    lijstNaam: lijst.naam,
    aantalRegels: regels.length,
    totaal,
    bericht,
  })
  // Klantmail bevat bewust geen bedragen — klanten zien alleen m²-richtprijzen
  const klantMail = aanvraagKlantTemplate({
    klantNaam,
    lijstNaam: lijst.naam,
    aantalRegels: regels.length,
    totaal: 0,
  })

  const [adminRes, klantRes] = await Promise.all([
    sendMail({ to: getAdminEmail(), subject: adminMail.subject, html: adminMail.html }),
    klantEmail
      ? sendMail({ to: klantEmail, cc, subject: klantMail.subject, html: klantMail.html })
      : Promise.resolve({ ok: false, error: 'geen klant-e-mailadres' }),
  ])
  if (!adminRes.ok) console.error('Admin-mail mislukt:', adminRes.error)
  if (!klantRes.ok) console.error('Klant-mail mislukt:', klantRes.error)

  return NextResponse.json({ ok: true, totaal, mail_verstuurd: adminRes.ok })
}
