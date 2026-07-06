'use client'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-stone-200 p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-stone-900 mb-2">Er ging iets mis</h1>
        <p className="text-sm text-stone-600 mb-6">
          Er is een onverwachte fout opgetreden. Probeer het opnieuw — blijft het
          probleem bestaan, neem dan contact op via{' '}
          <a href="mailto:info@kuiperholland.nl" className="text-blue-600 underline">info@kuiperholland.nl</a>.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Probeer opnieuw
          </button>
          <a
            href="/dashboard"
            className="px-5 py-2.5 bg-stone-100 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-200 transition-colors"
          >
            Naar dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
