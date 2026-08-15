import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import { registerGarment } from '@/lib/garments/register'

export const maxDuration = 30

const Body = z.object({
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
})

// RLS가 붙은 세션 클라이언트(supabase)로 insert하므로 owner_id 위장이 불가능하다 —
// garments_insert 정책이 owner_id = auth.uid()를 강제한다(supabase/migrations/0002_rls.sql).
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

  let result
  try {
    result = await registerGarment(supabase, user.id, 'owned', parsed.data)
  } catch {
    return NextResponse.json({ error: '옷장에 저장하지 못했습니다.' }, { status: 500 })
  }

  if (result.measurementsFailed) {
    // 실측만 실패한 경우 옷 자체는 남기고 알린다. 상세 화면에서 나중에 채울 수 있다.
    return NextResponse.json(
      { id: result.id, warning: '실측 정보를 저장하지 못했습니다.' },
      { status: 207 },
    )
  }

  return NextResponse.json(
    {
      id: result.id,
      ...(result.duplicate ? { warning: '이미 옷장에 같은 상품·색상·사이즈가 있습니다.' } : {}),
    },
    { status: 201 },
  )
}
