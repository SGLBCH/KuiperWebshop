import Link from 'next/link'

export default function PendingPage() {
  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Account in afwachting</h1>
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">
          Uw account is aangemaakt maar wacht nog op goedkeuring door een beheerder van Kuiper Holland.
          U ontvangt een e-mail zodra uw account is goedgekeurd.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
          <div className="flex gap-2 items-start">
            <span className="text-amber-500 text-base">ℹ️</span>
            <p className="text-sm text-amber-700">
              Heeft u al meer dan 2 werkdagen gewacht? Neem dan contact op via{' '}
              <a href="mailto:info@kuiperholland.nl" className="font-medium underline">
                info@kuiperholland.nl
              </a>
            </p>
          </div>
        </div>
        <Link
          href="/login"
          className="inline-block px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          ← Terug naar inloggen
        </Link>
      </div>
    </div>
  )
}
