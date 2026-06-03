import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
  const plan = profile?.plan ?? 'free'

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold mb-6">Billing</h1>
      <div className="border rounded-lg p-4 mb-4">
        <p className="text-sm text-gray-500 mb-1">Current plan</p>
        <p className="text-lg font-semibold capitalize">{plan}</p>
      </div>
      {plan === 'free' && (
        <div className="flex flex-col gap-2">
          <a href="/api/billing/checkout?plan=starter" className="bg-black text-white text-sm px-4 py-2 rounded text-center">Upgrade to Starter</a>
          <a href="/api/billing/checkout?plan=pro" className="border text-sm px-4 py-2 rounded text-center hover:bg-gray-50">Upgrade to Pro</a>
        </div>
      )}
    </div>
  )
}
