import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClickTimeline } from '@/components/ClickTimeline'
import CopyButton from '@/components/CopyButton'

export default async function LinkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: link } = await supabase
    .from('links')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!link) notFound()

  const { data: clicks } = await supabase
    .from('clicks')
    .select('id, clicked_at, user_agent, referrer')
    .eq('link_id', id)
    .order('clicked_at', { ascending: false })

  const shortUrl = `${process.env.NEXT_PUBLIC_APP_URL}/${link.slug}`

  async function toggleActive() {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')
    await supabase
      .from('links')
      .update({ active: !link.active })
      .eq('id', id)
      .eq('user_id', user.id)
    redirect(`/dashboard/links/${id}`)
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <a href="/dashboard/links" className="text-sm text-gray-400 hover:underline">
          ← Links
        </a>
      </div>

      <div className="flex items-start justify-between mb-1">
        <h1 className="text-xl font-semibold font-mono">/{link.slug}</h1>
        <form action={toggleActive}>
          <button
            type="submit"
            className={`text-xs px-2.5 py-1 rounded border ${
              link.active
                ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                : 'border-green-200 text-green-700 hover:bg-green-50'
            }`}
          >
            {link.active ? 'Deactivate' : 'Activate'}
          </button>
        </form>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <p className="text-sm text-gray-500 font-mono truncate">{shortUrl}</p>
        <CopyButton text={shortUrl} />
      </div>

      {link.destination_url && (
        <p className="text-xs text-gray-400 mb-6 truncate">→ {link.destination_url}</p>
      )}

      <h2 className="text-sm font-medium mb-3">
        Clicks ({clicks?.length ?? 0})
      </h2>
      <ClickTimeline clicks={clicks ?? []} />
    </div>
  )
}
