import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import { copyImageToStorage } from '@/lib/storage'
import { mergeSizeTableIntoCache } from '@/lib/musinsa/cache'
import { AUTO_PARSED_FIELDS } from '@/lib/musinsa/types'
import type { ParseMode } from '@/lib/types'

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

/**
 * options·sizeTable은 제외한다 — 항상 실패가 정상인 필드라 포함시키면
 * 모든 옷이 영원히 'manual'로 찍힌다 (스펙 §7, Task 5의 AUTO_PARSED_FIELDS 참고).
 */
function computeParseMode(manualFields: readonly string[]): ParseMode {
  const autoFieldSet: readonly string[] = AUTO_PARSED_FIELDS
  const failedAutoFields = manualFields.filter((field) => autoFieldSet.includes(field))
  if (failedAutoFields.length === 0) return 'auto'
  if (failedAutoFields.length >= AUTO_PARSED_FIELDS.length) return 'manual'
  return 'partial'
}

// RLS가 붙은 세션 클라이언트(supabase)로 insert하므로 owner_id 위장이 불가능하다 —
// garments_insert 정책이 owner_id = auth.uid()를 강제한다(supabase/migrations/0002_rls.sql).
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

  const storedImageUrl = input.imageUrl
    ? await copyImageToStorage(input.imageUrl, input.goodsNo, input.colorOption)
    : null

  // 같은 상품·색상·사이즈가 이미 있어도 등록은 막지 않는다(같은 옷을 두 벌 살 수 있다) — 응답에 경고만 얹는다.
  const { count: duplicateCount } = await supabase
    .from('garments')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .eq('goods_no', input.goodsNo)
    .eq('color_option', input.colorOption)
    .eq('size_option', input.sizeOption)

  const { data: garment, error: insertError } = await supabase
    .from('garments')
    .insert({
      owner_id: user.id,
      status: 'owned',
      source_url: input.sourceUrl,
      goods_no: input.goodsNo,
      brand: input.brand,
      name: input.name,
      price: input.price,
      image_url: storedImageUrl ?? input.imageUrl,
      category: input.category,
      color_option: input.colorOption,
      size_option: input.sizeOption,
      parse_mode: computeParseMode(input.manualFields),
    })
    .select('id')
    .single()

  if (insertError || !garment) {
    return NextResponse.json({ error: '옷장에 저장하지 못했습니다.' }, { status: 500 })
  }

  const rows = Object.entries(input.measurements).map(([key, value]) => ({
    garment_id: garment.id,
    key,
    value,
  }))

  if (rows.length > 0) {
    const { error: measurementError } = await supabase.from('garment_measurements').insert(rows)
    if (measurementError) {
      // 실측만 실패한 경우 옷 자체는 남기고 알린다. 상세 화면에서 나중에 채울 수 있다.
      return NextResponse.json(
        { id: garment.id, warning: '실측 정보를 저장하지 못했습니다.' },
        { status: 207 },
      )
    }
  }

  if (input.fullSizeTable) {
    // 다음 사용자를 위한 최적화일 뿐이므로 실패해도 등록 자체는 막지 않는다.
    try {
      await mergeSizeTableIntoCache(input.goodsNo, input.fullSizeTable)
    } catch {
      // 무시 — 캐시는 다음 파싱 시도에서 다시 채워진다.
    }
  }

  return NextResponse.json(
    {
      id: garment.id,
      ...(duplicateCount && duplicateCount > 0
        ? { warning: '이미 옷장에 같은 상품·색상·사이즈가 있습니다.' }
        : {}),
    },
    { status: 201 },
  )
}
