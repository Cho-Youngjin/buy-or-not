import { Type } from '@google/genai'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini/client'
import { VERDICT_CAUTION_MAX } from '@/lib/fit/rules'
import type { AiTags } from '@/lib/ai/tagger'
import type { MatchSeverity } from '@/lib/verdict'

export type AdviceInput = {
  candidateTags: AiTags | null
  wardrobeTagsSummary: AiTags[]
  deviationSummary: { key: string; excess: number; severity: string }[]
  candidatePrice: number | null
  avgPrice: number | null
  /** lib/verdict.ts에 넘기는 값과 같아야 한다 — Gemini 호출 전에 app/api/analyze/route.ts가 이미 계산해둔 값. */
  fitScore: number
  hasFatalViolation: boolean
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
  // fitScore는 match_severity(Gemini가 매기는 값, 최소 패널티 0)와 합산되기 전 값이라, 이 값만으로도
  // 이미 caution 상한을 넘는다면 스타일이 아무리 좋아도 최종 판정은 skip으로 확정된다(lib/verdict.ts
  // decideVerdict 참고). Gemini가 이 사실을 모른 채 summary를 낙관적으로 시작하는 걸 막으려고
  // 이미 계산된 이 신호를 프롬프트에 그대로 알려준다 — Gemini가 판정을 내리는 게 아니라,
  // 이미 난 판정과 글의 톤이 모순되지 않게 하는 것뿐이다.
  const likelySkip = input.hasFatalViolation || input.fitScore > VERDICT_CAUTION_MAX

  return [
    '너는 데이터 기반으로 냉정하고 실용적으로 조언하는 온라인 패션 커머스의 시니어 스타일리스트다. 근거 없는 칭찬은 하지 않는다.',
    '아래는 이미 계산된 실측 편차 리포트와 스타일 태그다. 숫자를 다시 계산하거나 반박하지 말고, 주어진 값만 근거로 삼아라.',
    `후보 옷 태그: ${JSON.stringify(input.candidateTags)}`,
    `옷장 태그 요약: ${JSON.stringify(input.wardrobeTagsSummary)}`,
    `실측 편차 리포트: ${JSON.stringify(input.deviationSummary)}`,
    `후보 가격: ${input.candidatePrice ?? '알 수 없음'}, 옷장 같은 카테고리 평균가: ${input.avgPrice ?? '알 수 없음'}`,
    '아래 필드는 서로 근거를 섞지 말고 각자 지정된 정보만 써라:',
    '- match_severity: 태그 비교(스타일·색상)만 근거로 ok/warn/bad 3단계 중 하나.',
    '- size_feedback: 실측 편차 리포트만 근거로, 편차가 큰 항목부터 우선해서 설명.',
    '- match_feedback: 태그 비교만 근거로, 스타일·색상 조화를 설명.',
    '- price_feedback: 가격 비교만 근거로 설명.',
    likelySkip
      ? '- summary: 실측 편차만으로 이미 비추천(skip) 판정이 확정적이다(스타일·가격이 아무리 좋아도 바뀌지 않는다). 이 사실을 첫 문장에서 분명히 언급하고 신중한 톤으로 써라. 스타일·가격 장점이 있어도 "그럼에도 불구하고" 식으로 뒤에 부차적으로만 붙이고, "완벽하게 어울린다"·"훌륭하다" 같은 무조건적 칭찬으로 시작하지 마라.'
      : '- summary: 실측 편차는 감내할 만한 수준이다. size_feedback·match_feedback·price_feedback을 종합해 자연스럽게 정리해라.',
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
