# 추천 → 룩 흐름 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** 친구가 옷장 주인에게 아이템을 추천하면, 그 자리에서 방금 추천한 아이템을 재료로 바로 룩을 짤 수 있게 한다.

**Architecture:** `outfit_items` RLS가 `status`가 아니라 `owner_id`만 검사하므로(§"사전 확인된 사실" 참고) DB·RLS 변경 없이 순수 프론트엔드로 끝낸다. `RecommendLinkBar`(추천하기)와 `OutfitBuilder`(룩 만들기)는 서버 컴포넌트인 `page.tsx`의 형제 섹션이라 상태를 공유할 수 없으므로, 새 클라이언트 래퍼 `RecommendAndBuild`가 둘을 감싸고 "방금 추천한 아이템" 목록을 `sessionStorage`로 들고 있는다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Tailwind CSS v4 · Vitest(node 환경) · Supabase(RLS)

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-17-recommend-to-outfit-design.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- TypeScript `strict: true`, `any` 금지. `npm run build`가 타입 에러 0개로 통과해야 한다.
- 사용자에게 하는 설명·요약·질문, 그리고 UI 문구는 한국어로 쓴다.
- 기능 단위마다 그 코드가 무엇을 하고 왜 그렇게 짰는지 설명하는 주석을 남긴다 (이 프로젝트의 학습 목적 예외 규칙).
- 태스크마다 커밋하고 push한다. 여러 태스크를 한 커밋에 몰아넣지 않는다.
- 커밋 메시지에 `Co-Authored-By: Claude` 등 AI 기여자 트레일러를 넣지 않는다.
- **새 의존성을 설치하지 않는다.** 상태 공유는 브라우저 기본 `sessionStorage`만 쓴다.
- **DB 마이그레이션을 추가하지 않는다.** `outfit_items_insert` RLS가 이미 이 기능에 필요한 권한을 허용한다(아래 "사전 확인된 사실" 참고).
- **`RecommendLinkBar`·`OutfitBuilder`의 새 props는 전부 선택(optional)으로 둔다** — `RecommendAndBuild` 없이 단독으로 쓰던 기존 방식이 그대로 동작해야 한다.

### 이 계획의 테스트 전략

컴포넌트·훅 렌더링 테스트 인프라가 이 프로젝트에 없어(계획 6·7·8과 같은 이유) `npm run build`(타입 검증) + `npm test`(회귀) + 브라우저 수동 검증을 쓴다. 새 로직(타입 확장, sessionStorage 읽고 쓰기)은 전부 UI에 바로 연결되는 얇은 코드라 순수 함수 단위 테스트로 뽑을 게 마땅치 않다 — Task 4에서 두 계정으로 전체 흐름을 실제로 눌러 확인하는 것이 이 계획의 핵심 검증이다.

### 사전 확인된 사실 (계획 작성 중 실제로 확인함)

- **`outfit_items_insert` RLS(`supabase/migrations/0005_outfits.sql`)는 `g.owner_id = o.wardrobe_owner_id`만 검사하고 `status`는 보지 않는다.** 방금 추천으로 들어간 `status='considering'` 아이템도 이미 룩에 넣을 권한이 있다는 뜻이다 — DB·RLS를 하나도 안 건드려도 된다.
- `registerGarment`(`lib/garments/register.ts`)는 이미 `finalImageUrl`(Storage 복사까지 끝난 최종 이미지 URL)을 계산해 두고도 반환하지 않고 있었다 — `RegisterGarmentResult`에 실어 돌려주기만 하면 된다.
- `app/u/[share_slug]/page.tsx`가 서버에서 가져오는 `garments`(`PublicGarment[]`)는 `OutfitBuilder`가 쓰는 `BuilderGarment`(`{id, name, image_url}`)의 상위 집합이라, 지금도 별도 매핑 없이 그대로 넘기고 있다(`<OutfitBuilder garments={garments ?? []} />`) — TypeScript는 변수(객체 리터럴이 아닌)를 좁은 타입의 prop에 넘길 때 초과 속성을 허용하므로 `RecommendAndBuild`에 그대로 넘겨도 타입 에러가 안 난다.
- `RecommendLinkBar`·`OutfitBuilder`는 지금 `app/u/[share_slug]/page.tsx` 한 곳에서만 쓰인다(`grep`으로 확인) — 이번 계획에서 두 컴포넌트의 새 prop을 전부 선택으로 둬도 실질적으로 깨질 다른 호출부가 없다.

