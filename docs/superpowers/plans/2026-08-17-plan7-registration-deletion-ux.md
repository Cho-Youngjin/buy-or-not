# 등록·삭제 UX 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** 링크 등록 폼을 접을 수 있게 하고, `"2 (L)"`처럼 옵션 라벨과 실측표 행 라벨이 달라도 실측이 자동으로 채워지게 하며, 삭제 버튼을 아이콘 버튼으로 통일하고 장바구니에 선택·전체 삭제를 추가한다.

**Architecture:** 폼 접기는 계획 6에서 만든 `useMusinsaParse.reset()`을 그대로 재사용하고 `GarmentForm`에 `onCancel` prop만 얹는다. 사이즈 매칭은 `lib/`의 순수 함수로 뽑아 단위 테스트하고 `GarmentForm`은 그 함수를 부르기만 한다. 장바구니 선택 상태는 새 클라이언트 컴포넌트 `CartList`가 들고, 삭제는 새 벌크 API 없이 기존 단건 `DELETE /api/garments/:id`를 병렬 호출한다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Tailwind CSS v4 · Vitest(node 환경) · @phosphor-icons/react

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-17-registration-deletion-ux-design.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- TypeScript `strict: true`, `any` 금지. `npm run build`가 타입 에러 0개로 통과해야 한다.
- 사용자에게 하는 설명·요약·질문, 그리고 UI 문구는 한국어로 쓴다.
- 기능 단위마다 그 코드가 무엇을 하고 왜 그렇게 짰는지 설명하는 주석을 남긴다 (이 프로젝트의 학습 목적 예외 규칙).
- 태스크마다 커밋하고 push한다. 여러 태스크를 한 커밋에 몰아넣지 않는다.
- 커밋 메시지에 `Co-Authored-By: Claude` 등 AI 기여자 트레일러를 넣지 않는다.
- **새 의존성을 설치하지 않는다.** 컴포넌트 테스트 인프라(jsdom·React Testing Library)도 여전히 범위 밖이다.
- **`lib/`에는 React 의존을 넣지 않는다.** node 환경 Vitest가 `lib/`를 그대로 import한다 — 새로 만드는 `lib/musinsa/sizeMatch.ts`는 순수 함수만 담는다.
- 새 API 라우트를 만들지 않는다. 삭제는 기존 `DELETE /api/garments/:id`(RLS가 소유자 검증)를 재사용한다.

### 이 계획의 테스트 전략

`lib/musinsa/sizeMatch.ts`는 순수 함수라 **TDD로 단위 테스트를 먼저 쓴다**(Task 2). 나머지(폼 접기·삭제 UI·장바구니)는 컴포넌트라 이 프로젝트에 렌더링 테스트 인프라가 없으므로, 계획 6과 같이 `npm run build`(타입·import 검증) + `npm test`(회귀) + 브라우저 수동 검증을 쓴다.

### 사전 확인된 사실 (계획 작성 중 실제로 검증함)

- `@phosphor-icons/react`의 `Trash`는 실제로 존재한다. **파일 존재 확인이 아니라 파일 내용**(`node_modules/@phosphor-icons/react/dist/csr/Trash.d.ts`의 `export declare const Trash: Icon;`)으로 확인했다 — 계획 4에서 Windows의 대소문자 무시 파일시스템 때문에 `Coathanger`/`CoatHanger`를 잘못 검증한 전례가 있어서다.
- 클라이언트 컴포넌트는 `@phosphor-icons/react`에서, 서버 컴포넌트는 `@phosphor-icons/react/ssr`에서 아이콘을 가져오는 게 이 코드베이스의 기존 패턴이다(`components/nav/MobileTabBar.tsx` vs `app/(app)/wardrobe/[id]/page.tsx`). 이번에 아이콘을 넣는 두 파일은 **둘 다 클라이언트 컴포넌트**이므로 `@phosphor-icons/react`를 쓴다.
- `app/(app)/cart/page.tsx`는 `items.length === 0`이면 빈 상태 문구를, 아니면 카드 목록을 그린다 — 즉 **`CartList`는 항상 아이템이 1개 이상일 때만 렌더링된다.** "전체 삭제" 버튼을 조건 없이 그려도 되는 근거다.
- `<input type="range" className="accent-accent">`가 이미 `components/account/FitStrictnessSlider.tsx`에 쓰이고 있다 — 체크박스도 같은 `accent-accent`로 색을 맞춘다.
- **이 프로젝트에는 `tailwind-merge`가 없다.** `Button`은 `` `${BASE} ${VARIANTS[variant]} ${className}` ``로 클래스를 이어붙이기만 하는데, Tailwind가 만드는 CSS의 순서는 "문자열에서 나중에 쓴 것"이 아니라 유틸리티의 고정된 정렬 순서를 따른다. 그래서 `className="p-2"`나 `"px-3"`을 넘겨도 `BASE`의 `px-4 py-2`를 이길 수 없다(실제로 `CartItemCard`의 `px-3`도 지금 먹지 않고 있다). **이 계획에서는 `Button`에 패딩 관련 클래스를 넘기지 않는다** — 아이콘 버튼도 기본 패딩을 그대로 쓴다.

