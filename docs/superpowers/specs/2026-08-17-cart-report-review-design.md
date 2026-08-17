# 장바구니 판단 리포트 다시보기 — 설계

**날짜**: 2026-08-17
**분류**: 사용자가 직접 제안한 6개 기능 중 3번(진행 순서 6→1→3→2→4→5의 세 번째).

## 배경

`/analyze`에서 구매 판단을 돌리면 그 결과(판정·실측 편차·제미나이 코멘트)가 `analyses` 테이블에 저장되고, 그 자리에서 한 번 보여준 뒤 사라진다. 장바구니(`/cart`)에는 판정 배지(살만함/주의/비추천)만 남아 있고, 왜 그 판정이 나왔는지(실측이 얼마나 벗어났는지, AI가 뭐라고 코멘트했는지)를 다시 볼 방법이 없다.

## 데이터 현황 확인

- `analyses` 테이블(`supabase/migrations/0004_analyses.sql`)에 `verdict`·`fit_score`·`report`(jsonb)·`feedback`(jsonb)·`model`·`created_at`이 이미 통째로 저장돼 있다.
- RLS: `analyses_select`가 `requester_id = auth.uid()`만 허용 — 본인이 직접 돌린 판단만 조회 가능. 장바구니 아이템은 전부 소유자 본인이 `/api/analyze`를 통해 등록하므로 `requester_id`가 항상 옷장 소유자(=현재 로그인 사용자) 자신이다.
- `report` 컬럼은 `scoreDeviation()`의 반환값을 그대로 저장한 것이라 `{ status, fields, fitScore, hasFatalViolation }` 모양이고, `DeviationReport` 컴포넌트가 기대하는 `{status, fields}` prop과 그대로 맞는다.
- `feedback` 컬럼은 두 가지 모양 중 하나다: 제미나이 호출이 성공하면 `{summary, sizeFeedback, matchFeedback, priceFeedback}`(`DeviationReport`의 `Feedback` prop과 일치), 실패하면 `app/api/analyze/route.ts:113`가 저장한 `{note: "AI 코멘트를 만들지 못했습니다."}`(모양이 다름).
- **함정**: `/api/recommend`(친구 추천 경로)는 `registerGarment`만 부르고 `/api/analyze`를 거치지 않는다 — 친구가 추천한 아이템은 `analyses` 행 자체가 없다. 장바구니의 판정 배지가 없는 아이템(`GarmentsRow → analyses` 조인이 빈 배열)이 정확히 이 경우와 겹친다(`app/(app)/cart/page.tsx`가 이미 `latest = analyses.sort()[0]`로 이 신호를 만들고 있다).

## 설계

### 1. 새 라우트 `/cart/[id]`

`/wardrobe/[id]`(옷 상세 페이지) 패턴을 그대로 따르는 서버 컴포넌트 페이지. 할 일:
- `garments`에서 그 옷의 `name`·`brand`·`image_url`·`category`(RLS `garments_select`가 소유자 본인 것만 돌려줌)를 가져온다.
- `analyses`에서 `garment_id = id`인 행을 `created_at desc`로 정렬해 가장 최근 1개만 가져온다.
- 리포트가 없으면(이론상 자기 등록 아이템은 항상 있지만, 방어적으로) "판단 리포트가 아직 없습니다"를 보여준다.
- `feedback`이 `summary` 필드를 갖고 있으면 그대로, 없으면(`{note}` 폴백 모양이면) `null`로 바꿔 `DeviationReport`에 넘긴다.
- 기존 `VerdictBadge`·`DeviationReport` 컴포넌트를 그대로 재사용한다 — 새 프레젠테이션 컴포넌트를 만들지 않는다.
- "← 장바구니로" 뒤로가기 링크를 상단에 둔다(`/wardrobe/[id]`의 "← 옷장으로"와 같은 패턴).

### 2. `CartItemCard`에 클릭 이동 추가

지금 `CartItemCard`는 카드 전체가 순수 `div`이고 체크박스·이미지·텍스트·"샀어요" 버튼이 전부 형제로 나열돼 있다(링크 없음). 이미지+텍스트 블록만 `<Link href="/cart/{id}">`로 감싼다. 체크박스와 "샀어요" 버튼은 그대로 형제로 남겨, 클릭했을 때 리포트 페이지로 안 새고 원래 동작(선택/구매완료)이 그대로 유지된다.

### 3. 리포트 없는 아이템은 링크 없이 렌더링

`CartItem.latestVerdict == null`이면(=analyses가 없으면) 이미지+텍스트 블록을 `Link` 대신 평범한 `div`로 렌더링한다 — 누를 것이 없다는 걸 커서 모양으로도 알 수 있게, 별도 안내 문구는 달지 않는다(스코프 밖).

## 영향 범위

- 새 라우트 하나, `CartItemCard` 수정 하나. `analyses` 테이블·RLS·`report`/`feedback` 저장 로직은 전혀 안 건드린다.
- `VerdictBadge`·`DeviationReport`는 프레젠테이션 전용이라 이미 여러 곳(AnalyzeLinkBar)에서 재사용되고 있고, 이번에 세 번째 재사용처가 생기는 것뿐이라 컴포넌트 자체는 손대지 않는다.

## 테스트

새 순수 함수 로직은 "feedback이 summary 필드를 가졌는지 판별" 정도라 아주 작다. `npm run build`(타입 체크) + 브라우저 확인(판정 배지가 있는 아이템을 눌러 리포트 페이지로 이동해 판정·실측 편차·AI 코멘트가 뜨는지, 리포트 없는 추천 아이템은 이미지 영역을 눌러도 이동하지 않는지, 체크박스·"샀어요" 버튼은 여전히 카드 클릭과 별개로 동작하는지)으로 검증한다.
