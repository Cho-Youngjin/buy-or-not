import type { Category } from '@/lib/types'

export type FieldResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string }

/** 사이즈 → 항목 → 값(cm). 예: { L: { 총장: 72, 가슴단면: 55 } } */
export type SizeTable = Record<string, Record<string, number>>

export type ProductOptions = {
  colors: string[]
  sizes: string[]
}

export type ParsedFields = {
  name: FieldResult<string>
  brand: FieldResult<string>
  price: FieldResult<number>
  imageUrl: FieldResult<string>
  category: FieldResult<Category>
  options: FieldResult<ProductOptions>
  sizeTable: FieldResult<SizeTable>
}

export type ParseResult = {
  goodsNo: string
  fields: ParsedFields
}

/** 수동 입력 폴백 화면이 다루는 필드 전체 목록. */
export const PARSEABLE_FIELDS = [
  'name', 'brand', 'price', 'imageUrl', 'category', 'options', 'sizeTable',
] as const

export type ParseableField = (typeof PARSEABLE_FIELDS)[number]

/**
 * parse_mode 계산에 쓰는 필드. options·sizeTable은 제외한다 —
 * 이 둘은 처음부터 자동 파싱을 시도하지 않으므로 실패가 항상 정상이고,
 * 포함시키면 모든 옷이 영원히 'manual'로 찍혀 "무신사 개편 감지" 지표가 무의미해진다.
 */
export const AUTO_PARSED_FIELDS = [
  'name', 'brand', 'price', 'imageUrl', 'category',
] as const

export function ok<T>(value: T): FieldResult<T> {
  return { ok: true, value }
}

export function fail<T>(reason: string): FieldResult<T> {
  return { ok: false, reason }
}
