import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error: formError } = await searchParams

  async function createProposal(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data, error } = await supabase
      .from('proposals')
      .insert({
        user_id: user.id,
        title: (formData.get('title') as string).trim(),
        body: (formData.get('body') as string).trim(),
        signature_required: formData.get('signature_required') === 'on',
      })
      .select('id')
      .single()

    if (error || !data) {
      redirect(
        `/dashboard/proposals/new?error=${encodeURIComponent(error?.message ?? 'Unknown error')}`
      )
    }

    redirect(`/dashboard/proposals/${data.id}`)
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold mb-6">New Proposal</h1>
      {formError && (
        <p className="text-sm text-red-600 mb-4">{formError}</p>
      )}
      <form action={createProposal} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">Title</label>
          <input
            name="title"
            type="text"
            placeholder="Q3 Audit — Acme Corp"
            required
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">
            Body{' '}
            <span className="text-gray-400 font-normal">(Markdown)</span>
          </label>
          <textarea
            name="body"
            rows={10}
            placeholder="## Scope&#10;&#10;This proposal covers..."
            className="w-full border rounded px-3 py-2 text-sm font-mono"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="signature_required" type="checkbox" />
          Require signature
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-black text-white text-sm px-4 py-2 rounded"
          >
            Create Proposal
          </button>
          <a
            href="/dashboard"
            className="text-sm px-4 py-2 rounded border hover:bg-gray-50"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  )
}
