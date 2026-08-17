import type { Verdict } from '@/lib/verdict'
import { pillClass } from '@/components/ui/styles'

const VERDICT_LABELS: Record<Verdict, string> = { buy: '살만함', caution: '주의', skip: '비추천' }

// 판정 3색은 의미 전달용이라 "액센트 1개" 원칙의 명시적 예외다 — pillClass가 그 3색을 갖고 있다.
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <span className={`${pillClass(verdict)} font-medium`}>{VERDICT_LABELS[verdict]}</span>
}
