# 항목별 허용오차 직접 입력 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** 사용자가 마이페이지에서 카테고리·항목별(예: 하의 → 허리단면)로 허용오차를 직접 cm 단위로 입력하면, 그 항목은 전체 판단 강도 배율(계획 5) 대신 입력값을 쓴다.

**Architecture:** 새 테이블 `fit_field_overrides`(owner_id, category, field_key, tolerance)에 사용자가 입력한 값을 저장한다. 계획 5가 만든 `toleranceMultiplier` 파라미터 패턴을 그대로 확장해, `buildPreferenceProfile`·`scoreDeviation`에 넷째 파라미터 `fieldOverrides: Record<string, number>`를 더한다. 값이 있으면 그걸, 없으면 지금처럼 `tolerance * toleranceMultiplier`를 쓴다. `/api/analyze`가 두 함수에 **같은 `fieldOverrides`**를 넘긴다 — 계획 5의 "같은 배율" 제약과 동일한 이유다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Supabase(Postgres/RLS) · zod · Vitest(node 환경)

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-17-fit-field-overrides-design.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- TypeScript `strict: true`, `any` 금지. `npm run build`가 타입 에러 0개로 통과해야 한다.
- 사용자에게 하는 설명·요약·질문, 그리고 UI 문구는 한국어로 쓴다.
- 기능 단위마다 그 코드가 무엇을 하고 왜 그렇게 짰는지 설명하는 주석을 남긴다 (이 프로젝트의 학습 목적 예외 규칙).
- 태스크마다 커밋하고 push한다. 여러 태스크를 한 커밋에 몰아넣지 않는다.
- 커밋 메시지에 `Co-Authored-By: Claude` 등 AI 기여자 트레일러를 넣지 않는다.
- **판정 로직 자체는 바꾸지 않는다.** `severity`·`weight`·`VERDICT_CAUTION_MAX`·`MIN_OWNED_GARMENTS_FOR_FIT`은 건드리지 않는다(사용자 확인 — 이번 범위는 항목별 허용오차뿐).
- **기존 테스트를 고치지 않는다.** 새 파라미터는 기본값이 `{}`라 기존 동작이 그대로여야 한다 — 기존 테스트가 깨지면 그건 구현이 틀린 것이다.
- 새 의존성을 설치하지 않는다.
- **`numeric` 컬럼은 PostgREST가 문자열로 돌려주므로 읽는 모든 지점에서 `Number()`로 감싼다**(계획 5의 `fit_strictness`, `garment_measurements.value`와 같은 이유).

---

## Task 1: 마이그레이션 — `fit_field_overrides`

**Files:**
- Create: `supabase/migrations/0007_fit_field_overrides.sql`
- Modify: `tests/rls.test.ts`

**Interfaces:**
- Produces: `fit_field_overrides(owner_id, category, field_key, tolerance)` 테이블 + RLS(owner_id = auth.uid()만)

- [ ] **Step 1: 마이그레이션 작성**

`supabase/migrations/0007_fit_field_overrides.sql`:

```sql
-- 항목별(카테고리 안 실측 키별) 허용오차 직접 입력. garment_measurements와 같은
-- "(대상, 키, 값)" 정규화 패턴을 따른다 — JSONB 한 덩어리 대신 항목 하나하나가 행이라
-- SQL로 다루기 쉽다. (category, field_key)를 복합키로 쓰는 이유: "총장"은 상의(3.0cm)·
-- 아우터(4.0cm)·하의(3.0cm)에서 기본값이 다 달라, 카테고리 없이는 어느 기본값을
-- 대체하는지 알 수 없다.
create table fit_field_overrides (
  owner_id uuid not null references profiles (id) on delete cascade,
  category category not null,
  field_key text not null,
  tolerance numeric(4, 1) not null check (tolerance > 0),
  primary key (owner_id, category, field_key)
);

alter table fit_field_overrides enable row level security;

-- 핏 판단은 항상 로그인한 사용자 자신의 옷장만 대상으로 실행된다(계획 5에서 확인) —
-- profiles처럼 공개 옷장 방문자에게 노출할 이유가 없어 owner_id = auth.uid() 하나로
-- select·insert·update·delete를 전부 커버한다.
create policy fit_field_overrides_select on fit_field_overrides for select
  using (owner_id = auth.uid());

create policy fit_field_overrides_insert on fit_field_overrides for insert
  with check (owner_id = auth.uid());

create policy fit_field_overrides_update on fit_field_overrides for update
  using (owner_id = auth.uid());

create policy fit_field_overrides_delete on fit_field_overrides for delete
  using (owner_id = auth.uid());
```

