import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchProductHtml } from '@/lib/musinsa/fetcher'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchProductHtml', () => {
  it('HTML 본문을 돌려준다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>ok</html>', { status: 200 })))
    await expect(fetchProductHtml('https://www.musinsa.com/products/1')).resolves.toBe('<html>ok</html>')
  })

  it('첫 요청이 실패하면 한 번 재시도한다', async () => {
    const mock = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(new Response('<html>ok</html>', { status: 200 }))
    vi.stubGlobal('fetch', mock)

    await expect(fetchProductHtml('https://www.musinsa.com/products/1')).resolves.toBe('<html>ok</html>')
    expect(mock).toHaveBeenCalledTimes(2)
  })

  it('두 번 다 실패하면 예외를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    await expect(fetchProductHtml('https://www.musinsa.com/products/1')).rejects.toThrow()
  })

  it('403 응답은 차단으로 보고 예외를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })))
    await expect(fetchProductHtml('https://www.musinsa.com/products/1')).rejects.toThrow(/403/)
  })

  it('브라우저처럼 보이는 User-Agent를 보낸다', async () => {
    const mock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('<html></html>', { status: 200 }))
    vi.stubGlobal('fetch', mock)
    await fetchProductHtml('https://www.musinsa.com/products/1')

    const init = mock.mock.calls[0][1] as RequestInit
    expect(String((init.headers as Record<string, string>)['User-Agent'])).toMatch(/Mozilla/)
  })
})
