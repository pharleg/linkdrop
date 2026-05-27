import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error: formError, message: formMessage } = await searchParams
  async function signup(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { error } = await supabase.auth.signUp({
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    })
    if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`)
    redirect('/signup?message=Check your email to confirm your account')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-80">
        <h1 className="text-2xl font-bold mb-6">Create your account</h1>
        {formError && (
          <p className="text-sm text-red-600 mb-4">{formError}</p>
        )}
        {formMessage && (
          <p className="text-sm text-green-600 mb-4">{formMessage}</p>
        )}
        <form action={signup} className="flex flex-col gap-3">
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
            placeholder="Password (min 6 characters)"
            required
            minLength={6}
            className="border rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="bg-black text-white rounded px-3 py-2 text-sm font-medium"
          >
            Create account
          </button>
        </form>
        <p className="text-xs text-gray-500 text-center mt-4">
          Have an account?{' '}
          <a href="/login" className="underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
