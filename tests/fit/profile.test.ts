import { describe, it, expect } from 'vitest'
import { clusterValues, buildPreferenceProfile, type GarmentForProfile } from '@/lib/fit/profile'

describe('clusterValues', () => {
  it('간격이 허용편차 이내면 하나의 범위로 묶는다', () => {
    expect(clusterValues([58, 60, 62], 3)).toEqual([{ lo: 58, hi: 62 }])
  })

  it('간격이 허용편차보다 크면 별도 범위로 나눈다 — 스펙 §9 예시', () => {
    // 총장 성공 집합 {58,60,62,78,80}, t=3 → 62→78 구간(16)이 t보다 커서 두 범위로 나뉜다.
    expect(clusterValues([58, 60, 62, 78, 80], 3)).toEqual([
      { lo: 58, hi: 62 },
      { lo: 78, hi: 80 },
    ])
  })

  it('빈 배열은 빈 배열을 돌려준다', () => {
    expect(clusterValues([], 3)).toEqual([])
  })

  it('값이 하나뿐이면 범위 하나(lo===hi)를 돌려준다', () => {
    expect(clusterValues([70], 3)).toEqual([{ lo: 70, hi: 70 }])
  })
})

function garment(overrides: Partial<GarmentForProfile>): GarmentForProfile {
  return {
    rating: null, fitTag: null, wearFrequency: null, price: null, measurements: {},
    ...overrides,
  }
}

describe('buildPreferenceProfile — 데이터 부족', () => {
  it('같은 카테고리 옷이 3벌 미만이면 insufficient다', () => {
    const garments = [garment({ rating: 5, measurements: { 총장: 60 } })]
    const profile = buildPreferenceProfile(garments, 'top')
    expect(profile.status).toBe('insufficient')
    expect(profile.fields).toEqual({})
  })
})

describe('buildPreferenceProfile — 성공 집합', () => {
  const garments: GarmentForProfile[] = [
    garment({ rating: 5, price: 30000, measurements: { 총장: 60, 어깨너비: 48 } }),
    garment({ wearFrequency: 'often', price: 40000, measurements: { 총장: 61, 어깨너비: 49 } }),
    garment({ rating: 1, fitTag: 'loose', price: 20000, measurements: { 총장: 70, 어깨너비: 55 } }),
  ]

  it('rating>=4 또는 wear_frequency=often인 옷만 성공 집합으로 묶어 범위를 만든다', () => {
    const profile = buildPreferenceProfile(garments, 'top')
    expect(profile.status).toBe('ok')
    expect(profile.fields['총장'].ranges).toEqual([{ lo: 60, hi: 61 }])
  })

  it('rating<=2고 fit_tag=loose인 실패 옷의 최소값이 상한 경고선이 된다', () => {
    const profile = buildPreferenceProfile(garments, 'top')
    expect(profile.fields['총장'].upperWarnLimit).toBe(70)
  })

  it('owned 옷 전체의 유효한 가격 평균을 avgPrice로 낸다', () => {
    const profile = buildPreferenceProfile(garments, 'top')
    expect(profile.avgPrice).toBe(30000)
  })
})

describe('buildPreferenceProfile — 성공 집합이 비어있으면 전체로 대체', () => {
  it('rating·착용빈도 신호가 하나도 없으면 전체 owned로 대체하고 신뢰도를 낮춘다', () => {
    const garments: GarmentForProfile[] = [
      garment({ measurements: { 총장: 60 } }),
      garment({ measurements: { 총장: 62 } }),
      garment({ measurements: { 총장: 64 } }),
    ]
    const profile = buildPreferenceProfile(garments, 'top')
    expect(profile.status).toBe('low_confidence')
    expect(profile.fields['총장'].ranges).toEqual([{ lo: 60, hi: 64 }])
  })
})

describe('buildPreferenceProfile — 표준 항목이 아닌 값은 무시한다', () => {
  it('FIT_RULES에 없는 카테고리는 insufficient다', () => {
    const garments = [garment({}), garment({}), garment({})]
    expect(buildPreferenceProfile(garments, 'shoes').status).toBe('insufficient')
  })
})

describe('buildPreferenceProfile — 허용오차 배율', () => {
  // 총장 기본 허용오차 3.0. 성공 집합의 값 간격이 4cm라 기본값에서는 매번 쪼개진다.
  const garments: GarmentForProfile[] = [
    garment({ rating: 5, measurements: { 총장: 60 } }),
    garment({ rating: 5, measurements: { 총장: 64 } }),
    garment({ rating: 5, measurements: { 총장: 68 } }),
  ]

  it('배율 1(기본)이면 간격 4cm가 허용오차 3.0을 넘어 세 구간으로 쪼개진다', () => {
    expect(buildPreferenceProfile(garments, 'top').fields['총장'].ranges).toEqual([
      { lo: 60, hi: 60 },
      { lo: 64, hi: 64 },
      { lo: 68, hi: 68 },
    ])
  })

  it('배율 2.0이면 허용오차가 6.0이 되어 같은 값들이 한 구간으로 묶인다', () => {
    expect(buildPreferenceProfile(garments, 'top', 2).fields['총장'].ranges).toEqual([
      { lo: 60, hi: 68 },
    ])
  })
})
