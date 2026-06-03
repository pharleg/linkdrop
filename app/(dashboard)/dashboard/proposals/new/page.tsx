import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error: formError } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  async function createProposal(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const title = (formData.get('title') as string).trim()
    const body = (formData.get('body') as string).trim()
    const signatureRequired = formData.get('signature_required') === 'on'

    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .insert({ user_id: user.id, title, body, signature_required: signatureRequired })
      .select('id')
      .single()

    if (proposalError || !proposal) {
      redirect(`/dashboard/proposals/new?error=${encodeURIComponent(proposalError?.message ?? 'Failed to create proposal')}`)
    }

    redirect(`/dashboard/proposals/${proposal.id}`)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">New Proposal</h1>
      {formError && <p className="text-sm text-red-600 mb-4">{formError}</p>}
      <form action={createProposal} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">Title</label>
          <input name="title" type="text" placeholder="Project proposal" required className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Content (Markdown)</label>
          <textarea name="body" rows={16} placeholder="## Overview&#10;&#10;Write your proposal here..." required
            className="w-full border rounded px-3 py-2 text-sm font-mono resize-y" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="signature_required" type="checkbox" defaultChecked />
          Require e-signature
        </label>
        <div className="flex gap-2">
          <button type="submit" className="bg-black text-white text-sm px-4 py-2 rounded">Create Proposal</button>
          <a href="/dashboard/proposals" className="text-sm px-4 py-2 rounded border hover:bg-gray-50">Cancel</a>
        </div>
      </form>
    </div>
  )
}
