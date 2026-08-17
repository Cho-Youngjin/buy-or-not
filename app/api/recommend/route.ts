import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import { registerGarment } from '@/lib/garments/register'

export const maxDuration = 30

const Body = z.object({
  wardrobeOwnerId: z.string().uuid(),
  goodsNo: z.string(),
  sourceUrl: z.string(),
  name: z.string().min(1),
  brand: z.string().nullable(),
  price: z.number().int().nonnegative().nullable(),
  imageUrl: z.string().nullable(),
  category: z.enum(['top', 'bottom', 'outer', 'shoes', 'acc']),
  colorOption: z.string(),
  sizeOption: z.string(),
  measurements: z.record(z.string(), z.number()),
  fullSizeTable: z.record(z.string(), z.record(z.string(), z.number())).nullable(),
  manualFields: z.array(z.string()),
  note: z.string().nullable(),
})

// 대상 옷장이 실제로 공개 상태인지는 여기서 검사하지 않는다 — garments_insert RLS 정책이
// "공개 옷장 + status='considering' + recommended_by=auth.uid()"만 허용하므로, 비공개
// 옷장에 추천을 시도하면 insert 자체가 RLS에서 조용히 막힌다(계획 1에서 이미 검증된 정책).
export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }
  const { wardrobeOwnerId, note, ...input } = parsed.data

  try {
    const result = await registerGarment(supabase, wardrobeOwnerId, 'considering', {
      ...input,
      recommendedBy: user.id,
      note,
    })
    // name·imageUrl은 추천 직후 프론트가 룩 재료 목록에 바로 추가하는 데 쓴다(RecommendLinkBar.onRecommended).
    return NextResponse.json({ id: result.id, name: result.name, imageUrl: result.imageUrl }, { status: 201 })
  } catch {
    return NextResponse.json({ error: '추천하지 못했습니다. 옷장이 비공개일 수 있습니다.' }, { status: 500 })
  }
}