---

## Task 1: 폼 접기

파싱된 폼을 닫는 "접기" 버튼을 `GarmentForm`에 추가하고, 세 링크 바가 `useMusinsaParse.reset`을 그대로 넘긴다. `reset()`은 `parsed`와 `url`을 둘 다 비우므로 "완전히 처음 상태로 되돌린다"는 사용자 요구와 정확히 맞아 **새 메서드가 필요 없다.**

**Files:**
- Modify: `components/garment/GarmentForm.tsx` (Props에 `onCancel` 추가, 폼 상단에 버튼 렌더)
- Modify: `components/garment/LinkInputBar.tsx`
- Modify: `components/analyze/AnalyzeLinkBar.tsx`
- Modify: `components/share/RecommendLinkBar.tsx`

**Interfaces:**
- Consumes: `useMusinsaParse()`의 `reset: () => void` (계획 6에서 만듦, 변경 없음)
- Produces: `GarmentForm`의 Props에 `onCancel?: () => void` 추가. 선택 prop이라 넘기지 않는 호출부는 그대로 동작한다.

- [ ] **Step 1: `GarmentForm`의 Props 타입에 `onCancel` 추가**

`components/garment/GarmentForm.tsx`의 `type Props` 안, `extraBody` 선언 바로 아래에 넣는다:

```ts
  /** 요청 바디에 합쳐 보낼 필드(예: wardrobeOwnerId). 옷장 등록·구매 판단에서는 비워둔다. */
  extraBody?: Record<string, unknown>
  /** 넘기면 폼 우측 상단에 "접기" 버튼이 생긴다. 링크를 잘못 넣었을 때 폼을 닫는 용도. */
  onCancel?: () => void
}
```

- [ ] **Step 2: 구조분해에 `onCancel` 추가**

같은 파일의 함수 선언부를 고친다:

```tsx
export function GarmentForm({
  parsed, sourceUrl, submitEndpoint, submitLabel, onSubmitted, noteField, extraBody, onCancel,
}: Props) {
```

- [ ] **Step 3: 폼 상단에 "접기" 버튼 렌더**

`return (` 바로 다음 줄, `{manualFields.length > 0 && (` 블록 **앞에** 넣는다:

```tsx
    <form onSubmit={handleSubmit} className={`${CARD_SURFACE} space-y-4 p-5`}>
      {/*
        type="button"이 반드시 필요하다: <form> 안의 <button>은 type을 안 주면 submit이 기본값이라,
        접기를 누르는 순간 폼이 제출돼 버린다.
      */}
      {onCancel && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-ink-muted underline transition hover:text-ink"
          >
            접기
          </button>
        </div>
      )}

      {manualFields.length > 0 && (
```

- [ ] **Step 4: `LinkInputBar`에서 `onCancel` 넘기기**

`components/garment/LinkInputBar.tsx`의 `<GarmentForm>`에 prop 한 줄을 추가한다:

```tsx
        <GarmentForm
          parsed={parse.parsed}
          sourceUrl={parse.url}
          submitEndpoint="/api/garments"
          submitLabel="옷장에 넣기"
          onCancel={parse.reset}
          onSubmitted={() => {
            parse.reset()
            router.refresh()
          }}
        />
```

- [ ] **Step 5: `AnalyzeLinkBar`에서 `onCancel` 넘기기**

`components/analyze/AnalyzeLinkBar.tsx`:

```tsx
        <GarmentForm
          parsed={parse.parsed}
          sourceUrl={parse.url}
          submitEndpoint="/api/analyze"
          submitLabel="판단하기"
          onCancel={parse.reset}
          onSubmitted={(data) => setResult(data as AnalyzeResult)}
        />
```

- [ ] **Step 6: `RecommendLinkBar`에서 `onCancel` 넘기기**

`components/share/RecommendLinkBar.tsx`:

