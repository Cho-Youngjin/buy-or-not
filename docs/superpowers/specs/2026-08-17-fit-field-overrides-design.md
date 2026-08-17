# 항목별 허용오차 직접 입력 설계 문서

작성일: 2026-08-17

## 1. 배경

합의한 A~F 중 **E: 핏 판단 정밀화**. `docs/superpowers/specs/2026-08-17-fit-strictness-design.md`(계획 5)가 명시적으로 범위 밖에 남겨둔 세 가지(항목별 개별 허용오차, 심각도·가중치, 판정 경계값) 중 **항목별 허용오차만** 이번에 다룬다(사용자 확인) — 심각도·가중치·판정 경계값은 앱의 핵심 판정 로직을 좌우하는 개발자 제어 값으로 남겨둔다.

## 2. 전체 배율과의 관계

계획 5가 만든 "판단 강도" 슬라이더(0.5배~2.0배, 모든 항목에 동일 배율)는 그대로 둔다. **항목별로 값을 입력하면 그 항목은 전체 배율 대신 입력값을 그대로 쓴다**(사용자 확인) — "허리단면은 더 엄격하게, 나머지는 지금 배율대로"가 가능해진다. 값을 비워두면(초기화) 그 항목도 다시 전체 배율을 따른다.

## 3. 데이터 모델

```sql
create table fit_field_overrides (
  owner_id uuid not null references profiles (id) on delete cascade,
  category category not null,
  field_key text not null,
  tolerance numeric(4, 1) not null check (tolerance > 0),
  primary key (owner_id, category, field_key)
);
```

`garment_measurements`가 이미 쓰는 "(대상, 키, 값)" 정규화 테이블 패턴을 그대로 따른다 — JSONB 한 덩어리 대신, 항목 하나하나가 행이라 SQL로 다루기 쉽고 나중에 확장하기 쉽다. `(category, field_key)`를 복합키로 쓰는 이유는 "총장"이 상의(3.0cm)·아우터(4.0cm)·하의(3.0cm)에서 기본값이 다 다르기 때문이다 — 카테고리 없이 `field_key`만으로는 어느 기본값을 대체하는지 알 수 없다.

**RLS**: 핏 판단은 항상 로그인한 사용자 자신의 옷장만 대상으로 실행된다(계획 5에서 이미 확인된 사실) — `profiles`처럼 "공개 옷장 방문자에게도 보임" 같은 예외가 필요 없다. `owner_id = auth.uid()` 하나로 select·insert·update·delete를 전부 커버한다.

## 4. 순수 함수 확장

계획 5가 만든 `toleranceMultiplier` 파라미터 패턴을 그대로 따라, 넷째 파라미터를 추가한다(둘 다 기본값 `{}`라 기존 호출부·테스트는 안 건드린다):

- `lib/fit/profile.ts`: `buildPreferenceProfile(garments, category, toleranceMultiplier = 1, fieldOverrides: Record<string, number> = {})` — `clusterValues(successValues, rules[key].tolerance * toleranceMultiplier)`를 `clusterValues(successValues, fieldOverrides[key] ?? rules[key].tolerance * toleranceMultiplier)`로 바꾼다.
- `lib/fit/engine.ts`: `scoreDeviation(candidateMeasurements, profile, category, toleranceMultiplier = 1, fieldOverrides: Record<string, number> = {})` — `const t = rule.tolerance * toleranceMultiplier`를 `const t = fieldOverrides[key] ?? rule.tolerance * toleranceMultiplier`로 바꾼다.
- `lib/fit/profile.ts`의 `fetchPreferenceProfile`(DB 래퍼)도 `fieldOverrides` 파라미터를 받아 `buildPreferenceProfile`에 그대로 전달한다.

**`buildPreferenceProfile`과 `scoreDeviation`에 반드시 같은 `fieldOverrides`를 넘겨야 한다** — 계획 5의 `toleranceMultiplier`와 같은 이유다. 선호 구간을 묶을 때 쓴 허용오차와 그 구간 밖 초과분을 잴 때 쓰는 허용오차가 다르면 `[lo-t, hi+t]` 개념이 깨진다.

## 5. API

- **`app/api/analyze/route.ts`**: `fit_strictness`를 조회하는 것과 같은 자리에서 `fit_field_overrides`도 `(owner_id, category)`로 조회해 `Record<string, number>`로 변환한 뒤, `fetchPreferenceProfile`과 `scoreDeviation` 양쪽에 같이 넘긴다.
- **`PUT /api/profile/fit-overrides`**(신규): `{ category, fieldKey, tolerance: number | null }`. `tolerance`가 숫자면 upsert, `null`이면 그 행을 삭제한다(= "기본값으로" 초기화). `fieldKey`가 실제 `FIT_RULES`에 있는 키인지는 서버에서 검증하지 않는다 — RLS로 본인 행만 건드릴 수 있고, `scoreDeviation`·`buildPreferenceProfile`이 애초에 `FIT_RULES`에 있는 키만 조회하므로 존재하지 않는 키가 들어와도 조용히 무시될 뿐 해가 없다.

