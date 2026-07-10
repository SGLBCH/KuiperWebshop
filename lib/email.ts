// E-mailverzending via de Resend REST API (server-side only).
// Zonder RESEND_API_KEY worden mails stil overgeslagen zodat de app
// blijft werken; de aanroeper kan het resultaat loggen.

type MailInput = {
  to: string | string[]
  cc?: string[]
  subject: string
  html: string
  attachments?: { filename: string; content: string }[]  // content = base64
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
        attachments: input.attachments,
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
        U ontvangt van ons zo snel mogelijk een offerte met de definitieve prijzen.
      </p>
      <p style="font-size: 14px;">Met vriendelijke groet,<br/>Kuiper Holland B.V.</p>
    `),
  }
}

// ─── Account-aanmelding ──────────────────────────────────────────────────────

export function aanmeldingKlantTemplate(p: { naam: string }): { subject: string; html: string } {
  return {
    subject: 'Uw accountaanvraag bij Kuiper Holland is in behandeling',
    html: wrap(`
      <h2 style="margin-top: 0;">Uw aanvraag is in review</h2>
      <p style="font-size: 14px;">Beste ${p.naam},</p>
      <p style="font-size: 14px;">
        Bedankt voor uw accountaanvraag bij de Kuiper Holland B2B webshop.
        Uw aanvraag wordt op dit moment beoordeeld door onze beheerder.
      </p>
      <p style="font-size: 14px;">
        Zodra uw account is goedgekeurd ontvangt u een e-mail en kunt u direct inloggen.
        Dit duurt doorgaans maximaal 2 werkdagen.
      </p>
      <p style="font-size: 14px;">Met vriendelijke groet,<br/>Kuiper Holland B.V.</p>
    `),
  }
}

export function aanmeldingAdminTemplate(p: {
  naam: string
  bedrijf: string
  email: string
  kvk?: string | null
  branche?: string | null
}): { subject: string; html: string } {
  return {
    subject: `Nieuwe accountaanvraag: ${p.bedrijf || p.naam}`,
    html: wrap(`
      <h2 style="margin-top: 0;">Nieuwe accountaanvraag</h2>
      <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
        <tr><td style="padding: 4px 0; color: #78716c;">Naam</td><td style="padding: 4px 0;"><strong>${p.naam}</strong></td></tr>
        <tr><td style="padding: 4px 0; color: #78716c;">Bedrijf</td><td style="padding: 4px 0;">${p.bedrijf || '—'}</td></tr>
        <tr><td style="padding: 4px 0; color: #78716c;">E-mail</td><td style="padding: 4px 0;">${p.email}</td></tr>
        <tr><td style="padding: 4px 0; color: #78716c;">KvK</td><td style="padding: 4px 0;">${p.kvk ?? '—'}</td></tr>
        <tr><td style="padding: 4px 0; color: #78716c;">Branche</td><td style="padding: 4px 0;">${p.branche ?? '—'}</td></tr>
      </table>
      <p style="font-size: 14px;">Beoordeel de aanvraag in het admin-panel onder <strong>Aanmeldingen</strong>.</p>
    `),
  }
}

export function goedkeuringKlantTemplate(p: { naam: string; loginUrl: string }): { subject: string; html: string } {
  return {
    subject: 'Uw account bij Kuiper Holland is goedgekeurd',
    html: wrap(`
      <h2 style="margin-top: 0;">Uw account is goedgekeurd 🎉</h2>
      <p style="font-size: 14px;">Beste ${p.naam},</p>
      <p style="font-size: 14px;">
        Goed nieuws: uw account voor de Kuiper Holland B2B webshop is goedgekeurd.
        U kunt nu inloggen en direct aan de slag met de configurator.
      </p>
      <p style="font-size: 14px; text-align: center; margin: 24px 0;">
        <a href="${p.loginUrl}" style="background: #1d4ed8; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Inloggen
        </a>
      </p>
      <p style="font-size: 14px;">Met vriendelijke groet,<br/>Kuiper Holland B.V.</p>
    `),
  }
}

// ─── Offerte ─────────────────────────────────────────────────────────────────

export function offerteKlantTemplate(p: {
  naam: string
  offertenummer: string
  vervaldatum: string
  offerteUrl: string
  accepteerUrl: string
  afwachtUrl: string
}): { subject: string; html: string } {
  return {
    subject: `Uw offerte ${p.offertenummer} van Kuiper Holland`,
    html: wrap(`
      <h2 style="margin-top: 0;">Uw offerte staat klaar</h2>
      <p style="font-size: 14px;">Beste ${p.naam},</p>
      <p style="font-size: 14px;">
        In de bijlage vindt u offerte <strong>${p.offertenummer}</strong>.
        Deze offerte is geldig tot <strong>${p.vervaldatum}</strong>.
      </p>
      <p style="font-size: 14px;">Laat ons direct weten wat u wilt doen:</p>
      <table style="width: 100%; margin: 20px 0;"><tr>
        <td style="text-align: center; padding: 0 6px;">
          <a href="${p.accepteerUrl}" style="display: inline-block; background: #16a34a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            ✓ Accepteren
          </a>
        </td>
        <td style="text-align: center; padding: 0 6px;">
          <a href="${p.afwachtUrl}" style="display: inline-block; background: #f5f5f4; color: #44403c; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; border: 1px solid #d6d3d1;">
            Afwachten
          </a>
        </td>
      </tr></table>
      <p style="font-size: 14px;">
        U kunt de offerte ook online bekijken en daar reageren:<br/>
        <a href="${p.offerteUrl}" style="color: #1d4ed8;">${p.offerteUrl}</a>
      </p>
      <p style="font-size: 14px;">Met vriendelijke groet,<br/>Kuiper Holland B.V.</p>
    `),
  }
}
