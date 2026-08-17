import { describe, it, expect } from 'vitest'
import { scoreDeviation } from '@/lib/fit/engine'
import type { PreferenceProfile } from '@/lib/fit/profile'

function profile(fields: PreferenceProfile['fields'], status: PreferenceProfile['status'] = 'ok'): PreferenceProfile {
  return { status, fields, avgPrice: null }
}

describe('scoreDeviation — 범위 안', () => {
  it('선호 범위 안이면 위반 없이 0점이다', () => {
    const report = scoreDeviation(
      { 총장: 61 },
      profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } }),
      'top',
    )
    expect(report.fields[0]).toMatchObject({ key: '총장', excess: 0, score: 0 })
    expect(report.fitScore).toBe(0)
  })
})

describe('scoreDeviation — 경고 구간(허용편차 이내 초과)', () => {
  it('허용구간[lo-t, hi+t]을 벗어났지만 초과폭이 t 이내면 가중치 × 1점이다', () => {
    // 총장 허용편차 t=3.0, 가중치 2. 범위 [60,62] → 허용구간 [57,65].
    // 67은 허용구간 밖으로 2cm 초과(67-65=2 <= t=3) → 경고.
    const report = scoreDeviation(
      { 총장: 67 },
      profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } }),
      'top',
    )
    expect(report.fields[0]).toMatchObject({ excess: 2, score: 2 })
  })
})

describe('scoreDeviation — 심각 구간(허용편차 초과)', () => {
  it('허용구간 밖으로 t보다 더 벗어나면 가중치 × 2점이다', () => {
    // 허용구간 [57,65] 밖으로 5cm 초과(70-65=5 > t=3) → 심각(가중치 2 × 2 = 4).
    const report = scoreDeviation(
      { 총장: 70 },
      profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } }),
      'top',
    )
    expect(report.fields[0]).toMatchObject({ excess: 5, score: 4 })
  })
})

describe('scoreDeviation — 클러스터가 여러 개면 가장 가까운 범위를 쓴다', () => {
  it('크롭·오버핏 범위를 둘 다 가진 사용자에게 둘 중 하나에만 맞아도 통과한다', () => {
    const report = scoreDeviation(
      { 총장: 79 },
      profile({ 총장: { ranges: [{ lo: 58, hi: 62 }, { lo: 78, hi: 80 }] } }),
      'top',
    )
    expect(report.fields[0]).toMatchObject({ excess: 0, score: 0 })
  })
})

describe('scoreDeviation — 회피 신호', () => {
  it('상한 경고선 이상이면 가중치 × 1점을 더한다', () => {
    const report = scoreDeviation(
      { 총장: 61 },
      profile({ 총장: { ranges: [{ lo: 60, hi: 62 }], upperWarnLimit: 61 } }),
      'top',
    )
    // 범위 안이라 excess=0(0점)이지만 회피 신호로 가중치(2) × 1 = 2점이 더해진다.
    expect(report.fields[0]).toMatchObject({ score: 2, avoidanceSignal: true })
  })
})

describe('scoreDeviation — 치명 위반', () => {
  it('허리단면처럼 심각도가 fatal인 항목에 위반이 있으면 hasFatalViolation=true다', () => {
    const report = scoreDeviation(
      { 허리단면: 90 },
      profile({ 허리단면: { ranges: [{ lo: 70, hi: 72 }] } }),
      'bottom',
    )
    expect(report.hasFatalViolation).toBe(true)
  })
})

describe('scoreDeviation — 둘 다 있는 항목만 채점한다', () => {
  it('후보에 없는 항목은 건너뛴다', () => {
    const report = scoreDeviation({}, profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } }), 'top')
    expect(report.fields).toEqual([])
    expect(report.fitScore).toBe(0)
  })

  it('선호 범위가 없는 항목(값이 하나도 없어 클러스터가 비어있음)은 건너뛴다', () => {
    const report = scoreDeviation({ 총장: 61 }, profile({ 총장: { ranges: [] } }), 'top')
    expect(report.fields).toEqual([])
  })
})

describe('scoreDeviation — 데이터 부족', () => {
  it('프로필이 insufficient면 채점 없이 그대로 넘긴다', () => {
    const report = scoreDeviation({ 총장: 61 }, profile({}, 'insufficient'), 'top')
    expect(report.status).toBe('insufficient')
    expect(report.fields).toEqual([])
  })
})

describe('scoreDeviation — 허용오차 배율', () => {
  // 총장: 기본 허용오차 t=3.0, 가중치 2. 선호 범위 [60,62].
  it('배율 0.5면 허용구간이 좁아져 기본값에서는 통과하던 값이 위반이 된다', () => {
    const p = profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } })

    // 배율 1: 허용구간 [57, 65] → 65는 경계 안이라 위반 없음.
    expect(scoreDeviation({ 총장: 65 }, p, 'top')).toMatchObject({ fitScore: 0 })

    // 배율 0.5: t=1.5 → 허용구간 [58.5, 63.5] → 65는 1.5cm 초과.
    // 초과폭 1.5가 t(1.5)보다 크지 않으므로 경고(가중치 2 × 1 = 2점).
    const strict = scoreDeviation({ 총장: 65 }, p, 'top', 0.5)
    expect(strict.fields[0]).toMatchObject({ excess: 1.5, score: 2 })
  })

  it('배율 2.0이면 허용구간이 넓어져 기본값에서는 위반이던 값이 통과한다', () => {
    const p = profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } })

    // 배율 1: 허용구간 [57, 65] → 67은 2cm 초과(경고, 2점).
    expect(scoreDeviation({ 총장: 67 }, p, 'top').fields[0]).toMatchObject({ excess: 2, score: 2 })

    // 배율 2: t=6.0 → 허용구간 [54, 68] → 67은 구간 안이라 위반 없음.
    const relaxed = scoreDeviation({ 총장: 67 }, p, 'top', 2)
    expect(relaxed.fields[0]).toMatchObject({ excess: 0, score: 0 })
    expect(relaxed.fitScore).toBe(0)
  })
})

describe('scoreDeviation — 항목별 허용오차 직접 입력', () => {
  it('fieldOverrides에 값이 있으면 toleranceMultiplier 대신 그 값을 쓴다', () => {
    const p = profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } })

    // toleranceMultiplier=2라면 t=6.0(허용구간 [54,68])이라 65는 위반이 아니다.
    // 하지만 fieldOverrides로 총장을 1.5로 고정하면 허용구간은 [58.5,63.5]가 되어
    // 65는 1.5cm 초과(경계와 같아 경고 단계, 가중치 2 × 1 = 2점)한다.
    const report = scoreDeviation({ 총장: 65 }, p, 'top', 2, { 총장: 1.5 })
    expect(report.fields[0]).toMatchObject({ excess: 1.5, score: 2 })
  })

  it('fieldOverrides에 없는 항목은 toleranceMultiplier를 그대로 따른다', () => {
    const p = profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } })

    // fieldOverrides에 총장이 없으므로(허리단면만 있음) 배율 0.5만 적용된다(t = 3.0 × 0.5 = 1.5).
    // 허용구간 [58.5, 63.5] 밖으로 65는 1.5cm 초과 — 경고(가중치 2 × 1 = 2점).
    const report = scoreDeviation({ 총장: 65 }, p, 'top', 0.5, { 허리단면: 1.0 })
    expect(report.fields[0]).toMatchObject({ excess: 1.5, score: 2 })
  })
})
