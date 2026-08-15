'use client'

import { createBrowserSupabase } from '@/lib/supabase/client'

export function LoginButton() {
  async function signIn() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <button
      onClick={signIn}
      className="rounded-lg bg-black px-6 py-3 text-white hover:bg-gray-800"
    >
      구글로 시작하기
    </button>
  )
}
