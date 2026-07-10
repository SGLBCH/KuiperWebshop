import { NextResponse } from 'next/server'
import { genereerOffertePdf } from '@/lib/offerte-pdf'
import { getOfferteByToken, datumNL } from '@/lib/offerte-service'

// Download van de offerte-PDF via het unieke offerte-token (uit de e-mail).
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const resultaat = await getOfferteByToken(token)
  if (!resultaat) return NextResponse.json({ error: 'Offerte niet gevonden.' }, { status: 404 })

  const { offerte, profiel } = resultaat
  if (offerte.status === 'concept') {
    return NextResponse.json({ error: 'Offerte is nog niet verstuurd.' }, { status: 403 })
  }

  const offertenummer = offerte.offertenummer ?? `OFF-${offerte.token.slice(0, 6).toUpperCase()}`
  const pdfBytes = await genereerOffertePdf({
    offertenummer,
    datum: offerte.verstuurd_op ? datumNL(offerte.verstuurd_op) : datumNL(new Date()),
    vervaldatum: offerte.vervaldatum ? datumNL(offerte.vervaldatum) : '—',
    klantNaam: profiel.naam ?? '—',
    klantBedrijf: profiel.bedrijf ?? '',
    klantAdres: profiel.adres,
    regels: offerte.regels,
    opmerking: offerte.opmerking,
  })

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${offertenummer}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
