import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'

// 두 필드 모두 선택이다 — 공유 토글(ShareToggle)과 핏 강도 슬라이더(FitStrictnessSlider)가
// 각자 자기 필드만 보내기 때문이다. 범위(0.5~2.0)는 DB CHECK 제약과 같은 값으로 맞춘다.
const Body = z.object({
  isWardrobePublic: z.boolean().optional(),
  fitStrictness: z.number().min(0.5).max(2).optional(),
})

export async function PATCH(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }

  const updates: Record<string, boolean | number> = {}
  if (parsed.data.isWardrobePublic !== undefined) {
    updates.is_wardrobe_public = parsed.data.isWardrobePublic
  }
  if (parsed.data.fitStrictness !== undefined) {
    updates.fit_strictness = parsed.data.fitStrictness
  }
  // 빈 요청은 성공으로 처리하지 않는다 — 클라이언트 버그를 조용히 삼키지 않기 위해서다.
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 값이 없습니다.' }, { status: 400 })
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)

  if (error) return NextResponse.json({ error: '설정을 저장하지 못했습니다.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
