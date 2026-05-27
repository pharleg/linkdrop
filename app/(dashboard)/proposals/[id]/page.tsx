import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, body, signature_required, created_at, expires_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!proposal) notFound()

  const { count: signatureCount } = await supabase
    .from('signatures')
    .select('id', { count: 'exact', head: true })
    .eq('proposal_id', id)

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold mb-6">{proposal.title}</h1>
      <div className="border rounded-lg p-4 mb-6 flex flex-col gap-2 text-sm">
        <div>
          <span className="text-gray-400">Signatures: </span>
          <span className="font-medium">{signatureCount ?? 0}</span>
        </div>
        <div>
          <span className="text-gray-400">Signature required: </span>
          <span>{proposal.signature_required ? 'Yes' : 'No'}</span>
        </div>
        {proposal.expires_at && (
          <div>
            <span className="text-gray-400">Expires: </span>
            <span>{new Date(proposal.expires_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>
      <div className="border rounded-lg p-4 text-sm text-gray-400">
        <p>Signature capture — Phase 7</p>
      </div>
    </div>
  )
}
