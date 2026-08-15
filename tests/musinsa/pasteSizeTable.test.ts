import { describe, it, expect } from 'vitest'
import { parsePastedSizeTable } from '@/lib/musinsa/pasteSizeTable'

// 실제 무신사 상품 페이지(https://www.musinsa.com/products/6593921)의 "사이즈" 탭을
// 직접 드래그해서 복사했을 때 나온 구조 그대로다 — cm/내 사이즈/M/L/XL은 <ul><li>로 만든
// 고정 라벨 열이고, 측정값은 라벨 칸이 없는 별도 <table>이다(lib/musinsa/pasteSizeTable.ts 참고).
const PLAIN_TEXT = [
  'cm',
  '내 사이즈',
  'M',
  'L',
  'XL',
  '총장\t어깨너비\t가슴단면\t소매길이',
  '사이즈를 직접 입력해주세요',
  '61\t50\t55\t19',
  '63\t52\t57\t20',
  '65\t54\t59\t21',
].join('\n')

const HTML_FRAGMENT = `
<ul>
  <li>cm</li>
  <li>내 사이즈</li>
  <li>M</li>
  <li>L</li>
  <li>XL</li>
</ul>
<table>
  <thead><tr><th>총장</th><th>어깨너비</th><th>가슴단면</th><th>소매길이</th></tr></thead>
  <tbody>
    <tr><td colspan="4">사이즈를 직접 입력해주세요</td></tr>
    <tr><td>61</td><td>50</td><td>55</td><td>19</td></tr>
    <tr><td>63</td><td>52</td><td>57</td><td>20</td></tr>
    <tr><td>65</td><td>54</td><td>59</td><td>21</td></tr>
  </tbody>
</table>`

describe('parsePastedSizeTable — 일반 텍스트(라벨 열 + 헤더 없는 측정값 표)', () => {
  it('사이즈별 실측표를 만든다', () => {
    const result = parsePastedSizeTable(null, PLAIN_TEXT)
    expect(result.table).toEqual({
      M: { 총장: 61, 어깨너비: 50, 가슴단면: 55, 소매길이: 19 },
      L: { 총장: 63, 어깨너비: 52, 가슴단면: 57, 소매길이: 20 },
      XL: { 총장: 65, 어깨너비: 54, 가슴단면: 59, 소매길이: 21 },
    })
  })

  it('"cm"·"내 사이즈" 라벨은 사이즈가 아니므로 결과에서 빠진다', () => {
    const result = parsePastedSizeTable(null, PLAIN_TEXT)
    expect(result.table['cm']).toBeUndefined()
    expect(result.table['내 사이즈']).toBeUndefined()
  })

  it('표준 항목만 있으면 unrecognizedHeaders가 비어있다', () => {
    const result = parsePastedSizeTable(null, PLAIN_TEXT)
    expect(result.unrecognizedHeaders).toEqual([])
  })
})

describe('parsePastedSizeTable — HTML 클립보드(우선, <li> 라벨 열 포함)', () => {
  it('HTML이 있으면 이걸 우선 파싱하고, <li> 라벨과 <table> 측정값을 순서대로 짝짓는다', () => {
    const result = parsePastedSizeTable(HTML_FRAGMENT, '못 읽는 텍스트')
    expect(result.table).toEqual({
      M: { 총장: 61, 어깨너비: 50, 가슴단면: 55, 소매길이: 19 },
      L: { 총장: 63, 어깨너비: 52, 가슴단면: 57, 소매길이: 20 },
      XL: { 총장: 65, 어깨너비: 54, 가슴단면: 59, 소매길이: 21 },
    })
  })
})

describe('parsePastedSizeTable — 별칭·미인식 헤더', () => {
  it('별칭 표기를 표준 키로 정규화한다', () => {
    const text = ['M', '기장\t흉위', '70\t55'].join('\n')
    const result = parsePastedSizeTable(null, text)
    expect(result.table.M).toEqual({ 총장: 70, 가슴단면: 55 })
  })

  it('별칭 사전에 없는 헤더는 버리지 않고 원문 키로 저장한다', () => {
    const text = ['M', '총장\t밴딩둘레', '70\t80'].join('\n')
    const result = parsePastedSizeTable(null, text)
    expect(result.table.M).toEqual({ 총장: 70, 밴딩둘레: 80 })
    expect(result.unrecognizedHeaders).toEqual(['밴딩둘레'])
  })
})

describe('parsePastedSizeTable — 견고성', () => {
  it('표를 하나도 못 찾으면 빈 결과를 돌려주고 예외를 던지지 않는다', () => {
    expect(() => parsePastedSizeTable(null, '아무 텍스트나')).not.toThrow()
    const result = parsePastedSizeTable(null, '아무 텍스트나')
    expect(result.table).toEqual({})
  })

  it('빈 문자열에도 예외를 던지지 않는다', () => {
    expect(() => parsePastedSizeTable(null, '')).not.toThrow()
  })

  it('사이즈 라벨 없이 측정값 표만 있으면(라벨 목록을 못 찾은 경우) 빈 결과를 돌려준다', () => {
    const text = ['총장\t어깨너비', '61\t50'].join('\n')
    const result = parsePastedSizeTable(null, text)
    expect(result.table).toEqual({})
  })
})
