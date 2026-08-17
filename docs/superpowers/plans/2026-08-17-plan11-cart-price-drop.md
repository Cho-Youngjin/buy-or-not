# 장바구니 가격 인하 표시 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** 장바구니(`status='considering'`) 상품 중 무신사 링크로 등록된 것의 가격이 떨어지면 "원래 얼마 → 지금 얼마"를 보여준다. `/cart`를 방문할 때마다 7일 이상 확인 안 한 상품의 가격만 백그라운드로 다시 확인한다.

**Architecture:** `garments`에 `last_known_price`·`price_checked_at` 두 컬럼을 더한다. 새 API `POST /api/cart/refresh-prices`가 대상을 찾아 기존 무신사 파싱 파이프라인(`fetchProductHtml`·`parseProductHtml`)으로 가격만 다시 읽는다. `/cart` 페이지에 보이지 않는 클라이언트 컴포넌트가 마운트 시 이 API를 fire-and-forget으로 불러 첫 로딩을 막지 않는다. `CartItemCard`가 `last_known_price < price`일 때만 "원래→지금"을 강조 표시한다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Supabase(Postgres/RLS) · cheerio(기존 파서 재사용)

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-17-cart-price-drop-design.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- TypeScript `strict: true`, `any` 금지. `npm run build`가 타입 에러 0개로 통과해야 한다.
- 사용자에게 하는 설명·요약·질문, 그리고 UI 문구는 한국어로 쓴다.
- 기능 단위마다 그 코드가 무엇을 하고 왜 그렇게 짰는지 설명하는 주석을 남긴다 (이 프로젝트의 학습 목적 예외 규칙).
- 태스크마다 커밋하고 push한다. 여러 태스크를 한 커밋에 몰아넣지 않는다.
- 커밋 메시지에 `Co-Authored-By: Claude` 등 AI 기여자 트레일러를 넣지 않는다.
- 새 의존성을 설치하지 않는다. 새 파싱 로직도 만들지 않는다 — 기존 `fetchProductHtml`·`parseProductHtml`을 그대로 재사용한다.
- **Vercel Cron을 쓰지 않는다.** 이 프로젝트는 아직 실제 배포된 적이 없어 Cron은 테스트할 방법이 없다(스펙 §2) — `/cart` 방문 시 지연 확인으로 간다.
- **가격 이력 테이블을 만들지 않는다.** `garments`에 컬럼 두 개만 더한다(스펙 §3).
- 한 번의 방문에 **최대 5개**까지만 재확인한다.

### 마이그레이션 적용 방법에 대한 참고

계획 10에서 확인된 사실: 이 프로젝트의 `npx supabase db push`는 계획 5의 마이그레이션이 CLI가 아니라 Supabase MCP의 `apply_migration` 도구로 적용된 이력 때문에 `LegacyDbPushMissingLocalError`로 막혀 있다(원격 이력에 `0006` 대신 타임스탬프 이름으로 기록됨). `migration repair`로 이력 자체를 고치는 건 이번 계획 범위가 아니므로, 계획 10과 같은 방식대로 **Supabase MCP `apply_migration` 도구로 직접 적용**한다 — 로컬 마이그레이션 파일의 SQL을 그대로 실행하므로 커밋된 내용과 실제 스키마가 정확히 일치한다.

---

## Task 1: 마이그레이션 — 가격 추적 컬럼

**Files:**
- Create: `supabase/migrations/0008_cart_price_tracking.sql`

**Interfaces:**
- Produces: `garments.last_known_price integer`(nullable), `garments.price_checked_at timestamptz`(nullable)

- [ ] **Step 1: 마이그레이션 작성**

`supabase/migrations/0008_cart_price_tracking.sql`:

