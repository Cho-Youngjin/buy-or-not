# 핏 판단 강도 설정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** 사용자가 마이페이지에서 핏 판단 허용오차 배율(0.5배~2.0배)을 슬라이더로 직접 조정하고, 그 값이 실제 구매 판단 결과에 반영되게 한다.

**Architecture:** `profiles`에 `fit_strictness` 컬럼 하나를 추가하고(별도 테이블 없음), 순수 함수 `buildPreferenceProfile`·`scoreDeviation`에 기본값 1인 `toleranceMultiplier` 파라미터를 더한다. `/api/analyze`가 요청마다 그 값을 한 번 읽어 두 함수에 **같은 값**을 넘긴다 — 선호 구간을 나눌 때 쓰는 허용오차와 그 구간 밖 초과분을 잴 때 쓰는 허용오차가 어긋나면 `[lo-t, hi+t]` 확장구간 개념 자체가 깨지기 때문이다.

**Tech Stack:** Next.js 16 App Router · TypeScript strict · Supabase(Postgres/RLS) · zod · Vitest(node 환경)

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-17-fit-strictness-design.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- TypeScript `strict: true`, `any` 금지. `npm run build`가 타입 에러 0개로 통과해야 한다.
- 사용자에게 하는 설명·요약·질문, 그리고 UI 문구는 한국어로 쓴다.
- 기능 단위마다 그 코드가 무엇을 하고 왜 그렇게 짰는지 설명하는 주석을 남긴다 (이 프로젝트의 학습 목적 예외 규칙).
- 태스크마다 커밋하고 push한다. 여러 태스크를 한 커밋에 몰아넣지 않는다.
- 커밋 메시지에 `Co-Authored-By: Claude` 등 AI 기여자 트레일러를 넣지 않는다.
- **판정 로직 자체는 바꾸지 않는다.** 배율은 `FIT_RULES[category][key].tolerance`에만 곱한다. `severity`·`weight`·`VERDICT_CAUTION_MAX`·`MIN_OWNED_GARMENTS_FOR_FIT`·`MATCH_PENALTY`는 건드리지 않는다.
- **기존 테스트를 고치지 않는다.** 새 파라미터는 기본값이 `1`이라 기존 동작이 그대로여야 한다 — 기존 테스트가 깨지면 그건 구현이 틀린 것이다.
- 새 의존성을 설치하지 않는다.

### 값의 범위와 의미

| 배율 | 총장(기본 허용오차 3.0cm) | 의미 |
|---|---|---|
| 0.5배 | 1.5cm | 가장 엄격 — 조금만 벗어나도 위반 |
| 1.0배 (기본) | 3.0cm | 지금과 동일 |
| 2.0배 | 6.0cm | 가장 너그러움 — 웬만하면 통과 |

슬라이더는 `min=0.5 max=2.0 step=0.1`이다.

### numeric 컬럼 주의

`garment_measurements.value`가 `numeric(5,1)`인데 기존 코드(`lib/fit/profile.ts:137`, `app/(app)/wardrobe/[id]/page.tsx`)가 전부 `Number(...)`로 감싸서 쓴다 — PostgREST가 `numeric`을 JSON 문자열로 돌려주기 때문이다. `fit_strictness`도 `numeric`이므로 **읽는 모든 지점에서 `Number()`로 감싼다**. 이 프로젝트의 기존 관례를 그대로 따르는 것이다.

---

## Task 1: 마이그레이션 — `profiles.fit_strictness`

**Files:**
- Create: `supabase/migrations/0006_fit_strictness.sql`

**Interfaces:**
- Produces: `profiles.fit_strictness numeric(2,1) not null default 1.0`, 값 범위 `[0.5, 2.0]`

- [ ] **Step 1: 마이그레이션 파일 작성**

Create `supabase/migrations/0006_fit_strictness.sql`:

