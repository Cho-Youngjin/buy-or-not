import { describe, it, expect } from 'vitest'
import { decideVerdict } from '@/lib/verdict'

describe('decideVerdict — 합계 기준', () => {
  it('fit_score와 match_penalty 합이 0이면 buy다', () => {
    expect(decideVerdict(0, false, 'ok')).toEqual({ verdict: 'buy', matchPenalty: 0 })
  })

  it('합이 1~4면 caution이다', () => {
    expect(decideVerdict(2, false, 'ok')).toEqual({ verdict: 'caution', matchPenalty: 0 })
    expect(decideVerdict(0, false, 'warn')).toEqual({ verdict: 'caution', matchPenalty: 2 })
    expect(decideVerdict(2, false, 'warn')).toEqual({ verdict: 'caution', matchPenalty: 2 })
  })

  it('합이 5 이상이면 skip이다', () => {
    expect(decideVerdict(3, false, 'warn')).toEqual({ verdict: 'skip', matchPenalty: 2 })
    expect(decideVerdict(1, false, 'bad')).toEqual({ verdict: 'skip', matchPenalty: 4 })
  })
})

describe('decideVerdict — 치명 위반', () => {
  it('fit_score가 0이어도 치명 위반이 있으면 무조건 skip이다', () => {
    expect(decideVerdict(0, true, 'ok')).toEqual({ verdict: 'skip', matchPenalty: 0 })
  })
})

describe('decideVerdict — Gemini 실패', () => {
  it('match_severity가 null이면(Gemini 호출 실패) match_penalty를 0으로 두고 fit_score만으로 판정한다', () => {
    expect(decideVerdict(0, false, null)).toEqual({ verdict: 'buy', matchPenalty: 0 })
    expect(decideVerdict(5, false, null)).toEqual({ verdict: 'skip', matchPenalty: 0 })
  })
})
