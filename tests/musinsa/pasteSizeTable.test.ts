import { describe, it, expect } from 'vitest'
import { parsePastedSizeTable } from '@/lib/musinsa/pasteSizeTable'

const PLAIN_TEXT = [
  'cm\t총장\t어깨너비\t가슴단면\t소매길이',
  '내 사이즈\t\t사이즈를 직접 입력해주세요\t\t',
  'M\t61\t50\t55\t19',
  'L\t63\t52\t57\t20',
  'XL\t65\t54\t59\t21',
].join('\n')

const HTML_TABLE = `
<table>
  <tr><th>cm</th><th>총장</th><th>어깨너비</th><th>가슴단면</th><th>소매길이</th></tr>
  <tr><td>내 사이즈</td><td></td><td>사이즈를 직접 입력해주세요</td><td></td><td></td></tr>
  <tr><td>M</td><td>61</td><td>50</td><td>55</td><td>19</td></tr>
  <tr><td>L</td><td>63</td><td>52</td><td>57</td><td>20</td></tr>
  <tr><td>XL</td><td>65</td><td>54</td><td>59</td><td>21</td></tr>
</table>`

describe('parsePastedSizeTable — 일반 텍스트(탭 구분)', () => {
  it('사이즈별 실측표를 만든다', () => {
    const result = parsePastedSizeTable(null, PLAIN_TEXT)
    expect(result.table).toEqual({
      M: { 총장: 61, 어깨너비: 50, 가슴단면: 55, 소매길이: 19 },
      L: { 총장: 63, 어깨너비: 52, 가슴단면: 57, 소매길이: 20 },
      XL: { 총장: 65, 어깨너비: 54, 가슴단면: 59, 소매길이: 21 },
    })
  })

  it('"내 사이즈" 입력 안내행은 숫자가 없어 결과에서 빠진다', () => {
    const result = parsePastedSizeTable(null, PLAIN_TEXT)
    expect(result.table['내 사이즈']).toBeUndefined()
  })

  it('표준 항목만 있으면 unrecognizedHeaders가 비어있다', () => {
    const result = parsePastedSizeTable(null, PLAIN_TEXT)
    expect(result.unrecognizedHeaders).toEqual([])
  })
})

describe('parsePastedSizeTable — HTML 클립보드(우선)', () => {
  it('HTML이 있으면 이걸 우선 파싱한다', () => {
    const result = parsePastedSizeTable(HTML_TABLE, '못 읽는 텍스트')
    expect(result.table.M).toEqual({ 총장: 61, 어깨너비: 50, 가슴단면: 55, 소매길이: 19 })
  })
})

describe('parsePastedSizeTable — 별칭·미인식 헤더', () => {
  it('별칭 표기를 표준 키로 정규화한다', () => {
    const text = ['cm\t기장\t흉위', 'M\t70\t55'].join('\n')
    const result = parsePastedSizeTable(null, text)
    expect(result.table.M).toEqual({ 총장: 70, 가슴단면: 55 })
  })

  it('별칭 사전에 없는 헤더는 버리지 않고 원문 키로 저장한다', () => {
    const text = ['cm\t총장\t밴딩둘레', 'M\t70\t80'].join('\n')
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
})
