import { MATCH_PENALTY, VERDICT_CAUTION_MAX } from '@/lib/fit/rules'

export type Verdict = 'buy' | 'caution' | 'skip'
export type MatchSeverity = 'ok' | 'warn' | 'bad'

/**
 * fit_score(코드가 계산한 실측 편차 점수)와 match_severity(Gemini가 판단한 스타일 매칭)를
 * 합산해 최종 판정을 낸다. Gemini는 verdict를 직접 출력하지 않는다 — 여기서만 계산한다(스펙 §9-10).
 * match_severity가 null이면 Gemini 호출이 실패했다는 뜻이고, match_penalty를 0으로 두어
 * fit_score만으로 판정한다(스펙 §12 에러 처리) — Gemini가 죽어도 앱은 반쯤 살아 있다.
 */
export function decideVerdict(
  fitScore: number,
  hasFatalViolation: boolean,
  matchSeverity: MatchSeverity | null,
): { verdict: Verdict; matchPenalty: number } {
  const matchPenalty = matchSeverity == null ? 0 : MATCH_PENALTY[matchSeverity]

  if (hasFatalViolation) return { verdict: 'skip', matchPenalty }

  const total = fitScore + matchPenalty
  if (total === 0) return { verdict: 'buy', matchPenalty }
  if (total <= VERDICT_CAUTION_MAX) return { verdict: 'caution', matchPenalty }
  return { verdict: 'skip', matchPenalty }
}
