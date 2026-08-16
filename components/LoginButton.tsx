'use client'

import { createBrowserSupabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

export function LoginButton() {
  async function signIn() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <Button onClick={signIn} className="px-6 py-3">
      구글로 시작하기
    </Button>
  )
}
