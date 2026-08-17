# 장바구니 판단 리포트 다시보기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** 장바구니에서 판정 배지가 있는 아이템을 누르면 그 판단이 나온 근거(실측 편차·제미나이 코멘트)를 다시 볼 수 있게 한다.

**Architecture:** 새 라우트 `/cart/[id]`가 `analyses` 테이블에서 그 옷의 가장 최근 판단 결과를 조회해 기존 `VerdictBadge`·`DeviationReport` 컴포넌트로 그대로 그린다(`/analyze`에서 이미 쓰는 컴포넌트 재사용, 새 프레젠테이션 컴포넌트 없음). `CartItemCard`의 이미지+텍스트 블록을 `Link`로 감싸되, 판정 배지가 없는(=`analyses`가 없는) 아이템은 감싸지 않는다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-17-cart-report-review-design.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- TypeScript `strict: true`, `any` 금지. `npm run build`가 타입 에러 0개로 통과해야 한다.
- 새 마이그레이션·새 테이블·새 컬럼을 추가하지 않는다 — `analyses` 테이블과 RLS는 계획 3부터 이미 있다.
- `VerdictBadge`·`DeviationReport`(`components/analyze/`)는 그대로 재사용한다. 새 프레젠테이션 컴포넌트를 만들지 않는다.

---

## Task 1: `/cart/[id]` 리포트 다시보기 페이지

**Files:**
- Create: `app/(app)/cart/[id]/page.tsx`

**Interfaces:**
- Consumes: `VerdictBadge`(`@/components/analyze/VerdictBadge`), `DeviationReport`(`@/components/analyze/DeviationReport`) — 둘 다 계획 2부터 존재, 변경 없음. `DeviationReport`(타입, `@/lib/fit/engine`)의 `fields: FieldDeviation[]` 모양.

- [ ] **Step 1: 페이지를 만든다**

`app/(app)/cart/[id]/page.tsx`:

```tsx
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
```

- [ ] **Step 2: 빌드로 확인**

```bash
npm run build
```

Expected: 타입 에러 0개. `/cart/[id]` 라우트가 목록에 나온다.

- [ ] **Step 3: 커밋**

```bash
git add "app/(app)/cart/[id]/page.tsx"
git commit -m "feat: add cart item report review page"
git push
```

---

## Task 2: `CartItemCard`에서 리포트 페이지로 이동

**Files:**
- Modify: `components/garment/CartItemCard.tsx`

**Interfaces:**
- 변경 없음(외부에 노출되는 `CartItem` 타입·prop 시그니처 그대로).

- [ ] **Step 1: 이미지+텍스트 블록을 조건부 `Link`로 감싼다**

`components/garment/CartItemCard.tsx`. **기존**:

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { CARD_SURFACE, pillClass } from '@/components/ui/styles'

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

const VERDICT_LABELS = { buy: '살만함', caution: '주의', skip: '비추천' } as const

type Props = {
  item: CartItem
  checked: boolean
  onToggle: (id: string) => void
}

/**
 * 장바구니 카드 한 장.
 * 선택 상태를 자기가 들지 않고 부모(CartList)에게서 받는 이유: "선택 삭제"는 여러 카드에
 * 걸친 동작이라, 어느 카드가 선택됐는지는 카드 하나가 알 수 있는 정보가 아니다.
 */
