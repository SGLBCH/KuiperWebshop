import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-stone-200 p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🪵</div>
        <h1 className="text-xl font-bold text-stone-900 mb-2">Pagina niet gevonden</h1>
        <p className="text-sm text-stone-600 mb-6">
          De pagina die u zoekt bestaat niet (meer) of het adres is verkeerd getypt.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Naar het dashboard
        </Link>
      </div>
    </div>
  )
}
