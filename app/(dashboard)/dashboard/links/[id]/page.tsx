import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LinkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: link } = await supabase.from('links').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!link) notFound()

  const { data: clicks } = await supabase
    .from('clicks')
    .select('id, clicked_at, user_agent, referrer')
    .eq('link_id', id)
    .order('clicked_at', { ascending: false })

  return (
    <div className="max-w-2xl">
      <div className="mb-6"><a href="/dashboard/links" className="text-sm text-gray-400 hover:underline">← Links</a></div>
      <h1 className="text-xl font-semibold mb-1 font-mono">/{link.slug}</h1>
      <p className="text-sm text-gray-500 mb-6">{link.destination_url}</p>
      <h2 className="text-sm font-medium mb-3">Clicks ({clicks?.length ?? 0})</h2>
      {!clicks || clicks.length === 0 ? (
        <p className="text-sm text-gray-400">No clicks yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {clicks.map((click) => (
            <li key={click.id} className="text-xs font-mono text-gray-600 border rounded px-3 py-2">
              {new Date(click.clicked_at).toISOString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
