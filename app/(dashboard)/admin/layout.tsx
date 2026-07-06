import { redirect } from 'next/navigation'

// Server-side toegangscontrole voor het hele /admin segment.
// Alleen profielen met rol 'admin' komen erdoor; iedereen anders
// wordt teruggestuurd naar het dashboard voordat er iets rendert.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const demoMode = !supabaseUrl || supabaseUrl === 'https://your-project.supabase.co'

  if (!demoMode) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
      .from('profiles')
      .select('rol, status')
      .eq('id', user.id)
      .single()

    if (profile?.rol !== 'admin' || profile?.status !== 'goedgekeurd') redirect('/dashboard')
  }

  return <>{children}</>
}
