import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { id } = await params
  // outfits_delete RLS(author_id = 나 또는 wardrobe_owner_id = 나)가 소유자를 검증한다.
  // outfit_items는 outfits(id) on delete cascade라 별도 정리가 필요 없다.
  const { error, count } = await supabase
    .from('outfits')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: '삭제하지 못했습니다.' }, { status: 500 })
  if (!count) return NextResponse.json({ error: '룩을 찾을 수 없습니다.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
