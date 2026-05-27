import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: link } = await supabase
    .from('links')
    .select('destination_url, proposal_id, active')
    .eq('slug', slug)
    .single()

  if (!link || !link.active) notFound()

  if (link.destination_url) redirect(link.destination_url)

  // proposal_id set — rendering deferred to Phase 6
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading proposal…</p>
    </div>
  )
}
