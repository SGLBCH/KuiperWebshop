import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Offerte-PDF voor de klant: uitsluitend m²-prijzen, geen totaalbedragen.
// Gebruikt door de verstuur-route (bijlage) en de download-route.

export type OfferteRegelData = {
  omschrijving: string
  aantal: number
  m2: number
  prijs_per_m2: number
}

export type OfferteData = {
  offertenummer: string
  datum: string          // weergaveformaat, bijv. 07-07-2026
  vervaldatum: string    // weergaveformaat
  klantNaam: string
  klantBedrijf: string
  klantAdres?: string | null
  regels: OfferteRegelData[]
  opmerking?: string | null
}

const BRUIN = rgb(0.545, 0.435, 0.278)   // #8B6F47
const DONKER = rgb(0.1, 0.1, 0.1)
const GRIJS = rgb(0.45, 0.45, 0.45)
const LICHT = rgb(0.96, 0.95, 0.93)

const eur = (n: number) =>
  '€ ' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const m2fmt = (n: number) =>
  n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m²'

export async function genereerOffertePdf(data: OfferteData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  let page = doc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()
  const marge = 48
  let y = height - marge

  const tekst = (t: string, x: number, size = 9, f = font, kleur = DONKER) =>
    page.drawText(t, { x, y, size, font: f, color: kleur })

  // ── Header ──
  tekst('Kuiper Holland', marge, 20, bold, BRUIN)
  y -= 14
  tekst('Veneer & HPL — Interieurbouw B2B', marge, 9, font, GRIJS)

  page.drawText('OFFERTE', { x: width - marge - 90, y: height - marge, size: 16, font: bold, color: DONKER })
  page.drawText(`Nummer: ${data.offertenummer}`, { x: width - marge - 150, y: height - marge - 18, size: 9, font, color: GRIJS })
  page.drawText(`Datum: ${data.datum}`, { x: width - marge - 150, y: height - marge - 30, size: 9, font, color: GRIJS })
  page.drawText(`Geldig tot: ${data.vervaldatum}`, { x: width - marge - 150, y: height - marge - 42, size: 9, font: bold, color: DONKER })

  y -= 24
  page.drawLine({ start: { x: marge, y }, end: { x: width - marge, y }, thickness: 2, color: BRUIN })

  // ── Klantgegevens ──
  y -= 24
  tekst('OFFERTE VOOR', marge, 8, bold, BRUIN)
  y -= 14
  tekst(data.klantNaam, marge, 10, bold)
  if (data.klantBedrijf) { y -= 12; tekst(data.klantBedrijf, marge, 9) }
  if (data.klantAdres) { y -= 12; tekst(data.klantAdres, marge, 9, font, GRIJS) }

  // ── Tabel ──
  y -= 30
  const kol = {
    nr: marge,
    omschrijving: marge + 26,
    aantal: width - marge - 220,
    m2: width - marge - 150,
    prijs: width - marge - 80,
  }

  // Kopregel
  page.drawRectangle({ x: marge - 4, y: y - 4, width: width - 2 * marge + 8, height: 18, color: BRUIN })
  tekst('#', kol.nr, 8, bold, rgb(1, 1, 1))
  tekst('Omschrijving', kol.omschrijving, 8, bold, rgb(1, 1, 1))
  tekst('Aantal', kol.aantal, 8, bold, rgb(1, 1, 1))
  tekst('Oppervlakte', kol.m2, 8, bold, rgb(1, 1, 1))
  tekst('Prijs per m²', kol.prijs, 8, bold, rgb(1, 1, 1))
  y -= 20

  let totaalM2 = 0
  data.regels.forEach((r, i) => {
    if (y < 140) {
      page = doc.addPage([595.28, 841.89])
      y = height - marge
    }
    if (i % 2 === 0) {
      page.drawRectangle({ x: marge - 4, y: y - 5, width: width - 2 * marge + 8, height: 17, color: LICHT })
    }
    totaalM2 += r.m2
    tekst(String(i + 1), kol.nr, 8)
    // Omschrijving inkorten indien te lang
    const oms = r.omschrijving.length > 62 ? r.omschrijving.slice(0, 59) + '…' : r.omschrijving
    tekst(oms, kol.omschrijving, 8)
    tekst(`${r.aantal}x`, kol.aantal, 8)
    tekst(m2fmt(r.m2), kol.m2, 8)
    tekst(eur(r.prijs_per_m2), kol.prijs, 8, bold)
    y -= 17
  })

  // Totaal m² (bewust géén totaalprijs)
  y -= 4
  page.drawLine({ start: { x: marge, y: y + 8 }, end: { x: width - marge, y: y + 8 }, thickness: 1.5, color: BRUIN })
  y -= 8
  tekst('Totale oppervlakte', kol.aantal - 60, 9, bold)
  tekst(m2fmt(totaalM2), kol.m2, 9, bold)

  // ── Opmerking ──
  if (data.opmerking) {
    y -= 30
    tekst('OPMERKING', marge, 8, bold, BRUIN)
    y -= 13
    // simpele regelafbreking
    const woorden = data.opmerking.split(/\s+/)
    let regel = ''
    for (const w of woorden) {
      if ((regel + ' ' + w).length > 95) {
        tekst(regel, marge, 8, font, GRIJS); y -= 11; regel = w
      } else {
        regel = regel ? regel + ' ' + w : w
      }
    }
    if (regel) { tekst(regel, marge, 8, font, GRIJS); y -= 11 }
  }

  // ── Voorwaarden / footer ──
  y = Math.min(y - 30, 120)
  page.drawLine({ start: { x: marge, y: y + 14 }, end: { x: width - marge, y: y + 14 }, thickness: 0.5, color: GRIJS })
  tekst('Prijzen per m², excl. BTW en verzendkosten. Geldig tot de bovenstaande vervaldatum.', marge, 7.5, font, GRIJS)
  y -= 11
  tekst('Op al onze offertes zijn de algemene verkoop- en leveringsvoorwaarden van Kuiper Holland B.V. van toepassing.', marge, 7.5, font, GRIJS)
  y -= 11
  tekst('Kuiper Holland B.V. — info@kuiperholland.nl', marge, 7.5, font, GRIJS)

  return doc.save()
}
