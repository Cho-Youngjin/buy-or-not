import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { ShareToggle } from '@/components/ShareToggle'
import { LogoutButton } from '@/components/LogoutButton'
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, avatar_url, share_slug, is_wardrobe_public')
    .eq('id', user.id)
    .single()

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

      {/* 2단계(핏 판단 설정)에서 실제 화면으로 교체한다. 지금은 존재만 알린다. */}
      <section className={`${CARD_SURFACE} flex items-center justify-between p-5`}>
        <div>
          <h2 className="text-sm font-medium text-ink">핏 판단 설정</h2>
          <p className="text-sm text-ink-muted">허용 편차 같은 수치를 직접 조정합니다.</p>
        </div>
        <span className="shrink-0 text-sm text-ink-muted">준비 중</span>
      </section>

      <LogoutButton />
    </main>
  )
}