export function CartItemCard({ item, checked, onToggle }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function markAsBought() {
    setSaving(true)
    await fetch(`/api/garments/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'owned' }),
    })
    router.refresh()
  }

  return (
    <div className={`${CARD_SURFACE} flex items-center gap-3 p-3`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(item.id)}
        aria-label={`${item.name} 선택`}
        className="h-4 w-4 shrink-0 accent-accent"
      />
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-btn bg-canvas">
        {item.image_url && <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="48px" />}
      </div>
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
      <Button onClick={markAsBought} disabled={saving} className="shrink-0 px-3 py-2 text-xs">
        {saving ? '처리 중…' : '샀어요'}
      </Button>
    </div>
  )
}
```

**변경**:

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { CARD_SURFACE, pillClass } from '@/components/ui/styles'

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

const VERDICT_LABELS = { buy: '살만함', caution: '주의', skip: '비추천' } as const

type Props = {
  item: CartItem
  checked: boolean
  onToggle: (id: string) => void
}

/**
 * 장바구니 카드 한 장.
 * 선택 상태를 자기가 들지 않고 부모(CartList)에게서 받는 이유: "선택 삭제"는 여러 카드에
 * 걸친 동작이라, 어느 카드가 선택됐는지는 카드 하나가 알 수 있는 정보가 아니다.
 */
export function CartItemCard({ item, checked, onToggle }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function markAsBought() {
    setSaving(true)
    await fetch(`/api/garments/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'owned' }),
    })
    router.refresh()
  }

  // latestVerdict가 없으면 analyses 행이 없다는 뜻이다(친구 추천으로 들어온 아이템 등,
  // app/(app)/cart/page.tsx의 analyses 조인 참고) — 보여줄 리포트가 없으니 링크를 안 씌운다.
  const cardBody = (
    <>
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-btn bg-canvas">
        {item.image_url && <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="48px" />}
      </div>
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
    </>
  )

  return (
    <div className={`${CARD_SURFACE} flex items-center gap-3 p-3`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(item.id)}
        aria-label={`${item.name} 선택`}
        className="h-4 w-4 shrink-0 accent-accent"
      />
      {item.latestVerdict ? (
        <Link href={`/cart/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          {cardBody}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{cardBody}</div>
      )}
      <Button onClick={markAsBought} disabled={saving} className="shrink-0 px-3 py-2 text-xs">
        {saving ? '처리 중…' : '샀어요'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: 빌드로 확인**

```bash
npm run build
```

Expected: 타입 에러 0개.

- [ ] **Step 3: 브라우저로 확인**

1. `/analyze`에서 실제 무신사 링크로 구매 판단을 한 번 돌려 장바구니에 판정 배지가 있는 아이템을 하나 만든다(이미 그런 아이템이 있다면 생략).
2. `/cart`에서 그 아이템의 이미지나 이름 부분을 눌러 `/cart/{id}`로 이동하고, 판정 배지·실측 편차 표·AI 코멘트가 뜨는지 확인한다.
3. "← 장바구니로"를 눌러 `/cart`로 돌아오는지 확인한다.
4. 체크박스를 눌러 선택/해제가 여전히 잘 되는지, "샀어요" 버튼이 여전히 잘 동작하는지 확인한다(리포트 페이지로 새지 않아야 한다).
5. 판정 배지가 없는 아이템(친구 추천으로 들어온 아이템 — 없다면 이 단계는 코드 리딩으로 대체: `item.latestVerdict` 조건이 정확히 배지 표시 조건과 같다는 것으로 충분)이 있다면 이미지 부분을 눌러도 이동하지 않는지 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add components/garment/CartItemCard.tsx
git commit -m "feat: link cart items with reports to their report page"
git push
```

---

## Task 3: README 기록

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 맨 끝에 "계획 14 — 장바구니 판단 리포트 다시보기" 절을 추가한다**

기존 절들과 같은 형식으로 쓴다. 최소한 아래 설계 판단은 근거와 함께 남길 가치가 있다:

- **새 프레젠테이션 컴포넌트를 안 만든 이유** — `VerdictBadge`·`DeviationReport`가 이미 `/analyze`의 즉시 결과 화면에서 쓰이고 있었고, `analyses.report` 컬럼이 그 컴포넌트가 기대하는 모양을 그대로 저장하고 있어서 재사용이 자연스러웠다.
- **`/api/recommend`가 `analyses` 행을 안 만든다는 걸 스펙 단계에서 코드로 확인한 것** — 친구 추천 아이템은 리포트가 없다는 걸 미리 알고, 배지 유무(`latestVerdict`)로 클릭 가능 여부를 가른 근거.
- **`feedback` 컬럼의 두 가지 모양(성공 시 4필드, 실패 시 `{note}`)을 구분해서 읽은 이유** — `app/api/analyze/route.ts`가 실패 시 다른 모양으로 저장한다는 걸 코드에서 확인하고, `summary` 필드 유무로 판별하는 타입 가드를 새로 만들었다.
- 이번 계획을 실행하며 실제로 겪은 문제만 추가로 적는다(예상한 문제를 미리 적지 않는다). 문제가 없었다면 없었다고 쓴다.

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: log cart report review work"
git push
```

---

## 남은 일 (이 계획 밖)

사용자가 제안한 6개 중 2(다크모드), 4(랜딩페이지 확장), 5(README 재구성)가 남아 있다. 합의된 진행 순서: 6 → 1 → 3(이 계획) → 2 → 4 → 5.
