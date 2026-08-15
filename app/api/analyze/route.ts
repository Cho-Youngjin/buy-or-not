import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import { registerGarment } from '@/lib/garments/register'
import { fetchPreferenceProfile } from '@/lib/fit/profile'
import { scoreDeviation } from '@/lib/fit/engine'
import { decideVerdict } from '@/lib/verdict'

export const maxDuration = 30

const Body = z.object({
  goodsNo: z.string(),
  sourceUrl: z.string(),
  name: z.string().min(1),
  brand: z.string().nullable(),
  price: z.number().int().nonnegative().nullable(),
  imageUrl: z.string().nullable(),
  category: z.enum(['top', 'bottom', 'outer', 'shoes', 'acc']),
  colorOption: z.string(),
  sizeOption: z.string(),
  measurements: z.record(z.string(), z.number()),
  fullSizeTable: z.record(z.string(), z.record(z.string(), z.number())).nullable(),
  manualFields: z.array(z.string()),
})

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }
  const input = parsed.data

  let garmentId: string
  try {
    ;({ id: garmentId } = await registerGarment(supabase, user.id, 'considering', input))
  } catch {
    return NextResponse.json({ error: '옷 정보를 저장하지 못했습니다.' }, { status: 500 })
  }

  const profile = await fetchPreferenceProfile(supabase, user.id, input.category)
  const report = scoreDeviation(input.measurements, profile, input.category)

  // 계획 2 Task 11에서 Gemini의 matchSeverity로 채워진다. 지금은 null → match_penalty=0,
  // fit_score만으로 판정한다(스펙 §12 "Gemini 호출 실패" 폴백과 같은 경로).
  const { verdict, matchPenalty } = decideVerdict(report.fitScore, report.hasFatalViolation, null)

  const { data: analysis, error: analysisError } = await supabase
    .from('analyses')
    .insert({
      garment_id: garmentId,
      requester_id: user.id,
      verdict,
      fit_score: report.fitScore + matchPenalty,
      report,
    })
    .select('id')
    .single()

  if (analysisError || !analysis) {
    return NextResponse.json({ error: '판단 결과를 저장하지 못했습니다.' }, { status: 500 })
  }

  return NextResponse.json({
    analysisId: analysis.id,
    garmentId,
    verdict,
    fitScore: report.fitScore + matchPenalty,
    report,
  })
}
