const TIMEOUT_MS = 8000
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function requestOnce(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'ko-KR,ko;q=0.9',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!response.ok) throw new Error(`무신사 응답 ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

/** 상품 페이지 HTML을 가져온다. 실패 시 한 번만 재시도한다. */
export async function fetchProductHtml(url: string): Promise<string> {
  try {
    return await requestOnce(url)
  } catch (first) {
    try {
      return await requestOnce(url)
    } catch {
      throw first
    }
  }
}
