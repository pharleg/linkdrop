import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { LinkCard } from '@/components/LinkCard'

export default async function LinksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: links } = await supabase
    .from('links')
    .select('id, slug, destination_url, active, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const serviceSupabase = createServiceClient()
  const clickCounts: Record<string, number> = {}

  if (links && links.length > 0) {
    const { data: counts } = await serviceSupabase
      .from('clicks')
      .select('link_id')
      .in('link_id', links.map((l) => l.id))

    if (counts) {
      for (const row of counts) {
        clickCounts[row.link_id] = (clickCounts[row.link_id] ?? 0) + 1
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Links</h1>
        <a href="/dashboard/links/new" className="bg-black text-white text-sm px-3 py-1.5 rounded">
          + New Link
        </a>
      </div>
      {!links || links.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <p className="text-gray-400 text-sm mb-4">No links yet.</p>
          <a href="/dashboard/links/new" className="text-sm underline text-gray-600">
            Create your first link
          </a>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.id}>
              <LinkCard
                id={link.id}
                slug={link.slug}
                destinationUrl={link.destination_url}
                clickCount={clickCounts[link.id] ?? 0}
                active={link.active}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
