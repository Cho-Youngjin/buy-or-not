import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'
import { fetchProductHtml } from '@/lib/musinsa/fetcher'
import { parseProductHtml } from '@/lib/musinsa/parser'

export const maxDuration = 30

const RECHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_ITEMS_PER_VISIT = 5

type Candidate = { id: string; goods_no: string; source_url: string }

/**
 * 후보 하나의 가격만 다시 읽어 저장한다. 실패해도(네트워크 오류·가격 파싱 실패)
 * price_checked_at은 갱신한다 — 계속 실패하는 링크를 방문할 때마다 재시도하지 않기 위해서다.
 */
async function refreshOne(supabase: SupabaseClient, candidate: Candidate): Promise<boolean> {
  const checkedAt = new Date().toISOString()
  try {
    const html = await fetchProductHtml(candidate.source_url)
    const result = parseProductHtml(html, candidate.goods_no)
    if (result.fields.price.ok) {
      await supabase
        .from('garments')
        .update({ last_known_price: result.fields.price.value, price_checked_at: checkedAt })
        .eq('id', candidate.id)
      return true
    }
  } catch {
    // 무시 — 아래에서 price_checked_at만 갱신한다.
  }
  await supabase.from('garments').update({ price_checked_at: checkedAt }).eq('id', candidate.id)
  return false
}

/**
 * 장바구니 방문 시 오래된(7일 이상 안 본) 가격을 백그라운드로 다시 확인한다.
 * Vercel Cron 대신 이 방식을 쓰는 이유: 이 프로젝트는 아직 실제 배포된 적이 없어
 * Cron은 테스트할 방법이 없다(스펙 §2) — 방문 시 지연 확인은 지금 바로 쓸 수 있다.
 */
export async function POST() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const staleThreshold = new Date(Date.now() - RECHECK_INTERVAL_MS).toISOString()

  // source_url이 있는(무신사 링크로 등록된) 장바구니 상품 중, 한 번도 안 봤거나 7일 넘은 것만.
  // price_checked_at이 오래된 순으로 최대 5개만 가져와 한 번에 너무 많이 긁지 않는다.
  const { data: candidates } = await supabase
    .from('garments')
    .select('id, goods_no, source_url')
    .eq('owner_id', user.id)
    .eq('status', 'considering')
    .not('source_url', 'is', null)
    .or(`price_checked_at.is.null,price_checked_at.lt.${staleThreshold}`)
    .order('price_checked_at', { ascending: true, nullsFirst: true })
    .limit(MAX_ITEMS_PER_VISIT)
    .overrideTypes<Candidate[], { merge: false }>()

  const results = await Promise.all((candidates ?? []).map((c) => refreshOne(supabase, c)))
  return NextResponse.json({ checked: candidates?.length ?? 0, updated: results.filter(Boolean).length })
}
