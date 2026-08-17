/**
 * 사이즈 라벨에서 숫자 토큰과 영문 토큰을 뽑는다. "2 (L)" → ["2", "L"].
 *
 * 영문은 글자 단위가 아니라 **덩어리 단위**로 자른다 — "XL"을 ["X","L"]로 쪼개면
 * "L"과 교집합이 생겨 다른 사이즈끼리 매칭돼 버린다.
 * 한글·괄호·공백은 애초에 토큰이 되지 않는다(사이즈를 식별하는 정보가 아니다).
 */
export function extractSizeTokens(label: string): string[] {
  return label.toUpperCase().match(/[A-Z]+|\d+/g) ?? []
}

/**
 * 두 사이즈 라벨이 같은 사이즈를 가리키는지 본다.
 *
 * 무신사 상품 옵션은 "2 (L)"처럼 번호와 알파벳을 함께 쓰는데 실측표 행 라벨은 "L"이나 "2"
 * 한쪽만 있는 경우가 많다. 그래서 정확히 같은 문자열을 요구하지 않고 토큰 하나라도 겹치면
 * 같은 사이즈로 본다. 문자열 포함(substring) 검사를 쓰지 않는 이유는 "XL"이 "L"을 포함해
 * 서로 다른 사이즈가 매칭돼 버리기 때문이다.
 *
 * 남는 한계: "2 (L)"과 "2 (XL)"처럼 번호가 같고 알파벳만 다른 라벨이 한 표에 함께 있으면
 * 번호 토큰 때문에 매칭될 수 있다. 실제 무신사 상품에서는 번호와 알파벳이 1:1이라
 * 이런 조합이 나오지 않아 그대로 둔다.
 */
export function sizesMatch(a: string, b: string): boolean {
  const tokensA = extractSizeTokens(a)
  const tokensB = extractSizeTokens(b)
  if (tokensA.length === 0 || tokensB.length === 0) return false
  return tokensA.some((token) => tokensB.includes(token))
}

/**
 * 실측표 행 라벨 목록에서 선택한 사이즈에 해당하는 것을 고른다.
 *
 * 정확히 같은 라벨을 먼저 찾고, 없을 때만 토큰 일치로 넓힌다 — 후보가 여럿일 때
 * 정확한 쪽을 놓치지 않기 위해서다.
 */
export function findMatchingSize(candidates: string[], size: string): string | undefined {
  const normalized = size.trim().toUpperCase()
  const exact = candidates.find((candidate) => candidate.trim().toUpperCase() === normalized)
  if (exact) return exact
  return candidates.find((candidate) => sizesMatch(candidate, size))
}