```tsx
        <GarmentForm
          parsed={parse.parsed}
          sourceUrl={parse.url}
          submitEndpoint="/api/recommend"
          submitLabel="추천하기"
          noteField
          extraBody={{ wardrobeOwnerId }}
          onCancel={parse.reset}
          onSubmitted={() => {
            parse.reset()
            setDone(true)
          }}
        />
```

- [ ] **Step 7: 빌드와 테스트 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 107개 전부 통과.

- [ ] **Step 8: 브라우저로 확인**

개발 서버를 띄우고 로그인한 상태에서:

1. `/wardrobe`에서 링크를 넣고 "불러오기" → 폼이 뜨면 우측 상단 "접기" 클릭 → **폼이 사라지고 입력창의 URL도 비워지는지**
2. 같은 화면에서 "접기"를 눌렀을 때 **폼이 제출되지 않는지**(옷이 새로 등록되지 않아야 한다 — Step 3의 `type="button"`이 하는 일)
3. `/analyze`에서도 같은 동작 확인

- [ ] **Step 9: 커밋**

```bash
git add components/garment/GarmentForm.tsx components/garment/LinkInputBar.tsx components/analyze/AnalyzeLinkBar.tsx components/share/RecommendLinkBar.tsx
git commit -m "feat: add collapse button to garment form"
git push
```

---

## Task 2: 사이즈 매칭 유연화

`"2 (L)"`(상품 옵션)과 `"L"`(실측표 행 라벨)이 정확히 같지 않아 실측 자동 채움이 안 되던 문제를 고친다. 순수 함수라 **테스트를 먼저 쓴다.**

**Files:**
- Create: `tests/musinsa/sizeMatch.test.ts`
- Create: `lib/musinsa/sizeMatch.ts`
- Modify: `components/garment/GarmentForm.tsx` (`matchedSizeKey` 계산을 교체)

**Interfaces:**
- Produces: `extractSizeTokens(label: string): string[]` — 라벨에서 숫자·영문 토큰을 뽑는다
- Produces: `sizesMatch(a: string, b: string): boolean` — 두 라벨의 토큰 집합에 교집합이 있으면 true
- Produces: `findMatchingSize(candidates: string[], size: string): string | undefined` — 후보 라벨 중 맞는 것을 고른다(정확 일치 우선)
- Consumes: `GarmentForm`의 `pastedSizeTable`(`SizeTable`)과 `size`(string) 상태 — 타입 변경 없음

> **스펙과의 차이(사용자에게 알릴 것)**: 스펙 §3은 `extractSizeTokens`·`sizesMatch` 두 개만 정의하고 컴포넌트에서 `Object.keys(...).find((key) => sizesMatch(key, size))`를 부르게 했다. 이 계획은 여기에 `findMatchingSize`를 더해 **정확히 같은 라벨을 먼저 찾고 없을 때만 토큰 일치로 넓히도록** 한다. 후보가 여럿일 때 정확한 쪽을 우선하는 게 항상 안전하고, 컴포넌트가 부르는 결정 로직 전체를 단위 테스트할 수 있게 되기 때문이다. 스펙의 의도(토큰 부분 일치 허용)는 그대로다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/musinsa/sizeMatch.test.ts`를 새로 만든다:

```ts
import { describe, it, expect } from 'vitest'
import { extractSizeTokens, sizesMatch, findMatchingSize } from '@/lib/musinsa/sizeMatch'

describe('extractSizeTokens', () => {
  it('숫자와 영문 라벨이 섞인 옵션에서 둘 다 뽑는다', () => {
    expect(extractSizeTokens('2 (L)')).toEqual(['2', 'L'])
  })

  it('영문만 있으면 통째로 한 토큰이다', () => {
    expect(extractSizeTokens('XL')).toEqual(['XL'])
  })

  it('숫자만 있는 라벨도 뽑는다', () => {
    expect(extractSizeTokens('95')).toEqual(['95'])
  })

  it('소문자는 대문자로 정규화한다', () => {
    expect(extractSizeTokens('free')).toEqual(['FREE'])
  })

  it('한글·기호만 있으면 빈 배열이다', () => {
    expect(extractSizeTokens('(-)')).toEqual([])
  })
})

describe('sizesMatch', () => {
  it('"2 (L)"과 "L"을 같은 사이즈로 본다', () => {
    expect(sizesMatch('2 (L)', 'L')).toBe(true)
  })

  it('"2 (L)"과 "2"를 같은 사이즈로 본다', () => {
    expect(sizesMatch('2 (L)', '2')).toBe(true)
  })

  it('대소문자를 구분하지 않는다', () => {
    expect(sizesMatch('l', 'L')).toBe(true)
  })

  it('"XL"과 "L"은 다른 사이즈다', () => {
    expect(sizesMatch('XL', 'L')).toBe(false)
  })

  it('빈 문자열끼리는 매칭하지 않는다', () => {
    expect(sizesMatch('', '')).toBe(false)
  })

  it('한쪽이 비어 있으면 매칭하지 않는다', () => {
    expect(sizesMatch('L', '')).toBe(false)
  })
})

