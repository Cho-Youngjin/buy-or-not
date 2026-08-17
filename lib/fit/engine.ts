import type { Category } from '@/lib/types'
import { FIT_RULES, type Severity } from '@/lib/fit/rules'
import type { PreferenceProfile } from '@/lib/fit/profile'

export type FieldDeviation = {
  key: string
  candidateValue: number
  /** 허용 범위를 벗어난 만큼(cm). 0이면 위반 없음. */
  excess: number
  severity: Severity
  score: number
  avoidanceSignal: boolean
}

export type DeviationReport = {
  status: PreferenceProfile['status']
  fields: FieldDeviation[]
  fitScore: number
  hasFatalViolation: boolean
}

/**
 * 후보 옷의 실측값을 선호 범위와 비교해 항목별 편차·점수를 매긴다(스펙 §9 "편차 채점").
 * 순수 함수다 — Supabase도 Gemini도 모른다.
 */
export function scoreDeviation(
  candidateMeasurements: Record<string, number>,
  profile: PreferenceProfile,
  category: Category,
  /**
   * 사용자가 마이페이지에서 정한 허용오차 배율(profiles.fit_strictness).
   * 기본값 1이면 FIT_RULES의 원래 수치를 그대로 쓴다 — 기존 호출부·테스트가 안 깨진다.
   * 주의: buildPreferenceProfile에 넘기는 값과 반드시 같아야 한다. 선호 구간을 나눌 때 쓴
   * 허용오차와 그 구간 밖 초과분을 잴 때 쓰는 허용오차가 다르면 [lo-t, hi+t] 개념이 깨진다.
   */
  toleranceMultiplier = 1,
  /**
   * 카테고리 안에서 사용자가 항목별로 직접 정한 허용오차(cm, fit_field_overrides).
   * 값이 있으면 toleranceMultiplier 대신 그 값을 그대로 쓴다 — 이것도 buildPreferenceProfile에
   * 넘기는 값과 반드시 같아야 한다(위 toleranceMultiplier 주석과 같은 이유).
   */
  fieldOverrides: Record<string, number> = {},
): DeviationReport {
  const rules = FIT_RULES[category]
  if (!rules || profile.status === 'insufficient') {
    return { status: 'insufficient', fields: [], fitScore: 0, hasFatalViolation: false }
  }

  const fields: FieldDeviation[] = []
  let fitScore = 0
  let hasFatalViolation = false

  for (const [key, rule] of Object.entries(rules)) {
    const candidateValue = candidateMeasurements[key]
    const fieldProfile = profile.fields[key]
    if (candidateValue == null || !fieldProfile || fieldProfile.ranges.length === 0) continue

    const t = fieldOverrides[key] ?? rule.tolerance * toleranceMultiplier
    // 범위가 여러 개(클러스터)일 수 있으므로, 각 범위에 대한 편차 중 가장 작은 값을 쓴다 —
    // 크롭 범위와 오버핏 범위를 둘 다 가진 사용자에게 후보가 둘 중 하나에만 맞아도 통과해야 한다.
    const excess = Math.min(
      ...fieldProfile.ranges.map((range) => {
        if (candidateValue < range.lo - t) return range.lo - t - candidateValue
        if (candidateValue > range.hi + t) return candidateValue - (range.hi + t)
        return 0
      }),
    )

    let score = 0
    if (excess > t) score = rule.weight * 2
    else if (excess > 0) score = rule.weight * 1

    const avoidanceSignal =
      (fieldProfile.upperWarnLimit != null && candidateValue >= fieldProfile.upperWarnLimit) ||
      (fieldProfile.lowerWarnLimit != null && candidateValue <= fieldProfile.lowerWarnLimit)
    if (avoidanceSignal) score += rule.weight * 1

    if (score > 0 && rule.severity === 'fatal') hasFatalViolation = true

    fitScore += score
    fields.push({ key, candidateValue, excess, severity: rule.severity, score, avoidanceSignal })
  }

  return { status: profile.status, fields, fitScore, hasFatalViolation }
}
