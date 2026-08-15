const GOODS_NO_PATTERNS = [
  /\/products\/(\d+)/,
  /\/app\/goods\/(\d+)/,
  /[?&]goodsNo=(\d+)/,
]

/** 무신사 상품 URL에서 상품번호를 뽑는다. 무신사 주소가 아니거나 번호가 없으면 null. */
export function extractGoodsNo(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }

  // 하위 도메인은 허용하되, musinsa.com으로 끝나야 한다.
  if (!/(^|\.)musinsa\.com$/.test(url.hostname)) return null

  const target = url.pathname + url.search
  for (const pattern of GOODS_NO_PATTERNS) {
    const match = target.match(pattern)
    if (match) return match[1]
  }
  return null
}
