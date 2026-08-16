import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'

const Body = z.object({
  wardrobeOwnerId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  garmentIds: z.array(z.string().uuid()).min(1),
})

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }
  const input = parsed.data

  const { data: outfit, error: outfitError } = await supabase
    .from('outfits')
    .insert({
      wardrobe_owner_id: input.wardrobeOwnerId,
      author_id: user.id,
      title: input.title,
      description: input.description,
    })
    .select('id')
    .single()

  // RLS(outfits_insert)가 "대상 옷장이 공개 중"이 아니면 이 insert 자체를 막는다.
  if (outfitError || !outfit) {
    return NextResponse.json({ error: '룩을 만들지 못했습니다.' }, { status: 500 })
  }

  const rows = input.garmentIds.map((garmentId) => ({ outfit_id: outfit.id, garment_id: garmentId }))
  const { error: itemsError } = await supabase.from('outfit_items').insert(rows)

  if (itemsError) {
    // outfit_items RLS(그 옷장 소유 검증)에 걸리면 빈 룩만 남는다 — 정리하고 에러로 알린다.
    await supabase.from('outfits').delete().eq('id', outfit.id)
    return NextResponse.json({ error: '선택한 옷 중 이 옷장 소유가 아닌 항목이 있습니다.' }, { status: 400 })
  }

  return NextResponse.json({ id: outfit.id }, { status: 201 })
}
