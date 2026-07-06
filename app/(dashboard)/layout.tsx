import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/ui/LogoutButton'

async function getSession() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
    return { demoMode: true, user: null, profile: null }
  }
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { demoMode: false, user: null, profile: null }

    const { data: profile } = await supabase
      .from('profiles')
      .select('status, rol, naam')
      .eq('id', user.id)
      .single()

    // Update last_seen_at non-blocking (column may not exist yet — ignore error)
    supabase.from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', user.id)
      .then(() => {})

    return { demoMode: false, user, profile }
  } catch {
    // Bij een Supabase-storing NOOIT terugvallen op demo-modus:
    // behandel als niet-ingelogd zodat de auth-gating intact blijft
    return { demoMode: false, user: null, profile: null }
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

  // Admin-navigatie alleen tonen aan echte admins. In demo-modus (geen
  // Supabase geconfigureerd) tonen we 'm zodat de admin lokaal te previewen is.
  const isAdmin = demoMode || profile?.rol === 'admin'

  // Block access if explicitly not approved (ignore null = possible fetch error)
  if (!demoMode && user && profile && profile.status !== 'goedgekeurd') {
    redirect('/pending')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8f5]">
      {/* Demo Banner */}
      {demoMode && (
        <div className="bg-amber-400 text-amber-950 text-center text-xs font-medium py-1.5 px-4">
          Demo modus — geen authenticatie geconfigureerd. Stel NEXT_PUBLIC_SUPABASE_URL in voor productie.
        </div>
      )}

      {/* Header */}
      <header className="bg-white/95 backdrop-blur border-b border-stone-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <span className="h-9 w-9 rounded-md bg-[var(--color-primary)] text-white flex items-center justify-center font-bold text-sm">
                KH
              </span>
              <span className="kuiper-wordmark hidden sm:block font-semibold text-sm leading-tight">
                Kuiper Holland<br /><span className="text-xs font-normal text-stone-500">B2B Webshop</span>
              </span>
            </Link>

            {/* Nav */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/dashboard"
                className="px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/configurator"
                className="px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Configurator
              </Link>
              <Link
                href="/profile"
                className="px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Profiel
              </Link>
              {/* Admin-link alleen voor admins. De rol wordt server-side
                  bepaald (getSession), dus dit is niet in de browser te
                  manipuleren. De /admin-route is bovendien apart beveiligd. */}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-3 py-2 text-sm font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  Admin
                </Link>
              )}
            </nav>

            {/* Right */}
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-sm text-stone-500 max-w-[180px] truncate">
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
      <footer className="bg-white border-t border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4 text-xs text-stone-500">
          <span>© {new Date().getFullYear()} Kuiper Holland B.V. — Alle rechten voorbehouden.</span>
          <span className="flex items-center gap-3">
            <a className="hover:text-[var(--color-primary)]" href="/voorwaarden/algemene-verkoop-en-leveringsvoorwaarden-nl.pdf" target="_blank">Voorwaarden NL</a>
            <a className="hover:text-[var(--color-primary)]" href="/voorwaarden/algemene-verkoop-en-leveringsvoorwaarden-en.pdf" target="_blank">Terms EN</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
