import type { Verdict } from '@/lib/verdict'

const VERDICT_LABELS: Record<Verdict, string> = { buy: '살만함', caution: '주의', skip: '비추천' }
const VERDICT_STYLES: Record<Verdict, string> = {
  buy: 'bg-green-100 text-green-800',
  caution: 'bg-amber-100 text-amber-800',
  skip: 'bg-red-100 text-red-800',
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`inline-block rounded-full px-4 py-1 text-sm font-semibold ${VERDICT_STYLES[verdict]}`}>
      {VERDICT_LABELS[verdict]}
    </span>
  )
}