```sql
-- 핏 판단 허용오차 배율. 클수록 너그럽고(허용 범위가 넓어짐) 작을수록 엄격하다.
-- 값이 하나뿐이라 별도 테이블을 만들지 않고 profiles에 컬럼으로 둔다 —
-- 기존 profiles_update 정책(id = auth.uid())이 이 컬럼의 권한도 그대로 커버한다.
-- CHECK로 범위를 DB에서 강제해, 클라이언트·API 검증이 뚫려도 이상한 값이 저장되지 않게 한다.
alter table profiles
  add column fit_strictness numeric(2, 1) not null default 1.0
  check (fit_strictness between 0.5 and 2.0);
```

- [ ] **Step 2: 마이그레이션 적용**

```bash
npx supabase db push
```

- [ ] **Step 3: 컬럼이 실제로 생겼는지 확인**

Supabase MCP 또는 대시보드 SQL 에디터에서:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'fit_strictness';
```

Expected: `fit_strictness | numeric | 1.0` 한 행.

범위 제약이 실제로 걸렸는지도 확인한다. 일부러 잘못된 값을 UPDATE해보는 방식은 쓰지 않는다 — 제약이 빠져 있으면 그 UPDATE가 성공해 실제 사용자 데이터를 망가뜨리기 때문이다. 대신 카탈로그를 조회한다:

```sql
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.profiles'::regclass and contype = 'c';
```

Expected: `CHECK (fit_strictness >= 0.5 AND fit_strictness <= 2.0)` 형태의 제약이 한 줄 나온다. 안 나오면 마이그레이션의 `check` 절을 다시 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/0006_fit_strictness.sql
git commit -m "feat: add fit strictness column to profiles"
git push
```

---

## Task 2: 순수 함수에 배율 파라미터 추가 (TDD)

**Files:**
- Modify: `lib/fit/profile.ts`
- Modify: `lib/fit/engine.ts`
- Test: `tests/fit/profile.test.ts`
- Test: `tests/fit/engine.test.ts`

**Interfaces:**
- Produces: `buildPreferenceProfile(garments: GarmentForProfile[], category: Category, toleranceMultiplier?: number): PreferenceProfile`
- Produces: `scoreDeviation(candidateMeasurements: Record<string, number>, profile: PreferenceProfile, category: Category, toleranceMultiplier?: number): DeviationReport`
- Produces: `fetchPreferenceProfile(supabase: SupabaseClient, ownerId: string, category: Category, toleranceMultiplier?: number): Promise<PreferenceProfile>`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`tests/fit/engine.test.ts` 맨 끝에 아래 describe 블록을 **추가**한다 (기존 내용은 건드리지 않는다):

```ts
describe('scoreDeviation — 허용오차 배율', () => {
  // 총장: 기본 허용오차 t=3.0, 가중치 2. 선호 범위 [60,62].
  it('배율 0.5면 허용구간이 좁아져 기본값에서는 통과하던 값이 위반이 된다', () => {
    const p = profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } })

    // 배율 1: 허용구간 [57, 65] → 65는 경계 안이라 위반 없음.
    expect(scoreDeviation({ 총장: 65 }, p, 'top')).toMatchObject({ fitScore: 0 })

    // 배율 0.5: t=1.5 → 허용구간 [58.5, 63.5] → 65는 1.5cm 초과.
    // 초과폭 1.5가 t(1.5)보다 크지 않으므로 경고(가중치 2 × 1 = 2점).
    const strict = scoreDeviation({ 총장: 65 }, p, 'top', 0.5)
    expect(strict.fields[0]).toMatchObject({ excess: 1.5, score: 2 })
  })

  it('배율 2.0이면 허용구간이 넓어져 기본값에서는 위반이던 값이 통과한다', () => {
    const p = profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } })

    // 배율 1: 허용구간 [57, 65] → 67은 2cm 초과(경고, 2점).
    expect(scoreDeviation({ 총장: 67 }, p, 'top').fields[0]).toMatchObject({ excess: 2, score: 2 })

    // 배율 2: t=6.0 → 허용구간 [54, 68] → 67은 구간 안이라 위반 없음.
    const relaxed = scoreDeviation({ 총장: 67 }, p, 'top', 2)
    expect(relaxed.fields[0]).toMatchObject({ excess: 0, score: 0 })
    expect(relaxed.fitScore).toBe(0)
  })
})
```

