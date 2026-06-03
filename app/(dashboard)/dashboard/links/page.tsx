import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LinksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: links } = await supabase
    .from('links')
    .select('id, slug, destination_url, active, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Links</h1>
        <a href="/dashboard/links/new" className="bg-black text-white text-sm px-3 py-1.5 rounded">+ New Link</a>
      </div>
      {!links || links.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <p className="text-gray-400 text-sm mb-4">No links yet.</p>
          <a href="/dashboard/links/new" className="text-sm underline text-gray-600">Create your first link</a>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.id}>
              <a href={`/dashboard/links/${link.id}`} className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-gray-50">
                <span className="font-mono text-sm">/{link.slug}</span>
                <span className="text-xs text-gray-400">{link.active ? 'active' : 'inactive'}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