- [ ] **Step 2: 마이그레이션 적용**

```bash
npx supabase db push
```

Expected: 오류 없이 완료.

- [ ] **Step 3: 테이블이 실제로 생겼는지 확인**

Supabase MCP 또는 대시보드 SQL 에디터에서:

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'fit_field_overrides';
```

Expected: `fit_field_overrides` 한 행.

- [ ] **Step 4: RLS 테스트 추가**

`tests/rls.test.ts`의 `outfits` describe 블록(파일 맨 끝) 뒤에 이어서 작성한다:

```ts
describe('fit_field_overrides', () => {
  it('본인은 자기 항목별 허용오차를 저장할 수 있다', async () => {
    const { error } = await alice.client
      .from('fit_field_overrides')
      .insert({ owner_id: alice.id, category: 'bottom', field_key: '허리단면', tolerance: 1.0 })
    expect(error).toBeNull()
  })

  it('본인 값은 조회된다', async () => {
    const { data } = await alice.client
      .from('fit_field_overrides')
      .select('tolerance')
      .eq('owner_id', alice.id)
      .eq('category', 'bottom')
      .eq('field_key', '허리단면')
      .single()
    expect(Number(data?.tolerance)).toBe(1.0)
  })

  it('남의 항목별 허용오차는 조회되지 않는다', async () => {
    const { data } = await bob.client.from('fit_field_overrides').select('tolerance').eq('owner_id', alice.id)
    expect(data).toEqual([])
  })

  it('남의 이름으로는 저장할 수 없다', async () => {
    const { error } = await bob.client
      .from('fit_field_overrides')
      .insert({ owner_id: alice.id, category: 'top', field_key: '총장', tolerance: 2.0 })
    expect(error).not.toBeNull()
  })

  it('본인은 자기 값을 지울 수 있다', async () => {
    const { data } = await alice.client
      .from('fit_field_overrides')
      .delete()
      .eq('owner_id', alice.id)
      .eq('category', 'bottom')
      .eq('field_key', '허리단면')
      .select()
    expect(data?.length).toBe(1)
  })
})
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npm test -- tests/rls.test.ts
```

Expected: PASS(기존 17개 + 새 5개 = 22개).

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/0007_fit_field_overrides.sql tests/rls.test.ts
git commit -m "feat: add fit_field_overrides table with rls"
git push
```

---

## Task 2: 순수 함수 확장 — `fieldOverrides`

**Files:**
- Modify: `lib/fit/engine.ts`
- Modify: `lib/fit/profile.ts`
- Modify: `tests/fit/engine.test.ts`
- Modify: `tests/fit/profile.test.ts`

**Interfaces:**
- Produces: `scoreDeviation(candidateMeasurements, profile, category, toleranceMultiplier?, fieldOverrides?)`, `buildPreferenceProfile(garments, category, toleranceMultiplier?, fieldOverrides?)`, `fetchPreferenceProfile(supabase, ownerId, category, toleranceMultiplier?, fieldOverrides?)` — 넷째 파라미터 전부 `Record<string, number> = {}`

- [ ] **Step 1: `engine.ts`에 실패하는 테스트를 먼저 쓴다**

`tests/fit/engine.test.ts` 맨 끝(`허용오차 배율` describe 블록 뒤)에 추가:

