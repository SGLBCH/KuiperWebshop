import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/ui/LogoutButton'

async function getSession() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
    return { demoMode: true, user: null, profile: null, nieuweAanvragen: 0 }
  }
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { demoMode: false, user: null, profile: null, nieuweAanvragen: 0 }

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

    // Voor admins: aantal nieuwe (onbehandelde) aanvragen ophalen voor de
    // notificatie-indicator in de menubalk
    let nieuweAanvragen = 0
    if (profile?.rol === 'admin') {
      const { count } = await supabase
        .from('aanvragen')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'nieuw')
      nieuweAanvragen = count ?? 0
    }

    return { demoMode: false, user, profile, nieuweAanvragen }
  } catch {
    // Bij een Supabase-storing NOOIT terugvallen op demo-modus:
    // behandel als niet-ingelogd zodat de auth-gating intact blijft
    return { demoMode: false, user: null, profile: null, nieuweAanvragen: 0 }
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { demoMode, user, profile, nieuweAanvragen } = await getSession()

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

  // Gedeelde navigatie-items voor desktop én mobiel
  const navItems: { href: string; label: string; badge: number }[] = [
    { href: '/dashboard', label: 'Dashboard', badge: 0 },
    { href: '/configurator', label: 'Configurator', badge: 0 },
    { href: '/profile', label: 'Profiel', badge: 0 },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', badge: nieuweAanvragen ?? 0 }] : []),
  ]

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
            <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="Kuiper Holland" className="h-9 w-9" />
              <span className="kuiper-wordmark hidden sm:block font-semibold text-sm leading-tight">
                Kuiper Holland<br /><span className="text-xs font-normal text-stone-500">B2B Webshop</span>
              </span>
            </Link>

            {/* Nav (desktop). De Admin-link wordt server-side gegate op rol,
                dus niet in de browser te manipuleren; /admin is apart beveiligd. */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  {item.label}
                  {item.badge > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            {/* Right */}
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-sm text-stone-500 max-w-[180px] truncate">
                {demoMode ? 'demo@kuiperholland.nl' : (user?.email ?? '')}
              </span>
              <LogoutButton />
            </div>
          </div>

          {/* Nav (mobiel) — tweede rij, alleen zichtbaar onder md */}
          <nav className="md:hidden flex items-center gap-1 overflow-x-auto -mx-1 px-1 pb-2">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="relative shrink-0 px-3 py-1.5 text-sm font-medium text-stone-600 hover:text-stone-900 bg-stone-100 rounded-lg transition-colors"
              >
                {item.label}
                {item.badge > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
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
