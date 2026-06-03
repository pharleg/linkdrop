import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'

export default async function SignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServiceClient()

  const { data: link } = await supabase
    .from('links')
    .select('id, proposal_id, active')
    .eq('slug', slug)
    .single()

  if (!link || !link.active || !link.proposal_id) notFound()

  return (
    <div className="max-w-lg mx-auto p-8">
      <h1 className="text-xl font-semibold mb-2">Sign Document</h1>
      <p className="text-sm text-gray-500">Signature capture coming soon.</p>
    </div>
  )
}