## 6. UI — `/mypage`의 "핏 판단 설정" 카드 안

전체 강도 슬라이더 아래에 새 컴포넌트 `components/account/FitFieldOverrides.tsx`를 추가한다.

- **카테고리 탭**: 상의/아우터/하의(`FIT_RULES`에 있는 카테고리만 — 신발·액세서리는 핏 판단 대상이 아니다). `/wardrobe`의 카테고리 필터 칩과 같은 `pillClass('active'|'neutral')` 스타일을 재사용한다.
- **항목별 입력칸**: 선택한 카테고리의 각 항목(예: 상의 → 어깨너비·가슴단면·총장·소매길이)마다 숫자 입력칸 하나. placeholder로 기본값(`"기본 1.5cm"`)을 보여준다.
- **저장 시점**: 입력칸에서 포커스를 벗어날 때(`onBlur`) 값이 있으면 저장한다 — `FitStrictnessSlider`가 드래그 중이 아니라 손을 뗄 때 저장하는 것과 같은 이유(과도한 PATCH 방지)로, 여기서는 "타이핑 중"이 아니라 "다음 칸으로 넘어갈 때" 저장한다.
- **초기화**: 값이 설정된 항목에만 "기본값으로" 버튼이 뜬다. 누르면 `tolerance: null`로 PUT해 그 행을 지우고, 다시 전체 배율을 따르게 한다.
- `/mypage/page.tsx`(서버 컴포넌트)가 `fit_field_overrides`를 미리 조회해 `initialOverrides` prop으로 넘긴다 — `ShareToggle`·`FitStrictnessSlider`와 같은 패턴(서버가 초기값을 가져오고, 클라이언트 컴포넌트는 자기 상태만 관리).

## 7. 에러 처리

- 입력값이 0 이하이거나 숫자가 아니면 저장을 시도하지 않는다(클라이언트에서 걸러낸다) — `tolerance > 0` DB 제약과 별개로, 잘못된 값으로 매번 API를 왕복하지 않기 위해서다.
- PUT 실패 시 별도 에러 배너 없이 조용히 실패한다 — 값이 화면에 남아있고 사용자가 다시 포커스를 옮기면 재시도되므로, 계획 7의 장바구니 벌크 삭제와 같은 "실패해도 화면 상태가 신호가 된다" 원칙을 따른다.

## 8. 테스트

- `tests/fit/profile.test.ts`: `fieldOverrides`가 있을 때 해당 항목만 그 값을 쓰고, 없는 항목은 `toleranceMultiplier`를 그대로 따르는 케이스.
- `tests/fit/engine.test.ts`: `fieldOverrides`로 설정한 값이 `toleranceMultiplier`보다 우선하는 케이스(배율이 1이어도 override 값을 쓰는지, 배율이 0.5여도 override 값이 그대로인지).
- `tests/rls.test.ts`: `fit_field_overrides`에 alice가 자기 행을 만들고 지울 수 있는지, bob이 alice의 행을 보거나 고칠 수 없는지(계획 1부터 있는 두 사용자 RLS 테스트 패턴 그대로).
- 기존 테스트는 수정하지 않는다(기본값 `{}`로 그대로 통과해야 함).

## 9. 수동 검증

실제 로그인 계정으로 `/mypage`에서 특정 카테고리·항목(예: 하의 → 허리단면)에 값을 입력하고, 전체 강도 배율을 바꿔도 그 항목만은 입력한 값을 그대로 쓰는지 `/analyze`의 `DeviationReport`로 확인한다. "기본값으로"를 누르면 다시 배율을 따르는지도 확인한다.

## 10. 범위 밖

- **심각도(severity)·가중치(weight) 조정** — 사용자 확인으로 이번 범위에서 뺐다. 앱의 핵심 판정 신뢰도를 좌우하는 값이라 개발자 제어로 남겨둔다.
- **`VERDICT_CAUTION_MAX`(판정 경계값)·`MIN_OWNED_GARMENTS_FOR_FIT`(데이터 부족 기준) 조정** — 같은 이유로 범위 밖.
- **항목별 허용오차의 상한·하한 UI 힌트(예: "일반적으로 1~3cm")** — 이번엔 단순 숫자 입력으로 시작한다.
