'use client'

import { useState } from 'react'
import { GarmentForm } from '@/components/garment/GarmentForm'
import { VerdictBadge } from '@/components/analyze/VerdictBadge'
import { DeviationReport } from '@/components/analyze/DeviationReport'
import { useMusinsaParse } from '@/components/garment/useMusinsaParse'
import { MusinsaLinkInput } from '@/components/garment/MusinsaLinkInput'
import { createManualParseResult } from '@/lib/musinsa/manualParseResult'
import { CARD_SURFACE } from '@/components/ui/styles'
import type { ParseResult } from '@/lib/musinsa/types'
import type { Verdict } from '@/lib/verdict'

type AnalyzeResult = {
  verdict: Verdict
  fitScore: number
  report: { status: 'ok' | 'low_confidence' | 'insufficient'; fields: unknown[] }
  feedback: { summary: string; sizeFeedback: string; matchFeedback: string; priceFeedback: string } | null
}

export function AnalyzeLinkBar() {
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  // 새 링크를 파싱하기 시작하면 이전 판단 결과를 지운다 — 기존 handleSubmit의 setResult(null)와 같은 역할.
  const parse = useMusinsaParse({ onStart: () => setResult(null) })
  const [manualParsed, setManualParsed] = useState<ParseResult | null>(null)

  return (
    <div className="space-y-4">
      {!manualParsed && !result && (
        <>
          <MusinsaLinkInput {...parse} placeholder="구매를 고민 중인 무신사 상품 링크를 붙여넣으세요" />

          <button
            type="button"
            onClick={() => setManualParsed(createManualParseResult())}
            className="text-sm text-ink-muted underline"
          >
            무신사 링크가 없나요? 직접 등록하기
          </button>
        </>
      )}

      {parse.parsed && !manualParsed && !result && (
        <GarmentForm
          parsed={parse.parsed}
          sourceUrl={parse.url}
          submitEndpoint="/api/analyze"
          submitLabel="판단하기"
          onCancel={parse.reset}
          onSubmitted={(data) => setResult(data as AnalyzeResult)}
        />
      )}

      {manualParsed && !result && (
        <GarmentForm
          parsed={manualParsed}
          sourceUrl={null}
          submitEndpoint="/api/analyze"
          submitLabel="판단하기"
          onCancel={() => setManualParsed(null)}
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
