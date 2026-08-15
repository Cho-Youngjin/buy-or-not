import { Type } from '@google/genai'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini/client'

export type AiTags = {
  category: string
  color_name: string
  color_tone: string
  brightness: string
  pattern: string
  style_keywords: string[]
  formality: number
  season: string[]
}

// responseSchema는 표준 JSON Schema가 아니라 Gemini 고유 포맷이다 — type 값은
// 소문자 'object'가 아니라 Type.OBJECT 같은 대문자 상수여야 런타임에서 실제로 적용된다.
const TAG_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING },
    color_name: { type: Type.STRING },
    color_tone: { type: Type.STRING },
    brightness: { type: Type.STRING },
    pattern: { type: Type.STRING },
    style_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    formality: { type: Type.INTEGER },
    season: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['category', 'color_name', 'color_tone', 'brightness', 'pattern', 'style_keywords', 'formality', 'season'],
}

/**
 * 옷이 garments에 들어올 때 딱 한 번 이미지를 보내 스타일 태그를 받는다(스펙 §10-1).
 * 구매 판단 시점에는 이 저장된 태그만 재사용하고 이미지를 다시 보내지 않는다 —
 * 옷장이 30벌이어도 판단 1회에 이미지 전송은 0장이어야 한다.
 * 실패해도 등록 자체를 막지 않으므로 예외 대신 null을 돌려준다(스펙 §12).
 */
export async function tagGarmentImage(imageUrl: string): Promise<AiTags | null> {
  try {
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) return null
    const contentType = imageResponse.headers.get('content-type') ?? 'image/jpeg'
    const imageBytes = Buffer.from(await imageResponse.arrayBuffer()).toString('base64')

    const client = getGeminiClient()
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: '이 의류 상품 이미지를 분석해서 스타일 태그를 매겨줘.' },
            { inlineData: { mimeType: contentType, data: imageBytes } },
          ],
        },
      ],
      config: { responseMimeType: 'application/json', responseSchema: TAG_SCHEMA },
    })

    const parsed: unknown = JSON.parse(response.text ?? '')
    if (!isAiTags(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

function isAiTags(value: unknown): value is AiTags {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.category === 'string' &&
    typeof v.color_name === 'string' &&
    Array.isArray(v.style_keywords)
  )
}
