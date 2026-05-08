'use client'

export function LogoutButton() {
  async function handleLogout() {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {}
    window.location.href = '/login'
  }

  return (
    <button
      onClick={handleLogout}
      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
    >
      Uitloggen
    </button>
  )
}
