import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkProposalLimit } from '@/lib/limits'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('proposals')
    .select('id, title, logo_url, signature_required, expires_at, created_at, proposal_revisions(id, revision, created_at)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed } = await checkProposalLimit(supabase, user.id)
  if (!allowed) return NextResponse.json({ error: 'plan_limit_reached' }, { status: 403 })

  const body = await request.json()
  const { title, body: proposalBody, logo_url, signature_required = true, expires_at } = body

  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (!proposalBody) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .insert({ user_id: user.id, title, logo_url, signature_required, expires_at })
    .select('id')
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: proposalError?.message ?? 'Failed to create proposal' }, { status: 500 })
  }

  const { error: revisionError } = await supabase
    .from('proposal_revisions')
    .insert({ proposal_id: proposal.id, revision: 1, body: proposalBody })

  if (revisionError) return NextResponse.json({ error: revisionError.message }, { status: 500 })

  return NextResponse.json({ id: proposal.id }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, body: revisionBody } = body
  if (!id || !revisionBody) return NextResponse.json({ error: 'id and body required' }, { status: 400 })

  const { data: proposal } = await supabase.from('proposals').select('id').eq('id', id).eq('user_id', user.id).single()
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: latest } = await supabase
    .from('proposal_revisions')
    .select('revision')
    .eq('proposal_id', id)
    .order('revision', { ascending: false })
    .limit(1)
    .single()

  const nextRevision = (latest?.revision ?? 0) + 1
  const { error } = await supabase.from('proposal_revisions').insert({ proposal_id: id, revision: nextRevision, body: revisionBody })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ revision: nextRevision })
}
