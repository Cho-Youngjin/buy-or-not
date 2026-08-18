import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateContentMock = vi.fn()

vi.mock('@/lib/gemini/client', () => ({
  getGeminiClient: () => ({ models: { generateContent: generateContentMock } }),
  GEMINI_MODEL: 'gemini-3.5-flash',
}))

beforeEach(() => generateContentMock.mockReset())

const baseInput = {
  candidateTags: null,
  wardrobeTagsSummary: [],
  deviationSummary: [{ key: '총장', excess: 4, severity: 'medium' as const }],
  candidatePrice: 39000,
  avgPrice: 30000,
  fitScore: 2,
  hasFatalViolation: false,
}

function textOfLastCall(): string {
  const args = generateContentMock.mock.calls.at(-1)?.[0]
  return args.contents[0].parts[0].text as string
}

describe('getMatchAdvice', () => {
  it('구조화된 조언을 돌려준다', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        match_severity: 'warn',
        size_feedback: '총장이 평소보다 깁니다.',
        match_feedback: '무난하게 매칭됩니다.',
        price_feedback: '평균보다 9천원 비쌉니다.',
        summary: '핏은 다소 크지만 매칭은 괜찮습니다.',
      }),
    })

    const { getMatchAdvice } = await import('@/lib/ai/advisor')
    const advice = await getMatchAdvice(baseInput)

    expect(advice?.matchSeverity).toBe('warn')
    expect(advice?.summary).toContain('매칭')
  })

  it('한 번 실패하면 재시도하고, 재시도까지 실패하면 null을 돌려준다', async () => {
    // mockRejectedValue(범용 재사용)나 mockImplementation은 이 vi.mock + 정적 import
    // 조합에서 vitest의 mock 계측과 충돌해 실제로는 잡히는 예외를 unhandled rejection으로
    // 오탐지한다(재현 확인됨) — 호출 횟수만큼 mockRejectedValueOnce를 체이닝해 피해간다.
    generateContentMock
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))

    const { getMatchAdvice } = await import('@/lib/ai/advisor')
    await expect(getMatchAdvice(baseInput)).resolves.toBeNull()
    expect(generateContentMock).toHaveBeenCalledTimes(2)
  })

  it('match_severity가 ok/warn/bad가 아니면 null을 돌려준다', async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ match_severity: '보통' }) })

    const { getMatchAdvice } = await import('@/lib/ai/advisor')
    await expect(getMatchAdvice(baseInput)).resolves.toBeNull()
  })

  it('치명 위반이면 summary를 신중하게 쓰라는 지시를 프롬프트에 넣는다', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        match_severity: 'bad', size_feedback: '', match_feedback: '', price_feedback: '', summary: '',
      }),
    })

    const { getMatchAdvice } = await import('@/lib/ai/advisor')
    await getMatchAdvice({ ...baseInput, hasFatalViolation: true })

    expect(textOfLastCall()).toContain('비추천(skip) 판정이 확정적')
  })

  it('fitScore가 caution 상한을 넘으면(치명 위반이 아니어도) 같은 지시를 넣는다', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        match_severity: 'ok', size_feedback: '', match_feedback: '', price_feedback: '', summary: '',
      }),
    })

    const { getMatchAdvice } = await import('@/lib/ai/advisor')
    // VERDICT_CAUTION_MAX(4)를 넘으면 match_severity가 'ok'(패널티 0)여도 total>4라 skip이 확정된다.
    await getMatchAdvice({ ...baseInput, fitScore: 5, hasFatalViolation: false })

    expect(textOfLastCall()).toContain('비추천(skip) 판정이 확정적')
  })

  it('실측 편차가 감내할 만하면 신중 지시를 넣지 않는다', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        match_severity: 'ok', size_feedback: '', match_feedback: '', price_feedback: '', summary: '',
      }),
    })

    const { getMatchAdvice } = await import('@/lib/ai/advisor')
    await getMatchAdvice({ ...baseInput, fitScore: 2, hasFatalViolation: false })

    expect(textOfLastCall()).not.toContain('비추천(skip) 판정이 확정적')
  })
})