describe('findMatchingSize', () => {
  it('실측표 행 라벨이 "L"뿐이어도 옵션 "2 (L)"과 이어준다', () => {
    expect(findMatchingSize(['S', 'M', 'L'], '2 (L)')).toBe('L')
  })

  it('실측표가 숫자 라벨이면 옵션의 숫자와 이어준다', () => {
    expect(findMatchingSize(['1', '2', '3'], '2 (L)')).toBe('2')
  })

  it('정확히 같은 라벨이 있으면 그것을 먼저 고른다', () => {
    expect(findMatchingSize(['2', '2 (L)'], '2 (L)')).toBe('2 (L)')
  })

  it('맞는 게 없으면 undefined다', () => {
    expect(findMatchingSize(['S', 'M'], 'XL')).toBeUndefined()
  })

  it('후보가 없으면 undefined다', () => {
    expect(findMatchingSize([], 'L')).toBeUndefined()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npm test -- tests/musinsa/sizeMatch.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/musinsa/sizeMatch'` (아직 파일이 없으므로).

- [ ] **Step 3: 최소 구현을 쓴다**

`lib/musinsa/sizeMatch.ts`를 새로 만든다:

```ts
/**
 * 사이즈 라벨에서 숫자 토큰과 영문 토큰을 뽑는다. "2 (L)" → ["2", "L"].
 *
 * 영문은 글자 단위가 아니라 **덩어리 단위**로 자른다 — "XL"을 ["X","L"]로 쪼개면
 * "L"과 교집합이 생겨 다른 사이즈끼리 매칭돼 버린다.
 * 한글·괄호·공백은 애초에 토큰이 되지 않는다(사이즈를 식별하는 정보가 아니다).
 */
export function extractSizeTokens(label: string): string[] {
  return label.toUpperCase().match(/[A-Z]+|\d+/g) ?? []
}

/**
 * 두 사이즈 라벨이 같은 사이즈를 가리키는지 본다.
 *
 * 무신사 상품 옵션은 "2 (L)"처럼 번호와 알파벳을 함께 쓰는데 실측표 행 라벨은 "L"이나 "2"
 * 한쪽만 있는 경우가 많다. 그래서 정확히 같은 문자열을 요구하지 않고 토큰 하나라도 겹치면
 * 같은 사이즈로 본다. 문자열 포함(substring) 검사를 쓰지 않는 이유는 "XL"이 "L"을 포함해
 * 서로 다른 사이즈가 매칭돼 버리기 때문이다.
 *
 * 남는 한계: "2 (L)"과 "2 (XL)"처럼 번호가 같고 알파벳만 다른 라벨이 한 표에 함께 있으면
 * 번호 토큰 때문에 매칭될 수 있다. 실제 무신사 상품에서는 번호와 알파벳이 1:1이라
 * 이런 조합이 나오지 않아 그대로 둔다.
 */
export function sizesMatch(a: string, b: string): boolean {
  const tokensA = extractSizeTokens(a)
  const tokensB = extractSizeTokens(b)
  if (tokensA.length === 0 || tokensB.length === 0) return false
  return tokensA.some((token) => tokensB.includes(token))
}

/**
 * 실측표 행 라벨 목록에서 선택한 사이즈에 해당하는 것을 고른다.
 *
 * 정확히 같은 라벨을 먼저 찾고, 없을 때만 토큰 일치로 넓힌다 — 후보가 여럿일 때
 * 정확한 쪽을 놓치지 않기 위해서다.
 */
export function findMatchingSize(candidates: string[], size: string): string | undefined {
  const normalized = size.trim().toUpperCase()
  const exact = candidates.find((candidate) => candidate.trim().toUpperCase() === normalized)
  if (exact) return exact
  return candidates.find((candidate) => sizesMatch(candidate, size))
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
npm test -- tests/musinsa/sizeMatch.test.ts
```

Expected: PASS — 16개 테스트 전부 통과.

- [ ] **Step 5: `GarmentForm`이 이 함수를 쓰게 바꾼다**

`components/garment/GarmentForm.tsx`의 import 목록에 추가한다(`STANDARD_KEYS` import 아래):

```ts
import { findMatchingSize } from '@/lib/musinsa/sizeMatch'
```

그리고 `matchedSizeKey` 계산을 교체한다. **기존 코드**(주석 두 줄 포함):

```ts
  // 붙여넣은 표의 사이즈 라벨(예: "L")은 무신사 원문 그대로 보존하지만, 사용자가 이 입력칸에
  // 소문자로 적어도("l") 매칭되도록 대소문자 구분 없이 비교한다.
  // 신발·액세서리는 FIT_RULES에 항목이 없어 애초에 핏 채점 대상이 아니므로(lib/fit/rules.ts 주석 참고),
  // 실측 입력 UI 자체를 보여주지 않는다 — 의미 없는 총장·가슴단면 입력칸을 채우게 하지 않기 위해서다.
  const hasMeasurableFit = category in FIT_RULES

  const matchedSizeKey = Object.keys(pastedSizeTable).find(
    (key) => key.toLowerCase() === size.trim().toLowerCase(),
  )
```

**바꿀 코드**:

```ts
  // 신발·액세서리는 FIT_RULES에 항목이 없어 애초에 핏 채점 대상이 아니므로(lib/fit/rules.ts 주석 참고),
  // 실측 입력 UI 자체를 보여주지 않는다 — 의미 없는 총장·가슴단면 입력칸을 채우게 하지 않기 위해서다.
  const hasMeasurableFit = category in FIT_RULES

  // 옵션 라벨("2 (L)")과 붙여넣은 표의 행 라벨("L")이 글자까지 같지 않아도 이어준다.
  // 매칭 규칙은 lib/musinsa/sizeMatch.ts에 순수 함수로 있다(단위 테스트 대상).
  const matchedSizeKey = findMatchingSize(Object.keys(pastedSizeTable), size)
```

- [ ] **Step 6: 빌드와 전체 테스트 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 123개(기존 107 + 신규 16) 전부 통과.

- [ ] **Step 7: 브라우저로 확인**

`/wardrobe`에서 사이즈 옵션 라벨이 `"2 (L)"`류인 무신사 상품(예: `https://www.musinsa.com/products/6996910`)을 불러온 뒤, 무신사 "사이즈" 탭의 실측표를 복사해 붙여넣는다. **선택한 사이즈에 해당하는 값이 "…사이즈 값이 자동으로 채워졌습니다"로 뜨는지** 확인한다. 리팩터링 전에는 이 경우 자동 채움이 안 되고 9칸 수동 입력이 떴다.

- [ ] **Step 8: 커밋**

```bash
git add lib/musinsa/sizeMatch.ts tests/musinsa/sizeMatch.test.ts components/garment/GarmentForm.tsx
git commit -m "feat: match size labels by token so 2 (L) finds L"
git push
```

---

## Task 3: 삭제 버튼을 아이콘 버튼으로 통일

옷장 상세의 밑줄 텍스트 링크를 휴지통 아이콘 버튼으로 바꾼다. 2단계 확인 흐름 자체는 그대로 둔다. 여기서 정한 모양을 Task 4의 장바구니 삭제 버튼이 그대로 쓴다.

**Files:**
- Modify: `components/garment/DeleteGarmentButton.tsx`

**Interfaces:**
- Consumes: `Button`(`@/components/ui/Button`)의 `variant="danger"` — 변경 없음
- Produces: 없음(내부 스타일만 바뀐다). `DeleteGarmentButton`의 props(`garmentId: string`)는 그대로다.

- [ ] **Step 1: `DeleteGarmentButton`의 첫 버튼을 아이콘 버튼으로 교체**

`components/garment/DeleteGarmentButton.tsx` 전체를 아래로 바꾼다:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'

/**
 * 옷 삭제 버튼. 실수로 지우는 걸 막기 위해 한 번 누르면 확인 문구가 뜨는 2단계다.
 * window.confirm을 쓰지 않는 이유: 브라우저 모달은 스타일을 맞출 수 없고 페이지 전체를 막는다.
 *
 * 첫 버튼은 글자 없이 아이콘만 있으므로 aria-label로 이름을 준다 — 스크린리더에서
 * "버튼"으로만 읽히면 무슨 버튼인지 알 수 없기 때문이다.
 *
 * Button에 패딩 클래스를 넘겨 정사각형으로 만들지 않는다: 이 프로젝트엔 tailwind-merge가 없어
 * className이 Button 내부의 px-4 py-2를 이기지 못한다(계획 서두 "사전 확인된 사실" 참고).
 * 기본 패딩 그대로도 아이콘이 가운데 오는 작은 버튼이라 보기에 문제없다.
 */
export function DeleteGarmentButton({ garmentId }: { garmentId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const response = await fetch(`/api/garments/${garmentId}`, { method: 'DELETE' })
    if (response.ok) {
      router.push('/wardrobe')
      router.refresh()
      return
    }
    setDeleting(false)
  }

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)} aria-label="삭제">
        <Trash size={16} weight="bold" />
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm text-ink">
      <span>정말 삭제할까요?</span>
      <Button variant="danger" onClick={handleDelete} disabled={deleting}>
        {deleting ? '삭제 중…' : '삭제'}
      </Button>
      <Button variant="secondary" onClick={() => setConfirming(false)}>
        취소
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: 빌드와 테스트 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 123개 전부 통과.

빌드가 `Export Trash doesn't exist`로 실패하면 아이콘 이름이 틀린 것이다 — 에러 메시지가 알려주는 정확한 이름(대소문자 포함)으로 고친다.

- [ ] **Step 3: 브라우저로 확인**

진짜 옷을 지우지 않도록, 먼저 `/wardrobe`에서 아무 무신사 링크로 **검증용 옷 하나를 새로 등록한다.** 그 옷을 눌러 상세로 들어간 뒤 페이지 맨 아래를 본다:

1. **빨간 배경의 휴지통 아이콘 버튼이 보이는지**
2. 누르면 **"정말 삭제할까요? [삭제] [취소]"가 뜨는지**
3. "취소"를 누르면 아이콘 버튼으로 돌아오는지
4. 다시 눌러 "삭제" → **`/wardrobe`로 돌아가고 그 옷이 목록에서 사라졌는지**(검증용으로 만든 옷이 이 단계에서 정리된다)

- [ ] **Step 4: 커밋**

```bash
git add components/garment/DeleteGarmentButton.tsx
git commit -m "feat: restyle garment delete button as icon button"
git push
```

---

## Task 4: 장바구니 선택 삭제·전체 삭제

장바구니 카드마다 체크박스를 상시 노출하고, 상단에 "선택 삭제"·"전체 삭제"를 둔다. 선택 상태를 들 곳이 필요하므로 새 클라이언트 컴포넌트 `CartList`를 만들고, 서버 컴포넌트인 `/cart` 페이지는 데이터만 넘긴다.

**Files:**
- Modify: `components/garment/CartItemCard.tsx` (체크박스 추가, props 확장)
- Create: `components/garment/CartList.tsx`
- Modify: `app/(app)/cart/page.tsx` (카드 나열 → `CartList` 하나로)

**Interfaces:**
- Consumes: `CartItem` 타입(`@/components/garment/CartItemCard`에서 export, 변경 없음), `Button`, `DELETE /api/garments/:id`
- Produces: `CartItemCard`의 props가 `{ item: CartItem }`에서 `{ item: CartItem; checked: boolean; onToggle: (id: string) => void }`로 **바뀐다**(추가가 아니라 필수 prop 확장). 유일한 호출부가 `CartList`이므로 다른 파일은 영향받지 않는다.
- Produces: `CartList` — `props: { items: CartItem[] }`

- [ ] **Step 1: `CartItemCard`에 체크박스를 추가한다**

`components/garment/CartItemCard.tsx`에서 `export function CartItemCard({ item }: { item: CartItem }) {` 줄부터 끝까지를 아래로 바꾼다(파일 위쪽의 import와 `CartItem`·`VERDICT_LABELS` 선언은 그대로 둔다):

```tsx
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
      </div>
      <Button onClick={markAsBought} disabled={saving} className="shrink-0 px-3 py-2 text-xs">
        {saving ? '처리 중…' : '샀어요'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: `CartList`를 만든다**

`components/garment/CartList.tsx`를 새로 만든다:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash } from '@phosphor-icons/react'
import { CartItemCard, type CartItem } from '@/components/garment/CartItemCard'
import { Button } from '@/components/ui/Button'

type Props = { items: CartItem[] }

/**
 * 장바구니 목록 + 선택/전체 삭제.
 *
 * /cart 페이지는 서버 컴포넌트라 상태를 들 수 없어서, 선택 상태가 필요한 이 부분만
 * 클라이언트 컴포넌트로 떼어냈다. 페이지는 데이터를 가져와 넘기기만 한다.
 *
 * 삭제에 벌크 API를 새로 만들지 않고 기존 단건 DELETE를 병렬로 부른다:
 * RLS가 이미 요청마다 소유자를 확인하고, 개인 옷장 규모(많아야 수십 개)에서
 * 요청 수가 문제 될 일이 없어 서버 코드를 늘릴 이유가 없다.
 *
 * 이 컴포넌트는 items가 1개 이상일 때만 렌더링된다(빈 장바구니는 페이지가 직접 안내 문구를
 * 그린다) — 그래서 "전체 삭제" 버튼을 조건 없이 그려도 된다.
 */
export function CartList({ items }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState<'selected' | 'all' | null>(null)
  const [deleting, setDeleting] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      // Set을 그대로 수정하면 참조가 같아 React가 리렌더를 건너뛴다 — 항상 새 Set을 만든다.
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const targetIds = confirming === 'all' ? items.map((item) => item.id) : [...selected]

  async function handleDelete() {
    setDeleting(true)
    await Promise.all(targetIds.map((id) => fetch(`/api/garments/${id}`, { method: 'DELETE' })))
    setDeleting(false)
    setConfirming(null)
    setSelected(new Set())
    // 일부가 실패해도 따로 알리지 않는다 — refresh가 실제 DB 상태를 다시 가져오므로
    // 안 지워진 항목은 목록에 그대로 남아 그 자체로 신호가 된다.
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
          <span>
            {confirming === 'all' ? `전체 ${items.length}개를` : `선택한 ${selected.size}개를`} 삭제할까요?
          </span>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? '삭제 중…' : '삭제'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(null)} disabled={deleting}>
            취소
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-ink-muted">
            {selected.size > 0 ? `${selected.size}개 선택됨` : `${items.length}개`}
          </span>
          <div className="flex gap-2">
            {/* gap-1.5는 BASE에 없는 속성이라 안전하게 더해진다. 패딩은 넘기지 않는다(계획 서두 참고). */}
            {selected.size > 0 && (
              <Button variant="danger" onClick={() => setConfirming('selected')} className="gap-1.5">
                <Trash size={16} weight="bold" />
                선택 삭제
              </Button>
            )}
            <Button variant="secondary" onClick={() => setConfirming('all')} className="gap-1.5">
              <Trash size={16} weight="bold" />
              전체 삭제
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <CartItemCard key={item.id} item={item} checked={selected.has(item.id)} onToggle={toggle} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `/cart` 페이지가 `CartList`를 쓰게 바꾼다**

`app/(app)/cart/page.tsx`에서 import를 바꾼다. **기존**:

```ts
import { CartItemCard, type CartItem } from '@/components/garment/CartItemCard'
```

**변경** — `CartItemCard`는 이제 이 파일에서 직접 쓰지 않고 `CartItem` 타입만 남으므로, 이 코드베이스가 순수 타입 import에 쓰는 `import type` 형태로 바꾼다(예: `AnalyzeLinkBar.tsx`의 `import type { Verdict }`):

```ts
import { CartList } from '@/components/garment/CartList'
import type { CartItem } from '@/components/garment/CartItemCard'
```

그리고 렌더링 부분의 `else` 가지를 바꾼다. **기존**:

```tsx
      ) : (
        <div className="space-y-2">
          {items.map((item) => <CartItemCard key={item.id} item={item} />)}
        </div>
      )}
```

**변경**:

```tsx
      ) : (
        <CartList items={items} />
      )}
