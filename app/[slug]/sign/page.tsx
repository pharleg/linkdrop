import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import SignatureCanvas from '@/components/SignatureCanvas'

export default async function SignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServiceClient()

  const { data: link } = await supabase
    .from('links')
    .select('id, proposal_id, active')
    .eq('slug', slug)
    .single()

  if (!link || !link.active || !link.proposal_id) notFound()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, signature_required')
    .eq('id', link.proposal_id)
    .single()

  if (!proposal || !proposal.signature_required) notFound()

  const { data: latestRevision } = await supabase
    .from('proposal_revisions')
    .select('revision, body')
    .eq('proposal_id', proposal.id)
    .order('revision', { ascending: false })
    .limit(1)
    .single()

  if (!latestRevision) notFound()

  const { data: existingSig } = await supabase
    .from('signatures')
    .select('id')
    .eq('proposal_id', proposal.id)
    .eq('link_id', link.id)
    .limit(1)
    .single()

  if (existingSig) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <h1 className="text-xl font-semibold mb-2">Already Signed</h1>
        <p className="text-sm text-gray-500">This document has already been signed.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-8">
      <h1 className="text-xl font-semibold mb-1">{proposal.title}</h1>
      <p className="text-sm text-gray-500 mb-6">Review and sign below to accept.</p>
      <SignatureCanvas
        linkId={link.id}
        proposalId={proposal.id}
        revision={latestRevision.revision}
        slug={slug}
      />
    </div>
  )
}
