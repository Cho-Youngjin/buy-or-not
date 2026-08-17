import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { LoginButton } from '@/components/account/LoginButton'

// MIN_OWNED_GARMENTS_FOR_FIT(lib/fit/rules.ts)와 정확히 일치하는 값이다 — 과장 없는 카피를 위해
// 실제 규칙에서 가져왔다. 규칙이 바뀌면 이 문구도 같이 확인해야 한다.
const GUIDE_STEPS = [
  { title: '무신사 링크로 옷장에 옷을 등록하세요', description: '실측·사이즈가 자동으로 채워집니다' },
  { title: '별점으로 선호도를 남기세요', description: '같은 카테고리 옷 3벌 이상이면 더 정확해져요' },
  { title: '사려는 옷 링크를 넣어 판단받으세요', description: '사이즈·스타일이 맞는지 바로 알려드립니다' },
] as const

const EXTRA_FEATURES = [
  '옷장을 친구에게 공유하고 추천받기',
  '가진 옷을 조합해 나만의 룩 만들기',
  '담아둔 옷 가격이 내리면 확인하기',
] as const

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/wardrobe')

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-6 py-16">
      <div className="space-y-6">
        <p className="text-sm text-ink-muted">무신사 링크 하나로 시작하는 옷장</p>
        <h1 className="text-4xl font-medium tracking-tight text-ink sm:text-5xl">살까 말까</h1>
        <p className="max-w-[46ch] leading-relaxed text-ink-muted">
          가진 옷을 옷장에 모아두면, 새로 사려는 옷이 내 사이즈와 스타일에 맞는지 알려드립니다.
        </p>
        <div>
          <LoginButton />
        </div>
      </div>

      <ol className="space-y-4">
        {GUIDE_STEPS.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-semibold text-ink">
              {index + 1}
            </span>
            <div>
              <p className="font-medium text-ink">{step.title}</p>
              <p className="text-sm text-ink-muted">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="space-y-2 border-t border-border pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">이런 것도 할 수 있어요</p>
        <ul className="space-y-1.5 text-sm text-ink-muted">
          {EXTRA_FEATURES.map((feature) => (
            <li key={feature}>· {feature}</li>
          ))}
        </ul>
      </div>
    </main>
  )
}
