import { describe, it, expect } from 'vitest'
import { extractSizeTokens, sizesMatch, findMatchingSize } from '@/lib/musinsa/sizeMatch'

describe('extractSizeTokens', () => {
  it('숫자와 영문 라벨이 섞인 옵션에서 둘 다 뽑는다', () => {
    expect(extractSizeTokens('2 (L)')).toEqual(['2', 'L'])
  })

  it('영문만 있으면 통째로 한 토큰이다', () => {
    expect(extractSizeTokens('XL')).toEqual(['XL'])
  })

  it('숫자만 있는 라벨도 뽑는다', () => {
    expect(extractSizeTokens('95')).toEqual(['95'])
  })

  it('소문자는 대문자로 정규화한다', () => {
    expect(extractSizeTokens('free')).toEqual(['FREE'])
  })

  it('한글·기호만 있으면 빈 배열이다', () => {
    expect(extractSizeTokens('(-)')).toEqual([])
  })
})

describe('sizesMatch', () => {
  it('"2 (L)"과 "L"을 같은 사이즈로 본다', () => {
    expect(sizesMatch('2 (L)', 'L')).toBe(true)
  })

  it('"2 (L)"과 "2"를 같은 사이즈로 본다', () => {
    expect(sizesMatch('2 (L)', '2')).toBe(true)
  })

  it('대소문자를 구분하지 않는다', () => {
    expect(sizesMatch('l', 'L')).toBe(true)
  })

  it('"XL"과 "L"은 다른 사이즈다', () => {
    expect(sizesMatch('XL', 'L')).toBe(false)
  })

  it('빈 문자열끼리는 매칭하지 않는다', () => {
    expect(sizesMatch('', '')).toBe(false)
  })

  it('한쪽이 비어 있으면 매칭하지 않는다', () => {
    expect(sizesMatch('L', '')).toBe(false)
  })
})

describe('findMatchingSize', () => {
  it('실측표 행 라벨이 "L"뿐이어도 옵션 "2 (L)"과 이어준다', () => {
    expect(findMatchingSize(['S', 'M', 'L'], '2 (L)')).toBe('L')
  })

  it('실측표가 숫자 라벨이면 옵션의 숫자와 이어준다', () => {
    expect(findMatchingSize(['1', '2', '3'], '2 (L)')).toBe('2')
  })

  it('정확히 같은 라벨이 있으면 그것을 먼저 고른다', () => {
    expect(findMatchingSize(['2', '2 (L)'], '2 (L)')).toBe('2 (L)')
  })

  it('맞는 게 없으면 undefined다', () => {
    expect(findMatchingSize(['S', 'M'], 'XL')).toBeUndefined()
  })

  it('후보가 없으면 undefined다', () => {
    expect(findMatchingSize([], 'L')).toBeUndefined()
  })
})
