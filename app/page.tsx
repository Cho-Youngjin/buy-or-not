import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { LoginButton } from '@/components/LoginButton'

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/wardrobe')

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-bold">살까 말까</h1>
      <p className="text-gray-600">
        가진 옷을 옷장에 모아두면, 새로 사려는 옷이 내 사이즈와 스타일에 맞는지 알려드립니다.
      </p>
      <LoginButton />
    </main>
  )
}