`tests/fit/profile.test.ts` 맨 끝에도 아래를 **추가**한다:

```ts
describe('buildPreferenceProfile — 허용오차 배율', () => {
  // 총장 기본 허용오차 3.0. 성공 집합의 값 간격이 4cm라 기본값에서는 매번 쪼개진다.
  const garments: GarmentForProfile[] = [
    garment({ rating: 5, measurements: { 총장: 60 } }),
    garment({ rating: 5, measurements: { 총장: 64 } }),
    garment({ rating: 5, measurements: { 총장: 68 } }),
  ]

  it('배율 1(기본)이면 간격 4cm가 허용오차 3.0을 넘어 세 구간으로 쪼개진다', () => {
    expect(buildPreferenceProfile(garments, 'top').fields['총장'].ranges).toEqual([
      { lo: 60, hi: 60 },
      { lo: 64, hi: 64 },
      { lo: 68, hi: 68 },
    ])
  })

  it('배율 2.0이면 허용오차가 6.0이 되어 같은 값들이 한 구간으로 묶인다', () => {
    expect(buildPreferenceProfile(garments, 'top', 2).fields['총장'].ranges).toEqual([
      { lo: 60, hi: 68 },
    ])
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npm test -- tests/fit/engine.test.ts tests/fit/profile.test.ts
```

Expected: 새로 추가한 4개 테스트 중 배율을 넘기는 것들이 실패한다. `scoreDeviation`·`buildPreferenceProfile`이 아직 4번째/3번째 인자를 무시하므로, 배율 0.5·2.0을 넘겨도 배율 1과 같은 결과가 나온다.

- [ ] **Step 3: `lib/fit/engine.ts`에 배율을 반영한다**

함수 시그니처에 파라미터를 추가하고:

```ts
export function scoreDeviation(
  candidateMeasurements: Record<string, number>,
  profile: PreferenceProfile,
  category: Category,
  /**
   * 사용자가 마이페이지에서 정한 허용오차 배율(profiles.fit_strictness).
   * 기본값 1이면 FIT_RULES의 원래 수치를 그대로 쓴다 — 기존 호출부·테스트가 안 깨진다.
   * 주의: buildPreferenceProfile에 넘기는 값과 반드시 같아야 한다. 선호 구간을 나눌 때 쓴
   * 허용오차와 그 구간 밖 초과분을 잴 때 쓰는 허용오차가 다르면 [lo-t, hi+t] 개념이 깨진다.
   */
  toleranceMultiplier = 1,
): DeviationReport {
```

그리고 함수 본문의 `const t = rule.tolerance` 한 줄을 아래로 바꾼다:

```ts
    const t = rule.tolerance * toleranceMultiplier
```

- [ ] **Step 4: `lib/fit/profile.ts`에 배율을 반영한다**

`buildPreferenceProfile`의 시그니처를 바꾼다:

```ts
export function buildPreferenceProfile(
  garments: GarmentForProfile[],
  category: Category,
  /** scoreDeviation에 넘기는 값과 반드시 같아야 한다 — engine.ts의 같은 파라미터 주석 참고. */
  toleranceMultiplier = 1,
): PreferenceProfile {
```

그리고 `fields[key] = { ... }` 안의 `ranges` 계산을 바꾼다:

```ts
      ranges: clusterValues(successValues, rules[key].tolerance * toleranceMultiplier),
```

`fetchPreferenceProfile`(DB 래퍼)도 배율을 받아 그대로 넘긴다:

```ts
export async function fetchPreferenceProfile(
  supabase: SupabaseClient,
  ownerId: string,
  category: Category,
  toleranceMultiplier = 1,
): Promise<PreferenceProfile> {
```

그리고 마지막 줄을 바꾼다:

