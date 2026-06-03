import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ProposalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Proposals</h1>
        <a href="/dashboard/proposals/new" className="bg-black text-white text-sm px-3 py-1.5 rounded">+ New Proposal</a>
      </div>
      {!proposals || proposals.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <p className="text-gray-400 text-sm mb-4">No proposals yet.</p>
          <a href="/dashboard/proposals/new" className="text-sm underline text-gray-600">Create your first proposal</a>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {proposals.map((p) => (
            <li key={p.id}>
              <a href={`/dashboard/proposals/${p.id}`} className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-gray-50">
                <span className="text-sm font-medium">{p.title}</span>
                <span className="text-xs text-gray-400 font-mono">{new Date(p.created_at).toLocaleDateString()}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
