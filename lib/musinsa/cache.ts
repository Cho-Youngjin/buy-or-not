import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ParseResult } from '@/lib/musinsa/types'

/** 가격은 변하므로 이 기간이 지나면 다시 파싱한다. 실측·이미지는 변하지 않는다. */
const PRICE_TTL_MS = 24 * 60 * 60 * 1000

export async function readCache(goodsNo: string): Promise<ParseResult | null> {
  const { data, error } = await supabaseAdmin
    .from('musinsa_cache')
    .select('payload, fetched_at')
    .eq('goods_no', goodsNo)
    .maybeSingle()

  if (error || !data) return null

  const age = Date.now() - new Date(data.fetched_at).getTime()
  if (age > PRICE_TTL_MS) return null

  return data.payload as ParseResult
}

export async function writeCache(goodsNo: string, result: ParseResult): Promise<void> {
  await supabaseAdmin
    .from('musinsa_cache')
    .upsert({ goods_no: goodsNo, payload: result, fetched_at: new Date().toISOString() })
}
