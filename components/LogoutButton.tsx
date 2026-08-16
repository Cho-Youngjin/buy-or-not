'use client'

import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

/**
 * 로그아웃. signOut()이 브라우저의 auth 쿠키를 지운 뒤,
 * router.refresh()로 서버 컴포넌트를 다시 그리게 해야 서버가 새 세션(=비로그인)을 보고 판단한다.
 * refresh 없이 push만 하면 캐시된 서버 렌더 결과 때문에 여전히 로그인 상태로 보일 수 있다.
 */
export function LogoutButton() {
  const router = useRouter()

  async function signOut() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <Button variant="secondary" onClick={signOut}>
      로그아웃
    </Button>
  )
}
