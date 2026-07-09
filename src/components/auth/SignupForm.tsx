'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SignupForm() {
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: String(formData.get('email')),
      password: String(formData.get('password')),
    })
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage('Account created. Check your email to confirm, then log in.')
    setTimeout(() => router.push('/login'), 1500)
  }

  return (
    <form
      action={handleSubmit}
      className="flex flex-col gap-3 max-w-sm mx-auto p-6"
    >
      <h1 className="text-xl font-display font-semibold">Create account</h1>
      {message && <p className="text-sm">{message}</p>}
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="rounded border border-surface-raised bg-surface p-2 placeholder:text-text-muted"
      />
      <input
        name="password"
        type="password"
        placeholder="Password (min 6 chars)"
        required
        minLength={6}
        className="rounded border border-surface-raised bg-surface p-2 placeholder:text-text-muted"
      />
      <button
        type="submit"
        className="rounded bg-accent p-2 font-medium text-bg hover:bg-accent-hover"
      >
        Sign up
      </button>
    </form>
  )
}