```

- [ ] **Step 4: 빌드와 테스트 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 123개 전부 통과.

`CartItemCard`의 props를 필수로 늘렸으므로, 혹시 다른 곳에서 쓰고 있었다면 여기서 타입 에러로 잡힌다.

- [ ] **Step 5: 브라우저로 확인**

먼저 검증용 데이터를 만든다 — `/analyze`에서 무신사 링크로 "판단하기"를 3번 해서 장바구니에 3개를 넣는다(판단한 옷은 `status='considering'`으로 장바구니에 담긴다). 그다음 `/cart`에서:

1. **카드마다 체크박스가 보이는지**, 상단에 "3개"와 "전체 삭제"가 보이는지
2. 하나를 체크 → 상단이 **"1개 선택됨"으로 바뀌고 "선택 삭제" 버튼이 나타나는지**
3. "선택 삭제" → **"선택한 1개를 삭제할까요?"** → "취소" → 원래대로 돌아오는지
4. 다시 "선택 삭제" → "삭제" → **체크한 것만 사라지고 나머지 2개는 남는지**
5. "전체 삭제" → "전체 2개를 삭제할까요?" → "삭제" → **목록이 비고 "고민 중인 옷이 없습니다" 안내가 뜨는지**

검증이 끝나면 남은 테스트 데이터가 없는지 `/cart`와 `/wardrobe`에서 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add components/garment/CartItemCard.tsx components/garment/CartList.tsx "app/(app)/cart/page.tsx"
git commit -m "feat: add select and bulk delete to cart"
git push
```