---

## Task 1: `registerGarment` 결과에 이름·이미지 싣기

**Files:**
- Modify: `lib/garments/register.ts`
- Modify: `app/api/recommend/route.ts`

**Interfaces:**
- Produces: `RegisterGarmentResult`에 `name: string`, `imageUrl: string | null` 추가
- Consumes: 없음(기존 계산값을 반환 객체에 실어 나르기만 한다)

- [ ] **Step 1: `RegisterGarmentResult` 타입에 필드를 추가한다**

`lib/garments/register.ts`에서:

```ts
export type RegisterGarmentResult = {
  id: string
  duplicate: boolean
  /** 옷 자체는 저장됐지만 실측 저장이 실패한 경우. 호출부가 응답 상태 코드를 결정할 때 쓴다. */
  measurementsFailed: boolean
}
```

를:

```ts
export type RegisterGarmentResult = {
  id: string
  name: string
  /** Storage 복사까지 끝난 최종 이미지 URL. 추천 직후 룩 재료 목록에 바로 쓸 수 있게 넘긴다(계획 9). */
  imageUrl: string | null
  duplicate: boolean
  /** 옷 자체는 저장됐지만 실측 저장이 실패한 경우. 호출부가 응답 상태 코드를 결정할 때 쓴다. */
  measurementsFailed: boolean
}
```

- [ ] **Step 2: 반환 객체에 값을 채운다**

같은 파일 맨 끝의 `return`:

```ts
  return {
    id: garment.id,
    duplicate: Boolean(duplicateCount && duplicateCount > 0),
    measurementsFailed,
  }
```

를:

```ts
  return {
    id: garment.id,
    name: input.name,
    imageUrl: finalImageUrl,
    duplicate: Boolean(duplicateCount && duplicateCount > 0),
    measurementsFailed,
  }
```

(`finalImageUrl`은 바로 위에서 이미 계산돼 있는 변수다 — 새 변수를 만들 필요가 없다.)

- [ ] **Step 3: `/api/recommend`가 확장된 필드를 응답에 담는다**

`app/api/recommend/route.ts`에서:

```ts
    const result = await registerGarment(supabase, wardrobeOwnerId, 'considering', {
      ...input,
      recommendedBy: user.id,
      note,
    })
    return NextResponse.json({ id: result.id }, { status: 201 })
```

를:

```ts
    const result = await registerGarment(supabase, wardrobeOwnerId, 'considering', {
      ...input,
      recommendedBy: user.id,
      note,
    })
    // name·imageUrl은 추천 직후 프론트가 룩 재료 목록에 바로 추가하는 데 쓴다(RecommendLinkBar.onRecommended).
    return NextResponse.json({ id: result.id, name: result.name, imageUrl: result.imageUrl }, { status: 201 })
```

- [ ] **Step 4: 빌드와 테스트로 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 126개 전부 통과. `/api/garments`·`/api/analyze`는 `result.name`·`result.imageUrl`을 쓰지 않으므로 동작 변화가 없어야 한다.

- [ ] **Step 5: 커밋**

```bash
git add lib/garments/register.ts app/api/recommend/route.ts
git commit -m "feat: return garment name and image url from register pipeline"
git push
```

---

## Task 2: `OutfitBuilder` — 자동 선택·추천 배지·제출 콜백

**Files:**
- Modify: `components/share/OutfitBuilder.tsx`

**Interfaces:**
- Produces: `export type BuilderGarment = { id: string; name: string; image_url: string | null; justRecommended?: boolean }` (이제 export됨)
- Produces: `Props`에 `preselectId?: string | null`, `onSubmitted?: () => void` 추가(둘 다 선택)
- Consumes: 없음

- [ ] **Step 1: `BuilderGarment` 타입을 export하고 필드를 추가한다**

```ts
type BuilderGarment = { id: string; name: string; image_url: string | null }
```

를:

