import type { Metadata } from 'next'
import Link from 'next/link'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createServerSupabase } from '@/lib/supabase/server'
import { RecommendAndBuild } from '@/components/share/RecommendAndBuild'
import { PublicHeader } from '@/components/nav/PublicHeader'
import { CARD_SURFACE, pillClass } from '@/components/ui/styles'
import { CATEGORY_LABELS, type Category } from '@/lib/types'

type Props = {
  params: Promise<{ share_slug: string }>
  searchParams: Promise<{ category?: string }>
}

// generateMetadata와 페이지 컴포넌트가 둘 다 이 프로필을 필요로 한다 — Next.js가 같은 요청
// 안에서 두 함수를 모두 실행하므로, cache()로 감싸지 않으면 같은 조회를 두 번 보낸다.
// (인자가 같은 호출끼리만 요청 하나 동안 결과를 재사용한다 — 클라이언트를 인자로 받으면
// 매번 새 인스턴스라 캐시가 안 먹으므로, 여기서 직접 createServerSupabase()를 부른다.)
const getProfileBySlug = cache(async (share_slug: string) => {
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from('profiles')
    .select('id, nickname, is_wardrobe_public')
    .eq('share_slug', share_slug)
    .single()
  return data
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { share_slug } = await params
  const profile = await getProfileBySlug(share_slug)
  const nickname = profile?.nickname ?? '사용자'

  return {
    title: `${nickname}님의 옷장 - 살까 말까`,
    description: `${nickname}님이 공유한 옷장을 구경해보세요.`,
  }
}

type PublicGarment = {
  id: string
  name: string
  brand: string | null
  image_url: string | null
  category: Category
  color_option: string | null
  size_option: string | null
}

export default async function SharedWardrobePage({ params, searchParams }: Props) {
  const { share_slug } = await params
  const supabase = await createServerSupabase()

  // 로그인 여부 확인과 프로필 조회는 서로 무관하다(프로필은 share_slug로만 찾는다) —
  // 동시에 보내 왕복을 하나로 줄인다.
  const [{ data: { user } }, profile] = await Promise.all([
    supabase.auth.getUser(),
    getProfileBySlug(share_slug),
  ])

  // RLS(profiles_select: 본인 또는 is_wardrobe_public)가 비공개 프로필은 이미 null로
  // 돌려주지만, is_wardrobe_public을 한 번 더 확인해 "본인이 비로그인 상태로 자기 비공개
  // 프로필을 본다"는 경우(RLS가 막아 애초에 null이라 사실 발생하지 않는다)까지 명확히 한다.
  if (!profile || !profile.is_wardrobe_public) notFound()

  const { category } = await searchParams
  let query = supabase
    .from('garments')
    .select('id, name, brand, image_url, category, color_option, size_option')
    .eq('owner_id', profile.id)
    .eq('status', 'owned')
    .order('created_at', { ascending: false })

  if (category && category in CATEGORY_LABELS) {
    query = query.eq('category', category as Category)
  }

  const { data: garments } = await query.overrideTypes<PublicGarment[], { merge: false }>()

  return (
    <>
      <PublicHeader isLoggedIn={Boolean(user)} />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <h1 className="text-2xl font-medium tracking-tight text-ink">{profile.nickname ?? '사용자'}님의 옷장</h1>

        <nav className="flex flex-wrap gap-2">
          <FilterLink href={`/u/${share_slug}`} label="전체" active={!category} />
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <FilterLink key={value} href={`/u/${share_slug}?category=${value}`} label={label} active={category === value} />
          ))}
        </nav>

        {!garments || garments.length === 0 ? (
          <p className="rounded-card border border-dashed border-border p-10 text-center text-sm text-ink-muted">
            아직 등록된 옷이 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {garments.map((garment) => <PublicGarmentCard key={garment.id} garment={garment} />)}
          </div>
        )}

        {user && user.id !== profile.id && (
          <RecommendAndBuild wardrobeOwnerId={profile.id} garments={garments ?? []} />
        )}
      </main>
    </>
  )
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={pillClass(active ? 'active' : 'neutral')}>
      {label}
    </Link>
  )
}

// 옷장 주인 전용 컨트롤(선호도 편집·삭제)이 있는 /wardrobe/[id]로 링크하지 않는다 —
// 방문자는 자기 것이 아닌 옷을 고칠 수 없어야 하고, 그 페이지는 비로그인 접근 시 리다이렉트된다.
function PublicGarmentCard({ garment }: { garment: PublicGarment }) {
  return (
    <article className={`${CARD_SURFACE} overflow-hidden`}>
      <div className="relative aspect-[3/4] bg-canvas">
        {garment.image_url ? (
          <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="200px" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">이미지 없음</div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="text-xs text-ink-muted">{garment.brand ?? CATEGORY_LABELS[garment.category]}</p>
        <h3 className="line-clamp-2 text-sm font-medium text-ink">{garment.name}</h3>
        <p className="text-xs text-ink-muted">
          {[garment.color_option, garment.size_option].filter(Boolean).join(' · ')}
        </p>
      </div>
    </article>
  )
}
