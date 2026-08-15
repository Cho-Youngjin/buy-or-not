import { Type } from '@google/genai'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini/client'
import type { AiTags } from '@/lib/ai/tagger'
import type { MatchSeverity } from '@/lib/verdict'

export type AdviceInput = {
  candidateTags: AiTags | null
  wardrobeTagsSummary: AiTags[]
  deviationSummary: { key: string; excess: number; severity: string }[]
  candidatePrice: number | null
  avgPrice: number | null
}

export type AdviceResult = {
  matchSeverity: MatchSeverity
  sizeFeedback: string
  matchFeedback: string
  priceFeedback: string
  summary: string
}

const ADVICE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    match_severity: { type: Type.STRING, enum: ['ok', 'warn', 'bad'] },
    size_feedback: { type: Type.STRING },
    match_feedback: { type: Type.STRING },
    price_feedback: { type: Type.STRING },
    summary: { type: Type.STRING },
  },
  required: ['match_severity', 'size_feedback', 'match_feedback', 'price_feedback', 'summary'],
}

function buildPrompt(input: AdviceInput): string {
  return [
    '아래는 이미 계산된 실측 편차 리포트와 스타일 태그다.',
    '숫자를 다시 계산하거나 반박하지 말고, 주어진 값을 한국어로 자연스럽게 설명해라.',
    `후보 옷 태그: ${JSON.stringify(input.candidateTags)}`,
    `옷장 태그 요약: ${JSON.stringify(input.wardrobeTagsSummary)}`,
    `실측 편차 리포트: ${JSON.stringify(input.deviationSummary)}`,
    `후보 가격: ${input.candidatePrice ?? '알 수 없음'}, 옷장 같은 카테고리 평균가: ${input.avgPrice ?? '알 수 없음'}`,
    'match_severity는 스타일·색상 조화가 얼마나 잘 맞는지를 ok/warn/bad 3단계로만 판단해라.',
  ].join('\n')
}

async function callOnce(input: AdviceInput): Promise<AdviceResult | null> {
  const client = getGeminiClient()
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
    config: { responseMimeType: 'application/json', responseSchema: ADVICE_SCHEMA },
  })

  const parsed: unknown = JSON.parse(response.text ?? '')
  if (!isAdviceJson(parsed)) return null

  return {
    matchSeverity: parsed.match_severity,
    sizeFeedback: parsed.size_feedback,
    matchFeedback: parsed.match_feedback,
    priceFeedback: parsed.price_feedback,
    summary: parsed.summary,
  }
}

type AdviceJson = {
  match_severity: MatchSeverity
  size_feedback: string
  match_feedback: string
  price_feedback: string
  summary: string
}

function isAdviceJson(value: unknown): value is AdviceJson {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (v.match_severity === 'ok' || v.match_severity === 'warn' || v.match_severity === 'bad') &&
    typeof v.size_feedback === 'string' &&
    typeof v.match_feedback === 'string' &&
    typeof v.price_feedback === 'string' &&
    typeof v.summary === 'string'
  )
}

/**
 * 편차 리포트 + 태그 비교 → 매칭 심각도 + 피드백 문장(스펙 §10-2).
 * Gemini가 verdict를 직접 내지 않는다 — matchSeverity만 돌려주고, 최종 판정은
 * 항상 lib/verdict.ts가 코드로 계산한다. 실패 시 1회 재시도, 그래도 실패하면 null —
 * 호출부(app/api/analyze/route.ts)가 null을 "AI 코멘트를 만들지 못했습니다"로 처리한다.
 */
export async function getMatchAdvice(input: AdviceInput): Promise<AdviceResult | null> {
  try {
    return await callOnce(input)
  } catch {
    try {
      return await callOnce(input)
    } catch {
      return null
    }
  }
}
