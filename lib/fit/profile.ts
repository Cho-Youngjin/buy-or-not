import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category, FitTag, WearFrequency } from '@/lib/types'
import { FIT_RULES, MIN_OWNED_GARMENTS_FOR_FIT } from '@/lib/fit/rules'

export type PreferredRange = { lo: number; hi: number }

export type FieldProfile = {
  ranges: PreferredRange[]
  /** loose(큼)로 실패한 옷들의 최소값 — 이 이상이면 과거에 커서 안 입은 치수(회피 신호 상한). */
  upperWarnLimit?: number
  /** tight(작음)로 실패한 옷들의 최대값 — 이 이하면 과거에 작아서 안 입은 치수(회피 신호 하한). */
  lowerWarnLimit?: number
}

export type PreferenceProfile = {
  status: 'ok' | 'low_confidence' | 'insufficient'
  fields: Record<string, FieldProfile>
  avgPrice: number | null
}

export type GarmentForProfile = {
  rating: number | null
  fitTag: FitTag | null
  wearFrequency: WearFrequency | null
  price: number | null
  measurements: Record<string, number>
}

/**
 * 값을 오름차순 정렬한 뒤 인접한 두 값의 차이가 허용편차(tolerance)보다 크면 그 지점에서
 * 구간을 나눈다(스펙 §9). 크롭과 오버핏처럼 서로 다른 극단을 동시에 선호하는 사용자를
 * 하나의 최소·최대 범위로 잡으면, 그 사이의 좋아하지 않는 중간 기장까지 통과시켜버린다.
 */
export function clusterValues(values: number[], tolerance: number): PreferredRange[] {
  if (values.length === 0) return []
  const sorted = [...values].sort((a, b) => a - b)

  const ranges: PreferredRange[] = []
  let clusterStart = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - prev > tolerance) {
      ranges.push({ lo: clusterStart, hi: prev })
      clusterStart = sorted[i]
    }
    prev = sorted[i]
  }
  ranges.push({ lo: clusterStart, hi: prev })
  return ranges
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

/**
 * garments(순수 데이터, DB를 모른다)로부터 선호 실측 범위를 조립한다.
 * DB 조회와 분리해서 여기 하나만 단위 테스트로 촘촘히 검증한다.
 */
export function buildPreferenceProfile(
  garments: GarmentForProfile[],
  category: Category,
  /** scoreDeviation에 넘기는 값과 반드시 같아야 한다 — engine.ts의 같은 파라미터 주석 참고. */
  toleranceMultiplier = 1,
  /** scoreDeviation에 넘기는 값과 반드시 같아야 한다 — engine.ts의 같은 파라미터 주석 참고. */
  fieldOverrides: Record<string, number> = {},
): PreferenceProfile {
  const rules = FIT_RULES[category]
  if (!rules) return { status: 'insufficient', fields: {}, avgPrice: null }
  if (garments.length < MIN_OWNED_GARMENTS_FOR_FIT) {
    return { status: 'insufficient', fields: {}, avgPrice: null }
  }

  const isSuccess = (g: GarmentForProfile) => (g.rating != null && g.rating >= 4) || g.wearFrequency === 'often'
  const isFailure = (g: GarmentForProfile) => (g.rating != null && g.rating <= 2) || g.wearFrequency === 'rarely'

  let successSet = garments.filter(isSuccess)
  let status: PreferenceProfile['status'] = 'ok'
  if (successSet.length === 0) {
    // 성공 신호가 하나도 없으면 카테고리 전체로 대체하되, 신뢰도가 낮다는 걸 리포트에 남긴다.
    successSet = garments
    status = 'low_confidence'
  }
  const failureSet = garments.filter(isFailure)

  const fields: Record<string, FieldProfile> = {}
  for (const key of Object.keys(rules)) {
    const successValues = successSet.map((g) => g.measurements[key]).filter((v): v is number => typeof v === 'number')
    if (successValues.length === 0) continue

    const looseFailureValues = failureSet
      .filter((g) => g.fitTag === 'loose')
      .map((g) => g.measurements[key])
      .filter((v): v is number => typeof v === 'number')
    const tightFailureValues = failureSet
      .filter((g) => g.fitTag === 'tight')
      .map((g) => g.measurements[key])
      .filter((v): v is number => typeof v === 'number')

    fields[key] = {
      ranges: clusterValues(successValues, fieldOverrides[key] ?? rules[key].tolerance * toleranceMultiplier),
      upperWarnLimit: looseFailureValues.length > 0 ? Math.min(...looseFailureValues) : undefined,
      lowerWarnLimit: tightFailureValues.length > 0 ? Math.max(...tightFailureValues) : undefined,
    }
  }

  const avgPrice = average(garments.map((g) => g.price).filter((p): p is number => typeof p === 'number'))

  return { status, fields, avgPrice }
}

type GarmentRow = {
  rating: number | null
  fit_tag: FitTag | null
  wear_frequency: WearFrequency | null
  price: number | null
  garment_measurements: { key: string; value: number }[] | null
}

/**
 * 옷장 집계 쿼리. owner_id를 명시적으로 건다 — RLS의 garments_select 정책은 "본인 것 또는
 * 공개 옷장"을 모두 허용하므로, 이 필터가 없으면 다른 공개 사용자의 옷까지 내 선호 범위에
 * 섞여 들어간다(app/wardrobe/page.tsx의 동일한 이유의 명시적 필터 참고).
 */
export async function fetchPreferenceProfile(
  supabase: SupabaseClient,
  ownerId: string,
  category: Category,
  toleranceMultiplier = 1,
  fieldOverrides: Record<string, number> = {},
): Promise<PreferenceProfile> {
  const { data } = await supabase
    .from('garments')
    .select('rating, fit_tag, wear_frequency, price, garment_measurements(key, value)')
    .eq('owner_id', ownerId)
    .eq('status', 'owned')
    .eq('category', category)
    .overrideTypes<GarmentRow[], { merge: false }>()

  const garments: GarmentForProfile[] = (data ?? []).map((g) => ({
    rating: g.rating,
    fitTag: g.fit_tag,
    wearFrequency: g.wear_frequency,
    price: g.price,
    measurements: Object.fromEntries((g.garment_measurements ?? []).map((m) => [m.key, Number(m.value)])),
  }))

  return buildPreferenceProfile(garments, category, toleranceMultiplier, fieldOverrides)
}