```sql
-- 장바구니(status='considering') 상품의 가격 인하를 보여주기 위한 컬럼.
-- price(등록 당시 가격)는 그대로 두고, 가장 최근에 확인한 가격과 확인 시각만 더한다.
-- 가격 이력 전체를 남기는 별도 테이블은 만들지 않는다 — 필요한 건 "원래→지금" 한 쌍이지
-- 히스토리 그래프가 아니다. 기존 garments_update RLS 정책(owner_id = auth.uid())이
-- 이 두 컬럼도 그대로 커버해 새 정책이 필요 없다.
alter table garments
  add column last_known_price integer check (last_known_price is null or last_known_price >= 0),
  add column price_checked_at timestamptz;
```

- [ ] **Step 2: 마이그레이션 적용**

Supabase MCP의 `apply_migration` 도구로 위 SQL을 이름 `cart_price_tracking`으로 그대로 적용한다(위 "마이그레이션 적용 방법에 대한 참고" 참고).

- [ ] **Step 3: 컬럼이 실제로 생겼는지 확인**

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'garments'
  and column_name in ('last_known_price', 'price_checked_at');
```

Expected: 두 행.

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/0008_cart_price_tracking.sql
git commit -m "feat: add price tracking columns to garments"
git push
```

---

## Task 2: 가격 재확인 API + 방문 시 트리거

**Files:**
- Create: `app/api/cart/refresh-prices/route.ts`
- Create: `components/garment/CartPriceRefresher.tsx`
- Modify: `app/(app)/cart/page.tsx`

**Interfaces:**
- Produces: `POST /api/cart/refresh-prices` — `{ checked: number; updated: number }`
- Consumes: `fetchProductHtml`(`@/lib/musinsa/fetcher`), `parseProductHtml`(`@/lib/musinsa/parser`) — 둘 다 계획 1부터 존재, 변경 없음

- [ ] **Step 1: API 라우트를 만든다**

`app/api/cart/refresh-prices/route.ts`:

```ts
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'
import { fetchProductHtml } from '@/lib/musinsa/fetcher'
import { parseProductHtml } from '@/lib/musinsa/parser'

export const maxDuration = 30

const RECHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_ITEMS_PER_VISIT = 5

type Candidate = { id: string; goods_no: string; source_url: string }

/**
 * 후보 하나의 가격만 다시 읽어 저장한다. 실패해도(네트워크 오류·가격 파싱 실패)
 * price_checked_at은 갱신한다 — 계속 실패하는 링크를 방문할 때마다 재시도하지 않기 위해서다.
 */
async function refreshOne(supabase: SupabaseClient, candidate: Candidate): Promise<boolean> {
  const checkedAt = new Date().toISOString()
  try {
    const html = await fetchProductHtml(candidate.source_url)
    const result = parseProductHtml(html, candidate.goods_no)
    if (result.fields.price.ok) {
      await supabase
        .from('garments')
        .update({ last_known_price: result.fields.price.value, price_checked_at: checkedAt })
        .eq('id', candidate.id)
      return true
    }
  } catch {
    // 무시 — 아래에서 price_checked_at만 갱신한다.
  }
  await supabase.from('garments').update({ price_checked_at: checkedAt }).eq('id', candidate.id)
  return false
}

/**
 * 장바구니 방문 시 오래된(7일 이상 안 본) 가격을 백그라운드로 다시 확인한다.
 * Vercel Cron 대신 이 방식을 쓰는 이유: 이 프로젝트는 아직 실제 배포된 적이 없어
 * Cron은 테스트할 방법이 없다(스펙 §2) — 방문 시 지연 확인은 지금 바로 쓸 수 있다.
 */
export async function POST() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const staleThreshold = new Date(Date.now() - RECHECK_INTERVAL_MS).toISOString()

  // source_url이 있는(무신사 링크로 등록된) 장바구니 상품 중, 한 번도 안 봤거나 7일 넘은 것만.
  // price_checked_at이 오래된 순으로 최대 5개만 가져와 한 번에 너무 많이 긁지 않는다.
  const { data: candidates } = await supabase
    .from('garments')
    .select('id, goods_no, source_url')
    .eq('owner_id', user.id)
    .eq('status', 'considering')
    .not('source_url', 'is', null)
    .or(`price_checked_at.is.null,price_checked_at.lt.${staleThreshold}`)
    .order('price_checked_at', { ascending: true, nullsFirst: true })
    .limit(MAX_ITEMS_PER_VISIT)
    .overrideTypes<Candidate[], { merge: false }>()

  const results = await Promise.all((candidates ?? []).map((c) => refreshOne(supabase, c)))
  return NextResponse.json({ checked: candidates?.length ?? 0, updated: results.filter(Boolean).length })
}
```

