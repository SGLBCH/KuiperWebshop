// E-mailverzending via de Resend REST API (server-side only).
// Zonder RESEND_API_KEY worden mails stil overgeslagen zodat de app
// blijft werken; de aanroeper kan het resultaat loggen.

type MailInput = {
  to: string | string[]
  cc?: string[]
  subject: string
  html: string
}

export function emailIsGeconfigureerd(): boolean {
  return !!process.env.RESEND_API_KEY
}

export function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL ?? 'info@kuiperholland.nl'
}

function getFromAddress(): string {
  // Zonder geverifieerd domein werkt Resend's testadres alleen naar het
  // eigen accountadres — zet RESEND_FROM zodra het domein is geverifieerd.
  return process.env.RESEND_FROM ?? 'Kuiper Webshop <onboarding@resend.dev>'
}

export async function sendMail(input: MailInput): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY niet geconfigureerd' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getFromAddress(),
        to: Array.isArray(input.to) ? input.to : [input.to],
        cc: input.cc && input.cc.length > 0 ? input.cc : undefined,
        subject: input.subject,
        html: input.html,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'onbekende fout' }
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

const wrap = (inhoud: string) => `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
    <div style="background: #1d4ed8; color: #fff; padding: 16px 24px; border-radius: 8px 8px 0 0;">
      <strong style="font-size: 16px;">Kuiper Holland — B2B Webshop</strong>
    </div>
    <div style="border: 1px solid #e7e5e4; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
      ${inhoud}
    </div>
    <p style="color: #a8a29e; font-size: 12px; padding: 12px 4px;">
      Dit bericht is automatisch verzonden door de Kuiper Holland B2B webshop.
    </p>
  </div>`

export function aanvraagAdminTemplate(p: {
  klantNaam: string
  klantBedrijf: string
  klantEmail: string
  lijstNaam: string
  aantalRegels: number
  totaal: number
  bericht?: string | null
}): { subject: string; html: string } {
  return {
    subject: `Nieuwe offerteaanvraag: ${p.lijstNaam} — ${p.klantBedrijf || p.klantNaam}`,
    html: wrap(`
      <h2 style="margin-top: 0;">Nieuwe offerteaanvraag</h2>
      <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
        <tr><td style="padding: 4px 0; color: #78716c;">Klant</td><td style="padding: 4px 0;"><strong>${p.klantNaam}</strong> (${p.klantBedrijf || '—'})</td></tr>
        <tr><td style="padding: 4px 0; color: #78716c;">E-mail</td><td style="padding: 4px 0;">${p.klantEmail}</td></tr>
        <tr><td style="padding: 4px 0; color: #78716c;">Orderlijst</td><td style="padding: 4px 0;">${p.lijstNaam}</td></tr>
        <tr><td style="padding: 4px 0; color: #78716c;">Regels</td><td style="padding: 4px 0;">${p.aantalRegels}</td></tr>
        <tr><td style="padding: 4px 0; color: #78716c;">Indicatieve waarde</td><td style="padding: 4px 0;"><strong>&euro; ${p.totaal.toFixed(2)}</strong> excl. BTW</td></tr>
      </table>
      ${p.bericht ? `<p style="font-size: 14px; background: #f5f5f4; padding: 12px; border-radius: 6px;"><strong>Bericht van de klant:</strong><br/>${p.bericht}</p>` : ''}
      <p style="font-size: 14px;">Bekijk en behandel de aanvraag in het admin-panel van de webshop.</p>
    `),
  }
}

export function aanvraagKlantTemplate(p: {
  klantNaam: string
  lijstNaam: string
  aantalRegels: number
  totaal: number
}): { subject: string; html: string } {
  return {
    subject: `Uw offerteaanvraag "${p.lijstNaam}" is ontvangen`,
    html: wrap(`
      <h2 style="margin-top: 0;">Bedankt voor uw aanvraag</h2>
      <p style="font-size: 14px;">Beste ${p.klantNaam},</p>
      <p style="font-size: 14px;">
        Wij hebben uw offerteaanvraag voor <strong>${p.lijstNaam}</strong>
        (${p.aantalRegels} regel${p.aantalRegels === 1 ? '' : 's'}) in goede orde ontvangen.
      </p>
      <p style="font-size: 14px;">
        De indicatieve waarde van uw aanvraag is <strong>&euro; ${p.totaal.toFixed(2)} excl. BTW</strong>.
        Dit is een richtbedrag — u ontvangt van ons zo snel mogelijk een definitieve offerte.
      </p>
      <p style="font-size: 14px;">Met vriendelijke groet,<br/>Kuiper Holland B.V.</p>
    `),
  }
}