```ts
export type BuilderGarment = {
  id: string
  name: string
  image_url: string | null
  /** RecommendAndBuild가 방금 추천한 아이템에만 true로 채운다 — 옷장 실물과 구분하는 배지에 쓴다. */
  justRecommended?: boolean
}
```

- [ ] **Step 2: `Props`에 새 필드를 추가한다**

```ts
type Props = {
  wardrobeOwnerId: string
  garments: BuilderGarment[]
}
```

를:

```ts
type Props = {
  wardrobeOwnerId: string
  garments: BuilderGarment[]
  /** 값이 바뀔 때마다(추천할 때마다) 그 id를 selected에 자동으로 더한다. */
  preselectId?: string | null
  /** 룩 생성에 성공하면 호출한다. RecommendAndBuild가 이걸로 추천 목록을 비운다. */
  onSubmitted?: () => void
}
```

- [ ] **Step 3: import와 함수 시그니처를 고친다**

```ts
import { useState } from 'react'
```

를:

```ts
import { useEffect, useState } from 'react'
```

로, 그리고:

```ts
export function OutfitBuilder({ wardrobeOwnerId, garments }: Props) {
```

를:

```ts
export function OutfitBuilder({ wardrobeOwnerId, garments, preselectId, onSubmitted }: Props) {
```

로 바꾼다.

- [ ] **Step 4: `preselectId`를 반영하는 effect를 추가한다**

`const [done, setDone] = useState(false)` 바로 아래(다른 훅들과 함께, `if (garments.length === 0)` 조기 반환보다 반드시 위)에 추가한다 — 리액트 훅은 조건부 반환 이전에 항상 같은 순서로 호출돼야 한다:

```ts
  // 추천 직후 preselectId가 바뀔 때마다 자동으로 체크한다. 이미 선택돼 있으면(같은 값이 다시
  // 와도) 중복으로 더하지 않는다.
  useEffect(() => {
    if (!preselectId) return
    setSelected((prev) => (prev.includes(preselectId) ? prev : [...prev, preselectId]))
  }, [preselectId])
```

- [ ] **Step 5: 제출 성공 시 `onSubmitted`를 호출한다**

```ts
    setDone(true)
    setTitle('')
    setDescription('')
    setSelected([])
    router.refresh()
  }
```

를:

```ts
    setDone(true)
    setTitle('')
    setDescription('')
    setSelected([])
    router.refresh()
    onSubmitted?.()
  }
```

- [ ] **Step 6: 추천함 배지를 추가한다**

`INPUT, CARD_SURFACE` import 줄에 `pillClass`를 더한다:

```ts
import { INPUT, CARD_SURFACE } from '@/components/ui/styles'
```

를:

```ts
import { INPUT, CARD_SURFACE, pillClass } from '@/components/ui/styles'
```

썸네일 `<label>` 안, `<div className="relative h-full w-full bg-canvas">` 블록 뒤에 배지를 추가한다. **기존**:

```tsx
            <div className="relative h-full w-full bg-canvas">
              {garment.image_url && (
                <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="150px" />
              )}
            </div>
          </label>
```

**변경**:

```tsx
            <div className="relative h-full w-full bg-canvas">
              {garment.image_url && (
                <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="150px" />
              )}
            </div>
            {garment.justRecommended && (
              <span className={`${pillClass('active')} absolute left-1 top-1 px-2 py-0.5 text-xs`}>
                추천함
              </span>
            )}
          </label>
```

(바깥 `<label>`이 이미 `relative`라 `absolute` 배지가 그 안에서 위치 잡힌다.)

- [ ] **Step 7: 빌드와 테스트로 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 126개 전부 통과.

- [ ] **Step 8: 커밋**

```bash
git add components/share/OutfitBuilder.tsx
git commit -m "feat: let OutfitBuilder preselect and badge recommended items"
git push
```

---

## Task 3: `RecommendLinkBar` — 추천 성공 콜백

**Files:**
- Modify: `components/share/RecommendLinkBar.tsx`

**Interfaces:**
- Consumes: `BuilderGarment`(Task 2에서 export됨)
- Produces: `Props`에 `onRecommended?: (garment: BuilderGarment) => void` 추가(선택)

- [ ] **Step 1: `RecommendLinkBar.tsx` 전체를 아래로 바꾼다**

