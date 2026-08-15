import { NextResponse } from 'next/server'
import { z } from 'zod'
import { extractGoodsNo } from '@/lib/musinsa/url'
import { fetchProductHtml } from '@/lib/musinsa/fetcher'
import { parseProductHtml } from '@/lib/musinsa/parser'
import { readCache, writeCache } from '@/lib/musinsa/cache'
import { createServerSupabase } from '@/lib/supabase/server'
import { fail, type ParseResult } from '@/lib/musinsa/types'

export const maxDuration = 30

const RequestBody = z.object({ url: z.string().min(1) })

// 브라우저는 무신사에 직접 접근할 수 없다(CORS 차단) — 이 라우트가 유일한 경유지다.
export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = RequestBody.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const goodsNo = extractGoodsNo(body.data.url)
  if (!goodsNo) {
    return NextResponse.json({ error: '무신사 상품 링크가 아닙니다.' }, { status: 400 })
  }

  const cached = await readCache(goodsNo)
  if (cached) return NextResponse.json(cached)

  let result: ParseResult
  try {
    const html = await fetchProductHtml(body.data.url)
    result = parseProductHtml(html, goodsNo)
  } catch {
    // 페이지를 아예 못 가져온 경우에도 전 필드 실패 결과를 돌려준다.
    // 화면은 이 응답을 받아 수동 입력 폼으로 넘어가고, 사용자는 막히지 않는다.
    const reason = '무신사에서 상품 정보를 가져오지 못했습니다. 직접 입력해 주세요.'
    result = {
      goodsNo,
      fields: {
        name: fail(reason), brand: fail(reason), price: fail(reason),
        imageUrl: fail(reason), category: fail(reason),
        options: fail(reason), sizeTable: fail(reason),
      },
    }
    // 일시적 네트워크 장애를 24시간 캐시하면 안 되므로 이 경로에서는 캐시에 쓰지 않는다.
    return NextResponse.json(result)
  }

  await writeCache(goodsNo, result)
  return NextResponse.json(result)
}
