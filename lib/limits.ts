import type { SupabaseClient } from '@supabase/supabase-js'

export const PLAN_LIMITS = {
  free:    { links: 5,        proposals: 0         },
  starter: { links: 25,       proposals: 5         },
  pro:     { links: Infinity, proposals: Infinity  },
} as const

export type Plan = keyof typeof PLAN_LIMITS

export async function getPlan(supabase: SupabaseClient, userId: string): Promise<Plan> {
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()
  return (data?.plan as Plan) ?? 'free'
}

export async function checkLinkLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; plan: Plan }> {
  const plan = await getPlan(supabase, userId)
  const limit = PLAN_LIMITS[plan].links
  if (limit === Infinity) return { allowed: true, plan }

  const result = await supabase
    .from('links')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('active', true)
  const count = result.count ?? 0

  return { allowed: count < limit, plan }
}

export async function checkProposalLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; plan: Plan }> {
  const plan = await getPlan(supabase, userId)
  const limit = PLAN_LIMITS[plan].proposals
  if (limit === Infinity) return { allowed: true, plan }
  if (limit === 0) return { allowed: false, plan }

  const result = await supabase
    .from('proposals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  const count = result.count ?? 0

  return { allowed: count < limit, plan }
}

export function signaturesEnabled(plan: Plan): boolean {
  return plan === 'starter' || plan === 'pro'
}
