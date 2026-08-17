import type { SupabaseClient } from '@supabase/supabase-js'
import { copyImageToStorage } from '@/lib/storage'
import { mergeSizeTableIntoCache } from '@/lib/musinsa/cache'
import { AUTO_PARSED_FIELDS, type SizeTable } from '@/lib/musinsa/types'
import type { Category, GarmentStatus, ParseMode } from '@/lib/types'
import { tagGarmentImage } from '@/lib/ai/tagger'

export type RegisterGarmentInput = {
  goodsNo: string
  sourceUrl: string | null
  name: string
  brand: string | null
  price: number | null
  imageUrl: string | null
  category: Category
  colorOption: string
  sizeOption: string
  measurements: Record<string, number>
  fullSizeTable: SizeTable | null
  manualFields: string[]
  /** 친구 추천으로 등록될 때만 채워진다(계획 3 Task 3). 옷장 등록·구매 판단에서는 비운다. */
  recommendedBy?: string
  note?: string | null
}

export type RegisterGarmentResult = {
  id: string
  name: string
  /** Storage 복사까지 끝난 최종 이미지 URL. 추천 직후 룩 재료 목록에 바로 쓸 수 있게 넘긴다(계획 9). */
  imageUrl: string | null
  duplicate: boolean
  /** 옷 자체는 저장됐지만 실측 저장이 실패한 경우. 호출부가 응답 상태 코드를 결정할 때 쓴다. */
  measurementsFailed: boolean
}

/**
 * options·sizeTable은 제외한다 — 항상 실패가 정상인 필드라 포함시키면
 * 모든 옷이 영원히 'manual'로 찍힌다 (스펙 §7, 계획 1 Task 5의 AUTO_PARSED_FIELDS 참고).
 */
function computeParseMode(manualFields: readonly string[]): ParseMode {
  const autoFieldSet: readonly string[] = AUTO_PARSED_FIELDS
  const failedAutoFields = manualFields.filter((field) => autoFieldSet.includes(field))
  if (failedAutoFields.length === 0) return 'auto'
  if (failedAutoFields.length >= AUTO_PARSED_FIELDS.length) return 'manual'
  return 'partial'
}

/**
 * garments insert + 이미지 Storage 복사 + garment_measurements insert + 사이즈표 캐시 병합을
 * 한 번에 수행한다. 옷장 등록(status='owned')과 구매 판단 후보 등록(status='considering')이
 * 이 파이프라인을 그대로 공유한다(스펙 §5) — 파싱·이미지·실측 저장 로직이 두 곳에서 따로
 * 갈라지면 무신사가 개편될 때 한쪽만 고치고 잊어버리는 사고가 난다.
 *
 * RLS를 그대로 태우기 위해 항상 세션 기반 클라이언트(supabase)를 받는다 — service_role을
 * 쓰지 않는다. status='considering'이고 recommended_by가 없는 이번 계획 범위에서는
 * ownerId가 항상 로그인한 본인이므로 garments_insert 정책(owner_id = auth.uid())을 그대로 만족한다.
 */
export async function registerGarment(
  supabase: SupabaseClient,
  ownerId: string,
  status: GarmentStatus,
  input: RegisterGarmentInput,
): Promise<RegisterGarmentResult> {
  const storedImageUrl = input.imageUrl
    ? await copyImageToStorage(input.imageUrl, input.goodsNo, input.colorOption)
    : null

  const { count: duplicateCount } = await supabase
    .from('garments')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('goods_no', input.goodsNo)
    .eq('color_option', input.colorOption)
    .eq('size_option', input.sizeOption)

  const { data: garment, error: insertError } = await supabase
    .from('garments')
    .insert({
      owner_id: ownerId,
      status,
      source_url: input.sourceUrl,
      goods_no: input.goodsNo,
      brand: input.brand,
      name: input.name,
      price: input.price,
      image_url: storedImageUrl ?? input.imageUrl,
      category: input.category,
      color_option: input.colorOption,
      size_option: input.sizeOption,
      parse_mode: computeParseMode(input.manualFields),
      recommended_by: input.recommendedBy ?? null,
      note: input.note ?? null,
    })
    .select('id')
    .single()

  if (insertError || !garment) {
    throw new Error('옷장에 저장하지 못했습니다.')
  }

  const rows = Object.entries(input.measurements).map(([key, value]) => ({
    garment_id: garment.id,
    key,
    value,
  }))

  let measurementsFailed = false
  if (rows.length > 0) {
    const { error: measurementError } = await supabase.from('garment_measurements').insert(rows)
    if (measurementError) measurementsFailed = true
  }

  if (input.fullSizeTable) {
    // 다음 사용자를 위한 최적화일 뿐이므로 실패해도 등록 자체는 막지 않는다.
    try {
      await mergeSizeTableIntoCache(input.goodsNo, input.fullSizeTable)
    } catch {
      // 무시 — 캐시는 다음 파싱 시도에서 다시 채워진다.
    }
  }

  const finalImageUrl = storedImageUrl ?? input.imageUrl
  if (finalImageUrl) {
    // 태깅은 옷장 등록이든 장바구니 등록이든 딱 한 번만 한다(스펙 §10-1) — 실패해도
    // 등록을 막지 않는다. ai_tags는 null로 남고, 이후 판단 시점에 "태그 없음"으로 처리된다.
    const tags = await tagGarmentImage(finalImageUrl)
    if (tags) {
      await supabase.from('garments').update({ ai_tags: tags }).eq('id', garment.id)
    }
  }

  return {
    id: garment.id,
    name: input.name,
    imageUrl: finalImageUrl,
    duplicate: Boolean(duplicateCount && duplicateCount > 0),
    measurementsFailed,
  }
}
