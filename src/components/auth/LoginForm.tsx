'use client'

import { signIn } from '@/app/login/actions'

export function LoginForm({ error }: { error?: string }) {
  return (
    <form action={signIn} className="flex flex-col gap-3 max-w-sm mx-auto p-6">
      <h1 className="text-xl font-semibold">Log in</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="border rounded p-2"
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        required
        className="border rounded p-2"
      />
      <button type="submit" className="bg-black text-white rounded p-2">
        Log in
      </button>
      <a href="/signup" className="text-sm text-center underline">
        Need an account?
      </a>
    </form>
  )
}
