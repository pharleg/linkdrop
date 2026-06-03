import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logClick, getClickCount } from '@/lib/track'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { link_id } = body
  if (!link_id) return NextResponse.json({ error: 'link_id required' }, { status: 400 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = request.headers.get('user-agent')
  const referrer = request.headers.get('referer')

  const prevCount = await getClickCount(link_id)
  await logClick({ linkId: link_id, ip, userAgent, referrer })

  if (prevCount === 0) {
    const supabase = createServiceClient()
    const { data: link } = await supabase
      .from('links')
      .select('notify_on_first_click, slug, user_id')
      .eq('id', link_id)
      .single()

    if (link?.notify_on_first_click) {
      const { data: { user } } = await supabase.auth.admin.getUserById(link.user_id)
      if (user?.email) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'noreply@linkdrop.io',
          to: user.email,
          subject: `Someone opened your link — ${link.slug}`,
          text: `Your link /${link.slug} was opened at ${new Date().toISOString()}.\n\nView: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/links`,
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
