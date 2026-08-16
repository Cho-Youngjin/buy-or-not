'use client'

import { useState } from 'react'
import type { ParseResult } from '@/lib/musinsa/types'
import { GarmentForm } from '@/components/GarmentForm'
import { VerdictBadge } from '@/components/VerdictBadge'
import { DeviationReport } from '@/components/DeviationReport'
import { Button } from '@/components/ui/Button'
import { INPUT, CARD_SURFACE } from '@/components/ui/styles'
import type { Verdict } from '@/lib/verdict'

type AnalyzeResult = {
  verdict: Verdict
  fitScore: number
  report: { status: 'ok' | 'low_confidence' | 'insufficient'; fields: unknown[] }
  feedback: { summary: string; sizeFeedback: string; matchFeedback: string; priceFeedback: string } | null
}

export function AnalyzeLinkBar() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [result, setResult] = useState<AnalyzeResult | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setParsed(null)
    setResult(null)

    const response = await fetch('/api/musinsa/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(data.error ?? '상품 정보를 가져오지 못했습니다.')
      return
    }
    setParsed(data as ParseResult)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="구매를 고민 중인 무신사 상품 링크를 붙여넣으세요"
          className={`${INPUT} flex-1`}
        />
        <Button type="submit" disabled={loading || url.trim().length === 0}>
          {loading ? '불러오는 중…' : '불러오기'}
        </Button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {parsed && !result && (
        <GarmentForm
          parsed={parsed}
          sourceUrl={url}
          submitEndpoint="/api/analyze"
          submitLabel="판단하기"
          onSubmitted={(data) => setResult(data as AnalyzeResult)}
        />
      )}

      {result && (
        <div className={`${CARD_SURFACE} space-y-3 p-5`}>
          <VerdictBadge verdict={result.verdict} />
          <DeviationReport status={result.report.status} fields={result.report.fields as never} feedback={result.feedback} />
        </div>
      )}
    </div>
  )
}
