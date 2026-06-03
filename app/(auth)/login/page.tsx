import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error: formError } = await searchParams
  async function login(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    })
    if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)
    redirect('/dashboard/links')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-80">
        <h1 className="text-2xl font-bold mb-6">Sign in to LinkDrop</h1>
        {formError && (
          <p className="text-sm text-red-600 mb-4">{formError}</p>
        )}
        <form action={login} className="flex flex-col gap-3">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            className="border rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="bg-black text-white rounded px-3 py-2 text-sm font-medium"
          >
            Sign in
          </button>
        </form>
        <p className="text-xs text-gray-500 text-center mt-4">
          No account?{' '}
          <a href="/signup" className="underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  )
}
