import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'

const Body = z.object({
  category: z.enum(['top', 'bottom', 'outer', 'shoes', 'acc']),
  fieldKey: z.string().min(1),
  /** 숫자면 그 값으로 저장(upsert), null이면 기본값으로 되돌린다(그 행을 삭제). */
  tolerance: z.number().min(0.5).max(10).nullable(),
})

/**
 * 항목별 허용오차 하나를 저장하거나(tolerance가 숫자) 지운다(tolerance가 null).
 * fieldKey가 실제 FIT_RULES에 있는 키인지는 검증하지 않는다 — RLS로 본인 행만 건드릴 수
 * 있고, scoreDeviation·buildPreferenceProfile이 FIT_RULES에 있는 키만 조회하므로
 * 존재하지 않는 키가 들어와도 조용히 무시될 뿐 해가 없다(스펙 §5).
 */
export async function PUT(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }
  const { category, fieldKey, tolerance } = parsed.data

  if (tolerance === null) {
    const { error } = await supabase
      .from('fit_field_overrides')
      .delete()
      .eq('owner_id', user.id)
      .eq('category', category)
      .eq('field_key', fieldKey)
    if (error) return NextResponse.json({ error: '초기화하지 못했습니다.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabase
    .from('fit_field_overrides')
    .upsert(
      { owner_id: user.id, category, field_key: fieldKey, tolerance },
      { onConflict: 'owner_id,category,field_key' },
    )
  if (error) return NextResponse.json({ error: '저장하지 못했습니다.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
