import { notFound, redirect } from 'next/navigation'
import { after } from 'next/server'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import { logClick } from '@/lib/track'

export default async function SlugPage({ params }: { params: Promise<{ slug: string }> }) {
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
    const { data: proposal } = await supabase
      .from('proposals')
      .select('id, title, user_id')
      .eq('id', link.proposal_id)
      .single()

    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('hide_branding')
      .eq('id', proposal?.user_id ?? '')
      .single()

    return (
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-semibold">{proposal?.title ?? 'Proposal'}</h1>
        <p className="text-sm text-gray-400 mt-2">Sign this proposal at <a href={`/${slug}/sign`} className="underline">/{slug}/sign</a></p>
        {!ownerProfile?.hide_branding && (
          <p className="text-xs text-gray-400 text-center mt-8">
            Powered by <a href="https://linkdrop.io" className="underline">LinkDrop</a>
          </p>
        )}
      </div>
    )
  }

  redirect(link.destination_url!)
}