```tsx
'use client'

import { useState } from 'react'
import { GarmentForm } from '@/components/garment/GarmentForm'
import { useMusinsaParse } from '@/components/garment/useMusinsaParse'
import { MusinsaLinkInput } from '@/components/garment/MusinsaLinkInput'
import type { BuilderGarment } from '@/components/share/OutfitBuilder'

type Props = {
  wardrobeOwnerId: string
  /** 추천에 성공하면 방금 등록된 아이템을 넘겨준다 — RecommendAndBuild가 룩 재료 목록에 바로 더하는 데 쓴다. */
  onRecommended?: (garment: BuilderGarment) => void
}

export function RecommendLinkBar({ wardrobeOwnerId, onRecommended }: Props) {
  const [done, setDone] = useState(false)
  // 새 링크를 파싱하기 시작하면 이전 완료 메시지를 지운다 — 기존 handleSubmit의 setDone(false)와 같은 역할.
  const parse = useMusinsaParse({ onStart: () => setDone(false) })

  return (
    <div className="space-y-4">
      <MusinsaLinkInput {...parse} placeholder="추천하고 싶은 무신사 상품 링크를 붙여넣으세요" />

      {parse.parsed && !done && (
        <GarmentForm
          parsed={parse.parsed}
          sourceUrl={parse.url}
          submitEndpoint="/api/recommend"
          submitLabel="추천하기"
          noteField
          extraBody={{ wardrobeOwnerId }}
          onCancel={parse.reset}
          onSubmitted={(data) => {
            parse.reset()
            setDone(true)
            // 서버 응답이 예상 형식이 아니면(id가 없는 등) 조용히 건너뛴다 — "추천했습니다!"
            // 문구는 그대로 뜨므로 추천 자체가 실패한 것처럼 보이지 않는다(스펙 §8).
            if (typeof data.id === 'string') {
              onRecommended?.({
                id: data.id,
                name: typeof data.name === 'string' ? data.name : '',
                image_url: typeof data.imageUrl === 'string' ? data.imageUrl : null,
                justRecommended: true,
              })
            }
          }}
        />
      )}

      {done && <p className="text-sm text-ink">추천했습니다! 상대방의 장바구니에 담겼습니다.</p>}
    </div>
  )
}
```

- [ ] **Step 2: 빌드와 테스트로 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 126개 전부 통과. `RecommendLinkBar`를 쓰는 곳이 아직 없으므로(Task 4에서 연결) 이 시점엔 동작 변화가 없다.

- [ ] **Step 3: 커밋**

```bash
git add components/share/RecommendLinkBar.tsx
git commit -m "feat: notify parent when a recommendation succeeds"
git push
```

---

## Task 4: `RecommendAndBuild` 래퍼 + 페이지 연결

**Files:**
- Create: `components/share/RecommendAndBuild.tsx`
- Modify: `app/u/[share_slug]/page.tsx`

**Interfaces:**
- Consumes: `RecommendLinkBar`(Task 3), `OutfitBuilder`·`BuilderGarment`(Task 2)
- Produces: `RecommendAndBuild`(`props: { wardrobeOwnerId: string; garments: BuilderGarment[] }`)

- [ ] **Step 1: `RecommendAndBuild.tsx`를 만든다**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { RecommendLinkBar } from '@/components/share/RecommendLinkBar'
import { OutfitBuilder, type BuilderGarment } from '@/components/share/OutfitBuilder'

type Props = {
  wardrobeOwnerId: string
  /** 옷장 주인의 실제 소유 옷(status='owned'). 서버 컴포넌트인 page.tsx가 가져와 넘긴다. */
  garments: BuilderGarment[]
}

/**
 * "추천하기"와 "룩 만들기"를 한 화면에서 잇는다. 두 컴포넌트는 원래 페이지의 형제 섹션이라
 * 상태를 공유할 수 없었는데, 방금 추천한 아이템을 룩 재료로 바로 쓰려면 상태 하나(추천 목록)를
 * 공유해야 해서 이 클라이언트 컴포넌트로 둘을 묶었다.
 *
 * 방금 추천한 아이템은 sessionStorage에 wardrobeOwnerId로 스코프해 저장한다: 새로고침해도
 * 남아야 하고, 이 페이지를 벗어나거나 룩을 제출하면 사라져야 하기 때문이다(사용자 요구,
 * 스펙 §3) — sessionStorage는 새로고침엔 살아남고, 언마운트 시 직접 지우면 페이지 이탈에서도
 * 정리된다. 서버 쿼리를 전혀 넓히지 않으므로 다른 방문자의 추천은 애초에 이 브라우저에도,
 * 서버 어디에도 남지 않는다.
 */