```ts
  return buildPreferenceProfile(garments, category, toleranceMultiplier)
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

```bash
npm test
```

Expected: 전부 통과. 기존 테스트(103개)가 하나도 안 깨지고 새 테스트 4개가 늘어 107개가 된다. 기존 테스트가 깨졌다면 기본값 `1` 처리가 잘못된 것이므로 테스트가 아니라 구현을 고친다.

- [ ] **Step 6: 커밋**

```bash
git add lib/fit/engine.ts lib/fit/profile.ts tests/fit/engine.test.ts tests/fit/profile.test.ts
git commit -m "feat: support tolerance multiplier in fit judgment"
git push
```

---

## Task 3: API 연결

**Files:**
- Modify: `app/api/profile/route.ts`
- Modify: `app/api/analyze/route.ts`

**Interfaces:**
- Consumes: `fetchPreferenceProfile`, `scoreDeviation`의 4번째 파라미터 (Task 2)
- Produces: `PATCH /api/profile` 바디가 `{ isWardrobePublic?: boolean, fitStrictness?: number }`를 받는다

- [ ] **Step 1: `app/api/profile/route.ts`를 부분 업데이트로 바꾼다**

지금은 `isWardrobePublic`이 필수라 `fitStrictness`만 보내면 400이 난다. 둘 다 선택으로 바꾸고, 온 것만 갱신한다. 파일 전체를 아래로 교체한다:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'

// 두 필드 모두 선택이다 — 공유 토글(ShareToggle)과 핏 강도 슬라이더(FitStrictnessSlider)가
// 각자 자기 필드만 보내기 때문이다. 범위(0.5~2.0)는 DB CHECK 제약과 같은 값으로 맞춘다.
const Body = z.object({
  isWardrobePublic: z.boolean().optional(),
  fitStrictness: z.number().min(0.5).max(2).optional(),
})

export async function PATCH(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }

  const updates: Record<string, boolean | number> = {}
  if (parsed.data.isWardrobePublic !== undefined) {
    updates.is_wardrobe_public = parsed.data.isWardrobePublic
  }
  if (parsed.data.fitStrictness !== undefined) {
    updates.fit_strictness = parsed.data.fitStrictness
  }
  // 빈 요청은 성공으로 처리하지 않는다 — 클라이언트 버그를 조용히 삼키지 않기 위해서다.
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 값이 없습니다.' }, { status: 400 })
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)

  if (error) return NextResponse.json({ error: '설정을 저장하지 못했습니다.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: `app/api/analyze/route.ts`가 배율을 읽어 두 함수에 넘기게 한다**

기존의 이 두 줄을

```ts
  const profile = await fetchPreferenceProfile(supabase, user.id, input.category)
  const report = scoreDeviation(input.measurements, profile, input.category)
```

아래로 바꾼다:

```ts
  // 사용자가 마이페이지에서 정한 허용오차 배율. numeric 컬럼은 PostgREST가 문자열로 돌려주므로
  // Number()로 감싼다(garment_measurements.value를 다루는 기존 코드와 같은 이유).
  // 선호 범위를 만드는 쪽과 편차를 재는 쪽에 반드시 같은 값을 넘겨야 한다(lib/fit/engine.ts 주석 참고).
  const { data: settings } = await supabase
    .from('profiles')
    .select('fit_strictness')
    .eq('id', user.id)
    .single()
  const strictness = Number(settings?.fit_strictness ?? 1)

  const profile = await fetchPreferenceProfile(supabase, user.id, input.category, strictness)
  const report = scoreDeviation(input.measurements, profile, input.category, strictness)
