import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const maxDuration = 30

const MAX_BYTES = 4 * 1024 * 1024 // 4MB — Vercel 서버리스 함수 요청 본문 기본 한도(4.5MB) 아래로 여유를 둔다.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/**
 * 수동 등록("직접 등록하기")에서 올린 사진을 Storage에 저장한다.
 * garments 테이블에는 쓰지 않으므로 세션 클라이언트(RLS)가 아니라 supabaseAdmin으로
 * Storage에 쓴다 — 로그인 여부만 세션 클라이언트로 확인한다(admin.ts 주석 참고).
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'JPG·PNG·WEBP 파일만 올릴 수 있습니다.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: '4MB 이하 파일만 올릴 수 있습니다.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const objectPath = `manual/${user.id}/${randomUUID()}.${EXTENSIONS[file.type]}`
  const { error } = await supabaseAdmin.storage
    .from('garments')
    .upload(objectPath, buffer, { contentType: file.type, upsert: false })

  if (error) {
    return NextResponse.json({ error: '사진을 올리지 못했습니다.' }, { status: 500 })
  }

  const url = supabaseAdmin.storage.from('garments').getPublicUrl(objectPath).data.publicUrl
  return NextResponse.json({ url })
}