```ts
describe('scoreDeviation — 항목별 허용오차 직접 입력', () => {
  it('fieldOverrides에 값이 있으면 toleranceMultiplier 대신 그 값을 쓴다', () => {
    const p = profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } })

    // toleranceMultiplier=2라면 t=6.0(허용구간 [54,68])이라 65는 위반이 아니다.
    // 하지만 fieldOverrides로 총장을 1.5로 고정하면 허용구간은 [58.5,63.5]가 되어
    // 65는 1.5cm 초과(경계와 같아 경고 단계, 가중치 2 × 1 = 2점)한다.
    const report = scoreDeviation({ 총장: 65 }, p, 'top', 2, { 총장: 1.5 })
    expect(report.fields[0]).toMatchObject({ excess: 1.5, score: 2 })
  })

  it('fieldOverrides에 없는 항목은 toleranceMultiplier를 그대로 따른다', () => {
    const p = profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } })

    // fieldOverrides에 총장이 없으므로(허리단면만 있음) 배율 0.5만 적용된다(t = 3.0 × 0.5 = 1.5).
    // 허용구간 [58.5, 63.5] 밖으로 65는 1.5cm 초과 — 경고(가중치 2 × 1 = 2점).
    const report = scoreDeviation({ 총장: 65 }, p, 'top', 0.5, { 허리단면: 1.0 })
    expect(report.fields[0]).toMatchObject({ excess: 1.5, score: 2 })
  })
})
```

- [ ] **Step 2: `profile.ts`에도 실패하는 테스트를 먼저 쓴다**

`tests/fit/profile.test.ts` 맨 끝(`허용오차 배율` describe 블록 뒤)에 추가:

```ts
describe('buildPreferenceProfile — 항목별 허용오차 직접 입력', () => {
  const garments: GarmentForProfile[] = [
    garment({ rating: 5, measurements: { 총장: 60 } }),
    garment({ rating: 5, measurements: { 총장: 64 } }),
    garment({ rating: 5, measurements: { 총장: 68 } }),
  ]

  it('fieldOverrides에 값이 있으면 toleranceMultiplier 대신 그 값으로 묶는다', () => {
    // toleranceMultiplier=1(기본 3.0)이면 간격 4cm가 넘어 세 구간으로 쪼개지지만(바로 위 테스트),
    // fieldOverrides로 총장을 5.0으로 고정하면 간격 4cm가 허용오차 안이라 한 구간으로 묶인다.
    const profile = buildPreferenceProfile(garments, 'top', 1, { 총장: 5.0 })
    expect(profile.fields['총장'].ranges).toEqual([{ lo: 60, hi: 68 }])
  })
})
```

- [ ] **Step 3: 두 테스트가 실패하는지 확인**

```bash
npm test -- tests/fit/engine.test.ts tests/fit/profile.test.ts
```

Expected: FAIL — `scoreDeviation`/`buildPreferenceProfile`이 넷째 인자를 아직 안 받는다(타입 에러 또는 무시되어 기대값과 다름).

- [ ] **Step 4: `lib/fit/engine.ts`를 구현한다**

**기존**:

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

