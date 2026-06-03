import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkLinkLimit } from '@/lib/limits'
import { generateSlug, resolveSlug } from '@/lib/slug'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('links')
    .select('id, slug, destination_url, active, notify_on_first_click, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed } = await checkLinkLimit(supabase, user.id)
  if (!allowed) return NextResponse.json({ error: 'plan_limit_reached' }, { status: 403 })

  const body = await request.json()
  let { slug, destination_url, notify_on_first_click = true } = body

  if (!destination_url) return NextResponse.json({ error: 'destination_url required' }, { status: 400 })

  if (!slug) {
    const checkExists = async (s: string) => {
      const { data } = await supabase.from('links').select('id').eq('slug', s).single()
      return !!data
    }
    const resolved = await resolveSlug(generateSlug(), checkExists)
    if (!resolved) return NextResponse.json({ error: 'Could not generate unique slug. Try a custom slug.' }, { status: 409 })
    slug = resolved
  }

  const { data, error } = await supabase
    .from('links')
    .insert({ user_id: user.id, slug, destination_url, notify_on_first_click })
    .select('id, slug')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug already taken.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, active } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('links').update({ active }).eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
