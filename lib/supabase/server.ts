import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** RLS가 적용되는 클라이언트다. 서버 코드에서는 기본적으로 이것을 쓴다. */
export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component에서는 쿠키를 쓸 수 없다. 미들웨어가 갱신을 맡으므로 무시한다.
          }
        },
      },
    },
  )
}
