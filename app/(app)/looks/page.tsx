import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { OutfitBuilder, type BuilderGarment } from '@/components/share/OutfitBuilder'
import { LooksList, type Look } from '@/components/share/LooksList'

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

  // 둘 다 user.id만 있으면 되고 서로의 결과와 무관하다 — 동시에 보낸다.
  // profiles를 참조하는 외래키가 outfits에 두 개(wardrobe_owner_id, author_id)라
  // PostgREST 임베딩에 어떤 컬럼을 쓸지 !author_id로 명시해야 한다.
  const [{ data: garments }, { data: outfits }] = await Promise.all([
    supabase
      .from('garments')
      .select('id, name, image_url')
      .eq('owner_id', user.id)
      .eq('status', 'owned')
      .order('created_at', { ascending: false })
      .overrideTypes<BuilderGarment[], { merge: false }>(),
    supabase
      .from('outfits')
      .select('id, title, description, author:profiles!author_id(nickname), outfit_items(garments(id, name, image_url))')
      .eq('wardrobe_owner_id', user.id)
      .order('created_at', { ascending: false })
      .overrideTypes<LookRow[], { merge: false }>(),
  ])

  const looks: Look[] = (outfits ?? []).map((outfit) => ({
    id: outfit.id,
    title: outfit.title,
    description: outfit.description,
    authorNickname: outfit.author?.nickname ?? null,
    garments: outfit.outfit_items
      .map((item) => item.garments)
      .filter((g): g is LookGarment => g !== null),
  }))

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight text-ink">나를 위한 룩</h1>

      <OutfitBuilder wardrobeOwnerId={user.id} garments={garments ?? []} defaultCollapsed />

      {looks.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-10 text-center text-sm text-ink-muted">
          아직 만들어진 룩이 없습니다. 위에서 옷을 골라 첫 룩을 만들어보세요.
        </p>
      ) : (
        <LooksList looks={looks} />
      )}
    </main>
  )
}
