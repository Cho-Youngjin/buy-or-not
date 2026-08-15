import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'

const PatchBody = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  fitTag: z.enum(['tight', 'just', 'loose']).nullable().optional(),
  wearFrequency: z.enum(['often', 'sometimes', 'rarely']).nullable().optional(),
  // 장바구니 → 옷장 승격("샀어요") 전용. 그 외 상태 전이(예: owned → considering)는 막는다.
  status: z.literal('owned').optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { id } = await params
  const parsed = PatchBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }
  const input = parsed.data

  if (input.status === 'owned') {
    // "샀어요"는 장바구니(considering)에 있던 옷에만 의미가 있다 — 이미 owned인 옷을 다시
    // owned로 "승격"하는 건 실수이거나 오용이므로 막는다. RLS가 소유자 확인을 하므로 여기서는
    // 상태 전이 자체의 논리적 유효성만 본다.
    const { data: current } = await supabase.from('garments').select('status').eq('id', id).single()
    if (current?.status !== 'considering') {
      return NextResponse.json({ error: '장바구니에 있는 옷만 옷장으로 옮길 수 있습니다.' }, { status: 400 })
    }
  }

  const updates: Record<string, unknown> = {}
  if ('rating' in input) updates.rating = input.rating
  if ('fitTag' in input) updates.fit_tag = input.fitTag
  if ('wearFrequency' in input) updates.wear_frequency = input.wearFrequency
  if (input.status) updates.status = input.status

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 값이 없습니다.' }, { status: 400 })
  }

  const { error, count } = await supabase
    .from('garments')
    .update(updates, { count: 'exact' })
    .eq('id', id)

  // RLS가 남의 옷이면 0행을 갱신하고 error 없이 조용히 끝낸다 — count로 구분해 404를 준다.
  if (error) return NextResponse.json({ error: '수정하지 못했습니다.' }, { status: 500 })
  if (!count) return NextResponse.json({ error: '옷을 찾을 수 없습니다.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { id } = await params
  const { error, count } = await supabase
    .from('garments')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: '삭제하지 못했습니다.' }, { status: 500 })
  if (!count) return NextResponse.json({ error: '옷을 찾을 수 없습니다.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
