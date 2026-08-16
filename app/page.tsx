import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { LoginButton } from '@/components/LoginButton'

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/wardrobe')

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col justify-center gap-6 px-6">
      <p className="text-sm text-ink-muted">무신사 링크 하나로 시작하는 옷장</p>
      <h1 className="text-4xl font-medium tracking-tight text-ink sm:text-5xl">살까 말까</h1>
      <p className="max-w-[46ch] leading-relaxed text-ink-muted">
        가진 옷을 옷장에 모아두면, 새로 사려는 옷이 내 사이즈와 스타일에 맞는지 알려드립니다.
      </p>
      <div>
        <LoginButton />
      </div>
    </main>
  )
}
