import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from '@phosphor-icons/react/ssr'
import { createServerSupabase } from '@/lib/supabase/server'
import { CATEGORY_LABELS, type Category } from '@/lib/types'
import type { DeviationReport as DeviationReportData } from '@/lib/fit/engine'
import type { Verdict } from '@/lib/verdict'
import { VerdictBadge } from '@/components/analyze/VerdictBadge'
import { DeviationReport } from '@/components/analyze/DeviationReport'
import { CARD_SURFACE } from '@/components/ui/styles'

type Props = { params: Promise<{ id: string }> }

type GarmentHeader = {
  id: string
  name: string
  brand: string | null
  category: Category
}

type AnalysisRow = {
  verdict: Verdict
  report: DeviationReportData
  feedback: unknown
  created_at: string
}

type FeedbackData = { summary: string; sizeFeedback: string; matchFeedback: string; priceFeedback: string }

// analyses.feedback은 두 모양 중 하나다: 제미나이 코멘트 성공(summary 등 4개 필드) 또는
// 실패 폴백({note: "..."}, app/api/analyze/route.ts:113). summary 유무로 구분해서,
// 폴백 모양이면 null로 바꿔 DeviationReport가 "AI 코멘트를 만들지 못했습니다"를 보여주게 한다.
function asFeedback(value: unknown): FeedbackData | null {
  if (value && typeof value === 'object' && 'summary' in value && 'sizeFeedback' in value) {
    return value as FeedbackData
  }
  return null
}

export default async function CartReportPage({ params }: Props) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { id } = await params

  const { data: garment } = await supabase
    .from('garments')
    .select('id, name, brand, category')
    .eq('id', id)
    .single<GarmentHeader>()

  // RLS(garments_select)가 남의 옷이면 이미 null을 돌려준다 — 별도 소유자 검사가 필요 없다.
  if (!garment) notFound()

  const { data: analysisRows } = await supabase
    .from('analyses')
    .select('verdict, report, feedback, created_at')
    .eq('garment_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .overrideTypes<AnalysisRow[], { merge: false }>()

  const analysis = analysisRows?.[0] ?? null

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Link href="/cart" className="inline-flex items-center gap-1 text-sm text-ink-muted transition hover:text-ink">
        <ArrowLeft size={16} />
        장바구니로
      </Link>

      <div>
        <p className="text-sm text-ink-muted">{garment.brand ?? CATEGORY_LABELS[garment.category]}</p>
        <h1 className="text-xl font-medium tracking-tight text-ink">{garment.name}</h1>
      </div>

      {analysis ? (
        <div className={`${CARD_SURFACE} space-y-3 p-5`}>
          <VerdictBadge verdict={analysis.verdict} />
          <DeviationReport
            status={analysis.report.status}
            fields={analysis.report.fields}
            feedback={asFeedback(analysis.feedback)}
          />
        </div>
      ) : (
        <p className="rounded-card border border-dashed border-border p-10 text-center text-sm text-ink-muted">
          판단 리포트가 아직 없습니다.
        </p>
      )}
    </main>
  )
}