**변경**:

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
  /**
   * 카테고리 안에서 사용자가 항목별로 직접 정한 허용오차(cm, fit_field_overrides).
   * 값이 있으면 toleranceMultiplier 대신 그 값을 그대로 쓴다 — 이것도 buildPreferenceProfile에
   * 넘기는 값과 반드시 같아야 한다(위 toleranceMultiplier 주석과 같은 이유).
   */
  fieldOverrides: Record<string, number> = {},
): DeviationReport {
```

같은 파일의 편차 계산 줄. **기존**:

```ts
    const t = rule.tolerance * toleranceMultiplier
```

**변경**:

```ts
    const t = fieldOverrides[key] ?? rule.tolerance * toleranceMultiplier
```

- [ ] **Step 5: `lib/fit/profile.ts`를 구현한다**

`buildPreferenceProfile` 시그니처. **기존**:

```ts
export function buildPreferenceProfile(
  garments: GarmentForProfile[],
  category: Category,
  /** scoreDeviation에 넘기는 값과 반드시 같아야 한다 — engine.ts의 같은 파라미터 주석 참고. */
  toleranceMultiplier = 1,
): PreferenceProfile {
```

**변경**:

```ts
export function buildPreferenceProfile(
  garments: GarmentForProfile[],
  category: Category,
  /** scoreDeviation에 넘기는 값과 반드시 같아야 한다 — engine.ts의 같은 파라미터 주석 참고. */
  toleranceMultiplier = 1,
  /** scoreDeviation에 넘기는 값과 반드시 같아야 한다 — engine.ts의 같은 파라미터 주석 참고. */
  fieldOverrides: Record<string, number> = {},
): PreferenceProfile {
```

같은 파일의 클러스터링 줄. **기존**:

```ts
    fields[key] = {
      ranges: clusterValues(successValues, rules[key].tolerance * toleranceMultiplier),
```

**변경**:

```ts
    fields[key] = {
      ranges: clusterValues(successValues, fieldOverrides[key] ?? rules[key].tolerance * toleranceMultiplier),
```

`fetchPreferenceProfile`(같은 파일, DB 래퍼)도 파라미터를 추가해 그대로 전달한다. **기존**:

```ts
export async function fetchPreferenceProfile(
  supabase: SupabaseClient,
  ownerId: string,
  category: Category,
  toleranceMultiplier = 1,
): Promise<PreferenceProfile> {
```

**변경**:

```ts
export async function fetchPreferenceProfile(
  supabase: SupabaseClient,
  ownerId: string,
  category: Category,
  toleranceMultiplier = 1,
  fieldOverrides: Record<string, number> = {},
): Promise<PreferenceProfile> {
```

같은 함수 맨 끝의 반환 줄. **기존**:

```ts
  return buildPreferenceProfile(garments, category, toleranceMultiplier)
```

**변경**:

```ts
  return buildPreferenceProfile(garments, category, toleranceMultiplier, fieldOverrides)
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npm test
```

Expected: 전부 통과(기존 126개 + Task 1의 5개 + 이번 태스크의 2개 = 133개).

- [ ] **Step 7: 빌드 확인**

```bash
npm run build
```

Expected: 타입 에러 0개.

- [ ] **Step 8: 커밋**

```bash
git add lib/fit/engine.ts lib/fit/profile.ts tests/fit/engine.test.ts tests/fit/profile.test.ts
git commit -m "feat: let per-field tolerance overrides win over the global multiplier"
git push
```

---

## Task 3: 항목별 허용오차 저장 API

**Files:**
- Create: `app/api/profile/fit-overrides/route.ts`

**Interfaces:**
- Produces: `PUT /api/profile/fit-overrides` — `{ category, fieldKey, tolerance: number | null }`. 숫자면 upsert, `null`이면 삭제(기본값으로 초기화).

- [ ] **Step 1: 라우트를 만든다**

`app/api/profile/fit-overrides/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'

const Body = z.object({
  category: z.enum(['top', 'bottom', 'outer', 'shoes', 'acc']),
  fieldKey: z.string().min(1),
  /** 숫자면 그 값으로 저장(upsert), null이면 기본값으로 되돌린다(그 행을 삭제). */
  tolerance: z.number().min(0.5).max(10).nullable(),
})

/**
 * 항목별 허용오차 하나를 저장하거나(tolerance가 숫자) 지운다(tolerance가 null).
 * fieldKey가 실제 FIT_RULES에 있는 키인지는 검증하지 않는다 — RLS로 본인 행만 건드릴 수
 * 있고, scoreDeviation·buildPreferenceProfile이 FIT_RULES에 있는 키만 조회하므로
 * 존재하지 않는 키가 들어와도 조용히 무시될 뿐 해가 없다(스펙 §5).
 */
export async function PUT(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }
  const { category, fieldKey, tolerance } = parsed.data

  if (tolerance === null) {
    const { error } = await supabase
      .from('fit_field_overrides')
      .delete()
      .eq('owner_id', user.id)
      .eq('category', category)
      .eq('field_key', fieldKey)
    if (error) return NextResponse.json({ error: '초기화하지 못했습니다.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabase
    .from('fit_field_overrides')
    .upsert(
      { owner_id: user.id, category, field_key: fieldKey, tolerance },
      { onConflict: 'owner_id,category,field_key' },
    )
  if (error) return NextResponse.json({ error: '저장하지 못했습니다.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

Expected: 타입 에러 0개. (이 라우트를 부르는 UI가 아직 없어 브라우저 검증은 Task 5에서 함께 한다.)

- [ ] **Step 3: 커밋**

```bash
git add app/api/profile/fit-overrides/route.ts
git commit -m "feat: add endpoint to save and reset per-field tolerance overrides"
git push
```

---

## Task 4: `/api/analyze`에 항목별 허용오차 반영

**Files:**
- Modify: `app/api/analyze/route.ts`

**Interfaces:**
- Consumes: `fit_field_overrides` 테이블(Task 1), `fetchPreferenceProfile`·`scoreDeviation`의 확장된 시그니처(Task 2)

- [ ] **Step 1: `fit_strictness` 조회 뒤에 `fit_field_overrides` 조회를 추가한다**

**기존**:

```ts
  const { data: settings } = await supabase
    .from('profiles')
    .select('fit_strictness')
    .eq('id', user.id)
    .single()
  const strictness = Number(settings?.fit_strictness ?? 1)

  const profile = await fetchPreferenceProfile(supabase, user.id, input.category, strictness)
  const report = scoreDeviation(input.measurements, profile, input.category, strictness)
```

**변경**:

```ts
  const { data: settings } = await supabase
    .from('profiles')
    .select('fit_strictness')
    .eq('id', user.id)
    .single()
  const strictness = Number(settings?.fit_strictness ?? 1)

  // 이 카테고리에서 사용자가 항목별로 직접 정한 허용오차. 있으면 위 배율 대신 그 값을 쓴다
  // (lib/fit/engine.ts·lib/fit/profile.ts의 fieldOverrides 파라미터 주석 참고).
  const { data: overrideRows } = await supabase
    .from('fit_field_overrides')
    .select('field_key, tolerance')
    .eq('owner_id', user.id)
    .eq('category', input.category)
  const fieldOverrides = Object.fromEntries(
    (overrideRows ?? []).map((row) => [row.field_key, Number(row.tolerance)]),
  )

  const profile = await fetchPreferenceProfile(supabase, user.id, input.category, strictness, fieldOverrides)
  const report = scoreDeviation(input.measurements, profile, input.category, strictness, fieldOverrides)
```

- [ ] **Step 2: 빌드와 테스트로 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 133개 전부 통과.

- [ ] **Step 3: 커밋**

```bash
git add app/api/analyze/route.ts
git commit -m "feat: apply per-field tolerance overrides in purchase judgment"
git push
```

---

## Task 5: UI — `/mypage`에 항목별 입력칸

**Files:**
- Create: `components/account/FitFieldOverrides.tsx`
- Modify: `app/(app)/mypage/page.tsx`

**Interfaces:**
- Consumes: `FIT_RULES`(`@/lib/fit/rules`), `CATEGORY_LABELS`(`@/lib/types`), `pillClass`·`INPUT`(`@/components/ui/styles`)
- Produces: `FitFieldOverrides` — `props: { initialOverrides: { category: Category; fieldKey: string; tolerance: number }[] }`

- [ ] **Step 1: `FitFieldOverrides.tsx`를 만든다**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FIT_RULES } from '@/lib/fit/rules'
import { CATEGORY_LABELS, type Category } from '@/lib/types'
import { pillClass, INPUT } from '@/components/ui/styles'

type OverrideRow = { category: Category; fieldKey: string; tolerance: number }
type Props = { initialOverrides: OverrideRow[] }

// FIT_RULES에 실측 항목이 정의된 카테고리만(신발·액세서리는 핏 판단 대상이 아니다).
// Object.keys 순서는 lib/fit/rules.ts에 선언된 순서(top, outer, bottom) 그대로다.
const TOLERANCE_CATEGORIES = Object.keys(FIT_RULES) as Category[]

/**
 * 항목별 허용오차 직접 입력. 값을 비워두면(초기화) 마이페이지 위쪽의 전체 강도 배율을
 * 그대로 따르고, 값을 넣으면 그 항목만 고정된다(스펙 §2) — /api/analyze가 이 값을
 * fetchPreferenceProfile·scoreDeviation 양쪽에 같은 값으로 넘긴다.
 */
export function FitFieldOverrides({ initialOverrides }: Props) {
  const router = useRouter()
  const [category, setCategory] = useState<Category>(TOLERANCE_CATEGORIES[0])
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const row of initialOverrides) {
      map[`${row.category}:${row.fieldKey}`] = String(row.tolerance)
    }
    return map
  })
  const [savingKey, setSavingKey] = useState<string | null>(null)

  async function save(fieldKey: string, tolerance: number | null) {
    const mapKey = `${category}:${fieldKey}`
    setSavingKey(mapKey)
    await fetch('/api/profile/fit-overrides', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, fieldKey, tolerance }),
    })
    setSavingKey(null)
    setValues((prev) => {
      const next = { ...prev }
      if (tolerance === null) delete next[mapKey]
      else next[mapKey] = String(tolerance)
      return next
    })
    router.refresh()
  }

  const rules = FIT_RULES[category] ?? {}

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TOLERANCE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={pillClass(category === c ? 'active' : 'neutral')}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {Object.entries(rules).map(([fieldKey, rule]) => {
          const mapKey = `${category}:${fieldKey}`
          const value = values[mapKey] ?? ''
          return (
            <div key={fieldKey} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-sm text-ink">{fieldKey}</span>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="10"
                value={value}
                placeholder={`기본 ${rule.tolerance}cm`}
                onChange={(e) => setValues((prev) => ({ ...prev, [mapKey]: e.target.value }))}
                onBlur={() => {
                  const num = Number(value)
                  if (value.trim() !== '' && Number.isFinite(num) && num > 0) save(fieldKey, num)
                }}
                className={`${INPUT} w-24`}
              />
              <span className="text-xs text-ink-muted">cm</span>
              {values[mapKey] !== undefined && (
                <button
                  type="button"
                  onClick={() => save(fieldKey, null)}
                  disabled={savingKey === mapKey}
                  className="text-xs text-ink-muted underline"
                >
                  기본값으로
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `/mypage/page.tsx`가 초기값을 조회해 넘긴다**

import 줄. **기존**:

```ts
import { FitStrictnessSlider } from '@/components/account/FitStrictnessSlider'
```

**변경**:

```ts
import { FitStrictnessSlider } from '@/components/account/FitStrictnessSlider'
import { FitFieldOverrides } from '@/components/account/FitFieldOverrides'
```

프로필 조회 뒤에 오버라이드 조회를 추가한다. **기존**:

```ts
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, avatar_url, share_slug, is_wardrobe_public, fit_strictness')
    .eq('id', user.id)
    .single()
```

**변경**:

```ts
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, avatar_url, share_slug, is_wardrobe_public, fit_strictness')
    .eq('id', user.id)
    .single()

  const { data: fitOverrideRows } = await supabase
    .from('fit_field_overrides')
    .select('category, field_key, tolerance')
    .eq('owner_id', user.id)
  const fitOverrides = (fitOverrideRows ?? []).map((row) => ({
    category: row.category,
    fieldKey: row.field_key,
    tolerance: Number(row.tolerance),
  }))
```

"핏 판단 설정" 카드 안, 슬라이더 뒤에 컴포넌트를 추가한다. **기존**:

```tsx
        {/* numeric 컬럼은 PostgREST가 문자열로 돌려주므로 Number()로 감싼다(계획 서두 참고). */}
        <FitStrictnessSlider initialValue={Number(profile?.fit_strictness ?? 1)} />
      </section>
```

**변경**:

```tsx
        {/* numeric 컬럼은 PostgREST가 문자열로 돌려주므로 Number()로 감싼다(계획 서두 참고). */}
        <FitStrictnessSlider initialValue={Number(profile?.fit_strictness ?? 1)} />

        <div className="border-t border-border pt-3">
          <h3 className="mb-2 text-xs font-medium text-ink-muted">항목별 직접 입력 (선택)</h3>
          <FitFieldOverrides initialOverrides={fitOverrides} />
        </div>
      </section>
```

- [ ] **Step 3: 빌드와 테스트로 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 133개 전부 통과.

- [ ] **Step 4: 브라우저로 확인**

로그인한 상태에서 `/mypage`:

1. "핏 판단 설정" 카드 안, 전체 강도 슬라이더 아래에 카테고리 탭(상의·아우터·하의)과 항목별 입력칸이 보이는지
2. "하의" 탭에서 "허리단면"에 `1.0`을 입력하고 다른 칸을 클릭(포커스 이동) → 저장되고 "기본값으로" 버튼이 나타나는지
3. 새로고침 후에도 입력한 값이 그대로 남아있는지(서버에서 초기값을 다시 읽어옴)
4. `/analyze`에서 하의 카테고리 무신사 링크로 판단 → `DeviationReport`의 허리단면 초과 여부가 방금 입력한 `1.0cm` 기준으로 계산되는지(전체 강도 배율을 바꿔봐도 허리단면만은 그대로인지)
5. "기본값으로"를 눌러 → 입력칸이 비워지고, 이후 판단에서 허리단면이 다시 전체 배율을 따르는지

검증하며 만든 값은 확인 후 "기본값으로"로 정리한다.

- [ ] **Step 5: 커밋**

```bash
git add components/account/FitFieldOverrides.tsx "app/(app)/mypage/page.tsx"
git commit -m "feat: add per-field tolerance override UI to mypage"
git push
```

---

## Task 6: README 기록

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 맨 끝에 "계획 10 — 항목별 허용오차 직접 입력" 절을 추가한다**

기존 절들과 같은 형식(문제 / 원인 / 해결 / 검증 / 결과)으로 쓴다. **이 계획을 실행하며 실제로 겪은 문제만 적는다** — 미리 예상한 문제를 적지 않는다. 겪은 문제가 없었다면 그렇게 쓰고, 대신 내린 설계 판단과 근거를 남긴다.

최소한 아래는 계획 작성 시점에 이미 확정된 판단이라 기록할 가치가 있다:

- **계획 5의 `toleranceMultiplier` 파라미터 패턴을 그대로 확장한 것** — 새 추상화를 만들지 않고 넷째 파라미터 `fieldOverrides`를 추가하는 것으로 끝냈다. 기본값이 `{}`라 기존 호출부·테스트가 그대로 통과했다.
- **`garment_measurements`와 같은 정규화 테이블을 고른 이유** — JSONB 한 덩어리 대신 `(owner_id, category, field_key, tolerance)` 행 하나하나로 저장해, 이미 이 프로젝트가 실측값에 쓰던 패턴을 그대로 재사용했다.
- **새 테이블·새 RLS 정책이라 RLS 테스트를 추가한 것** — 계획 5는 `profiles`의 기존 정책을 재사용해 RLS 테스트가 불필요했지만, 이번엔 완전히 새 테이블이라 실제 Postgres에 두 사용자(alice·bob)로 붙는 테스트를 추가했다(계획 1부터 이어온 이 프로젝트의 RLS 검증 원칙).
- **심각도·가중치·판정 경계값을 이번 범위에서 뺀 이유** — 사용자 확인. 앱의 핵심 판정 신뢰도를 좌우하는 값이라 개발자 제어로 남겨뒀다.

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: log per-field tolerance override work"
git push
```

---

## 남은 일 (이 계획 밖)

합의한 A~F 중 A(계획 6)·B(계획 7)·C(계획 8)·D(계획 9)·E(이 계획)가 끝난다. 나머지는 각자 별도 스펙·계획 사이클로 진행한다.

- **F. 가격 인하 표시** — 주기적으로 장바구니 상품 가격 재확인, "원래 얼마 → 얼마" 표시. 이메일·알림 토글은 범위에서 뺐다.
- **`MUSINSA_CATEGORY_MAP` 확장** — 액세서리류의 실제 무신사 대분류명을 확인하면 추가한다(커밋 `2893adf` 참고).
- **삭제 되돌리기(휴지통)** — 계획 7 스펙 §7에서 범위 밖으로 남겨둔 것.
- **`RecommendLinkBar`(친구 추천)에도 수동 등록 지원** — 계획 8 스펙 §7에서 범위 밖으로 남겨둔 것.
- **옷장 주인에게 "누가 무엇을 추천했는지" 실시간 알림, 여러 탭 간 추천 목록 동기화** — 계획 9 스펙 §10에서 범위 밖으로 남겨둔 것.
- **심각도(severity)·가중치(weight) 조정, `VERDICT_CAUTION_MAX`·`MIN_OWNED_GARMENTS_FOR_FIT` 조정** — 이 계획 스펙 §10에서 범위 밖으로 남겨둔 것.
