import { describe, it, expect } from 'vitest'
import { extractGoodsNo } from '@/lib/musinsa/url'

describe('extractGoodsNo', () => {
  it('신형 상품 URL에서 번호를 뽑는다', () => {
    expect(extractGoodsNo('https://www.musinsa.com/products/1234567')).toBe('1234567')
  })

  it('구형 상품 URL에서 번호를 뽑는다', () => {
    expect(extractGoodsNo('https://www.musinsa.com/app/goods/1234567')).toBe('1234567')
  })

  it('쿼리스트링 형식에서도 뽑는다', () => {
    expect(extractGoodsNo('https://www.musinsa.com/app/goods/?goodsNo=1234567')).toBe('1234567')
  })

  it('경로 뒤에 쿼리가 붙어도 뽑는다', () => {
    expect(extractGoodsNo('https://www.musinsa.com/products/1234567?color=black')).toBe('1234567')
  })

  it('앞뒤 공백을 무시한다', () => {
    expect(extractGoodsNo('  https://www.musinsa.com/products/1234567  ')).toBe('1234567')
  })

  it('무신사가 아닌 도메인은 거부한다', () => {
    expect(extractGoodsNo('https://www.example.com/products/1234567')).toBeNull()
  })

  it('도메인 이름에 musinsa가 섞인 위장 주소를 거부한다', () => {
    expect(extractGoodsNo('https://musinsa.com.evil.io/products/123')).toBeNull()
  })

  it('URL이 아니면 null을 반환한다', () => {
    expect(extractGoodsNo('그냥 문자열')).toBeNull()
  })

  it('상품번호가 없는 무신사 주소는 null을 반환한다', () => {
    expect(extractGoodsNo('https://www.musinsa.com/main')).toBeNull()
  })
})
