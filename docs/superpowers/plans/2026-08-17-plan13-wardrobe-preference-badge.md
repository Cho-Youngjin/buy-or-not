# 옷장 카드 선호도 미설정 배지 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** `/wardrobe` 목록에서 별점(선호도)을 아직 안 매긴 옷에 "선호도 미설정" 배지를 띄우고, 누르면 그 옷의 선호도 입력 섹션으로 바로 이동한다.

**Architecture:** `GarmentCard`의 바깥 요소를 `Link`에서 `div`로 바꾸고, 카드 클릭 영역(이미지+텍스트)은 그대로 `Link`로 감싸되, 배지는 `rating == null`일 때만 렌더링되는 형제 `Link`(앵커 `#선호도`)로 오버레이한다. 상세 페이지(`/wardrobe/[id]`)의 선호도 `<section>`에 같은 id를 달아 앵커 대상으로 만든다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-17-wardrobe-preference-badge-design.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- TypeScript `strict: true`, `any` 금지. `npm run build`가 타입 에러 0개로 통과해야 한다.
- 새 마이그레이션·새 컬럼을 추가하지 않는다 — `garments.rating`은 이미 존재한다(계획 2).
- 공유 옷장(`app/u/[share_slug]/page.tsx`)은 별도 `PublicGarmentCard`를 쓰고 `rating`을 쿼리하지 않으므로 이번 변경의 영향을 받지 않는다(스펙에서 확인 완료) — 손대지 않는다.

---

## Task 1: `GarmentCard`에 배지 추가 + 상세 페이지 앵커

**Files:**
- Modify: `components/garment/GarmentCard.tsx`
- Modify: `app/(app)/wardrobe/page.tsx`
- Modify: `app/(app)/wardrobe/[id]/page.tsx`

**Interfaces:**
- Produces: `GarmentCardData`에 `rating: number | null` 필드 추가.

- [ ] **Step 1: `GarmentCard.tsx`를 고친다**

전체 파일. **기존**:

```tsx
import Link from 'next/link'
import Image from 'next/image'
import { CATEGORY_LABELS, type Category } from '@/lib/types'
import { CARD_SURFACE } from '@/components/ui/styles'

export type GarmentCardData = {
  id: string
  name: string
  brand: string | null
  price: number | null
  image_url: string | null
  category: Category
  color_option: string | null
  size_option: string | null
}

export function GarmentCard({ garment }: { garment: GarmentCardData }) {
  return (
    <Link
      href={`/wardrobe/${garment.id}`}
      className={`${CARD_SURFACE} block overflow-hidden transition hover:border-accent`}
    >
      <div className="relative aspect-[3/4] bg-canvas">
        {garment.image_url ? (
          <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="200px" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">
            이미지 없음
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="text-xs text-ink-muted">{garment.brand ?? CATEGORY_LABELS[garment.category]}</p>
        <h3 className="line-clamp-2 text-sm font-medium text-ink">{garment.name}</h3>
        <p className="text-xs text-ink-muted">
          {[garment.color_option, garment.size_option].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Link>
  )
}
```

**변경**:

```tsx
import Link from 'next/link'
import Image from 'next/image'
import { CATEGORY_LABELS, type Category } from '@/lib/types'
import { CARD_SURFACE, pillClass } from '@/components/ui/styles'

export type GarmentCardData = {
  id: string
  name: string
  brand: string | null
  price: number | null
  image_url: string | null
  category: Category
  color_option: string | null
  size_option: string | null
  rating: number | null
}

export function GarmentCard({ garment }: { garment: GarmentCardData }) {
  return (
    <div className={`${CARD_SURFACE} relative overflow-hidden transition hover:border-accent`}>
      <Link href={`/wardrobe/${garment.id}`} className="block">
        <div className="relative aspect-[3/4] bg-canvas">
          {garment.image_url ? (
            <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="200px" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-muted">
              이미지 없음
            </div>
          )}
        </div>
        <div className="space-y-1 p-3">
          <p className="text-xs text-ink-muted">{garment.brand ?? CATEGORY_LABELS[garment.category]}</p>
          <h3 className="line-clamp-2 text-sm font-medium text-ink">{garment.name}</h3>
          <p className="text-xs text-ink-muted">
            {[garment.color_option, garment.size_option].filter(Boolean).join(' · ')}
          </p>
        </div>
      </Link>

      {/* 별점(선호도)을 아직 안 매긴 옷. 위 Link 안에 중첩하면 <a> 안에 <a>가 되어 HTML
          규격을 어기므로, 형제 요소로 이미지 우상단에 오버레이한다. outer div가 position:relative라
          top-2/right-2는 카드 맨 위(=이미지 상단)를 기준으로 놓인다 — outer div에 padding이 없어서다. */}
      {garment.rating == null && (
        <Link
          href={`/wardrobe/${garment.id}#선호도`}
          className={`${pillClass('caution')} absolute right-2 top-2 px-2 py-0.5 text-xs`}
        >
          선호도 미설정
        </Link>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `WardrobePage` 쿼리에 `rating`을 추가한다**

