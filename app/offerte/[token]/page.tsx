import { getOfferteByToken, datumNL, isVerlopen } from '@/lib/offerte-service'

// Publieke offertepagina, bereikbaar via het unieke token uit de e-mail.
// Toont uitsluitend m²-prijzen en biedt dezelfde keuzes als de mail:
// accepteren of afwachten.
export default async function OffertePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const resultaat = await getOfferteByToken(token)

  if (!resultaat || resultaat.offerte.status === 'concept') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] px-4">
        <div className="bg-white rounded-2xl shadow-lg border border-stone-200 p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">📄</div>
          <h1 className="text-xl font-bold text-stone-900 mb-2">Offerte niet gevonden</h1>
          <p className="text-sm text-stone-600">
            Deze offerte bestaat niet (meer) of de link is onjuist.
            Neem contact op via <a className="text-blue-600 underline" href="mailto:info@kuiperholland.nl">info@kuiperholland.nl</a>.
          </p>
        </div>
      </div>
    )
  }

  const { offerte, profiel } = resultaat
  const verlopen = isVerlopen(offerte)
  const offertenummer = offerte.offertenummer ?? `OFF-${offerte.token.slice(0, 6).toUpperCase()}`
  const totaalM2 = offerte.regels.reduce((s, r) => s + (r.m2 ?? 0), 0)
  const kanReageren = !verlopen && (offerte.status === 'verstuurd' || offerte.status === 'afgewacht')

  return (
    <div className="min-h-screen bg-[#faf8f5] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-stone-200 overflow-hidden">
          {/* Header */}
          <div className="bg-[#8B6F47] text-white px-6 py-5 flex items-center justify-between">
            <div>
              <p className="font-bold text-lg">Kuiper Holland</p>
              <p className="text-xs opacity-80">Veneer &amp; HPL — Interieurbouw B2B</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-bold">OFFERTE</p>
              <p className="text-xs opacity-90">{offertenummer}</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Status */}
            {offerte.status === 'geaccepteerd' && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
                ✓ U heeft deze offerte <strong>geaccepteerd</strong>
                {offerte.reactie_op ? ` op ${datumNL(offerte.reactie_op)}` : ''}. Kuiper Holland neemt contact met u op.
              </div>
            )}
            {offerte.status === 'afgewacht' && !verlopen && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                U heeft aangegeven deze offerte <strong>af te wachten</strong>. U kunt hieronder alsnog accepteren.
              </div>
            )}
            {verlopen && offerte.status !== 'geaccepteerd' && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
                Deze offerte is <strong>verlopen</strong> op {offerte.vervaldatum ? datumNL(offerte.vervaldatum) : '—'}.
                Neem contact op voor een nieuwe offerte.
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-stone-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-stone-500 uppercase mb-1.5">Offerte voor</p>
                <p className="font-semibold text-stone-800">{profiel.naam ?? '—'}</p>
                <p className="text-stone-600">{profiel.bedrijf ?? ''}</p>
              </div>
              <div className="bg-stone-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-stone-500 uppercase mb-1.5">Geldigheid</p>
                <p className="text-stone-600">Datum: {offerte.verstuurd_op ? datumNL(offerte.verstuurd_op) : '—'}</p>
                <p className="font-semibold text-stone-800">Geldig tot: {offerte.vervaldatum ? datumNL(offerte.vervaldatum) : '—'}</p>
              </div>
            </div>

            {/* Regels */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-[#8B6F47] text-left">
                    <th className="py-2 pr-2 font-semibold text-stone-600">Omschrijving</th>
                    <th className="py-2 px-2 font-semibold text-stone-600 text-center">Aantal</th>
                    <th className="py-2 px-2 font-semibold text-stone-600 text-center">m²</th>
                    <th className="py-2 pl-2 font-semibold text-stone-600 text-right">Prijs / m²</th>
                  </tr>
                </thead>
                <tbody>
                  {offerte.regels.map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-stone-50' : ''}>
                      <td className="py-2.5 pr-2 text-stone-800">{r.omschrijving}</td>
                      <td className="py-2.5 px-2 text-center text-stone-600">{r.aantal}×</td>
                      <td className="py-2.5 px-2 text-center text-stone-600">
                        {r.m2.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-semibold text-stone-800">
                        € {r.prijs_per_m2.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#8B6F47] font-bold text-stone-800">
                    <td className="py-2.5 pr-2">Totale oppervlakte</td>
                    <td />
                    <td className="py-2.5 px-2 text-center">
                      {totaalM2.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>

            {offerte.opmerking && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-stone-700">
                <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Opmerking</p>
                {offerte.opmerking}
              </div>
            )}

            <p className="text-xs text-stone-400">
              Prijzen per m², excl. BTW en verzendkosten. Op deze offerte zijn de algemene
              verkoop- en leveringsvoorwaarden van Kuiper Holland B.V. van toepassing.
            </p>

            {/* Acties */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              {kanReageren && (
                <>
                  <a
                    href={`/api/offerte/reactie?token=${offerte.token}&keuze=geaccepteerd`}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-center transition-colors"
                  >
                    ✓ Offerte accepteren
                  </a>
                  {offerte.status !== 'afgewacht' && (
                    <a
                      href={`/api/offerte/reactie?token=${offerte.token}&keuze=afgewacht`}
                      className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-center border border-stone-300 transition-colors"
                    >
                      Afwachten
                    </a>
                  )}
                </>
              )}
              <a
                href={`/api/offerte/pdf?token=${offerte.token}`}
                target="_blank"
                className="flex-1 py-3 bg-white hover:bg-stone-50 text-[#8B6F47] font-semibold rounded-xl text-center border-2 border-[#8B6F47] transition-colors"
              >
                📄 Download PDF
              </a>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-stone-400 mt-4">
          Vragen over deze offerte? Mail naar{' '}
          <a className="underline" href="mailto:info@kuiperholland.nl">info@kuiperholland.nl</a>
        </p>
      </div>
    </div>
  )
}
