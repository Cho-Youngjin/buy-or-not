import { createClient } from '@supabase/supabase-js'

/**
 * RLS를 우회하는 클라이언트.
 * musinsa_cache 읽기/쓰기와 Storage 업로드에만 사용한다.
 * 사용자 데이터(garments 등)에는 절대 쓰지 않는다 — RLS가 무력화된다.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
