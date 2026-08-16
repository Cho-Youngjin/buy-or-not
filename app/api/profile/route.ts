import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'

const Body = z.object({ isWardrobePublic: z.boolean() })

export async function PATCH(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_wardrobe_public: parsed.data.isWardrobePublic })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: '설정을 저장하지 못했습니다.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
