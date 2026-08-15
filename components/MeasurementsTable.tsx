type Props = {
  measurements: { key: string; value: number }[]
}

export function MeasurementsTable({ measurements }: Props) {
  if (measurements.length === 0) {
    return <p className="text-sm text-gray-500">등록된 실측 정보가 없습니다.</p>
  }

  return (
    <table className="w-full text-sm">
      <tbody>
        {measurements.map((m) => (
          <tr key={m.key} className="border-b last:border-0">
            <td className="py-2 text-gray-600">{m.key}</td>
            <td className="py-2 text-right font-medium">{m.value}cm</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
