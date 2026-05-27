import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-white">
      <aside className="w-52 border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <span className="font-bold text-base">🔗 LinkDrop</span>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          <a
            href="/dashboard"
            className="text-sm px-2 py-1.5 rounded hover:bg-gray-100"
          >
            Links
          </a>
          <a
            href="/dashboard/proposals/new"
            className="text-sm px-2 py-1.5 rounded hover:bg-gray-100"
          >
            Proposals
          </a>
          <a
            href="#"
            className="text-sm px-2 py-1.5 rounded text-gray-400 cursor-not-allowed"
          >
            Settings
          </a>
        </nav>
        <div className="p-3 border-t">
          <p className="text-xs text-gray-400 truncate mb-2">{user.email}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-gray-500 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
