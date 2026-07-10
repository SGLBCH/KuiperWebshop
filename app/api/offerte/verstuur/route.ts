import { NextResponse } from 'next/server'
import { sendMail, getAdminEmail, offerteKlantTemplate } from '@/lib/email'
import { genereerOffertePdf } from '@/lib/offerte-pdf'
import { datumNL } from '@/lib/offerte-service'

// Verstuurt een offerte naar de klant: PDF als bijlage + accepteer/afwacht-
// knoppen in de mail + link naar de online offertepagina. Alleen voor admins.
export async function POST(request: Request) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 })
  const { data: adminProfile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (adminProfile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })
  }

  let body: { offerte_id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Ongeldige request body.' }, { status: 400 })
  }
  if (!body.offerte_id) return NextResponse.json({ error: 'offerte_id ontbreekt.' }, { status: 400 })

  // Admin-RLS: leestoegang tot alle offertes en profielen
  const { data: offerte } = await supabase
    .from('offertes').select('*').eq('id', body.offerte_id).single()
  if (!offerte) return NextResponse.json({ error: 'Offerte niet gevonden.' }, { status: 404 })
  if (!Array.isArray(offerte.regels) || offerte.regels.length === 0) {
    return NextResponse.json({ error: 'Offerte bevat geen regels.' }, { status: 400 })
  }

  const { data: profiel } = await supabase
    .from('profiles')
    .select('naam, bedrijf, adres, email, order_confirm_email, order_confirm_email_cc')
    .eq('id', offerte.user_id)
    .single()
  const klantEmail = profiel?.order_confirm_email || profiel?.email
  if (!klantEmail) return NextResponse.json({ error: 'Klant heeft geen e-mailadres.' }, { status: 400 })

  // Vervaldatum: standaard 30 dagen vanaf vandaag als de admin niets invulde
  const vervaldatum = offerte.vervaldatum
    ?? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0]
  const offertenummer = offerte.offertenummer
    ?? `OFF-${new Date().getFullYear()}-${String(offerte.token).slice(0, 6).toUpperCase()}`

  // PDF genereren (alleen m²-prijzen)
  const pdfBytes = await genereerOffertePdf({
    offertenummer,
    datum: datumNL(new Date()),
    vervaldatum: datumNL(vervaldatum),
    klantNaam: profiel?.naam ?? klantEmail,
    klantBedrijf: profiel?.bedrijf ?? '',
    klantAdres: profiel?.adres,
    regels: offerte.regels,
    opmerking: offerte.opmerking,
  })

  const origin = new URL(request.url).origin
  const offerteUrl = `${origin}/offerte/${offerte.token}`
  const mail = offerteKlantTemplate({
    naam: profiel?.naam ?? klantEmail,
    offertenummer,
    vervaldatum: datumNL(vervaldatum),
    offerteUrl,
    accepteerUrl: `${origin}/api/offerte/reactie?token=${offerte.token}&keuze=geaccepteerd`,
    afwachtUrl: `${origin}/api/offerte/reactie?token=${offerte.token}&keuze=afgewacht`,
  })

  const mailRes = await sendMail({
    to: klantEmail,
    cc: profiel?.order_confirm_email_cc ? [profiel.order_confirm_email_cc] : undefined,
    subject: mail.subject,
    html: mail.html,
    attachments: [{
      filename: `${offertenummer}.pdf`,
      content: Buffer.from(pdfBytes).toString('base64'),
    }],
  })
  if (!mailRes.ok) {
    return NextResponse.json({ error: 'Mail versturen mislukt: ' + mailRes.error }, { status: 502 })
  }

  // Kopie naar admin (best effort)
  sendMail({
    to: getAdminEmail(),
    subject: `Kopie: ${mail.subject}`,
    html: mail.html,
    attachments: [{ filename: `${offertenummer}.pdf`, content: Buffer.from(pdfBytes).toString('base64') }],
  }).catch(() => {})

  await supabase.from('offertes').update({
    status: 'verstuurd',
    verstuurd_op: new Date().toISOString(),
    vervaldatum,
    offertenummer,
  }).eq('id', offerte.id)

  return NextResponse.json({ ok: true, offertenummer })
}
