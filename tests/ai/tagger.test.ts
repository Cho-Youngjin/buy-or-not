import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateContentMock = vi.fn()

vi.mock('@/lib/gemini/client', () => ({
  getGeminiClient: () => ({ models: { generateContent: generateContentMock } }),
  GEMINI_MODEL: 'gemini-2.5-flash',
}))

beforeEach(() => {
  generateContentMock.mockReset()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { 'content-type': 'image/jpeg' },
  })))
})

describe('tagGarmentImage', () => {
  it('구조화된 태그를 돌려준다', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        category: 'top', color_name: '차콜', color_tone: '쿨', brightness: '어두움',
        pattern: '무지', style_keywords: ['미니멀'], formality: 3, season: ['봄'],
      }),
    })

    const { tagGarmentImage } = await import('@/lib/ai/tagger')
    const tags = await tagGarmentImage('https://example.com/shirt.jpg')

    expect(tags?.color_name).toBe('차콜')
    expect(generateContentMock).toHaveBeenCalledTimes(1)
  })

  it('Gemini 호출이 실패하면 예외를 던지지 않고 null을 돌려준다', async () => {
    generateContentMock.mockRejectedValue(new Error('quota exceeded'))

    const { tagGarmentImage } = await import('@/lib/ai/tagger')
    await expect(tagGarmentImage('https://example.com/shirt.jpg')).resolves.toBeNull()
  })

  it('응답이 JSON이 아니면 null을 돌려준다', async () => {
    generateContentMock.mockResolvedValue({ text: '이건 JSON이 아님' })

    const { tagGarmentImage } = await import('@/lib/ai/tagger')
    await expect(tagGarmentImage('https://example.com/shirt.jpg')).resolves.toBeNull()
  })
})
