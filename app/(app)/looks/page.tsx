import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { CARD_SURFACE } from '@/components/ui/styles'

type LookGarment = { id: string; name: string; image_url: string | null }

type LookRow = {
  id: string
  title: string
  description: string | null
  author: { nickname: string | null } | null
  outfit_items: { garments: LookGarment | null }[]
}

export default async function LooksPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // profiles를 참조하는 외래키가 outfits에 두 개(wardrobe_owner_id, author_id)라
  // PostgREST 임베딩에 어떤 컬럼을 쓸지 !author_id로 명시해야 한다.
  const { data: outfits } = await supabase
    .from('outfits')
    .select('id, title, description, author:profiles!author_id(nickname), outfit_items(garments(id, name, image_url))')
    .eq('wardrobe_owner_id', user.id)
    .order('created_at', { ascending: false })
    .overrideTypes<LookRow[], { merge: false }>()

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight text-ink">나를 위한 룩</h1>

      {!outfits || outfits.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-10 text-center text-sm text-ink-muted">
          아직 만들어진 룩이 없습니다. 옷장을 공유하면 친구가 룩을 만들어 줄 수 있어요.
        </p>
      ) : (
        <div className="space-y-4">
          {outfits.map((outfit) => (
            <article key={outfit.id} className={`${CARD_SURFACE} p-4`}>
              <p className="text-xs text-ink-muted">{outfit.author?.nickname ?? '알 수 없음'}님이 만듦</p>
              <h2 className="text-lg font-medium text-ink">{outfit.title}</h2>
              {outfit.description && <p className="text-sm text-ink-muted">{outfit.description}</p>}
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {outfit.outfit_items.map((item) => item.garments && (
                  <div key={item.garments.id} className="relative h-24 w-20 shrink-0 overflow-hidden rounded-btn bg-canvas">
                    {item.garments.image_url && (
                      <Image src={item.garments.image_url} alt={item.garments.name} fill className="object-cover" sizes="80px" />
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