```

- [ ] **Step 3: 빌드와 테스트 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 107개 전부 통과.

- [ ] **Step 4: 기존 공유 토글이 안 깨졌는지 브라우저로 확인**

`/mypage`에서 "옷장 공개 중/비공개" 토글을 눌러 여전히 저장되는지 확인한다 (Step 1에서 `isWardrobePublic`을 선택 필드로 바꿨으므로 회귀 여부를 반드시 본다).

- [ ] **Step 5: 커밋**

```bash
git add app/api/profile/route.ts app/api/analyze/route.ts
git commit -m "feat: accept and apply fit strictness in profile and analyze apis"
git push
```

---

## Task 4: 마이페이지 슬라이더 UI

**Files:**
- Create: `components/FitStrictnessSlider.tsx`
- Modify: `app/(app)/mypage/page.tsx`

**Interfaces:**
- Consumes: `PATCH /api/profile`의 `fitStrictness` (Task 3), `Button`·`CARD_SURFACE`(계획 4)
- Produces: `FitStrictnessSlider` — `props: { initialValue: number }`

- [ ] **Step 1: `components/FitStrictnessSlider.tsx` 생성**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 핏 판단 허용오차 배율 슬라이더.
 * 저장을 onChange가 아니라 onPointerUp·onKeyUp에서 하는 이유: range 입력의 onChange는 드래그하는
 * 내내 값마다 발생해서, 그대로 저장하면 슬라이더 한 번 움직일 때 PATCH가 수십 번 날아간다.
 * 화면 표시는 onChange로 즉시 갱신하고(끊김 없는 피드백), 저장은 사용자가 손을 뗄 때 한 번만 한다.
 * 키보드(화살표) 조작도 지원해야 하므로 onKeyUp도 같이 건다.
 */
export function FitStrictnessSlider({ initialValue }: { initialValue: number }) {
  const router = useRouter()
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fitStrictness: value }),
    })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-sm text-ink">{value.toFixed(1)}배</span>
        <span className="text-xs text-ink-muted">{saving ? '저장 중…' : ''}</span>
      </div>

      <input
        type="range"
        min={0.5}
        max={2}
        step={0.1}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        onPointerUp={save}
        onKeyUp={save}
        className="w-full accent-accent"
        aria-label="핏 판단 허용오차 배율"
      />

      <div className="flex justify-between text-xs text-ink-muted">
        <span>엄격하게 (0.5배)</span>
        <span>너그럽게 (2.0배)</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `app/(app)/mypage/page.tsx`에 붙인다**

import에 추가한다:

```tsx
import { FitStrictnessSlider } from '@/components/FitStrictnessSlider'
```

프로필 조회 쿼리의 select에 컬럼을 추가한다:

```tsx
    .select('nickname, avatar_url, share_slug, is_wardrobe_public, fit_strictness')
```

그리고 "핏 판단 설정" 섹션(지금은 "준비 중" 표시만 있다) 전체를 아래로 교체한다:

```tsx
      <section className={`${CARD_SURFACE} space-y-3 p-5`}>
        <h2 className="text-sm font-medium text-ink">핏 판단 설정</h2>
        <p className="text-sm text-ink-muted">
          실측이 내 선호 범위에서 얼마나 벗어나도 괜찮은지 정합니다.
          엄격할수록 조금만 달라도 &quot;주의&quot;나 &quot;비추천&quot;이 나옵니다.
        </p>
        {/* numeric 컬럼은 PostgREST가 문자열로 돌려주므로 Number()로 감싼다(계획 서두 참고). */}
        <FitStrictnessSlider initialValue={Number(profile?.fit_strictness ?? 1)} />
      </section>
