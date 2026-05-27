import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LinkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: link } = await supabase
    .from('links')
    .select('id, slug, destination_url, active, notify_on_first_click, created_at')
    .eq('id', id)
    .single()

  if (!link) notFound()

  const { count } = await supabase
    .from('clicks')
    .select('id', { count: 'exact', head: true })
    .eq('link_id', id)

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">/{link.slug}</h1>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            link.active
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {link.active ? 'active' : 'inactive'}
        </span>
      </div>
      <div className="border rounded-lg p-4 mb-6 flex flex-col gap-2 text-sm">
        <div>
          <span className="text-gray-400">Short link: </span>
          <span>linkdrop.io/{link.slug}</span>
        </div>
        {link.destination_url && (
          <div>
            <span className="text-gray-400">Destination: </span>
            <a
              href={link.destination_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline truncate"
            >
              {link.destination_url}
            </a>
          </div>
        )}
        <div>
          <span className="text-gray-400">Total clicks: </span>
          <span className="font-medium">{count ?? 0}</span>
        </div>
      </div>
      <div className="border rounded-lg p-4 text-sm text-gray-400">
        <p>Click timeline — Phase 3</p>
      </div>
    </div>
  )
}
