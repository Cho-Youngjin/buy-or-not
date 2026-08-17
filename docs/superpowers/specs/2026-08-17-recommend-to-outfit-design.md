# 추천 → 룩 흐름 설계 문서

작성일: 2026-08-17

## 1. 배경

합의한 A~F 중 **D: 추천 → 룩 흐름**. 친구가 옷장 주인에게 아이템을 추천하면, 그 자리에서 방금 추천한 아이템을 재료로 바로 룩을 짤 수 있게 한다. 지금은 추천에 성공하면 "추천했습니다!" 텍스트만 뜨고 끝이라, 룩을 짜려면 아래 "룩 만들기" 섹션에서 옷장 주인의 **기존 소유 옷(`status='owned'`)**만 골라야 했다 — 방금 추천한 옷은 `status='considering'`이라 그 목록에 없었다.

## 2. 핵심 발견 — DB·RLS 변경이 필요 없다

`outfit_items_insert` RLS 정책(`supabase/migrations/0005_outfits.sql`)을 확인했다:

```sql
create policy outfit_items_insert on outfit_items for insert
  with check (
    exists (
      select 1 from outfits o
      join garments g on g.id = outfit_items.garment_id
      where o.id = outfit_items.outfit_id
        and o.author_id = auth.uid()
        and g.owner_id = o.wardrobe_owner_id
    )
  );
```

`g.owner_id = o.wardrobe_owner_id`만 검사하고 **`status`는 보지 않는다.** 즉 방금 추천으로 들어간 `status='considering'` 아이템도 이미 룩에 넣을 권한이 있다 — 화면에 그 아이템을 보여주고 선택 가능하게만 하면 된다. 순수 프론트엔드 작업이다.

## 3. 상태 공유 — `sessionStorage`

`RecommendLinkBar`(추천하기)와 `OutfitBuilder`(룩 만들기)는 지금 `app/u/[share_slug]/page.tsx`(서버 컴포넌트)의 형제 섹션이라 상태를 공유할 수 없다. 새 클라이언트 래퍼 `components/share/RecommendAndBuild.tsx`가 둘을 감싸고 "방금 추천한 아이템" 목록을 들고 있는다.

**요구사항(사용자 확인)**: 새로고침해도 남아있어야 하고, 룩을 제출하거나 이 페이지를 벗어나면 사라져야 한다. `sessionStorage`가 정확히 이 조건에 맞는다:

- `wardrobeOwnerId`로 스코프한 키(`recommended-look-material:{id}`)에 저장 — 새로고침에도 남는다.
- 컴포넌트 언마운트(페이지 이탈) 시 `useEffect` 클린업에서 그 키를 지운다.
- 룩 제출 성공 시 그 자리에서 상태와 `sessionStorage`를 함께 비운다.
- 서버 쿼리를 전혀 넓히지 않으므로 "다른 방문자의 추천은 안 보여야 한다"는 조건도 저절로 지켜진다 — 애초에 서버에 남에게 노출될 데이터가 없다(전부 이 브라우저 탭 안에만 있다).

## 4. `/api/recommend` 응답 확장

`RecommendAndBuild`가 추천 직후 목록에 아이템을 추가하려면 이름·이미지가 필요한데, 지금 `/api/recommend`는 `{id}`만 돌려준다. `registerGarment`가 이미 계산해 둔 값(`input.name`, `copyImageToStorage` 처리까지 끝난 최종 `image_url`)을 `RegisterGarmentResult`에 실어 돌려주도록 확장한다.

```ts
// lib/garments/register.ts
export type RegisterGarmentResult = {
  id: string
  name: string
  imageUrl: string | null
  duplicate: boolean
  measurementsFailed: boolean
}
```

`registerGarment` 맨 끝의 `return`에 `name: input.name`과 `imageUrl: finalImageUrl`을 추가한다. `/api/garments`·`/api/analyze`는 이 필드를 안 쓰므로 영향이 없다 — 응답 바디에 필드가 늘어날 뿐이다.

`/api/recommend/route.ts`의 응답:

```ts
return NextResponse.json({ id: result.id, name: result.name, imageUrl: result.imageUrl }, { status: 201 })
```

## 5. `OutfitBuilder` 확장

`components/share/OutfitBuilder.tsx`의 `BuilderGarment` 타입을 export하고 필드를 하나 더한다:

```ts
export type BuilderGarment = { id: string; name: string; image_url: string | null; justRecommended?: boolean }
```

