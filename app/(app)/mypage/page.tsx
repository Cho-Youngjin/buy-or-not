import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { ShareToggle } from '@/components/share/ShareToggle'
import { LogoutButton } from '@/components/account/LogoutButton'
import { FitStrictnessSlider } from '@/components/account/FitStrictnessSlider'
import { FitFieldOverrides } from '@/components/account/FitFieldOverrides'
import { ThemeToggle } from '@/components/account/ThemeToggle'
import { CARD_SURFACE } from '@/components/ui/styles'

/**
 * 마이페이지. 프로필·옷장 공유·설정 진입점·로그아웃을 한곳에 모은다.
 * 닉네임과 아바타는 Auth 메타데이터가 아니라 profiles에서 읽는다 —
 * 가입 시 handle_new_user() 트리거(마이그레이션 0003)가 이미 채워 두기 때문이다.
 */
export default async function MyPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // 둘 다 user.id만 있으면 되고 서로의 결과와 무관하다 — 동시에 보낸다.
  const [{ data: profile }, { data: fitOverrideRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('nickname, avatar_url, share_slug, is_wardrobe_public, fit_strictness, theme')
      .eq('id', user.id)
      .single(),
    supabase
      .from('fit_field_overrides')
      .select('category, field_key, tolerance')
      .eq('owner_id', user.id),
  ])
  const fitOverrides = (fitOverrideRows ?? []).map((row) => ({
    category: row.category,
    fieldKey: row.field_key,
    tolerance: Number(row.tolerance),
  }))

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight text-ink">마이페이지</h1>

      <section className={`${CARD_SURFACE} flex items-center gap-4 p-5`}>
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-canvas">
          {profile?.avatar_url && (
            <Image src={profile.avatar_url} alt="" fill className="object-cover" sizes="56px" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{profile?.nickname ?? '사용자'}</p>
          <p className="truncate text-sm text-ink-muted">{user.email}</p>
        </div>
      </section>

      <section className={`${CARD_SURFACE} space-y-3 p-5`}>
        <h2 className="text-sm font-medium text-ink">옷장 공유</h2>
        <p className="text-sm text-ink-muted">
          공유를 켜면 링크를 받은 친구가 옷장을 구경하고 아이템이나 룩을 추천할 수 있습니다.
        </p>
        {profile && (
          <ShareToggle shareSlug={profile.share_slug} initialIsPublic={profile.is_wardrobe_public} />
        )}
      </section>

      <section className={`${CARD_SURFACE} space-y-3 p-5`}>
        <h2 className="text-sm font-medium text-ink">핏 판단 설정</h2>
        <p className="text-sm text-ink-muted">
          실측이 내 선호 범위에서 얼마나 벗어나도 괜찮은지 정합니다.
          엄격할수록 조금만 달라도 &quot;주의&quot;나 &quot;비추천&quot;이 나옵니다.
        </p>
        {/* numeric 컬럼은 PostgREST가 문자열로 돌려주므로 Number()로 감싼다(계획 서두 참고). */}
        <FitStrictnessSlider initialValue={Number(profile?.fit_strictness ?? 1)} />

        <div className="border-t border-border pt-3">
          <h3 className="mb-2 text-xs font-medium text-ink-muted">항목별 직접 입력 (선택)</h3>
          <FitFieldOverrides initialOverrides={fitOverrides} />
        </div>
      </section>

      <section className={`${CARD_SURFACE} space-y-3 p-5`}>
        <h2 className="text-sm font-medium text-ink">화면 테마</h2>
        {/* theme 컬럼은 DB CHECK로 세 값만 허용되지만 PostgREST 타입은 그냥 string이라 캐스팅한다
            (profile?.fit_strictness를 Number()로 감싸는 위 코드와 같은 이유). */}
        <ThemeToggle initialValue={(profile?.theme as 'system' | 'light' | 'dark') ?? 'system'} />
      </section>

      <LogoutButton />
    </main>
  )
}