export function RecommendAndBuild({ wardrobeOwnerId, garments }: Props) {
  const storageKey = `recommended-look-material:${wardrobeOwnerId}`
  const [recommended, setRecommended] = useState<BuilderGarment[]>([])
  const [preselectId, setPreselectId] = useState<string | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(storageKey)
    if (raw) {
      try {
        setRecommended(JSON.parse(raw) as BuilderGarment[])
      } catch {
        // 손상된 값은 무시하고 빈 목록으로 시작한다.
      }
    }
    return () => sessionStorage.removeItem(storageKey)
  }, [storageKey])

  function handleRecommended(garment: BuilderGarment) {
    setRecommended((prev) => {
      const next = [garment, ...prev]
      sessionStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
    setPreselectId(garment.id)
  }

  function handleOutfitSubmitted() {
    setRecommended([])
    sessionStorage.removeItem(storageKey)
  }

  return (
    <>
      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-lg font-medium text-ink">추천하기</h2>
        <RecommendLinkBar wardrobeOwnerId={wardrobeOwnerId} onRecommended={handleRecommended} />
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-lg font-medium text-ink">룩 만들기</h2>
        <OutfitBuilder
          wardrobeOwnerId={wardrobeOwnerId}
          garments={[...recommended, ...garments]}
          preselectId={preselectId}
          onSubmitted={handleOutfitSubmitted}
        />
      </section>
    </>
  )
}
```

- [ ] **Step 2: `page.tsx`의 import를 바꾼다**

`app/u/[share_slug]/page.tsx`에서:

```ts
import { RecommendLinkBar } from '@/components/share/RecommendLinkBar'
import { OutfitBuilder } from '@/components/share/OutfitBuilder'
```

를:

```ts
import { RecommendAndBuild } from '@/components/share/RecommendAndBuild'
```

로 바꾼다.

- [ ] **Step 3: 두 섹션을 `RecommendAndBuild` 하나로 바꾼다**

**기존**:

```tsx
        {user && user.id !== profile.id && (
          <>
            <section className="space-y-3 border-t border-border pt-6">
              <h2 className="text-lg font-medium text-ink">추천하기</h2>
              <RecommendLinkBar wardrobeOwnerId={profile.id} />
            </section>

            <section className="space-y-3 border-t border-border pt-6">
              <h2 className="text-lg font-medium text-ink">룩 만들기</h2>
              <OutfitBuilder wardrobeOwnerId={profile.id} garments={garments ?? []} />
            </section>
          </>
        )}
```

**변경**:

```tsx
        {user && user.id !== profile.id && (
          <RecommendAndBuild wardrobeOwnerId={profile.id} garments={garments ?? []} />
        )}
```

- [ ] **Step 4: 빌드와 테스트로 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 126개 전부 통과.

- [ ] **Step 5: 브라우저로 전체 흐름을 확인**

두 계정이 필요하다 — 계정 A(옷장 주인, 공개 옷장)와 계정 B(추천하는 친구). 계정 B로 로그인해 계정 A의 공유 옷장(`/u/{share_slug}`)에 들어간다.

1. 무신사 링크로 "추천하기" → "추천했습니다!" 문구 아래 "룩 만들기" 목록에 방금 추천한 아이템이 **"추천함" 배지**와 함께 나타나고 **자동으로 체크**돼 있는지
2. 계정 A의 기존 옷을 하나 더 골라 "룩 만들기" → 성공 후 룩 재료 목록에서 방금 추천한 아이템이 **사라지는지**(제출 시 비움, `handleOutfitSubmitted`)
3. 추천만 하고 제출은 하지 않은 상태에서 **새로고침** → 추천한 아이템이 **여전히** 목록에 남아있는지(체크가 풀려 있어도 무방하다 — `preselectId`는 추천하는 그 순간에만 반영되는 값이라 새로고침 후 재적용을 요구하지 않는다)
4. `/wardrobe` 같은 다른 페이지로 이동했다가 같은 공유 옷장으로 다시 들어오면 추천 목록이 **비어 있는지**(페이지 이탈 시 정리)
5. 계정 A로 다시 로그인해 `/looks`에서 방금 만든 룩에 두 아이템(추천한 것 + 기존 것)이 모두 들어있는지

검증하며 만든 추천·룩 데이터는 확인 후 정리한다.

- [ ] **Step 6: 커밋**

```bash
git add components/share/RecommendAndBuild.tsx "app/u/[share_slug]/page.tsx"
git commit -m "feat: build a look with just-recommended items"
git push
```

---

## Task 5: README 기록

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 맨 끝에 "계획 9 — 추천 → 룩 흐름" 절을 추가한다**

기존 절들과 같은 형식(문제 / 원인 / 해결 / 검증 / 결과)으로 쓴다. **이 계획을 실행하며 실제로 겪은 문제만 적는다** — 미리 예상한 문제를 적지 않는다. 겪은 문제가 없었다면 그렇게 쓰고, 대신 내린 설계 판단과 근거를 남긴다.

최소한 아래는 계획 작성 시점에 이미 확정된 판단이라 기록할 가치가 있다:

- **DB·RLS를 하나도 안 건드린 이유** — `outfit_items_insert` 정책을 직접 읽어보니 `owner_id`만 검사하고 `status`는 안 봤다. "룩에 넣을 수 있는 옷"과 "옷장에 실제로 소유한 옷(`status='owned'`)"이 이 프로젝트에서 처음부터 다른 개념으로 설계돼 있었다는 뜻이고, 덕분에 계획 전체가 프론트엔드 작업으로 끝났다.
- **`sessionStorage`를 고른 이유** — "새로고침해도 남고, 페이지를 벗어나거나 룩을 제출하면 사라져야 한다"는 요구를 서버 쿼리 없이 정확히 만족한다. 서버로 넓히지 않았기 때문에 "다른 방문자의 추천은 안 보여야 한다"는 조건도 별도로 신경 쓸 필요가 없었다 — 애초에 서버 어디에도 남지 않는다.
- **`registerGarment`가 이미 계산해 둔 값을 반환하기만 한 것** — `finalImageUrl`은 계획 1부터 있었는데 아무도 반환하지 않고 있었다. 새 쿼리나 계산 없이 반환 객체에 필드 두 개를 얹는 것으로 끝났다.
- **두 컴포넌트의 새 prop을 전부 선택(optional)으로 둔 이유** — `RecommendAndBuild`가 없어도 `RecommendLinkBar`·`OutfitBuilder`가 단독으로 동작해야 한다는 이 계획의 제약(계획 서두) 때문이다.

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: log recommend-to-outfit flow work"
git push
```

---

## 남은 일 (이 계획 밖)

합의한 A~F 중 A(계획 6)·B(계획 7)·C(계획 8)·D(이 계획)가 끝난다. 나머지는 각자 별도 스펙·계획 사이클로 진행한다.

- **E. 핏 판단 정밀화** — 항목별 개별 허용오차, 심각도·가중치·판정 경계값
- **F. 가격 인하 표시** — 주기적으로 장바구니 상품 가격 재확인, "원래 얼마 → 얼마" 표시. 이메일·알림 토글은 범위에서 뺐다.
- **`MUSINSA_CATEGORY_MAP` 확장** — 액세서리류의 실제 무신사 대분류명을 확인하면 추가한다(커밋 `2893adf` 참고).
- **삭제 되돌리기(휴지통)** — 계획 7 스펙 §7에서 범위 밖으로 남겨둔 것.
- **`RecommendLinkBar`(친구 추천)에도 수동 등록 지원** — 계획 8 스펙 §7에서 범위 밖으로 남겨둔 것.
- **옷장 주인에게 "누가 무엇을 추천했는지" 실시간 알림** — 이 계획 스펙 §10에서 범위 밖으로 남겨둔 것.
- **여러 브라우저 탭 간 추천 목록 동기화** — 이 계획 스펙 §10에서 범위 밖으로 남겨둔 것.