- [ ] **Step 2: 방문 시 트리거 컴포넌트를 만든다**

`components/garment/CartPriceRefresher.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 아무것도 그리지 않는다 — 마운트되자마자 가격 재확인 API를 백그라운드로 부르기만 한다.
 * /cart 페이지의 첫 로딩을 막지 않기 위해 서버 컴포넌트가 아니라 여기서 fire-and-forget으로 부른다.
 */
export function CartPriceRefresher() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    fetch('/api/cart/refresh-prices', { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { updated?: number } | null) => {
        if (!cancelled && data?.updated) router.refresh()
      })
      .catch(() => {
        // 무시 — 가격 갱신은 부가 기능이라 실패해도 사용자를 막지 않는다.
      })
    return () => {
      cancelled = true
    }
  }, [router])

  return null
}
```

- [ ] **Step 3: `/cart` 페이지에 연결한다**

`app/(app)/cart/page.tsx`의 import 목록에 추가:

```ts
import { CartPriceRefresher } from '@/components/garment/CartPriceRefresher'
```

`<main>` 안, `<h1>` 바로 뒤에 추가한다. **기존**:

```tsx
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight text-ink">장바구니</h1>

      {items.length === 0 ? (
```

**변경**:

```tsx
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight text-ink">장바구니</h1>
      <CartPriceRefresher />

      {items.length === 0 ? (
```

- [ ] **Step 4: 빌드로 확인**

```bash
npm run build
```

Expected: 타입 에러 0개. (가격 표시는 Task 3에서 하므로 여기서는 API가 정상 동작하는지만 본다.)

- [ ] **Step 5: 브라우저로 재확인이 실제로 일어나는지 확인**

`/wardrobe`에서 무신사 링크로 아무 옷이나 하나 등록한 뒤 `/api/analyze`(또는 기존 장바구니 아이템)로 `status='considering'` 상품을 하나 만든다. 그 상품의 `price_checked_at`을 8일 전으로 강제로 되돌린다:

```sql
update garments set price_checked_at = now() - interval '8 days'
where id = '<방금 만든 garment id>';
```

`/cart`를 방문한 뒤(개발자 도구 네트워크 탭에서 `POST /api/cart/refresh-prices`가 실제로 나가는지 확인) 잠시 기다렸다가 DB를 다시 조회해 `last_known_price`·`price_checked_at`이 갱신됐는지 확인한다:

```sql
select last_known_price, price_checked_at from garments where id = '<그 id>';
```

- [ ] **Step 6: 커밋**

```bash
git add app/api/cart/refresh-prices/route.ts components/garment/CartPriceRefresher.tsx "app/(app)/cart/page.tsx"
git commit -m "feat: recheck cart item prices on visit"
git push
```

---

## Task 3: 장바구니 카드에 가격 인하 표시

**Files:**
- Modify: `components/garment/CartItemCard.tsx`
- Modify: `app/(app)/cart/page.tsx`

**Interfaces:**
- Produces: `CartItem`에 `price: number | null`, `lastKnownPrice: number | null` 추가

- [ ] **Step 1: `CartItemCard.tsx`를 고친다**

`CartItem` 타입. **기존**:

```ts
export type CartItem = {
  id: string
  name: string
  brand: string | null
  image_url: string | null
  latestVerdict: 'buy' | 'caution' | 'skip' | null
}
```

**변경**:

```ts
export type CartItem = {
  id: string
  name: string
  brand: string | null
  image_url: string | null
  latestVerdict: 'buy' | 'caution' | 'skip' | null
  /** 등록 당시 가격. */
  price: number | null
  /** 가장 최근에 다시 확인한 가격. 아직 한 번도 재확인 안 했으면 null(= price와 같다고 본다). */
  lastKnownPrice: number | null
}
```

