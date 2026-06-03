import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('full_name, custom_domain').eq('id', user.id).single()

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold mb-6">Settings</h1>
      <div className="border rounded-lg p-4 mb-4">
        <p className="text-sm font-medium mb-1">Email</p>
        <p className="text-sm text-gray-500">{user.email}</p>
      </div>
      <div className="border rounded-lg p-4 mb-4">
        <p className="text-sm font-medium mb-1">Custom Domain</p>
        <p className="text-sm text-gray-400">Coming soon — enter your domain and we&apos;ll reach out with setup instructions.</p>
        <input type="text" defaultValue={profile?.custom_domain ?? ''} placeholder="yourdomain.com" disabled
          className="mt-2 w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-400" />
      </div>
      <div className="border rounded-lg p-4">
        <p className="text-sm font-medium mb-1">Team</p>
        <p className="text-sm text-gray-400">Coming soon.</p>
      </div>
    </div>
  )
}
