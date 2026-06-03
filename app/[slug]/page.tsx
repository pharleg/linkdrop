import { notFound, redirect } from 'next/navigation'
import { after } from 'next/server'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import { logClick } from '@/lib/track'
import ProposalViewer from '@/components/ProposalViewer'

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createServiceClient()

  const { data: link } = await supabase
    .from('links')
    .select('id, destination_url, proposal_id, active')
    .eq('slug', slug)
    .single()

  if (!link || !link.active) notFound()

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = headersList.get('user-agent')
  const referrer = headersList.get('referer')

  after(() => logClick({ linkId: link.id, ip, userAgent, referrer }))

  if (link.proposal_id) {
    const [{ data: proposal }, { data: latestRevision }] = await Promise.all([
      supabase
        .from('proposals')
        .select('id, title, user_id, signature_required')
        .eq('id', link.proposal_id)
        .single(),
      supabase
        .from('proposal_revisions')
        .select('revision, body')
        .eq('proposal_id', link.proposal_id)
        .order('revision', { ascending: false })
        .limit(1)
        .single(),
    ])

    if (!proposal || !latestRevision) notFound()

    const [{ data: ownerProfile }, { data: markups }, { data: existingSig }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('hide_branding')
          .eq('id', proposal.user_id)
          .single(),
        supabase
          .from('markups')
          .select('id, paragraph_index, markup_type, comment_text, reply_text, author_role')
          .eq('proposal_id', proposal.id)
          .eq('revision', latestRevision.revision)
          .order('created_at', { ascending: true }),
        supabase
          .from('signatures')
          .select('id')
          .eq('proposal_id', proposal.id)
          .eq('link_id', link.id)
          .limit(1)
          .single(),
      ])

    const alreadySigned = !!existingSig

    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="mb-6 flex items-start justify-between">
          <h1 className="text-2xl font-semibold">{proposal.title}</h1>
          {proposal.signature_required && !alreadySigned && (
            <a
              href={`/${slug}/sign`}
              className="shrink-0 ml-4 bg-black text-white text-sm px-4 py-2 rounded"
            >
              Sign
            </a>
          )}
          {alreadySigned && (
            <span className="shrink-0 ml-4 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded">
              Signed
            </span>
          )}
        </div>

        <ProposalViewer
          proposalId={proposal.id}
          revision={latestRevision.revision}
          body={latestRevision.body}
          markups={(markups ?? []) as Parameters<typeof ProposalViewer>[0]['markups']}
          canMarkup={true}
        />

        {!ownerProfile?.hide_branding && (
          <p className="text-xs text-gray-400 text-center mt-12">
            Powered by{' '}
            <a href="https://linkdrop.io" className="underline">
              LinkDrop
            </a>
          </p>
        )}
      </div>
    )
  }

  redirect(link.destination_url!)
}
