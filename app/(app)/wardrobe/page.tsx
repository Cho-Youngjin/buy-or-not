import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { LinkInputBar } from '@/components/garment/LinkInputBar'
import { GarmentCard, type GarmentCardData } from '@/components/garment/GarmentCard'
import { pillClass } from '@/components/ui/styles'
import { CATEGORY_LABELS, type Category } from '@/lib/types'

type Props = { searchParams: Promise<{ category?: string }> }

export default async function WardrobePage({ searchParams }: Props) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { category } = await searchParams

  // .eq('owner_id', user.id)는 RLS와 중복이 아니라 여기서 실제로 필요하다 — garments_select
  // 정책은 "내 옷" 또는 "공개 옷장 주인의 옷"을 둘 다 허용해서(0002_rls.sql), 이 필터를 빼면
  // 공개 옷장을 가진 다른 사용자의 옷까지 내 옷장 목록에 섞여 들어온다. 그래서 user를 먼저
  // 확인한 뒤에야 이 쿼리를 보낼 수 있고, getUser()와 병렬로 보낼 수 없다.
  let query = supabase
    .from('garments')
    .select('id, name, brand, price, image_url, category, color_option, size_option, rating')
    .eq('owner_id', user.id)
    .eq('status', 'owned')
    .order('created_at', { ascending: false })

  if (category && category in CATEGORY_LABELS) {
    query = query.eq('category', category as Category)
  }

  const { data: garments } = await query

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight text-ink">내 옷장</h1>

      <LinkInputBar />

      <nav className="flex flex-wrap gap-2">
        <FilterLink href="/wardrobe" label="전체" active={!category} />
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <FilterLink key={value} href={`/wardrobe?category=${value}`} label={label} active={category === value} />
        ))}
      </nav>

      {!garments || garments.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-10 text-center text-sm text-ink-muted">
          아직 등록한 옷이 없습니다. 위에 무신사 상품 링크를 붙여넣어 첫 옷을 추가해 보세요.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {garments.map((garment) => (
            <GarmentCard key={garment.id} garment={garment as GarmentCardData} />
          ))}
        </div>
      )}
    </main>
  )
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={pillClass(active ? 'active' : 'neutral')}>
      {label}
    </Link>
  )
}
