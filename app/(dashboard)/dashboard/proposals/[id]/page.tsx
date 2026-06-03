import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import CopyButton from '@/components/CopyButton'

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, signature_required, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!proposal) notFound()

  const serviceSupabase = createServiceClient()

  const [{ data: revisions }, { data: signatures }, { data: markups }, { data: links }] =
    await Promise.all([
      serviceSupabase
        .from('proposal_revisions')
        .select('id, revision, created_at')
        .eq('proposal_id', id)
        .order('revision', { ascending: false }),
      serviceSupabase
        .from('signatures')
        .select('id, signer_name, signer_email, signed_at, revision')
        .eq('proposal_id', id)
        .order('signed_at', { ascending: false }),
      serviceSupabase
        .from('markups')
        .select('id, paragraph_index, markup_type, comment_text, reply_text, author_role, created_at, revision')
        .eq('proposal_id', id)
        .order('created_at', { ascending: true }),
      serviceSupabase
        .from('links')
        .select('id, slug')
        .eq('proposal_id', id)
        .eq('user_id', user.id),
    ])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <a href="/dashboard/proposals" className="text-sm text-gray-400 hover:underline">
          ← Proposals
        </a>
      </div>
      <h1 className="text-xl font-semibold mb-1">{proposal.title}</h1>
      <p className="text-xs text-gray-400 font-mono mb-6">
        {new Date(proposal.created_at).toISOString()}
      </p>

      {links && links.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium mb-3">Share links ({links.length})</h2>
          <ul className="flex flex-col gap-2">
            {links.map((l) => {
              const url = `${appUrl}/${l.slug}`
              return (
                <li key={l.id} className="flex items-center gap-2 border rounded px-3 py-2">
                  <span className="font-mono text-sm text-gray-700 truncate">{url}</span>
                  <CopyButton text={url} />
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-sm font-medium mb-3">Revisions ({revisions?.length ?? 0})</h2>
        <ul className="flex flex-col gap-1">
          {revisions?.map((r) => (
            <li
              key={r.id}
              className="text-xs font-mono text-gray-600 border rounded px-3 py-2 flex justify-between"
            >
              <span>v{r.revision}</span>
              <span>{new Date(r.created_at).toISOString()}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-medium mb-3">Signatures ({signatures?.length ?? 0})</h2>
        {!signatures || signatures.length === 0 ? (
          <p className="text-sm text-gray-400">
            {proposal.signature_required ? 'Not yet signed.' : 'No signature required.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {signatures.map((sig) => (
              <li key={sig.id} className="border rounded px-3 py-2">
                <p className="text-sm font-medium">{sig.signer_name}</p>
                <p className="text-xs text-gray-500">{sig.signer_email}</p>
                <p className="text-xs font-mono text-gray-400">
                  {sig.signed_at ? new Date(sig.signed_at).toISOString() : ''} · v{sig.revision}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium mb-3">Markups ({markups?.length ?? 0})</h2>
        {!markups || markups.length === 0 ? (
          <p className="text-sm text-gray-400">No markups yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {markups.map((m) => (
              <li key={m.id} className="border rounded px-3 py-2">
                <p className="text-xs text-gray-400 mb-1">
                  ¶{m.paragraph_index} · {m.markup_type} · {m.author_role}
                </p>
                {m.comment_text && <p className="text-sm">{m.comment_text}</p>}
                {m.reply_text && (
                  <p className="text-sm text-gray-500 border-l-2 pl-2 mt-1">
                    Reply: {m.reply_text}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
