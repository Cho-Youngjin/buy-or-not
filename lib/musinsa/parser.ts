import * as cheerio from 'cheerio'
import type { Category } from '@/lib/types'
import { ok, fail, type FieldResult, type ParseResult } from '@/lib/musinsa/types'

type DetailData = {
  goodsNm?: string
  brand?: string
  brandInfo?: { brandName?: string }
  goodsPrice?: { salePrice?: number }
  thumbnailImageUrl?: string
  category?: { categoryDepth1Name?: string }
}

/**
 * 무신사 대분류 이름 → 표준 카테고리.
 * '상의'·'바지'·'아우터'는 Phase 0에서 실제 상품으로 확인됨.
 * '신발'·'가방'·'패션잡화'는 확인되지 않은 추정값 — Task 5 실행 시 실제 상품으로 검증한다.
 */
const MUSINSA_CATEGORY_MAP: Record<string, Category> = {
  상의: 'top',
  바지: 'bottom',
  아우터: 'outer',
  신발: 'shoes',
  가방: 'acc',
  패션잡화: 'acc',
}

export function parseProductHtml(html: string, goodsNo: string): ParseResult {
  const detail = readDetailData(html)

  return {
    goodsNo,
    fields: {
      name: extractName(detail),
      brand: extractBrand(detail),
      price: extractPrice(detail),
      imageUrl: extractImage(detail),
      category: extractCategory(detail),
      // Phase 0 조사 결과 둘 다 정적 파싱 경로가 없다 — 시도하지 않는다.
      options: fail('색상·사이즈 옵션은 자동으로 가져오지 않습니다'),
      sizeTable: fail('실측표는 자동으로 가져오지 않습니다 — 붙여넣기로 채워주세요'),
    },
  }
}

function readDetailData(html: string): DetailData | null {
  const $ = cheerio.load(html)
  const raw = $('script#__NEXT_DATA__').contents().text()
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null // 깨진 __NEXT_DATA__는 조용히 건너뛴다
  }

  const queries = (parsed as Record<string, any>)?.props?.pageProps?.dehydratedState?.queries
  if (!Array.isArray(queries)) return null

  const detailQuery = queries.find(
    (q) => Array.isArray(q?.queryKey) && q.queryKey[0] === 'Detail' && typeof q.queryKey[1] === 'number',
  )
  return detailQuery?.state?.data?.data ?? null
}

function extractName(detail: DetailData | null): FieldResult<string> {
  const name = detail?.goodsNm?.trim()
  return name ? ok(name) : fail('상품명을 찾지 못했습니다')
}

function extractBrand(detail: DetailData | null): FieldResult<string> {
  // 한글 표시명(brandInfo.brandName)을 우선한다 — brand는 내부 브랜드 코드(예: 'nmx')다.
  const brand = detail?.brandInfo?.brandName?.trim() || detail?.brand?.trim()
  return brand ? ok(brand) : fail('브랜드를 찾지 못했습니다')
}

function extractPrice(detail: DetailData | null): FieldResult<number> {
  const price = detail?.goodsPrice?.salePrice
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return fail('가격을 찾지 못했습니다')
  }
  return ok(Math.round(price))
}

function extractImage(detail: DetailData | null): FieldResult<string> {
  const path = detail?.thumbnailImageUrl?.trim()
  if (!path) return fail('상품 이미지를 찾지 못했습니다')
  const absolute = path.startsWith('http') ? path : `https://image.msscdn.net${path}`
  return ok(absolute)
}

function extractCategory(detail: DetailData | null): FieldResult<Category> {
  const depth1 = detail?.category?.categoryDepth1Name?.trim()
  if (!depth1) return fail('카테고리를 찾지 못했습니다')
  const category = MUSINSA_CATEGORY_MAP[depth1]
  return category ? ok(category) : fail(`알 수 없는 카테고리: ${depth1}`)
}
