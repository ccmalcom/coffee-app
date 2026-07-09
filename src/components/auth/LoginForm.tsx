'use client'

import { signIn } from '@/app/login/actions'

export function LoginForm({ error }: { error?: string }) {
  return (
    <form action={signIn} className="flex flex-col gap-3 max-w-sm mx-auto p-6">
      <h1 className="text-xl font-display font-semibold">Log in</h1>
      {error && <p className="text-danger text-sm">{error}</p>}
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
        placeholder="Password"
        required
        className="rounded border border-surface-raised bg-surface p-2 placeholder:text-text-muted"
      />
      <button
        type="submit"
        className="rounded bg-accent p-2 font-medium text-bg hover:bg-accent-hover"
      >
        Log in
      </button>
      <a href="/signup" className="text-sm text-center text-accent underline">
        Need an account?
      </a>
    </form>
  )
}