카드 본문의 이름·브랜드 블록 뒤에 가격 줄을 추가한다. **기존**:

```tsx
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="truncate text-xs text-ink-muted">{item.brand}</span>
          {item.latestVerdict && (
            <span className={`${pillClass(item.latestVerdict)} px-2 py-0.5 text-xs`}>
              {VERDICT_LABELS[item.latestVerdict]}
            </span>
          )}
        </div>
      </div>
```

**변경**:

```tsx
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="truncate text-xs text-ink-muted">{item.brand}</span>
          {item.latestVerdict && (
            <span className={`${pillClass(item.latestVerdict)} px-2 py-0.5 text-xs`}>
              {VERDICT_LABELS[item.latestVerdict]}
            </span>
          )}
        </div>
        {item.price != null && (
          <p className="mt-1 text-xs">
            {item.lastKnownPrice != null && item.lastKnownPrice < item.price ? (
              <>
                <span className="text-ink-muted line-through">{item.price.toLocaleString()}원</span>
                {' → '}
                <span className="font-medium text-ink">{item.lastKnownPrice.toLocaleString()}원</span>
                <span className={`${pillClass('buy')} ml-1 px-1.5 py-0.5 text-[10px]`}>인하</span>
              </>
            ) : (
              <span className="text-ink-muted">{(item.lastKnownPrice ?? item.price).toLocaleString()}원</span>
            )}
          </p>
        )}
      </div>
```

- [ ] **Step 2: `/cart` 페이지가 가격 두 필드를 조회해 넘긴다**

`app/(app)/cart/page.tsx`의 `CartGarmentRow` 타입. **기존**:

```ts
type CartGarmentRow = {
  id: string
  name: string
  brand: string | null
  image_url: string | null
  analyses: AnalysisRow[] | null
}
```

**변경**:

```ts
type CartGarmentRow = {
  id: string
  name: string
  brand: string | null
  image_url: string | null
  price: number | null
  last_known_price: number | null
  analyses: AnalysisRow[] | null
}
```

쿼리의 `select`. **기존**:

```ts
    .select('id, name, brand, image_url, analyses(verdict, created_at)')
```

**변경**:

```ts
    .select('id, name, brand, image_url, price, last_known_price, analyses(verdict, created_at)')
```

`items` 매핑. **기존**:

```ts
  const items: CartItem[] = (garments ?? []).map((g) => {
    const analyses = g.analyses ?? []
    const latest = [...analyses].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    return { id: g.id, name: g.name, brand: g.brand, image_url: g.image_url, latestVerdict: latest?.verdict ?? null }
  })
```

**변경**:

```ts
  const items: CartItem[] = (garments ?? []).map((g) => {
    const analyses = g.analyses ?? []
    const latest = [...analyses].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    return {
      id: g.id,
      name: g.name,
      brand: g.brand,
      image_url: g.image_url,
      latestVerdict: latest?.verdict ?? null,
      price: g.price,
      lastKnownPrice: g.last_known_price,
    }
  })
```

- [ ] **Step 3: 빌드로 확인**

```bash
npm run build
```

Expected: 타입 에러 0개.

- [ ] **Step 4: 브라우저로 확인**

1. Task 2 Step 5에서 갱신해 둔 아이템의 `last_known_price`가 `price`보다 낮게 DB에서 직접 값을 만들어 둔다(실제 가격이 안 내렸다면 테스트를 위해 `update garments set last_known_price = price - 1000 where id = '<id>'`로 인위적으로 낮춰본다):
   ```sql
   update garments set last_known_price = price - 1000 where id = '<id>';
   ```
2. `/cart`를 새로고침 → **취소선 원래 가격 → 강조된 낮은 가격 + "인하" 배지**가 뜨는지 확인
3. `last_known_price`가 `price`와 같거나 높은 다른 아이템은 평범하게 가격 하나만 뜨는지 확인
4. 테스트로 만든 값은 확인 후 `update garments set last_known_price = null, price_checked_at = null where id = '<id>'`로 정리한다