- **`preselectId?: string | null` prop 추가**: 값이 바뀔 때마다(추천할 때마다) `useEffect`로 `selected`에 자동으로 더한다. 다른 옷만 더 고르고 바로 "룩 만들기"를 누를 수 있다(사용자 확인 — 자동 선택).
- **`onSubmitted?: () => void` prop 추가**: 룩 생성 성공 시 기존 로직(`setDone`, `router.refresh()` 등) 뒤에 호출한다. `RecommendAndBuild`가 이걸로 추천 목록을 비운다.
- **"추천함" 배지**: `justRecommended`인 아이템의 썸네일 왼쪽 위에 작은 배지(`pillClass('active')`)를 얹는다 — 옷장 주인이 아직 사지 않은 옷임을 구분해, 실제 소유 옷과 섞여 혼란스럽지 않게 한다.

## 6. `RecommendLinkBar` 확장

`onRecommended?: (garment: BuilderGarment) => void` prop을 추가한다. `GarmentForm`의 `onSubmitted`가 이미 서버 응답(JSON)을 그대로 넘겨주므로, 거기서 `id`·`name`·`imageUrl`을 뽑아 호출한다:

```tsx
onSubmitted={(data) => {
  parse.reset()
  setDone(true)
  onRecommended?.({
    id: data.id as string,
    name: data.name as string,
    image_url: (data.imageUrl as string | null) ?? null,
    justRecommended: true,
  })
}}
```

두 컴포넌트 모두 새 prop을 **선택(optional)**으로 둔다 — `RecommendAndBuild` 없이 단독으로 쓰던 기존 방식도 그대로 동작해야 한다.

## 7. 새 래퍼 컴포넌트

```tsx
// components/share/RecommendAndBuild.tsx
'use client'

export function RecommendAndBuild({ wardrobeOwnerId, garments }: Props) {
  const storageKey = `recommended-look-material:${wardrobeOwnerId}`
  const [recommended, setRecommended] = useState<BuilderGarment[]>([])
  const [preselectId, setPreselectId] = useState<string | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(storageKey)
    if (raw) {
      try { setRecommended(JSON.parse(raw)) } catch { /* 손상된 값은 무시 */ }
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
      <section>...RecommendLinkBar onRecommended={handleRecommended}...</section>
      <section>...OutfitBuilder garments={[...recommended, ...garments]} preselectId={preselectId} onSubmitted={handleOutfitSubmitted}...</section>
    </>
  )
}
```

`app/u/[share_slug]/page.tsx`는 지금 있는 두 `<section>`(추천하기·룩 만들기)을 `<RecommendAndBuild wardrobeOwnerId={profile.id} garments={garments ?? []} />` 하나로 바꾼다. `garments`(`PublicGarment[]`)가 `BuilderGarment`의 상위 집합이라(지금도 `OutfitBuilder`에 그대로 넘기고 있다) 별도 매핑이 필요 없다.

## 8. 에러 처리

- `sessionStorage`가 없는 환경(사생활 보호 모드 등 극히 드문 경우)에서는 `try/catch`로 조용히 무시한다 — 이 기능이 없어도 추천·룩 만들기 자체는 그대로 동작해야 한다.
- 추천 API 응답이 예상 형식이 아니면(`data.id`가 없는 등) `onRecommended`를 호출하지 않는다 — 기존 "추천했습니다!" 문구는 그대로 뜨므로 사용자에게 추천 자체가 실패한 것처럼 보이지 않는다.

## 9. 검증

- **`npm run build`/`npm test`**: 타입 확장(`RegisterGarmentResult`)이 기존 로직을 안 건드리므로 회귀 통과가 핵심 신호다.
- **브라우저 수동 검증**(다른 계정으로 로그인해 공유 옷장 방문):
  1. 무신사 링크로 추천 → "추천했습니다!" 아래 "룩 만들기" 목록에 방금 추천한 아이템이 "추천함" 배지와 함께 나타나고 자동으로 체크돼 있는지
  2. 옷장 주인의 기존 옷 하나를 더 골라 "룩 만들기" → 성공 후 방금 추천한 아이템이 목록에서 사라지는지(제출 시 비움)
  3. 추천 직후 새로고침 → 추천한 아이템이 여전히 목록에 남아있는지(체크는 풀려도 무방 — `preselectId`는 최초 1회 반영값이라 새로고침 후 재적용을 요구하지 않는다)
  4. 다른 페이지로 이동했다가 이 공유 옷장으로 다시 들어오면 추천 목록이 비어 있는지(이탈 시 정리)

## 10. 범위 밖

- **옷장 주인에게 "누가 무엇을 추천했는지" 실시간 알림** — 이번 범위는 추천한 사람 화면에서의 흐름만 다룬다.
- **`recommended_by` 기준 서버 쿼리로 영구 저장** — sessionStorage로 충분하다고 판단했다(§3).
- **여러 브라우저 탭 간 동기화** — `sessionStorage`는 탭별로 독립적이다. 필요해지면 `localStorage`+이벤트로 확장할 수 있으나 이번엔 다루지 않는다.
