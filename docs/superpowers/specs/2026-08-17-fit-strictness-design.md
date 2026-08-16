# 핏 판단 강도 설정 설계 문서

작성일: 2026-08-17

## 1. 배경

`docs/superpowers/specs/2026-08-16-nav-and-design-system.md`(1단계: 네비게이션 & 디자인 시스템)를 진행하며, 사용자가 처음 제기한 5개 문제 중 4번("설정페이지에서 핏판단 수치를 사용자가 정할 수 있게")은 별도 2단계로 미뤄뒀다. `/mypage`에는 "핏 판단 설정 (준비 중)" 진입점만 만들어져 있다. 이 문서는 그 2단계를 다룬다.

핏 판단 로직(`lib/fit/rules.ts`의 `FIT_RULES`)은 카테고리별 14개 항목 × (허용편차·심각도·가중치) 총 45개 숫자로 구성돼 있어, 전부를 사용자 설정으로 노출하는 건 과하다고 판단해 범위를 좁혔다.

## 2. 범위

**포함**
- 사용자가 "판단 강도"를 0.5배~2.0배 사이 연속값으로 직접 조정
- 이 배율은 각 항목의 **허용편차(tolerance)에만** 곱해진다 — 배율이 클수록 허용 범위가 넓어져 애매한 옷도 "살만함"에 가까워지고, 작을수록 엄격해진다
- `/mypage`에 슬라이더 UI 추가

**제외**
- 항목별(총장/허리단면 등) 개별 허용편차 직접 입력
- `severity`·`weight`(심각도·가중치) 조정
- `VERDICT_CAUTION_MAX`(판정 경계값), `MIN_OWNED_GARMENTS_FOR_FIT`(데이터 부족 기준) 조정 — 이번 범위는 "허용오차 배율" 하나로 한정한다

## 3. 데이터 모델

`profiles` 테이블에 컬럼 하나를 추가한다:

```sql
alter table profiles add column fit_strictness numeric not null default 1.0
  check (fit_strictness between 0.5 and 2.0);
```

별도 테이블(`fit_settings` 등)을 만들지 않는다 — 값이 하나뿐이라 새 테이블+RLS 정책을 만드는 건 과설계다. 기존 `profiles_update` RLS 정책(`id = auth.uid()`)이 그대로 이 컬럼도 커버한다. `profiles_select` 정책(`id = auth.uid() or is_wardrobe_public`)상 공개 옷장 방문자에게도 이 값이 보이지만, 핏 판단은 항상 "로그인한 사용자 자신의 옷장"을 대상으로만 실행되므로(다른 사람 옷장을 빌려와 판단하는 기능 없음) 실질적인 영향은 없다.

## 4. API

- `app/api/profile/route.ts`의 PATCH 바디 스키마에 `fitStrictness: z.number().min(0.5).max(2.0)`을 추가한다. 기존 `isWardrobePublic`과 같은 패턴으로 부분 업데이트를 허용한다.
- `app/api/analyze/route.ts`가 요청 처리 시작 시 `profiles`에서 `fit_strictness`를 한 번 조회한다. 이 값을 `fetchPreferenceProfile`(→`buildPreferenceProfile`)과 `scoreDeviation` **양쪽 모두**에 넘긴다.

이 "양쪽에 같은 값"이 반드시 지켜져야 하는 이유: `buildPreferenceProfile`이 선호 실측값들을 구간으로 묶을 때 허용편차를 병합 거리로 쓰고(`lib/fit/profile.ts`의 `clusterValues`), `scoreDeviation`이 그 구간 밖으로 벗어난 만큼을 잴 때도 같은 허용편차로 `[lo-t, hi+t]`를 계산한다(`lib/fit/engine.ts`). 두 곳에 다른 배율이 들어가면 이 확장구간 개념 자체가 깨진다.

## 5. 순수 함수 변경

- `lib/fit/profile.ts`: `buildPreferenceProfile(garments, category, toleranceMultiplier = 1)` — `clusterValues(successValues, rules[key].tolerance)` 호출을 `clusterValues(successValues, rules[key].tolerance * toleranceMultiplier)`로 바꾼다.
- `lib/fit/engine.ts`: `scoreDeviation(candidateMeasurements, profile, category, toleranceMultiplier = 1)` — `const t = rule.tolerance`를 `const t = rule.tolerance * toleranceMultiplier`로 바꾼다.
- `lib/fit/profile.ts`의 `fetchPreferenceProfile`(DB 래퍼)도 `toleranceMultiplier` 파라미터를 받아 `buildPreferenceProfile`에 그대로 전달한다.

기본값이 `1`이므로 기존 호출부(있다면)와 기존 테스트는 파라미터를 안 넘겨도 그대로 동작한다 — 하위 호환을 깨지 않는다.

## 6. UI

`app/(app)/mypage/page.tsx`의 "핏 판단 설정 (준비 중)" 자리(`components/ui/styles.ts`의 `CARD_SURFACE` 섹션)를 실제 컨트롤로 교체한다:

- `<input type="range" min={0.5} max={2.0} step={0.1} />`
- 현재 값을 "0.8배"처럼 라벨로 같이 표시
- 슬라이더 양 끝에 "너그럽게"/"엄격하게" 텍스트 힌트
- 변경 시 `ShareToggle`과 같은 패턴으로 `/api/profile` PATCH 즉시 호출 → 저장

새 컴포넌트 `components/FitStrictnessSlider.tsx`로 분리한다(`ShareToggle`과 같은 급의 단일 책임 클라이언트 컴포넌트). `ShareToggle`이 `{ shareSlug, initialIsPublic }`를 서버 컴포넌트(`/mypage`)로부터 props로 받는 것과 동일하게, `FitStrictnessSlider`도 `{ initialValue: number }` 하나만 props로 받는다 — `/mypage`가 이미 `profiles`를 조회하는 쿼리에 `fit_strictness` 컬럼만 추가하면 되고, 컴포넌트가 별도로 fetch할 필요가 없다.

## 7. 테스트

- `tests/fit/profile.test.ts`: `toleranceMultiplier`가 1이 아닐 때 `clusterValues`에 전달되는 허용편차가 실제로 배율만큼 바뀌는 케이스 추가 (예: 배율 0.5로 원래 하나였던 구간이 둘로 쪼개지는 경우).
- `tests/fit/engine.test.ts`: 배율 0.5에서 원래 허용범위 안이던 값이 위반으로 바뀌는 케이스, 배율 2.0에서 원래 위반이던 값이 허용범위 안으로 들어오는 케이스 추가.
- 기존 테스트는 수정하지 않는다(기본값 1로 그대로 통과해야 함).
- RLS 테스트 추가 불필요 — 기존 `profiles_update`(본인만) 정책이 이미 이 컬럼을 커버하고, `tests/rls.test.ts`의 기존 profiles 시나리오가 이를 이미 검증하고 있다.

## 8. 수동 검증

실제 로그인 계정으로 `/mypage`에서 슬라이더를 0.5배/1.0배/2.0배로 바꿔가며 같은 무신사 링크를 `/analyze`에 넣어, `DeviationReport`의 "초과" 수치와 최종 판정(살만함/주의/비추천)이 실제로 달라지는지 확인한다.
