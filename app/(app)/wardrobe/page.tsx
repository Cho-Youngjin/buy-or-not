import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { LinkInputBar } from '@/components/LinkInputBar'
import { GarmentCard, type GarmentCardData } from '@/components/GarmentCard'
import { CATEGORY_LABELS, type Category } from '@/lib/types'

type Props = { searchParams: Promise<{ category?: string }> }

// RLS의 garments_select 정책이 owner_id = auth.uid() 행만 돌려주므로,
// 여기서 .eq('owner_id', user.id)를 빼도 안전하지만 쿼리 의도를 명확히 하려고 남겨둔다.
export default async function WardrobePage({ searchParams }: Props) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { category } = await searchParams

  let query = supabase
    .from('garments')
    .select('id, name, brand, price, image_url, category, color_option, size_option')
    .eq('owner_id', user.id)
    .eq('status', 'owned')
    .order('created_at', { ascending: false })

  if (category && category in CATEGORY_LABELS) {
    query = query.eq('category', category as Category)
  }

  const { data: garments } = await query

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">내 옷장</h1>

      <LinkInputBar />

      <nav className="flex flex-wrap gap-2">
        <FilterLink href="/wardrobe" label="전체" active={!category} />
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <FilterLink key={value} href={`/wardrobe?category=${value}`} label={label} active={category === value} />
        ))}
      </nav>

      {!garments || garments.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-gray-500">
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
    <a href={href}
      className={`rounded-full border px-4 py-1 text-sm ${active ? 'bg-black text-white' : 'bg-white'}`}>
      {label}
    </a>
  )
}
