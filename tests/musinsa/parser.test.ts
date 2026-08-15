import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseProductHtml } from '@/lib/musinsa/parser'

function fixture(name: string): string {
  return readFileSync(path.resolve(__dirname, '../fixtures/musinsa', name), 'utf-8')
}

describe('parseProductHtml — 상의', () => {
  const result = parseProductHtml(fixture('top.html'), '6593921')

  it('상품번호를 그대로 담는다', () => {
    expect(result.goodsNo).toBe('6593921')
  })

  it('상품명을 뽑는다', () => {
    expect(result.fields.name).toEqual({ ok: true, value: '롤업 슬리브 크롭 반팔 티셔츠 블랙' })
  })

  it('브랜드는 한글 표시명을 뽑는다', () => {
    expect(result.fields.brand).toEqual({ ok: true, value: '언더오프' })
  })

  it('가격을 판매가로 뽑는다', () => {
    expect(result.fields.price).toEqual({ ok: true, value: 19900 })
  })

  it('대표 이미지를 절대 URL로 뽑는다', () => {
    expect(result.fields.imageUrl.ok).toBe(true)
    if (result.fields.imageUrl.ok) {
      expect(result.fields.imageUrl.value).toMatch(/^https:\/\/image\.msscdn\.net\//)
    }
  })

  it('카테고리를 top으로 판정한다', () => {
    expect(result.fields.category).toEqual({ ok: true, value: 'top' })
  })

  it('옵션과 실측표는 처음부터 시도하지 않고 실패로 둔다', () => {
    expect(result.fields.options.ok).toBe(false)
    expect(result.fields.sizeTable.ok).toBe(false)
  })
})

describe('parseProductHtml — 하의', () => {
  const result = parseProductHtml(fixture('bottom.html'), '6815858')

  it('바지 카테고리를 bottom으로 매핑한다', () => {
    expect(result.fields.category).toEqual({ ok: true, value: 'bottom' })
  })

  it('브랜드 한글 표시명을 뽑는다', () => {
    expect(result.fields.brand).toEqual({ ok: true, value: '위캔더스' })
  })
})

describe('parseProductHtml — 아우터', () => {
  const result = parseProductHtml(fixture('outer.html'), '2087860')

  it('아우터 카테고리를 outer로 매핑한다', () => {
    expect(result.fields.category).toEqual({ ok: true, value: 'outer' })
  })
})

describe('parseProductHtml — 견고성', () => {
  it('빈 HTML에도 예외를 던지지 않고 전 필드를 실패로 표시한다', () => {
    const result = parseProductHtml('<html><body></body></html>', '1')
    expect(result.fields.name.ok).toBe(false)
    expect(result.fields.sizeTable.ok).toBe(false)
    if (!result.fields.name.ok) {
      expect(result.fields.name.reason.length).toBeGreaterThan(0)
    }
  })

  it('__NEXT_DATA__가 깨진 JSON이어도 예외를 던지지 않는다', () => {
    const html = '<html><script id="__NEXT_DATA__" type="application/json">{not json</script></html>'
    expect(() => parseProductHtml(html, '1')).not.toThrow()
  })

  it('Detail 쿼리가 없어도 예외를 던지지 않는다', () => {
    const html = '<html><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"dehydratedState":{"queries":[]}}}}</script></html>'
    const result = parseProductHtml(html, '1')
    expect(result.fields.name.ok).toBe(false)
  })
})
