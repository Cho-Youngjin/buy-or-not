import { supabaseAdmin } from '@/lib/supabase/admin'
import { ok, type ParseResult, type SizeTable } from '@/lib/musinsa/types'

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

/**
 * 사용자가 붙여넣은 사이즈표를 기존 캐시 행에 병합한다.
 * fetched_at은 건드리지 않는다 — 가격 TTL과 무관한 갱신이라 upsert 대신 update를 쓴다.
 * 캐시 행 자체가 없으면(원본 파싱이 완전히 실패해 writeCache가 호출되지 않은 경우) 병합하지 않는다.
 */
export async function mergeSizeTableIntoCache(goodsNo: string, table: SizeTable): Promise<void> {
  const { data } = await supabaseAdmin
    .from('musinsa_cache')
    .select('payload')
    .eq('goods_no', goodsNo)
    .maybeSingle()

  if (!data) return

  const payload = data.payload as ParseResult
  const merged: ParseResult = {
    ...payload,
    fields: { ...payload.fields, sizeTable: ok(table) },
  }

  await supabaseAdmin
    .from('musinsa_cache')
    .update({ payload: merged })
    .eq('goods_no', goodsNo)
}
