/** 핏 판단에 사용하는 표준 실측 항목. 이 목록에 없는 항목은 저장은 되지만 판단에서 제외된다. */
export const STANDARD_KEYS: ReadonlySet<string> = new Set([
  '총장', '어깨너비', '가슴단면', '소매길이',
  '허리단면', '엉덩이단면', '허벅지단면', '밑위', '밑단단면',
])

/** 무신사 표기 → 표준 키. 키는 공백을 제거한 형태로 비교한다. */
const ALIASES: Record<string, string> = {
  기장: '총장',
  옷길이: '총장',
  흉위: '가슴단면',
  가슴둘레: '가슴단면',
  어깨: '어깨너비',
  견장: '어깨너비',
  소매: '소매길이',
  팔길이: '소매길이',
  허리: '허리단면',
  힙단면: '엉덩이단면',
  엉덩이: '엉덩이단면',
  허벅지: '허벅지단면',
  밑위길이: '밑위',
  밑단: '밑단단면',
}

export function normalizeMeasurementKey(raw: string): string {
  const compact = raw
    .replace(/\(\s*cm\s*\)/gi, '')
    .replace(/\s+/g, '')
    .trim()

  if (STANDARD_KEYS.has(compact)) return compact
  if (ALIASES[compact]) return ALIASES[compact]
  return raw.trim()
}

export function isStandardKey(key: string): boolean {
  return STANDARD_KEYS.has(key)
}
