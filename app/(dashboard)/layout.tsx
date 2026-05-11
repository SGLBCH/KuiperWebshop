import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/ui/LogoutButton'

async function getSession() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
      return { demoMode: true, user: null, profile: null }
    }
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { demoMode: false, user: null, profile: null }

    const { data: profile } = await supabase
      .from('profiles')
      .select('status, rol, naam')
      .eq('id', user.id)
      .single()

    return { demoMode: false, user, profile }
  } catch {
    return { demoMode: true, user: null, profile: null }
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { demoMode, user, profile } = await getSession()

  if (!demoMode && !user) {
    redirect('/login')
  }

  // Block access if not approved yet
  if (!demoMode && user && profile?.status !== 'goedgekeurd') {
    redirect('/pending')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Demo Banner */}
      {demoMode && (
        <div className="bg-amber-400 text-amber-950 text-center text-xs font-medium py-1.5 px-4">
          Demo modus — geen authenticatie geconfigureerd. Stel NEXT_PUBLIC_SUPABASE_URL in voor productie.
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-xl">🪵</span>
              <span className="font-bold text-lg" style={{ color: '#8B6F47' }}>Kuiper Holland</span>
            </Link>

            {/* Nav */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/dashboard"
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/configurator"
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Configurator
              </Link>
              <Link
                href="/profile"
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Profiel
              </Link>
              <Link
                href="/admin"
                className="px-3 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
              >
                Admin
              </Link>
            </nav>

            {/* Right */}
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-sm text-gray-500 max-w-[180px] truncate">
                {demoMode ? 'demo@kuiperholland.nl' : (user?.email ?? '')}
              </span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between text-xs text-gray-400">
          <span>© {new Date().getFullYear()} Kuiper Holland B.V. — Alle rechten voorbehouden.</span>
          <span>B2B Webshop v1.0</span>
        </div>
      </footer>
    </div>
  )
}
