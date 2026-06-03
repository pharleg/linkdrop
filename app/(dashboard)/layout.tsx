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
      <aside className="w-52 border-r flex flex-col shrink-0 bg-[#111111]">
        <div className="p-4 border-b border-neutral-800">
          <span className="font-bold text-base text-white">LinkDrop</span>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          <a href="/dashboard/links" className="text-sm px-2 py-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800">Links</a>
          <a href="/dashboard/proposals" className="text-sm px-2 py-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800">Proposals</a>
          <a href="/dashboard/billing" className="text-sm px-2 py-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800">Billing</a>
          <a href="/dashboard/settings" className="text-sm px-2 py-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800">Settings</a>
        </nav>
        <div className="p-3 border-t border-neutral-800">
          <p className="text-xs text-neutral-500 truncate mb-2">{user.email}</p>
          <form action={signOut}>
            <button type="submit" className="text-xs text-neutral-400 hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
