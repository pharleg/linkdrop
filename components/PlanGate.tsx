import { createClient } from '@/lib/supabase/server'
import type { Plan } from '@/lib/limits'

interface Props {
  required: Plan | Plan[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default async function PlanGate({ required, children, fallback }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  const plan = (profile?.plan ?? 'free') as Plan
  const allowed = Array.isArray(required) ? required.includes(plan) : plan === required

  if (!allowed) return fallback ? <>{fallback}</> : null
  return <>{children}</>
}
