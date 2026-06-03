import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { proposal_id, revision, paragraph_index, markup_type, comment_text, author_role } = body

  if (!proposal_id || revision == null || paragraph_index == null || !markup_type || !author_role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('markups')
    .insert({ proposal_id, revision, paragraph_index, markup_type, comment_text, author_role })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (author_role === 'recipient') {
    const { data: proposal } = await supabase.from('proposals').select('title, user_id').eq('id', proposal_id).single()
    if (proposal) {
      const { data: { user } } = await supabase.auth.admin.getUserById(proposal.user_id)
      if (user?.email) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'noreply@linkdrop.io',
          to: user.email,
          subject: `New markup on "${proposal.title}"`,
          text: `Someone ${markup_type === 'comment' ? 'left a comment' : 'struck through a paragraph'} on your proposal.\n\nView: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/proposals/${proposal_id}`,
        })
      }
    }
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, reply_text } = body
  if (!id || !reply_text) return NextResponse.json({ error: 'id and reply_text required' }, { status: 400 })

  const serviceSupabase = createServiceClient()
  const { data: markup } = await serviceSupabase.from('markups').select('proposal_id').eq('id', id).single()
  if (!markup) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: proposal } = await supabase.from('proposals').select('id').eq('id', markup.proposal_id).eq('user_id', user.id).single()
  if (!proposal) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await serviceSupabase.from('markups').update({ reply_text }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
