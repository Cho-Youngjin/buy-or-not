import { describe, it, expect } from 'vitest'
import { normalizeMeasurementKey, isStandardKey, STANDARD_KEYS } from '@/lib/musinsa/measurements'

describe('normalizeMeasurementKey', () => {
  it('표준 키는 그대로 둔다', () => {
    expect(normalizeMeasurementKey('총장')).toBe('총장')
    expect(normalizeMeasurementKey('허리단면')).toBe('허리단면')
  })

  it('공백이 섞인 표기를 표준화한다', () => {
    expect(normalizeMeasurementKey('가슴 단면')).toBe('가슴단면')
    expect(normalizeMeasurementKey('어깨 너비')).toBe('어깨너비')
  })

  it('단위 표기를 떼어낸다', () => {
    expect(normalizeMeasurementKey('총장(cm)')).toBe('총장')
    expect(normalizeMeasurementKey('가슴단면 (CM)')).toBe('가슴단면')
  })

  it('별칭을 표준 키로 바꾼다', () => {
    expect(normalizeMeasurementKey('흉위')).toBe('가슴단면')
    expect(normalizeMeasurementKey('기장')).toBe('총장')
    expect(normalizeMeasurementKey('힙단면')).toBe('엉덩이단면')
  })

  it('모르는 항목은 원문 그대로 돌려준다', () => {
    expect(normalizeMeasurementKey('밴딩둘레')).toBe('밴딩둘레')
  })

  it('앞뒤 공백을 제거한다', () => {
    expect(normalizeMeasurementKey('  총장  ')).toBe('총장')
  })
})

describe('isStandardKey', () => {
  it('표준 9개 항목을 인식한다', () => {
    expect(STANDARD_KEYS.size).toBe(9)
    expect(isStandardKey('밑위')).toBe(true)
    expect(isStandardKey('밴딩둘레')).toBe(false)
  })
})
