import { NextResponse } from 'next/server'
import { sendMail, getAdminEmail, goedkeuringKlantTemplate } from '@/lib/email'

// Door de admin aangeroepen nadat een aanmelding is goedgekeurd.
export async function POST(request: Request) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (adminProfile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })
  }

  let body: { user_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldige request body.' }, { status: 400 })
  }
  if (!body.user_id) return NextResponse.json({ error: 'user_id ontbreekt.' }, { status: 400 })

  // Admin-RLS geeft leestoegang tot alle profielen
  const { data: profile } = await supabase
    .from('profiles')
    .select('naam, email, status')
    .eq('id', body.user_id)
    .single()
  if (!profile?.email || profile.status !== 'goedgekeurd') {
    return NextResponse.json({ error: 'Profiel niet gevonden of niet goedgekeurd.' }, { status: 400 })
  }

  const origin = new URL(request.url).origin
  const mail = goedkeuringKlantTemplate({
    naam: profile.naam ?? profile.email,
    loginUrl: `${origin}/login`,
  })

  const [klantRes, adminRes] = await Promise.all([
    sendMail({ to: profile.email, subject: mail.subject, html: mail.html }),
    sendMail({
      to: getAdminEmail(),
      subject: `Account goedgekeurd: ${profile.naam ?? profile.email}`,
      html: mail.html,
    }),
  ])
  if (!klantRes.ok) console.error('Goedkeuring klant-mail mislukt:', klantRes.error)
  if (!adminRes.ok) console.error('Goedkeuring admin-mail mislukt:', adminRes.error)

  return NextResponse.json({ ok: true })
}
