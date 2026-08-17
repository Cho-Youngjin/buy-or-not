import { describe, it, expect } from 'vitest'
import { createManualParseResult } from '@/lib/musinsa/manualParseResult'
import { PARSEABLE_FIELDS } from '@/lib/musinsa/types'

describe('createManualParseResult', () => {
  it('모든 필드를 실패(직접 입력 대상)로 만든다', () => {
    const result = createManualParseResult()
    for (const key of PARSEABLE_FIELDS) {
      expect(result.fields[key].ok).toBe(false)
    }
  })

  it('호출마다 다른 goodsNo를 만든다', () => {
    const a = createManualParseResult()
    const b = createManualParseResult()
    expect(a.goodsNo).not.toBe(b.goodsNo)
  })

  it('goodsNo가 빈 문자열이 아니다', () => {
    expect(createManualParseResult().goodsNo.length).toBeGreaterThan(0)
  })
})