```

- [ ] **Step 3: 빌드와 테스트 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 107개 전부 통과.

- [ ] **Step 4: 브라우저로 저장 동작을 확인**

`/mypage`에서:
- 슬라이더를 움직이면 위 숫자("1.0배")가 끊김 없이 따라 바뀌는지
- 손을 뗐을 때만 저장되는지 (개발자도구 Network 탭에서 `/api/profile` PATCH가 드래그 중이 아니라 놓을 때 1회만 가는지)
- 페이지를 새로고침해도 방금 정한 값이 유지되는지

- [ ] **Step 5: 커밋**

```bash
git add components/FitStrictnessSlider.tsx "app/(app)/mypage/page.tsx"
git commit -m "feat: add fit strictness slider to my page"
git push
```

---

## Task 5: 종단 검증과 README 기록

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 배율이 실제 판단 결과를 바꾸는지 종단 검증**

이 계획의 핵심 주장("설정이 실제 판단에 반영된다")을 직접 확인하는 단계다. 브라우저에서:

1. `/wardrobe`에 같은 카테고리(상의) 옷이 3벌 이상 있어야 핏 판단이 동작한다(`MIN_OWNED_GARMENTS_FOR_FIT`). 부족하면 무신사 링크로 몇 벌 등록하고 별점을 4점 이상 남긴다.
2. `/mypage`에서 배율을 **0.5배**로 맞춘다.
3. `/analyze`에 무신사 상품 링크를 넣고 실측을 채워 판단한다. 편차 표의 "초과" 수치와 판정 배지를 기록한다.
4. `/mypage`로 가서 배율을 **2.0배**로 바꾼다.
5. `/analyze`에서 **같은 링크·같은 실측값**으로 다시 판단한다.

Expected: 같은 옷인데 0.5배일 때보다 2.0배일 때 "초과" cm가 줄거나 0이 되고, 판정이 같거나 더 관대해진다(비추천→주의, 주의→살만함 방향). 두 번 다 결과가 완전히 동일하다면 배율이 어딘가에서 유실된 것이므로 Task 3 Step 2를 다시 확인한다.

검증하며 만든 옷·분석 데이터는 확인 후 정리한다.

- [ ] **Step 2: 배율을 기본값으로 되돌린다**

검증이 끝나면 `/mypage`에서 배율을 1.0배로 되돌려 둔다 — 극단값이 남아 있으면 이후 다른 작업에서 판단 결과를 오해하게 된다.

- [ ] **Step 3: README에 기록을 추가한다**

`README.md` 맨 끝에 절을 추가한다. **이 계획을 실행하며 실제로 겪은 문제만 적는다** — 미리 예상한 문제를 적지 않는다. 형식은 기존 절들과 맞춘다(문제 / 원인 / 해결 / 검증 / 결과).

실제로 겪은 문제가 없었다면 그렇게 쓰고, 대신 이번 작업에서 내린 설계 판단과 그 근거를 남긴다. 최소한 아래는 기록할 가치가 있는 사실이다:

- 45개 수치를 전부 노출하는 대신 배율 하나로 좁힌 이유(사용자가 감당할 수 있는 설정의 양)
- `buildPreferenceProfile`과 `scoreDeviation`에 **같은** 배율을 넘겨야 하는 이유(`[lo-t, hi+t]` 확장구간이 두 곳의 허용오차가 같다는 전제 위에 있음)
- 새 파라미터에 기본값 1을 준 덕분에 기존 테스트 103개를 한 줄도 안 고치고 넘어간 것
- 별도 테이블 대신 `profiles` 컬럼을 고른 이유와, 그 덕에 RLS 정책을 새로 안 짜도 됐다는 것

- [ ] **Step 4: 커밋**

```bash
git add README.md
git commit -m "docs: log fit strictness setting work"
git push
```

---

## 남은 일 (이 계획 밖)

- **항목별 허용오차 개별 조정.** 이번엔 전체 배율 하나로 좁혔다. 실제로 써 보고 "허리만 더 엄격하게" 같은 요구가 생기면 그때 별도 사이클로 다룬다.
- **`severity`·`weight`·판정 경계값 조정.** 배율보다 판단 결과에 훨씬 크게 영향을 주는 값들이라, 사용자에게 노출하려면 UX를 따로 설계해야 한다.
- **액세서리 카테고리 매핑 확장.** 무신사 대분류명 중 액세서리류(팔찌·모자 등)의 실제 이름을 확인하지 못해 `lib/musinsa/parser.ts`의 `MUSINSA_CATEGORY_MAP`에 추가하지 못했다. 파싱 실패 시 기본값을 `acc`로 바꿔 핏 판단 오염은 막아뒀지만(커밋 `2893adf`), 실제 상품 링크를 확보하면 매핑을 정확히 넣는 게 좋다.
