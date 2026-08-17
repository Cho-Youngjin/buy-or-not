type FieldDeviation = {
  key: string
  candidateValue: number
  excess: number
  score: number
  avoidanceSignal: boolean
}

type Feedback = {
  summary: string
  sizeFeedback: string
  matchFeedback: string
  priceFeedback: string
} | null

type Props = {
  status: 'ok' | 'low_confidence' | 'insufficient'
  fields: FieldDeviation[]
  feedback?: Feedback
}

// "총장이 깁니다" 옆에 근거 수치를 항상 같이 보여준다(스펙 §11) — AI 말만 믿게 만들지 않는다.
export function DeviationReport({ status, fields, feedback }: Props) {
  if (status === 'insufficient') {
    return (
      <p className="rounded-btn border border-border bg-canvas p-3 text-sm text-ink-muted">
        옷장에 같은 카테고리 데이터가 부족해 핏 판단은 어렵습니다.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {feedback ? (
        <div className="space-y-1 rounded-btn border border-border bg-canvas p-3 text-sm text-ink">
          <p className="font-medium">{feedback.summary}</p>
          <p>{feedback.sizeFeedback}</p>
          <p>{feedback.matchFeedback}</p>
          <p>{feedback.priceFeedback}</p>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">AI 코멘트를 만들지 못했습니다. 아래 실측 비교로 판단해주세요.</p>
      )}
      {status === 'low_confidence' && (
        <p className="text-xs text-accent">
          선호도(별점·착용빈도)를 남긴 옷이 없어 카테고리 전체 평균으로 비교했습니다 — 신뢰도가 낮습니다.
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-muted">
            <th className="py-1 font-normal">항목</th>
            <th className="py-1 text-right font-normal">실측값</th>
            <th className="py-1 text-right font-normal">편차</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.key} className="border-t border-border">
              <td className="py-2">
                {f.key}
                {f.avoidanceSignal && <span className="ml-1 text-xs text-danger">(과거 실패 이력)</span>}
              </td>
              <td className="py-2 text-right font-mono">{f.candidateValue}cm</td>
              <td className={`py-2 text-right font-mono ${f.score > 0 ? 'text-danger' : 'text-ink-muted'}`}>
                {f.excess === 0 ? '적합' : `${f.excess.toFixed(1)}cm 초과`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
