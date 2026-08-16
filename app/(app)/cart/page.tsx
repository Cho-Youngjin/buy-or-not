import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { CartItemCard, type CartItem } from '@/components/CartItemCard'

type AnalysisRow = { verdict: 'buy' | 'caution' | 'skip'; created_at: string }

type CartGarmentRow = {
  id: string
  name: string
  brand: string | null
  image_url: string | null
  analyses: AnalysisRow[] | null
}

export default async function CartPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: garments } = await supabase
    .from('garments')
    .select('id, name, brand, image_url, analyses(verdict, created_at)')
    .eq('owner_id', user.id)
    .eq('status', 'considering')
    .order('created_at', { ascending: false })
    .overrideTypes<CartGarmentRow[], { merge: false }>()

  const items: CartItem[] = (garments ?? []).map((g) => {
    const analyses = g.analyses ?? []
    const latest = [...analyses].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    return { id: g.id, name: g.name, brand: g.brand, image_url: g.image_url, latestVerdict: latest?.verdict ?? null }
  })

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">장바구니</h1>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-gray-500">
          고민 중인 옷이 없습니다. &quot;살까 말까&quot;에서 링크를 넣어보세요.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => <CartItemCard key={item.id} item={item} />)}
        </div>
      )}
    </main>
  )
}