`app/(app)/wardrobe/page.tsx`의 `select`. **기존**:

```ts
    .select('id, name, brand, price, image_url, category, color_option, size_option')
```

**변경**:

```ts
    .select('id, name, brand, price, image_url, category, color_option, size_option, rating')
```

- [ ] **Step 3: 상세 페이지 선호도 섹션에 앵커 id를 단다**

`app/(app)/wardrobe/[id]/page.tsx`의 선호도 섹션. **기존**:

```tsx
      <section>
        <h2 className="mb-2 text-sm font-medium text-ink">선호도</h2>
        <PreferenceForm
```

**변경**:

```tsx
      <section id="선호도">
        <h2 className="mb-2 text-sm font-medium text-ink">선호도</h2>
        <PreferenceForm
```

- [ ] **Step 4: 빌드로 확인**

```bash
npm run build
```

Expected: 타입 에러 0개.

- [ ] **Step 5: 브라우저로 확인**

1. `/wardrobe`에서 별점이 없는 옷의 카드에 "선호도 미설정" 배지가 이미지 우상단에 뜨는지 확인한다. (지금 옷장이 비어 있거나 전부 별점이 있다면, 확인용으로 옷을 하나 등록하거나 기존 옷 하나의 `rating`을 DB에서 임시로 `null`로 만든다.)
2. 배지를 눌러 `/wardrobe/{id}#선호도`로 이동하고, 화면이 "선호도" 섹션 근처로 스크롤돼 있는지 확인한다.
3. 카드의 나머지 부분(이미지 배지가 아닌 곳)을 눌러 평소처럼 상세 페이지 맨 위로 이동하는지 확인한다.
4. 그 옷에 별점을 매긴 뒤 `/wardrobe`로 돌아가 배지가 사라지는지 확인한다.
5. DB를 임시로 건드렸다면 확인 후 원래 값으로 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add components/garment/GarmentCard.tsx "app/(app)/wardrobe/page.tsx" "app/(app)/wardrobe/[id]/page.tsx"
git commit -m "feat: badge unrated garments in wardrobe list"
git push
```

---

## Task 2: README 기록

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 맨 끝에 "계획 13 — 옷장 카드 선호도 미설정 배지" 절을 추가한다**

기존 절들과 같은 형식으로 쓴다. 최소한 아래 설계 판단은 근거와 함께 남길 가치가 있다:

- **별점만으로 "미설정"을 판단한 이유** — 핏 판단 엔진이 가장 핵심적으로 쓰는 신호가 별점이고, 핏·착용빈도는 별점을 매기면 자연스럽게 따라오는 보조 정보라 세 항목을 전부 강제하지 않았다.
- **카드 바깥 요소를 `Link`에서 `div`로 바꾼 이유** — 배지도 별도 링크(`#선호도` 앵커)여야 하는데, 기존처럼 카드 전체가 `Link`였다면 그 안에 또 다른 `Link`를 넣는 게 되어 `<a>` 중첩이 된다. HTML 중첩 인터랙티브 요소 문제를 피하려고 바깥을 `div`로, 클릭 영역별로 형제 `Link` 두 개로 나눴다.
- **공유 옷장에 영향이 없는 이유** — `app/u/[share_slug]/page.tsx`는 이 컴포넌트를 아예 안 쓰고 별도 `PublicGarmentCard`를 쓴다는 걸 스펙 단계에서 실제로 grep해 확인했다.
- 이번 계획을 실행하며 실제로 겪은 문제만 추가로 적는다(예상한 문제를 미리 적지 않는다). 문제가 없었다면 없었다고 쓴다.

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: log wardrobe preference badge work"
git push
```

---

## 남은 일 (이 계획 밖)

사용자가 제안한 6개 중 3(판단 리포트 재조회), 2(다크모드), 4(랜딩페이지 확장), 5(README 재구성)가 남아 있다. 합의된 진행 순서: 6 → 1(이 계획) → 3 → 2 → 4 → 5.
