import { describe, it, expect } from 'vitest'
import { FIT_RULES, MATCH_PENALTY, VERDICT_CAUTION_MAX, MIN_OWNED_GARMENTS_FOR_FIT } from '@/lib/fit/rules'

describe('FIT_RULES', () => {
  it('상의는 허리단면을 판단하지 않는다(하의 전용 항목)', () => {
    expect(FIT_RULES.top?.['허리단면']).toBeUndefined()
  })

  it('하의 허리단면은 치명 심각도에 가중치 5다', () => {
    expect(FIT_RULES.bottom?.['허리단면']).toEqual({ tolerance: 1.5, severity: 'fatal', weight: 5 })
  })

  it('아우터는 상의보다 허용편차가 1.0cm 더 넓다', () => {
    expect(FIT_RULES.outer?.['총장'].tolerance).toBe(FIT_RULES.top!['총장'].tolerance + 1.0)
    expect(FIT_RULES.outer?.['가슴단면'].tolerance).toBe(FIT_RULES.top!['가슴단면'].tolerance + 1.0)
  })

  it('신발·액세서리는 핏 판단 대상이 아니다', () => {
    expect(FIT_RULES.shoes).toBeUndefined()
    expect(FIT_RULES.acc).toBeUndefined()
  })
})

describe('MATCH_PENALTY', () => {
  it('ok/warn/bad를 0/2/4점으로 환산한다', () => {
    expect(MATCH_PENALTY).toEqual({ ok: 0, warn: 2, bad: 4 })
  })
})

describe('임계값', () => {
  it('caution 상한은 4점이다', () => {
    expect(VERDICT_CAUTION_MAX).toBe(4)
  })

  it('핏 비교 최소 보유 벌 수는 3벌이다', () => {
    expect(MIN_OWNED_GARMENTS_FOR_FIT).toBe(3)
  })
})
