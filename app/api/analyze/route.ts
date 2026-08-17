import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import { registerGarment } from '@/lib/garments/register'
import { fetchPreferenceProfile } from '@/lib/fit/profile'
import { scoreDeviation } from '@/lib/fit/engine'
import { decideVerdict } from '@/lib/verdict'
import { getMatchAdvice } from '@/lib/ai/advisor'
import { GEMINI_MODEL } from '@/lib/gemini/client'
import type { AiTags } from '@/lib/ai/tagger'

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

  // 사용자가 마이페이지에서 정한 허용오차 배율. numeric 컬럼은 PostgREST가 문자열로 돌려주므로
  // Number()로 감싼다(garment_measurements.value를 다루는 기존 코드와 같은 이유).
  // 선호 범위를 만드는 쪽과 편차를 재는 쪽에 반드시 같은 값을 넘겨야 한다(lib/fit/engine.ts 주석 참고).
  const { data: settings } = await supabase
    .from('profiles')
    .select('fit_strictness')
    .eq('id', user.id)
    .single()
  const strictness = Number(settings?.fit_strictness ?? 1)

  const profile = await fetchPreferenceProfile(supabase, user.id, input.category, strictness)
  const report = scoreDeviation(input.measurements, profile, input.category, strictness)

  // 태깅은 registerGarment(등록 파이프라인)이 이미 끝냈다 — 여기서는 저장된 태그만 읽는다.
  // 이미지를 다시 보내지 않으므로 옷장이 몇 벌이든 판단 1회에 이미지 전송은 0장이다(스펙 §10-1).
  const { data: candidateGarment } = await supabase
    .from('garments')
    .select('ai_tags, price')
    .eq('id', garmentId)
    .single()

  const { data: wardrobeGarments } = await supabase
    .from('garments')
    .select('ai_tags')
    .eq('owner_id', user.id)
    .eq('status', 'owned')
    .eq('category', input.category)
    .not('ai_tags', 'is', null)

  const advice = await getMatchAdvice({
    candidateTags: (candidateGarment?.ai_tags ?? null) as AiTags | null,
    wardrobeTagsSummary: (wardrobeGarments ?? []).map((g) => g.ai_tags) as AiTags[],
    deviationSummary: report.fields.map((f) => ({ key: f.key, excess: f.excess, severity: f.severity })),
    candidatePrice: candidateGarment?.price ?? null,
    avgPrice: profile.avgPrice,
  })

  // advice가 null이면(Gemini 호출·재시도 모두 실패) match_penalty=0으로 fit_score만으로
  // 판정한다 — Gemini가 죽어도 앱은 반쯤 살아 있다(스펙 §12).
  const { verdict, matchPenalty } = decideVerdict(
    report.fitScore,
    report.hasFatalViolation,
    advice?.matchSeverity ?? null,
  )

  const { data: analysis, error: analysisError } = await supabase
    .from('analyses')
    .insert({
      garment_id: garmentId,
      requester_id: user.id,
      verdict,
      fit_score: report.fitScore + matchPenalty,
      report,
      feedback: advice ?? { note: 'AI 코멘트를 만들지 못했습니다.' },
      model: advice ? GEMINI_MODEL : null,
      prompt_snapshot: advice ? { deviationSummary: report.fields, candidateTags: candidateGarment?.ai_tags } : null,
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
    feedback: advice,
  })
}
