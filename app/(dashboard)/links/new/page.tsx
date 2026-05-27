import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default function NewLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  async function createLink(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const slug = (formData.get('slug') as string).trim().toLowerCase()
    const destinationUrl = (formData.get('destination_url') as string).trim()
    const notifyOnFirstClick = formData.get('notify_on_first_click') === 'on'

    const { data, error } = await supabase
      .from('links')
      .insert({
        user_id: user.id,
        slug,
        destination_url: destinationUrl,
        notify_on_first_click: notifyOnFirstClick,
      })
      .select('id')
      .single()

    if (error) {
      redirect(
        `/dashboard/links/new?error=${encodeURIComponent(
          error.code === '23505' ? 'That slug is already taken.' : error.message
        )}`
      )
    }

    redirect(`/dashboard/links/${data.id}`)
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold mb-6">New Link</h1>
      <form action={createLink} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">Slug</label>
          <div className="flex items-center border rounded overflow-hidden">
            <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r">
              linkdrop.io/
            </span>
            <input
              name="slug"
              type="text"
              placeholder="your-slug"
              required
              pattern="[a-z0-9\-]+"
              className="flex-1 px-3 py-2 text-sm outline-none"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Lowercase letters, numbers, hyphens only.</p>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">
            Destination URL
          </label>
          <input
            name="destination_url"
            type="url"
            placeholder="https://example.com"
            required
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="notify_on_first_click" type="checkbox" />
          Email me on first click
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-black text-white text-sm px-4 py-2 rounded"
          >
            Create Link
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
