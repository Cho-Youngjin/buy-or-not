# 룩 페이지 자체 제작 + 선택삭제 — 설계

**날짜**: 2026-08-17
**분류**: 랜딩페이지(4번) 문구 검토 중 발견된 새 항목(7번). "가진 옷을 조합해 룩 만들기"라는 문구가 실제로는 안 되는 얘기였다 — `/looks`(`app/(app)/looks/page.tsx`)는 지금 이미 만들어진 룩을 보여주기만 하고, 옷장 주인 스스로 룩을 만드는 버튼이 없다.

## 배경

`OutfitBuilder`(`components/share/OutfitBuilder.tsx`)와 `POST /api/outfits`는 계획 9에서 "친구가 추천하며 그 자리에서 룩을 짜는" 흐름(`app/u/[share_slug]/page.tsx`의 `RecommendAndBuild`)을 위해 만들어졌다. 옷장 주인 본인의 `/looks` 페이지에는 이 흐름이 연결돼 있지 않다.

## 발견한 함정

`outfits_insert` RLS 정책(`supabase/migrations/0005_outfits.sql:29-33`)은 이렇게 돼 있다:

```sql
create policy outfits_insert on outfits for insert
  with check (
    author_id = auth.uid()
    and exists (select 1 from profiles p where p.id = wardrobe_owner_id and p.is_wardrobe_public)
  );
```

"대상 옷장이 공개 상태"를 예외 없이 요구한다 — 주석에도 "본인 옷장이라는 예외가 없다"고 명시돼 있다. 이건 "친구가 추천"만 상정하고 짠 정책이라, 옷장을 비공개로 해둔 사용자가 자기 옷으로 룩을 만들려 해도 지금 그대로면 `/api/outfits`의 insert가 DB에서 막힌다(`app/api/outfits/route.ts:34`의 주석에도 이 사실이 이미 적혀 있었다).

## 설계

### 1. RLS 수정

`outfits_insert`를 "author_id = 나, 그리고 (대상 옷장이 내 것) 또는 (대상 옷장이 공개 상태)"로 바꾼다:

```sql
drop policy outfits_insert on outfits;
create policy outfits_insert on outfits for insert
  with check (
    author_id = auth.uid()
    and (
      wardrobe_owner_id = auth.uid()
      or exists (select 1 from profiles p where p.id = wardrobe_owner_id and p.is_wardrobe_public)
    )
  );
```

`outfits_select`(이미 `wardrobe_owner_id = auth.uid()`를 무조건 허용)·`outfits_delete`(`author_id = auth.uid() or wardrobe_owner_id = auth.uid()`)·`outfit_items_insert`(작성자 검증)는 이미 본인 옷장을 전부 커버하고 있어 손댈 필요가 없다.

### 2. `/looks`에 "룩 만들기" 섹션 추가

기존 `OutfitBuilder`를 그대로 재사용한다. 이 컴포넌트는 "친구"를 전제하는 로직이나 문구가 하드코딩돼 있지 않다 — `wardrobeOwnerId`·`garments`·`preselectId`·`onSubmitted`만 받는 순수한 폼이다. `/looks` 페이지(서버 컴포넌트)가 본인 소유 옷(`status='owned'`)을 조회해 `wardrobeOwnerId={user.id}`와 함께 넘기면 그대로 동작한다. 새 프레젠테이션 컴포넌트를 만들지 않는다.

### 3. 선택 삭제·전체 삭제

`/cart`의 `CartList.tsx`가 이미 이 UX(체크박스 → "N개 선택됨" 표시 → 선택 삭제/전체 삭제 버튼 → 확인 문구 → 병렬 DELETE)를 정확히 구현해뒀다. 같은 패턴으로 `LooksList.tsx`를 새로 만든다 — 벌크 삭제 API를 새로 만들지 않고 단건 DELETE를 병렬로 부르는 것도 `CartList`의 주석에 적힌 이유(RLS가 어차피 요청마다 소유자를 검증하고, 개인 규모에서 요청 수가 문제 될 일이 없다)를 그대로 따른다. `DELETE /api/outfits/[id]`가 지금 없으므로 새로 만든다 — `outfits_delete` RLS가 이미 있어 친구가 만들어준 룩도 내가 지울 수 있다(`author_id`든 `wardrobe_owner_id`든 나면 허용). `outfit_items`는 `on delete cascade`(`outfits (id) on delete cascade`)라 별도 정리 로직이 필요 없다.

### 4. 빈 상태 문구

**기존**: "아직 만들어진 룩이 없습니다. 옷장을 공유하면 친구가 룩을 만들어 줄 수 있어요."
**변경**: "아직 만들어진 룩이 없습니다. 위에서 옷을 골라 첫 룩을 만들어보세요." 자체 제작이 이제 기본 경로이므로 그쪽으로 무게중심을 옮기고, 친구 추천 안내는 뺀다 — 옷장을 공유했는지 여부와 무관하게 "룩 만들기" 섹션이 항상 위에 있으니 굳이 다른 경로를 안내할 필요가 없다.

## 영향 범위

- `supabase/migrations`에 새 마이그레이션 하나(RLS 정책 교체).
- `app/(app)/looks/page.tsx` 수정, `components/garment/LooksList.tsx`(가칭) 신규, `app/api/outfits/[id]/route.ts` 신규.
- `OutfitBuilder`·`RecommendAndBuild`·`/api/outfits`(POST)·`app/u/[share_slug]/page.tsx`(친구 추천 흐름)는 전혀 안 건드린다 — 기존 친구 추천 경로와 자체 제작 경로가 같은 컴포넌트·같은 API를 공유하되 서로 간섭하지 않는다.

## 테스트

RLS 정책 변경이라 `tests/rls.test.ts`에 실제 Postgres에 붙는 테스트를 추가한다(계획 3·10이 확립한 alice·bob 두 계정 패턴): 비공개 옷장 주인이 본인 옷으로 룩을 만들 수 있는지(새로 통과해야 할 케이스), 다른 사람이 그 비공개 옷장으로 룩을 만들려 하면 여전히 막히는지(회귀 확인). `LooksList`는 `CartList`와 동일한 구조라 별도 단위 테스트보다는 `npm run build` + 브라우저 확인(룩 만들기 → 선택 삭제 → 전체 삭제)으로 검증한다.