---

## Task 5: README 기록

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 맨 끝에 "계획 7 — 등록·삭제 UX 개선" 절을 추가한다**

기존 절들과 같은 형식(문제 / 원인 / 해결 / 검증 / 결과)으로 쓴다. **이 계획을 실행하며 실제로 겪은 문제만 적는다** — 미리 예상한 문제를 적지 않는다. 겪은 문제가 없었다면 그렇게 쓰고, 대신 내린 설계 판단과 근거를 남긴다.

최소한 아래는 계획 작성 시점에 이미 확정된 판단이라 기록할 가치가 있다:

- **폼 접기에 새 메서드를 만들지 않은 것** — 처음엔 "URL은 남기고 폼만 닫는" `collapse()`를 설계했지만, 사용자가 "URL도 같이 지워달라"고 해서 계획 6의 `reset()`과 요구사항이 정확히 같아졌다. 설계 대화 한 번으로 새 API가 사라진 사례.
- **`type="button"`이 없으면 접기 버튼이 폼을 제출해 버린다는 것** — `<form>` 안의 `<button>`은 type 기본값이 submit이다.
- **substring 대신 토큰 매칭을 쓴 이유** — `"2 (L)".includes("L")`은 참이지만 `"XL".includes("L")`도 참이라 서로 다른 사이즈가 매칭된다. 영문을 덩어리로 자르면 `"XL"`과 `"L"`이 다른 토큰이 되어 구분된다.
- **스펙에 없던 `findMatchingSize`를 더한 이유** — 정확 일치 우선 규칙까지 순수 함수 안에 넣어야 컴포넌트가 내리는 결정 전체를 단위 테스트할 수 있다.
- **벌크 삭제 API를 만들지 않은 이유** — RLS가 요청마다 소유자를 확인하고 개인 옷장 규모가 작아, 기존 단건 DELETE를 `Promise.all`로 부르는 것으로 충분하다.
- **선택 상태를 `CartList`로 끌어올린 이유** — "어느 카드가 선택됐는지"는 카드 한 장이 알 수 있는 정보가 아니다. `/cart`가 서버 컴포넌트라 상태를 들 수 없어 클라이언트 경계를 이 컴포넌트로 그었다.
- 아이콘 이름을 **파일 존재가 아니라 파일 내용으로** 확인한 것(계획 4의 `Coathanger`/`CoatHanger` 사고 재발 방지)
- **`Button`에 넘기는 `className`이 내부 패딩을 못 이긴다는 것** — `tailwind-merge`가 없어서 `` `${BASE} ${className}` ``로 이어붙여도 Tailwind가 CSS를 유틸리티 고정 순서로 내보내기 때문에 `BASE`의 `px-4`가 이긴다. 계획을 쓰며 아이콘 버튼을 정사각형으로 만들려고 `p-2`를 넘기려다 발견했고, 확인해 보니 기존 `CartItemCard`의 `px-3`도 이미 먹지 않고 있었다(아무도 몰랐다). 이번엔 패딩을 덮어쓰지 않는 쪽으로 피해 갔지만, 앞으로 `Button`의 크기를 정말 바꿔야 하면 `className`이 아니라 `Button`에 `size` 같은 variant를 더하는 게 맞다.

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: log registration and deletion UX work"
git push
```

---

## 남은 일 (이 계획 밖)

합의한 A~F 중 A(계획 6)와 B(이 계획)가 끝난다. 나머지는 각자 별도 스펙·계획 사이클로 진행한다.

- **C. 수동 등록** — 무신사 링크 없이 사진 업로드 + 직접 입력. `garments.source_url`·`goods_no`가 nullable이고 `parse_mode`에 `'manual'` 기본값이 이미 있어 DB 변경 없이 가능할 수 있다.
- **D. 추천 → 룩 흐름** — 추천 직후 그 아이템으로 바로 룩 짜기
- **E. 핏 판단 정밀화** — 항목별 개별 허용오차, 심각도·가중치·판정 경계값
- **F. 가격 인하 표시** — 주기적으로 장바구니 상품 가격 재확인, "원래 얼마 → 얼마" 표시. 이메일·알림 토글은 범위에서 뺐다.
- **`MUSINSA_CATEGORY_MAP` 확장** — 액세서리류의 실제 무신사 대분류명을 확인하면 추가한다(커밋 `2893adf` 참고).
- **삭제 되돌리기(휴지통)** — 이번엔 즉시 삭제만 다뤘다(스펙 §7).