- [ ] **Step 5: 커밋**

```bash
git add components/garment/CartItemCard.tsx "app/(app)/cart/page.tsx"
git commit -m "feat: show price drop on cart items"
git push
```

---

## Task 4: README 기록

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 맨 끝에 "계획 11 — 장바구니 가격 인하 표시" 절을 추가한다**

기존 절들과 같은 형식(문제 / 원인 / 해결 / 검증 / 결과)으로 쓴다. **이 계획을 실행하며 실제로 겪은 문제만 적는다** — 미리 예상한 문제를 적지 않는다. 겪은 문제가 없었다면 그렇게 쓰고, 대신 내린 설계 판단과 근거를 남긴다.

최소한 아래는 계획 작성 시점에 이미 확정된 판단이라 기록할 가치가 있다:

- **Vercel Cron이 아니라 방문 시 지연 확인을 고른 이유** — 이 프로젝트가 아직 실제 배포된 적이 없어, Cron 기반 설계는 지금 당장 검증할 방법이 없다. 방문-트리거는 배포 여부와 무관하게 바로 만들고 테스트할 수 있고, 나중에 실제로 배포한 뒤 Cron이 필요해지면 같은 API(`/api/cart/refresh-prices`)를 그대로 재사용할 수 있게 설계했다.
- **가격 이력 테이블 대신 컬럼 두 개를 고른 이유** — 사용자가 요청한 건 "원래→지금" 한 쌍이지 히스토리 그래프가 아니었다. `garment_measurements`처럼 정규화 테이블을 쓸 만한 경우와, `fit_field_overrides`(계획 10)처럼 컬럼으로 충분한 경우를 이번에도 구분해 판단했다.
- **재확인 실패 시에도 `price_checked_at`을 갱신하는 이유** — 상품이 삭제됐거나 페이지 구조가 바뀌어 계속 실패하는 링크가 있으면, 그 링크를 방문할 때마다 무신사에 헛수고 요청을 보내게 된다. 실패도 "확인했다"로 치고 다음 7일간은 건드리지 않는다.
- **한 번에 최대 5개로 제한한 이유** — 오랜만에 방문해 장바구니가 여러 개 쌓여 있어도 한 번에 몰아서 긁지 않는다. 나머지는 다음 방문에 처리된다.

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: log cart price drop work"
git push
```

---

## 남은 일 (이 계획 밖)

**합의한 A~F가 전부 끝난다.** 이 문서 작성 시점에 남아있는 것들:

- **`MUSINSA_CATEGORY_MAP` 확장** — 액세서리류의 실제 무신사 대분류명을 확인하면 추가한다(커밋 `2893adf` 참고).
- **삭제 되돌리기(휴지통)** — 계획 7 스펙 §7에서 범위 밖으로 남겨둔 것.
- **`RecommendLinkBar`(친구 추천)에도 수동 등록 지원** — 계획 8 스펙 §7에서 범위 밖으로 남겨둔 것.
- **옷장 주인에게 "누가 무엇을 추천했는지" 실시간 알림, 여러 탭 간 추천 목록 동기화** — 계획 9 스펙 §10에서 범위 밖으로 남겨둔 것.
- **심각도(severity)·가중치(weight) 조정, `VERDICT_CAUTION_MAX`·`MIN_OWNED_GARMENTS_FOR_FIT` 조정** — 계획 10 스펙 §10에서 범위 밖으로 남겨둔 것.
- **Vercel 실제 배포** — 이 계획을 포함해 지금까지 전부 로컬에서만 검증됐다. 배포 후에는 `npx supabase db push`가 여전히 이력 불일치로 막힐 수 있어 `migration repair`가 필요할 수 있다(계획 10에서 처음 확인).
- **Vercel Cron 기반 완전 자동 가격 갱신** — 이 계획의 스펙 §8에서 범위 밖으로 남겨둔 것. 배포 후 필요해지면 `/api/cart/refresh-prices`를 그대로 Cron에서 호출할 수 있다.
