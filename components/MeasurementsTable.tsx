import { CARD_SURFACE } from '@/components/ui/styles'

type Props = {
  measurements: { key: string; value: number }[]
}

export function MeasurementsTable({ measurements }: Props) {
  if (measurements.length === 0) {
    return <p className="text-sm text-ink-muted">등록된 실측 정보가 없습니다.</p>
  }

  return (
    <table className={`${CARD_SURFACE} w-full overflow-hidden text-sm`}>
      <tbody>
        {measurements.map((m) => (
          <tr key={m.key} className="border-b border-border last:border-0">
            <td className="px-4 py-2 text-ink-muted">{m.key}</td>
            {/* 수치는 자릿수가 세로로 맞도록 mono로 둔다. */}
            <td className="px-4 py-2 text-right font-mono text-ink">{m.value}cm</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
