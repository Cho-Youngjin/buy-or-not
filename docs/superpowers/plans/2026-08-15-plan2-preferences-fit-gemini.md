# 계획 2: 선호도 · 핏 판단 · Gemini · 장바구니 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: 이 프로젝트는 `superpowers:subagent-driven-development`를 기본 실행 방식으로 쓰지 않는다(`CLAUDE.md` 참고 — 기능 단위로 사용자와 상호 리뷰하며 진행). `superpowers:executing-plans`로 태스크 단위로 실행하고, 완료할 때마다 사용자에게 알린다. Steps는 체크박스(`- [ ]`)로 진행 상황을 추적한다.

**Goal:** 옷장 옷에 별점·핏 태그·착용빈도를 남기고, 구매를 고민하는 무신사 링크를 넣으면 결정론적 핏 판단(코드)과 Gemini가 생성한 한국어 피드백 문장이 결합된 살까/주의/비추천 판정을 받아 장바구니에 쌓이고 "샀어요"로 옷장에 승격시킬 수 있다.

**Architecture:** 계획 1(기반+옷장 등록)이 이미 만든 `garments`/`garment_measurements` 스키마와 무신사 파싱·등록 파이프라인을 그대로 재사용한다. 핏 판단(`lib/fit/*`, `lib/verdict.ts`)은 네트워크를 모르는 순수 함수로 만들어 Gemini 없이도 단위 테스트되고, `/api/analyze`가 이 순수 함수들과 Gemini 호출(`lib/ai/*`)을 조합한다. Gemini는 숫자 판단을 하지 않고 이미 계산된 리포트를 문장으로 풀어쓰는 역할만 한다 — 결과가 흔들리지 않게 하기 위해서다.

**Tech Stack:** 계획 1과 동일 + `@google/genai`(Gemini API SDK)

**설계 문서:** `docs/superpowers/specs/2026-08-13-buy-or-not-design.md` (§9 핏 판단 엔진, §10 Gemini 연동 결정 근거)

**이 계획의 범위:** 스펙 §14 Phase 3(옷장 상세와 선호도), Phase 4(핏 판단 엔진), Phase 5(Gemini 연동 · 장바구니). 공유 옷장 · 룩(Phase 6·7)과 마감(Phase 8)은 계획 3에서 다룬다.

## Global Constraints

- Node.js 20 이상, npm.
- TypeScript `strict: true`, `any` 사용 금지.
- **외부 서비스(무신사, Gemini) 호출은 서버 코드에서만 한다.** 클라이언트 컴포넌트에서 직접 `fetch`하지 않는다.
- **`SUPABASE_SERVICE_ROLE_KEY`는 `lib/supabase/admin.ts` 밖에서 import하지 않는다.**
- **접근 제어는 RLS가 전담한다.** Route Handler는 애플리케이션 레이어에서 중복 권한 체크를 하지 않고, 세션 기반 클라이언트(`createServerSupabase`)로 DB에 맡긴다. `service_role`은 캐시·Storage 등 계획 1에서 이미 정한 용도 외로 넓히지 않는다.
- **핏 판단 로직(`lib/fit/*`, `lib/verdict.ts`)은 순수 함수다.** Supabase·Gemini를 몰라야 하고, 네트워크 없이 단위 테스트된다. DB 집계는 이 순수 함수들을 감싸는 얇은 wrapper(`fetchPreferenceProfile` 등)로 분리한다.
- **Gemini는 숫자를 계산하지 않는다.** 편차·점수·`verdict`는 항상 코드가 계산하고, Gemini에는 계산이 끝난 결과만 서술하게 한다. `responseSchema`로 구조화 출력을 강제해 자유 서술이 산술에 섞이지 않게 한다.
- **Gemini 실패는 앱을 막지 않는다.** 호출 실패·타임아웃·JSON 파싱 실패 시 `match_penalty = 0`으로 두고 `fit_score`만으로 판정하며, 실측 비교 표는 그대로 보여준다.
- 사용자에게 보이는 모든 문구는 한국어.
- 실측 표준 항목명은 정확히 다음 9개다: `총장`, `어깨너비`, `가슴단면`, `소매길이`, `허리단면`, `엉덩이단면`, `허벅지단면`, `밑위`, `밑단단면`.
- 커밋 메시지는 Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`). AI 공동작성자 트레일러(`Co-Authored-By: Claude` 등)는 넣지 않는다.
- 환경변수: 계획 1의 4개 + `GEMINI_API_KEY`. `.env.local`은 커밋하지 않는다.
- 기능 하나를 추가·변경할 때마다 사용자에게 알리고, 기능/작업 단위로 커밋·push한다. 여러 태스크를 조용히 묶어서 한 번에 던지지 않는다.

## File Structure

```
buy-or-not/
├── app/
│   ├── wardrobe/[id]/page.tsx           옷 상세: 실측 표 + 선호도 편집 + 삭제
│   ├── analyze/page.tsx                 구매 판단: 링크 입력 → 판정 배지 + 피드백 + 근거 표
│   ├── cart/page.tsx                    장바구니: considering 목록 + "샀어요"
│   └── api/
│       ├── garments/[id]/route.ts       PATCH(선호도·"샀어요") / DELETE
│       └── analyze/route.ts             POST: considering 등록 + 핏 판단 + (Gemini) + analyses insert
├── components/
│   ├── PreferenceForm.tsx               별점·핏태그·착용빈도 편집 (Client)
│   ├── MeasurementsTable.tsx            실측 표시
│   ├── DeleteGarmentButton.tsx          삭제 확인 + 이동
│   ├── AnalyzeLinkBar.tsx               분석용 링크 입력 바 (LinkInputBar의 analyze 버전)
│   ├── VerdictBadge.tsx                 buy/caution/skip 배지
│   ├── DeviationReport.tsx              항목별 편차 + AI 피드백 표시
│   └── CartItemCard.tsx                 장바구니 카드 + "샀어요" 버튼
├── lib/
│   ├── garments/
│   │   └── register.ts                  garments insert + 실측 저장 + 이미지 복사 + 캐시 병합 + AI 태깅 (owned/considering 공용)
│   ├── fit/
│   │   ├── rules.ts                     허용편차 · 심각도 · 가중치 상수 (순수)
│   │   ├── profile.ts                   클러스터링(순수) + 선호 실측 범위 DB 집계
│   │   └── engine.ts                    편차 채점 → DeviationReport (순수)
│   ├── verdict.ts                       fit_score + match_severity → verdict (순수)
│   ├── gemini/
│   │   └── client.ts                    Gemini SDK 클라이언트 초기화
│   └── ai/
│       ├── tagger.ts                    이미지 → ai_tags (등록 시 1회)
│       └── advisor.ts                   편차 리포트 + 태그 비교 → 매칭 심각도 + 피드백 문장
├── supabase/migrations/
│   └── 0004_analyses.sql                verdict enum, analyses 테이블 + RLS
├── tests/
│   ├── fit/
│   │   ├── profile.test.ts              클러스터링 + 선호 프로필 조립(순수 부분)
│   │   └── engine.test.ts               편차 채점
│   ├── verdict.test.ts                  최종 판정
│   ├── ai/
│   │   ├── tagger.test.ts               Gemini 모킹
│   │   └── advisor.test.ts              Gemini 모킹
│   └── rls.test.ts                      (수정) analyses 시나리오 추가
├── .env.local.example                   (수정) GEMINI_API_KEY 추가
└── package.json                         (수정) @google/genai 추가
```

**분리 근거.** `lib/fit/profile.ts`의 클러스터링(`clusterValues`)과 `lib/fit/engine.ts`의 채점(`scoreDeviation`)은 순수 함수라 가상 데이터로 단위 테스트되고, DB 접근은 각각을 감싸는 얇은 wrapper(`fetchPreferenceProfile`)에만 있다. 이 둘을 합치면 회귀가 가장 무서운 산술 로직이 네트워크 없이는 테스트되지 못한다. `lib/garments/register.ts`로 등록 로직을 뽑아내는 이유는 스펙이 요구하는 "등록 파이프라인 재사용"(§5) 그대로다 — 옷장 등록(`status='owned'`)과 구매 판단(`status='considering'`)이 이미지 복사·실측 저장·캐시 병합·AI 태깅을 토씨 하나 다르지 않게 공유해야, 무신사 파서가 바뀌거나 태깅 로직이 바뀌었을 때 한 곳만 고치면 된다.

---

### Task 1: 옷 수정·삭제 API

옷장 상세 화면이 쓸 API다. 선호도 편집(별점·핏태그·착용빈도)과 "샀어요"(장바구니→옷장 승격)를 하나의 PATCH로 처리한다 — 둘 다 "이 옷의 컬럼 몇 개를 갱신한다"는 같은 모양의 작업이고, 사용자 입장에서도 "옷 상세에서 뭔가를 바꾼다"는 같은 행동이기 때문이다. 접근 제어는 새 코드가 아니라 계획 1의 `garments_update`/`garments_delete` RLS 정책(`owner_id = auth.uid()`)이 그대로 막는다 — `tests/rls.test.ts`의 "남의 옷은 수정할 수 없다"/"남의 옷은 삭제할 수 없다" 시나리오가 이미 이 정책을 검증했으므로 이 태스크에서 새 RLS 테스트를 만들지 않는다.

**Files:**
- Create: `app/api/garments/[id]/route.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (계획 1 Task 8)
- Produces:
  - `PATCH /api/garments/:id` — 요청 `{ rating?, fitTag?, wearFrequency?, status? }`, 응답 `{ ok: true }` 또는 `{ error }`
  - `DELETE /api/garments/:id` — 응답 `{ ok: true }` 또는 `{ error }`

- [ ] **Step 1: Route Handler 작성**

`app/api/garments/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'

const PatchBody = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  fitTag: z.enum(['tight', 'just', 'loose']).nullable().optional(),
  wearFrequency: z.enum(['often', 'sometimes', 'rarely']).nullable().optional(),
  // 장바구니 → 옷장 승격("샀어요") 전용. 그 외 상태 전이(예: owned → considering)는 막는다.
  status: z.literal('owned').optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { id } = await params
  const parsed = PatchBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }
  const input = parsed.data

  if (input.status === 'owned') {
    // "샀어요"는 장바구니(considering)에 있던 옷에만 의미가 있다 — 이미 owned인 옷을 다시
    // owned로 "승격"하는 건 실수이거나 오용이므로 막는다. RLS가 소유자 확인을 하므로 여기서는
    // 상태 전이 자체의 논리적 유효성만 본다.
    const { data: current } = await supabase.from('garments').select('status').eq('id', id).single()
    if (current?.status !== 'considering') {
      return NextResponse.json({ error: '장바구니에 있는 옷만 옷장으로 옮길 수 있습니다.' }, { status: 400 })
    }
  }

  const updates: Record<string, unknown> = {}
  if ('rating' in input) updates.rating = input.rating
  if ('fitTag' in input) updates.fit_tag = input.fitTag
  if ('wearFrequency' in input) updates.wear_frequency = input.wearFrequency
  if (input.status) updates.status = input.status

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 값이 없습니다.' }, { status: 400 })
  }

  const { error, count } = await supabase
    .from('garments')
    .update(updates, { count: 'exact' })
    .eq('id', id)

  // RLS가 남의 옷이면 0행을 갱신하고 error 없이 조용히 끝낸다 — count로 구분해 404를 준다.
  // (count 옵션은 update()/delete() 자체에 넘긴다 — 체이닝된 select()는 이 옵션을 받지 않는다.)
  if (error) return NextResponse.json({ error: '수정하지 못했습니다.' }, { status: 500 })
  if (!count) return NextResponse.json({ error: '옷을 찾을 수 없습니다.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { id } = await params
  const { error, count } = await supabase
    .from('garments')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: '삭제하지 못했습니다.' }, { status: 500 })
  if (!count) return NextResponse.json({ error: '옷을 찾을 수 없습니다.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: 수동 검증**

`npm run dev` 후 로그인한 상태에서 브라우저 콘솔에:

```js
// 본인 옷 id로 교체
const id = '<garment-id>'
await (await fetch(`/api/garments/${id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rating: 5, fitTag: 'just' }),
})).json()
```

Expected: `{ ok: true }`. Supabase Table Editor에서 `garments.rating`/`fit_tag`가 바뀐 것을 확인한다.

- [ ] **Step 3: 커밋**

```bash
git add app/api/garments/[id]
git commit -m "feat: add garment update and delete api"
```

---

### Task 2: 옷 상세 화면

실측 표, 선호도 편집 폼, 삭제 버튼을 보여준다. 옷장 그리드의 카드를 눌러 들어온다.

**Files:**
- Create: `components/MeasurementsTable.tsx`
- Create: `components/PreferenceForm.tsx`
- Create: `components/DeleteGarmentButton.tsx`
- Create: `app/wardrobe/[id]/page.tsx`
- Modify: `components/GarmentCard.tsx` (카드를 상세 페이지로 감싼다)

**Interfaces:**
- Consumes: `PATCH /api/garments/:id`, `DELETE /api/garments/:id` (Task 1), `createServerSupabase`, `CATEGORY_LABELS`
- Produces: `/wardrobe/:id` 화면

- [ ] **Step 1: 실측 표 컴포넌트**

`components/MeasurementsTable.tsx`:

```tsx
type Props = {
  measurements: { key: string; value: number }[]
}

export function MeasurementsTable({ measurements }: Props) {
  if (measurements.length === 0) {
    return <p className="text-sm text-gray-500">등록된 실측 정보가 없습니다.</p>
  }

  return (
    <table className="w-full text-sm">
      <tbody>
        {measurements.map((m) => (
          <tr key={m.key} className="border-b last:border-0">
            <td className="py-2 text-gray-600">{m.key}</td>
            <td className="py-2 text-right font-medium">{m.value}cm</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 2: 선호도 편집 폼**

`components/PreferenceForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FitTag, WearFrequency } from '@/lib/types'

const FIT_TAG_LABELS: Record<FitTag, string> = { tight: '작음', just: '딱맞음', loose: '큼' }
const WEAR_FREQUENCY_LABELS: Record<WearFrequency, string> = {
  often: '자주', sometimes: '가끔', rarely: '거의 안 입음',
}

type Props = {
  garmentId: string
  initialRating: number | null
  initialFitTag: FitTag | null
  initialWearFrequency: WearFrequency | null
}

// 핏 판단 엔진(Task 4)이 rating>=4 또는 wear_frequency='often'을 "성공 집합",
// rating<=2 또는 wear_frequency='rarely'를 "실패 집합" 신호로 쓴다(스펙 §9) —
// 이 폼에서 남기는 값이 곧 그 사용자의 선호 실측 범위를 만드는 원재료다.
export function PreferenceForm({ garmentId, initialRating, initialFitTag, initialWearFrequency }: Props) {
  const router = useRouter()
  const [rating, setRating] = useState(initialRating)
  const [fitTag, setFitTag] = useState(initialFitTag)
  const [wearFrequency, setWearFrequency] = useState(initialWearFrequency)
  const [saving, setSaving] = useState(false)

  async function save(next: { rating?: number | null; fitTag?: FitTag | null; wearFrequency?: WearFrequency | null }) {
    setSaving(true)
    await fetch(`/api/garments/${garmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-sm font-medium">별점</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={saving}
              onClick={() => { setRating(n); save({ rating: n }) }}
              className={`text-2xl ${rating != null && n <= rating ? 'text-amber-400' : 'text-gray-300'}`}
              aria-label={`${n}점`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">핏</p>
        <div className="flex gap-2">
          {(Object.keys(FIT_TAG_LABELS) as FitTag[]).map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={saving}
              onClick={() => { setFitTag(tag); save({ fitTag: tag }) }}
              className={`rounded-full border px-3 py-1 text-sm ${fitTag === tag ? 'bg-black text-white' : 'bg-white'}`}
            >
              {FIT_TAG_LABELS[tag]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">착용 빈도</p>
        <div className="flex gap-2">
          {(Object.keys(WEAR_FREQUENCY_LABELS) as WearFrequency[]).map((freq) => (
            <button
              key={freq}
              type="button"
              disabled={saving}
              onClick={() => { setWearFrequency(freq); save({ wearFrequency: freq }) }}
              className={`rounded-full border px-3 py-1 text-sm ${wearFrequency === freq ? 'bg-black text-white' : 'bg-white'}`}
            >
              {WEAR_FREQUENCY_LABELS[freq]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 삭제 버튼**

`components/DeleteGarmentButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
      <button type="button" onClick={() => setConfirming(true)} className="text-sm text-red-600 underline">
        삭제
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span>정말 삭제할까요?</span>
      <button type="button" onClick={handleDelete} disabled={deleting}
        className="rounded bg-red-600 px-2 py-1 text-white disabled:bg-gray-300">
        {deleting ? '삭제 중…' : '삭제'}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-gray-500">취소</button>
    </div>
  )
}
```

- [ ] **Step 4: 상세 페이지**

`app/wardrobe/[id]/page.tsx`:

```tsx
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { CATEGORY_LABELS, type Category, type FitTag, type WearFrequency } from '@/lib/types'
import { MeasurementsTable } from '@/components/MeasurementsTable'
import { PreferenceForm } from '@/components/PreferenceForm'
import { DeleteGarmentButton } from '@/components/DeleteGarmentButton'

type Props = { params: Promise<{ id: string }> }

// 이 프로젝트는 Supabase 타입을 생성해두지 않아(계획 1부터 일관된 선택) select 결과가
// any로 추론된다 — GarmentCardData(계획 1 Task 12)와 같은 이유로 명시적 타입을 달아 캐스팅한다.
type GarmentDetail = {
  id: string
  name: string
  brand: string | null
  price: number | null
  image_url: string | null
  category: Category
  color_option: string | null
  size_option: string | null
  rating: number | null
  fit_tag: FitTag | null
  wear_frequency: WearFrequency | null
  garment_measurements: { key: string; value: number }[] | null
}

export default async function GarmentDetailPage({ params }: Props) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { id } = await params
  const { data: garment } = await supabase
    .from('garments')
    .select('id, name, brand, price, image_url, category, color_option, size_option, rating, fit_tag, wear_frequency, garment_measurements(key, value)')
    .eq('id', id)
    .single<GarmentDetail>()

  // RLS가 남의 옷이면 이 시점에 이미 null을 돌려준다 — 별도 소유자 검사가 필요 없다.
  if (!garment) notFound()

  const measurements = (garment.garment_measurements ?? [])
    .map((m) => ({ key: m.key, value: Number(m.value) }))
    .sort((a, b) => a.key.localeCompare(b.key))

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl bg-gray-100">
        {garment.image_url && (
          <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="400px" />
        )}
      </div>

      <div>
        <p className="text-sm text-gray-500">{garment.brand ?? CATEGORY_LABELS[garment.category]}</p>
        <h1 className="text-xl font-bold">{garment.name}</h1>
        <p className="text-sm text-gray-600">
          {[garment.color_option, garment.size_option].filter(Boolean).join(' · ')}
          {garment.price ? ` · ${garment.price.toLocaleString()}원` : ''}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">실측</h2>
        <MeasurementsTable measurements={measurements} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">선호도</h2>
        <PreferenceForm
          garmentId={garment.id}
          initialRating={garment.rating}
          initialFitTag={garment.fit_tag}
          initialWearFrequency={garment.wear_frequency}
        />
      </section>

      <DeleteGarmentButton garmentId={garment.id} />
    </main>
  )
}
```

- [ ] **Step 5: 옷장 카드에서 상세로 연결**

`components/GarmentCard.tsx`에 `Link` 래핑을 추가한다.

```tsx
import Link from 'next/link'
import Image from 'next/image'
import { CATEGORY_LABELS, type Category } from '@/lib/types'

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
    <Link href={`/wardrobe/${garment.id}`} className="block overflow-hidden rounded-xl border">
      <div className="relative aspect-[3/4] bg-gray-100">
        {garment.image_url ? (
          <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="200px" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            이미지 없음
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="text-xs text-gray-500">{garment.brand ?? CATEGORY_LABELS[garment.category]}</p>
        <h3 className="line-clamp-2 text-sm font-medium">{garment.name}</h3>
        <p className="text-xs text-gray-600">
          {[garment.color_option, garment.size_option].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Link>
  )
}
```

(`<article>`을 `<Link>`로 바꿨을 뿐, `GarmentCardData`와 렌더 내용은 그대로다.)

- [ ] **Step 6: 수동 검증**

`npm run dev` → `/wardrobe`에서 카드 클릭 → 상세 페이지 로드 확인 → 별점 클릭 시 즉시 저장되고(`router.refresh()`) 새로고침해도 유지되는지 확인 → 삭제 → 그리드에서 사라지는지 확인.

- [ ] **Step 7: 커밋**

```bash
git add components/MeasurementsTable.tsx components/PreferenceForm.tsx components/DeleteGarmentButton.tsx app/wardrobe/[id] components/GarmentCard.tsx
git commit -m "feat: add garment detail page with preference editing"
```

---

### Task 3: 핏 판단 상수

스펙 §9 표를 그대로 상수로 옮긴다. 카테고리·항목마다 허용 편차·심각도·가중치가 다르다.

**Files:**
- Create: `lib/fit/rules.ts`
- Test: `tests/fit/rules.test.ts`

**Interfaces:**
- Consumes: `Category` (계획 1 Task 3)
- Produces:
  - `Severity = 'low' | 'medium' | 'high' | 'fatal'`
  - `FieldRule = { tolerance: number; severity: Severity; weight: number }`
  - `FIT_RULES: Partial<Record<Category, Record<string, FieldRule>>>`
  - `MIN_OWNED_GARMENTS_FOR_FIT`, `VERDICT_CAUTION_MAX`, `MATCH_PENALTY`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/fit/rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { FIT_RULES, MATCH_PENALTY, VERDICT_CAUTION_MAX, MIN_OWNED_GARMENTS_FOR_FIT } from '@/lib/fit/rules'

describe('FIT_RULES', () => {
  it('상의는 허리단면을 판단하지 않는다(하의 전용 항목)', () => {
    expect(FIT_RULES.top?.['허리단면']).toBeUndefined()
  })

  it('하의 허리단면은 치명 심각도에 가중치 5다', () => {
    expect(FIT_RULES.bottom?.['허리단면']).toEqual({ tolerance: 1.5, severity: 'fatal', weight: 5 })
  })

  it('아우터는 상의보다 허용편차가 1.0cm 더 넓다', () => {
    expect(FIT_RULES.outer?.['총장'].tolerance).toBe(FIT_RULES.top!['총장'].tolerance + 1.0)
    expect(FIT_RULES.outer?.['가슴단면'].tolerance).toBe(FIT_RULES.top!['가슴단면'].tolerance + 1.0)
  })

  it('신발·액세서리는 핏 판단 대상이 아니다', () => {
    expect(FIT_RULES.shoes).toBeUndefined()
    expect(FIT_RULES.acc).toBeUndefined()
  })
})

describe('MATCH_PENALTY', () => {
  it('ok/warn/bad를 0/2/4점으로 환산한다', () => {
    expect(MATCH_PENALTY).toEqual({ ok: 0, warn: 2, bad: 4 })
  })
})

describe('임계값', () => {
  it('caution 상한은 4점이다', () => {
    expect(VERDICT_CAUTION_MAX).toBe(4)
  })

  it('핏 비교 최소 보유 벌 수는 3벌이다', () => {
    expect(MIN_OWNED_GARMENTS_FOR_FIT).toBe(3)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- tests/fit/rules.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현 작성**

`lib/fit/rules.ts`:

```ts
import type { Category } from '@/lib/types'

export type Severity = 'low' | 'medium' | 'high' | 'fatal'

export type FieldRule = {
  /** 허용 편차(cm). 이 안쪽이면 위반 없음. */
  tolerance: number
  severity: Severity
  weight: number
}

/**
 * 카테고리·항목별 허용 편차·심각도·가중치 (스펙 §9).
 * 허리단면 2cm는 아예 못 입는 문제고 총장 2cm는 무의미하다 — 이 차이를 코드가 알고 있어야
 * "총장은 좀 길지만 괜찮고 허리가 안 맞습니다" 같은 우선순위 있는 피드백이 나온다.
 * 신발·액세서리는 실측 기반 핏 판단 대상이 아니라 의도적으로 비워둔다.
 */
export const FIT_RULES: Partial<Record<Category, Record<string, FieldRule>>> = {
  top: {
    어깨너비: { tolerance: 1.5, severity: 'high', weight: 3 },
    가슴단면: { tolerance: 2.0, severity: 'high', weight: 3 },
    총장: { tolerance: 3.0, severity: 'medium', weight: 2 },
    소매길이: { tolerance: 2.5, severity: 'low', weight: 1 },
  },
  // 아우터는 레이어링을 감안해 상의 허용편차에 +1.0cm를 더한다(스펙 §9).
  outer: {
    어깨너비: { tolerance: 2.5, severity: 'high', weight: 3 },
    가슴단면: { tolerance: 3.0, severity: 'high', weight: 3 },
    총장: { tolerance: 4.0, severity: 'medium', weight: 2 },
    소매길이: { tolerance: 3.5, severity: 'low', weight: 1 },
  },
  bottom: {
    허리단면: { tolerance: 1.5, severity: 'fatal', weight: 5 },
    밑위: { tolerance: 1.5, severity: 'high', weight: 3 },
    허벅지단면: { tolerance: 1.5, severity: 'high', weight: 3 },
    엉덩이단면: { tolerance: 2.0, severity: 'medium', weight: 2 },
    밑단단면: { tolerance: 2.0, severity: 'medium', weight: 2 },
    총장: { tolerance: 3.0, severity: 'medium', weight: 2 },
  },
}

/** 같은 카테고리 owned 옷이 이 수 미만이면 핏 비교를 건너뛴다(스펙 §9 "데이터 부족 처리"). */
export const MIN_OWNED_GARMENTS_FOR_FIT = 3

/** Gemini가 반환한 매칭 심각도(ok/warn/bad)를 fit_score와 합산 가능한 점수로 환산한다. */
export const MATCH_PENALTY: Record<'ok' | 'warn' | 'bad', number> = { ok: 0, warn: 2, bad: 4 }

/** fit_score + match_penalty 합계가 이 값 이하면 caution, 초과면 skip(치명 위반이 없을 때). */
export const VERDICT_CAUTION_MAX = 4
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/fit/rules.test.ts`
Expected: PASS, 6 passed

- [ ] **Step 5: 커밋**

```bash
git add lib/fit/rules.ts tests/fit/rules.test.ts
git commit -m "feat: add fit judgment tolerance and severity rules"
```

---

### Task 4: 선호 실측 범위 산출

옷장의 `status='owned'` 옷들을 별점·착용빈도로 성공/실패 집합으로 나누고, 성공 집합의 값을 클러스터링해 선호 범위(들)를 만든다. 클러스터링 자체는 순수 함수라 가상 배열로 테스트하고, DB 집계는 그 위에 얇게 얹는다.

**Files:**
- Create: `lib/fit/profile.ts`
- Test: `tests/fit/profile.test.ts`

**Interfaces:**
- Consumes: `FIT_RULES`, `MIN_OWNED_GARMENTS_FOR_FIT` (Task 3), `Category`, `FitTag`, `WearFrequency` (계획 1 Task 3)
- Produces:
  - `PreferredRange = { lo: number; hi: number }`
  - `FieldProfile = { ranges: PreferredRange[]; upperWarnLimit?: number; lowerWarnLimit?: number }`
  - `PreferenceProfile = { status: 'ok' | 'low_confidence' | 'insufficient'; fields: Record<string, FieldProfile>; avgPrice: number | null }`
  - `clusterValues(values: number[], tolerance: number): PreferredRange[]`
  - `buildPreferenceProfile(garments: GarmentForProfile[], category: Category): PreferenceProfile`
  - `fetchPreferenceProfile(supabase, ownerId: string, category: Category): Promise<PreferenceProfile>`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/fit/profile.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { clusterValues, buildPreferenceProfile, type GarmentForProfile } from '@/lib/fit/profile'

describe('clusterValues', () => {
  it('간격이 허용편차 이내면 하나의 범위로 묶는다', () => {
    expect(clusterValues([58, 60, 62], 3)).toEqual([{ lo: 58, hi: 62 }])
  })

  it('간격이 허용편차보다 크면 별도 범위로 나눈다 — 스펙 §9 예시', () => {
    // 총장 성공 집합 {58,60,62,78,80}, t=3 → 62→78 구간(16)이 t보다 커서 두 범위로 나뉜다.
    expect(clusterValues([58, 60, 62, 78, 80], 3)).toEqual([
      { lo: 58, hi: 62 },
      { lo: 78, hi: 80 },
    ])
  })

  it('빈 배열은 빈 배열을 돌려준다', () => {
    expect(clusterValues([], 3)).toEqual([])
  })

  it('값이 하나뿐이면 범위 하나(lo===hi)를 돌려준다', () => {
    expect(clusterValues([70], 3)).toEqual([{ lo: 70, hi: 70 }])
  })
})

function garment(overrides: Partial<GarmentForProfile>): GarmentForProfile {
  return {
    rating: null, fitTag: null, wearFrequency: null, price: null, measurements: {},
    ...overrides,
  }
}

describe('buildPreferenceProfile — 데이터 부족', () => {
  it('같은 카테고리 옷이 3벌 미만이면 insufficient다', () => {
    const garments = [garment({ rating: 5, measurements: { 총장: 60 } })]
    const profile = buildPreferenceProfile(garments, 'top')
    expect(profile.status).toBe('insufficient')
    expect(profile.fields).toEqual({})
  })
})

describe('buildPreferenceProfile — 성공 집합', () => {
  const garments: GarmentForProfile[] = [
    garment({ rating: 5, price: 30000, measurements: { 총장: 60, 어깨너비: 48 } }),
    garment({ wearFrequency: 'often', price: 40000, measurements: { 총장: 61, 어깨너비: 49 } }),
    garment({ rating: 1, fitTag: 'loose', price: 20000, measurements: { 총장: 70, 어깨너비: 55 } }),
  ]

  it('rating>=4 또는 wear_frequency=often인 옷만 성공 집합으로 묶어 범위를 만든다', () => {
    const profile = buildPreferenceProfile(garments, 'top')
    expect(profile.status).toBe('ok')
    expect(profile.fields['총장'].ranges).toEqual([{ lo: 60, hi: 61 }])
  })

  it('rating<=2고 fit_tag=loose인 실패 옷의 최소값이 상한 경고선이 된다', () => {
    const profile = buildPreferenceProfile(garments, 'top')
    expect(profile.fields['총장'].upperWarnLimit).toBe(70)
  })

  it('owned 옷 전체의 유효한 가격 평균을 avgPrice로 낸다', () => {
    const profile = buildPreferenceProfile(garments, 'top')
    expect(profile.avgPrice).toBe(30000)
  })
})

describe('buildPreferenceProfile — 성공 집합이 비어있으면 전체로 대체', () => {
  it('rating·착용빈도 신호가 하나도 없으면 전체 owned로 대체하고 신뢰도를 낮춘다', () => {
    const garments: GarmentForProfile[] = [
      garment({ measurements: { 총장: 60 } }),
      garment({ measurements: { 총장: 62 } }),
      garment({ measurements: { 총장: 64 } }),
    ]
    const profile = buildPreferenceProfile(garments, 'top')
    expect(profile.status).toBe('low_confidence')
    expect(profile.fields['총장'].ranges).toEqual([{ lo: 60, hi: 64 }])
  })
})

describe('buildPreferenceProfile — 표준 항목이 아닌 값은 무시한다', () => {
  it('FIT_RULES에 없는 카테고리는 insufficient다', () => {
    const garments = [garment({}), garment({}), garment({})]
    expect(buildPreferenceProfile(garments, 'shoes').status).toBe('insufficient')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- tests/fit/profile.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현 작성**

`lib/fit/profile.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category, FitTag, WearFrequency } from '@/lib/types'
import { FIT_RULES, MIN_OWNED_GARMENTS_FOR_FIT } from '@/lib/fit/rules'

export type PreferredRange = { lo: number; hi: number }

export type FieldProfile = {
  ranges: PreferredRange[]
  /** loose(큼)로 실패한 옷들의 최소값 — 이 이상이면 과거에 커서 안 입은 치수(회피 신호 상한). */
  upperWarnLimit?: number
  /** tight(작음)로 실패한 옷들의 최대값 — 이 이하면 과거에 작아서 안 입은 치수(회피 신호 하한). */
  lowerWarnLimit?: number
}

export type PreferenceProfile = {
  status: 'ok' | 'low_confidence' | 'insufficient'
  fields: Record<string, FieldProfile>
  avgPrice: number | null
}

export type GarmentForProfile = {
  rating: number | null
  fitTag: FitTag | null
  wearFrequency: WearFrequency | null
  price: number | null
  measurements: Record<string, number>
}

/**
 * 값을 오름차순 정렬한 뒤 인접한 두 값의 차이가 허용편차(tolerance)보다 크면 그 지점에서
 * 구간을 나눈다(스펙 §9). 크롭과 오버핏처럼 서로 다른 극단을 동시에 선호하는 사용자를
 * 하나의 최소·최대 범위로 잡으면, 그 사이의 좋아하지 않는 중간 기장까지 통과시켜버린다.
 */
export function clusterValues(values: number[], tolerance: number): PreferredRange[] {
  if (values.length === 0) return []
  const sorted = [...values].sort((a, b) => a - b)

  const ranges: PreferredRange[] = []
  let clusterStart = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - prev > tolerance) {
      ranges.push({ lo: clusterStart, hi: prev })
      clusterStart = sorted[i]
    }
    prev = sorted[i]
  }
  ranges.push({ lo: clusterStart, hi: prev })
  return ranges
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

/**
 * garments(순수 데이터, DB를 모른다)로부터 선호 실측 범위를 조립한다.
 * DB 조회와 분리해서 여기 하나만 단위 테스트로 촘촘히 검증한다.
 */
export function buildPreferenceProfile(garments: GarmentForProfile[], category: Category): PreferenceProfile {
  const rules = FIT_RULES[category]
  if (!rules) return { status: 'insufficient', fields: {}, avgPrice: null }
  if (garments.length < MIN_OWNED_GARMENTS_FOR_FIT) {
    return { status: 'insufficient', fields: {}, avgPrice: null }
  }

  const isSuccess = (g: GarmentForProfile) => (g.rating != null && g.rating >= 4) || g.wearFrequency === 'often'
  const isFailure = (g: GarmentForProfile) => (g.rating != null && g.rating <= 2) || g.wearFrequency === 'rarely'

  let successSet = garments.filter(isSuccess)
  let status: PreferenceProfile['status'] = 'ok'
  if (successSet.length === 0) {
    // 성공 신호가 하나도 없으면 카테고리 전체로 대체하되, 신뢰도가 낮다는 걸 리포트에 남긴다.
    successSet = garments
    status = 'low_confidence'
  }
  const failureSet = garments.filter(isFailure)

  const fields: Record<string, FieldProfile> = {}
  for (const key of Object.keys(rules)) {
    const successValues = successSet.map((g) => g.measurements[key]).filter((v): v is number => typeof v === 'number')
    if (successValues.length === 0) continue

    const looseFailureValues = failureSet
      .filter((g) => g.fitTag === 'loose')
      .map((g) => g.measurements[key])
      .filter((v): v is number => typeof v === 'number')
    const tightFailureValues = failureSet
      .filter((g) => g.fitTag === 'tight')
      .map((g) => g.measurements[key])
      .filter((v): v is number => typeof v === 'number')

    fields[key] = {
      ranges: clusterValues(successValues, rules[key].tolerance),
      upperWarnLimit: looseFailureValues.length > 0 ? Math.min(...looseFailureValues) : undefined,
      lowerWarnLimit: tightFailureValues.length > 0 ? Math.max(...tightFailureValues) : undefined,
    }
  }

  const avgPrice = average(garments.map((g) => g.price).filter((p): p is number => typeof p === 'number'))

  return { status, fields, avgPrice }
}

type GarmentRow = {
  rating: number | null
  fit_tag: FitTag | null
  wear_frequency: WearFrequency | null
  price: number | null
  garment_measurements: { key: string; value: number }[] | null
}

/**
 * 옷장 집계 쿼리. owner_id를 명시적으로 건다 — RLS의 garments_select 정책은 "본인 것 또는
 * 공개 옷장"을 모두 허용하므로, 이 필터가 없으면 다른 공개 사용자의 옷까지 내 선호 범위에
 * 섞여 들어간다(app/wardrobe/page.tsx의 동일한 이유의 명시적 필터 참고).
 */
export async function fetchPreferenceProfile(
  supabase: SupabaseClient,
  ownerId: string,
  category: Category,
): Promise<PreferenceProfile> {
  const { data } = await supabase
    .from('garments')
    .select('rating, fit_tag, wear_frequency, price, garment_measurements(key, value)')
    .eq('owner_id', ownerId)
    .eq('status', 'owned')
    .eq('category', category)
    .overrideTypes<GarmentRow[], { merge: false }>()  // .returns()는 deprecated — overrideTypes로 대체

  const garments: GarmentForProfile[] = (data ?? []).map((g) => ({
    rating: g.rating,
    fitTag: g.fit_tag,
    wearFrequency: g.wear_frequency,
    price: g.price,
    measurements: Object.fromEntries((g.garment_measurements ?? []).map((m) => [m.key, Number(m.value)])),
  }))

  return buildPreferenceProfile(garments, category)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/fit/profile.test.ts`
Expected: PASS, 9 passed

- [ ] **Step 5: 커밋**

```bash
git add lib/fit/profile.ts tests/fit/profile.test.ts
git commit -m "feat: cluster wardrobe measurements into preferred ranges"
```

---

### Task 5: 편차 채점 엔진

후보 옷의 실측값을 선호 범위와 비교해 항목별 편차·점수·회피 신호를 계산한다.

**Files:**
- Create: `lib/fit/engine.ts`
- Test: `tests/fit/engine.test.ts`

**Interfaces:**
- Consumes: `FIT_RULES` (Task 3), `PreferenceProfile`, `FieldProfile` (Task 4), `Category`
- Produces:
  - `FieldDeviation = { key: string; candidateValue: number; excess: number; severity: Severity; score: number; avoidanceSignal: boolean }`
  - `DeviationReport = { status: PreferenceProfile['status']; fields: FieldDeviation[]; fitScore: number; hasFatalViolation: boolean }`
  - `scoreDeviation(candidateMeasurements: Record<string, number>, profile: PreferenceProfile, category: Category): DeviationReport`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/fit/engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scoreDeviation } from '@/lib/fit/engine'
import type { PreferenceProfile } from '@/lib/fit/profile'

function profile(fields: PreferenceProfile['fields'], status: PreferenceProfile['status'] = 'ok'): PreferenceProfile {
  return { status, fields, avgPrice: null }
}

describe('scoreDeviation — 범위 안', () => {
  it('선호 범위 안이면 위반 없이 0점이다', () => {
    const report = scoreDeviation(
      { 총장: 61 },
      profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } }),
      'top',
    )
    expect(report.fields[0]).toMatchObject({ key: '총장', excess: 0, score: 0 })
    expect(report.fitScore).toBe(0)
  })
})

describe('scoreDeviation — 경고 구간(허용편차 이내 초과)', () => {
  it('허용구간[lo-t, hi+t]을 벗어났지만 초과폭이 t 이내면 가중치 × 1점이다', () => {
    // 총장 허용편차 t=3.0, 가중치 2. 범위 [60,62] → 허용구간 [57,65].
    // 67은 허용구간 밖으로 2cm 초과(67-65=2 <= t=3) → 경고.
    const report = scoreDeviation(
      { 총장: 67 },
      profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } }),
      'top',
    )
    expect(report.fields[0]).toMatchObject({ excess: 2, score: 2 })
  })
})

describe('scoreDeviation — 심각 구간(허용편차 초과)', () => {
  it('허용구간 밖으로 t보다 더 벗어나면 가중치 × 2점이다', () => {
    // 허용구간 [57,65] 밖으로 5cm 초과(70-65=5 > t=3) → 심각(가중치 2 × 2 = 4).
    const report = scoreDeviation(
      { 총장: 70 },
      profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } }),
      'top',
    )
    expect(report.fields[0]).toMatchObject({ excess: 5, score: 4 })
  })
})

describe('scoreDeviation — 클러스터가 여러 개면 가장 가까운 범위를 쓴다', () => {
  it('크롭·오버핏 범위를 둘 다 가진 사용자에게 둘 중 하나에만 맞아도 통과한다', () => {
    const report = scoreDeviation(
      { 총장: 79 },
      profile({ 총장: { ranges: [{ lo: 58, hi: 62 }, { lo: 78, hi: 80 }] } }),
      'top',
    )
    expect(report.fields[0]).toMatchObject({ excess: 0, score: 0 })
  })
})

describe('scoreDeviation — 회피 신호', () => {
  it('상한 경고선 이상이면 가중치 × 1점을 더한다', () => {
    const report = scoreDeviation(
      { 총장: 61 },
      profile({ 총장: { ranges: [{ lo: 60, hi: 62 }], upperWarnLimit: 61 } }),
      'top',
    )
    // 범위 안이라 excess=0(0점)이지만 회피 신호로 가중치(2) × 1 = 2점이 더해진다.
    expect(report.fields[0]).toMatchObject({ score: 2, avoidanceSignal: true })
  })
})

describe('scoreDeviation — 치명 위반', () => {
  it('허리단면처럼 심각도가 fatal인 항목에 위반이 있으면 hasFatalViolation=true다', () => {
    const report = scoreDeviation(
      { 허리단면: 90 },
      profile({ 허리단면: { ranges: [{ lo: 70, hi: 72 }] } }),
      'bottom',
    )
    expect(report.hasFatalViolation).toBe(true)
  })
})

describe('scoreDeviation — 둘 다 있는 항목만 채점한다', () => {
  it('후보에 없는 항목은 건너뛴다', () => {
    const report = scoreDeviation({}, profile({ 총장: { ranges: [{ lo: 60, hi: 62 }] } }), 'top')
    expect(report.fields).toEqual([])
    expect(report.fitScore).toBe(0)
  })

  it('선호 범위가 없는 항목(값이 하나도 없어 클러스터가 비어있음)은 건너뛴다', () => {
    const report = scoreDeviation({ 총장: 61 }, profile({ 총장: { ranges: [] } }), 'top')
    expect(report.fields).toEqual([])
  })
})

describe('scoreDeviation — 데이터 부족', () => {
  it('프로필이 insufficient면 채점 없이 그대로 넘긴다', () => {
    const report = scoreDeviation({ 총장: 61 }, profile({}, 'insufficient'), 'top')
    expect(report.status).toBe('insufficient')
    expect(report.fields).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- tests/fit/engine.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현 작성**

`lib/fit/engine.ts`:

```ts
import type { Category } from '@/lib/types'
import { FIT_RULES, type Severity } from '@/lib/fit/rules'
import type { PreferenceProfile } from '@/lib/fit/profile'

export type FieldDeviation = {
  key: string
  candidateValue: number
  /** 허용 범위를 벗어난 만큼(cm). 0이면 위반 없음. */
  excess: number
  severity: Severity
  score: number
  avoidanceSignal: boolean
}

export type DeviationReport = {
  status: PreferenceProfile['status']
  fields: FieldDeviation[]
  fitScore: number
  hasFatalViolation: boolean
}

/**
 * 후보 옷의 실측값을 선호 범위와 비교해 항목별 편차·점수를 매긴다(스펙 §9 "편차 채점").
 * 순수 함수다 — Supabase도 Gemini도 모른다.
 */
export function scoreDeviation(
  candidateMeasurements: Record<string, number>,
  profile: PreferenceProfile,
  category: Category,
): DeviationReport {
  const rules = FIT_RULES[category]
  if (!rules || profile.status === 'insufficient') {
    return { status: 'insufficient', fields: [], fitScore: 0, hasFatalViolation: false }
  }

  const fields: FieldDeviation[] = []
  let fitScore = 0
  let hasFatalViolation = false

  for (const [key, rule] of Object.entries(rules)) {
    const candidateValue = candidateMeasurements[key]
    const fieldProfile = profile.fields[key]
    if (candidateValue == null || !fieldProfile || fieldProfile.ranges.length === 0) continue

    const t = rule.tolerance
    // 범위가 여러 개(클러스터)일 수 있으므로, 각 범위에 대한 편차 중 가장 작은 값을 쓴다 —
    // 크롭 범위와 오버핏 범위를 둘 다 가진 사용자에게 후보가 둘 중 하나에만 맞아도 통과해야 한다.
    const excess = Math.min(
      ...fieldProfile.ranges.map((range) => {
        if (candidateValue < range.lo - t) return range.lo - t - candidateValue
        if (candidateValue > range.hi + t) return candidateValue - (range.hi + t)
        return 0
      }),
    )

    let score = 0
    if (excess > t) score = rule.weight * 2
    else if (excess > 0) score = rule.weight * 1

    const avoidanceSignal =
      (fieldProfile.upperWarnLimit != null && candidateValue >= fieldProfile.upperWarnLimit) ||
      (fieldProfile.lowerWarnLimit != null && candidateValue <= fieldProfile.lowerWarnLimit)
    if (avoidanceSignal) score += rule.weight * 1

    if (score > 0 && rule.severity === 'fatal') hasFatalViolation = true

    fitScore += score
    fields.push({ key, candidateValue, excess, severity: rule.severity, score, avoidanceSignal })
  }

  return { status: profile.status, fields, fitScore, hasFatalViolation }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/fit/engine.test.ts`
Expected: PASS, 9 passed

- [ ] **Step 5: 커밋**

```bash
git add lib/fit/engine.ts tests/fit/engine.test.ts
git commit -m "feat: score candidate garment deviation against preferred ranges"
```

---

### Task 6: 최종 판정

`fit_score`와 Gemini의 매칭 심각도를 합쳐 `buy`/`caution`/`skip`을 정한다.

**Files:**
- Create: `lib/verdict.ts`
- Test: `tests/verdict.test.ts`

**Interfaces:**
- Consumes: `MATCH_PENALTY`, `VERDICT_CAUTION_MAX` (Task 3)
- Produces:
  - `Verdict = 'buy' | 'caution' | 'skip'`
  - `MatchSeverity = 'ok' | 'warn' | 'bad'`
  - `decideVerdict(fitScore: number, hasFatalViolation: boolean, matchSeverity: MatchSeverity | null): { verdict: Verdict; matchPenalty: number }`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/verdict.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { decideVerdict } from '@/lib/verdict'

describe('decideVerdict — 합계 기준', () => {
  it('fit_score와 match_penalty 합이 0이면 buy다', () => {
    expect(decideVerdict(0, false, 'ok')).toEqual({ verdict: 'buy', matchPenalty: 0 })
  })

  it('합이 1~4면 caution이다', () => {
    expect(decideVerdict(2, false, 'ok')).toEqual({ verdict: 'caution', matchPenalty: 0 })
    expect(decideVerdict(0, false, 'warn')).toEqual({ verdict: 'caution', matchPenalty: 2 })
    expect(decideVerdict(2, false, 'warn')).toEqual({ verdict: 'caution', matchPenalty: 2 })
  })

  it('합이 5 이상이면 skip이다', () => {
    expect(decideVerdict(3, false, 'warn')).toEqual({ verdict: 'skip', matchPenalty: 2 })
    expect(decideVerdict(1, false, 'bad')).toEqual({ verdict: 'skip', matchPenalty: 4 })
  })
})

describe('decideVerdict — 치명 위반', () => {
  it('fit_score가 0이어도 치명 위반이 있으면 무조건 skip이다', () => {
    expect(decideVerdict(0, true, 'ok')).toEqual({ verdict: 'skip', matchPenalty: 0 })
  })
})

describe('decideVerdict — Gemini 실패', () => {
  it('match_severity가 null이면(Gemini 호출 실패) match_penalty를 0으로 두고 fit_score만으로 판정한다', () => {
    expect(decideVerdict(0, false, null)).toEqual({ verdict: 'buy', matchPenalty: 0 })
    expect(decideVerdict(5, false, null)).toEqual({ verdict: 'skip', matchPenalty: 0 })
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- tests/verdict.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현 작성**

`lib/verdict.ts`:

```ts
import { MATCH_PENALTY, VERDICT_CAUTION_MAX } from '@/lib/fit/rules'

export type Verdict = 'buy' | 'caution' | 'skip'
export type MatchSeverity = 'ok' | 'warn' | 'bad'

/**
 * fit_score(코드가 계산한 실측 편차 점수)와 match_severity(Gemini가 판단한 스타일 매칭)를
 * 합산해 최종 판정을 낸다. Gemini는 verdict를 직접 출력하지 않는다 — 여기서만 계산한다(스펙 §9-10).
 * match_severity가 null이면 Gemini 호출이 실패했다는 뜻이고, match_penalty를 0으로 두어
 * fit_score만으로 판정한다(스펙 §12 에러 처리) — Gemini가 죽어도 앱은 반쯤 살아 있다.
 */
export function decideVerdict(
  fitScore: number,
  hasFatalViolation: boolean,
  matchSeverity: MatchSeverity | null,
): { verdict: Verdict; matchPenalty: number } {
  const matchPenalty = matchSeverity == null ? 0 : MATCH_PENALTY[matchSeverity]

  if (hasFatalViolation) return { verdict: 'skip', matchPenalty }

  const total = fitScore + matchPenalty
  if (total === 0) return { verdict: 'buy', matchPenalty }
  if (total <= VERDICT_CAUTION_MAX) return { verdict: 'caution', matchPenalty }
  return { verdict: 'skip', matchPenalty }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/verdict.test.ts`
Expected: PASS, 7 passed

- [ ] **Step 5: 커밋**

```bash
git add lib/verdict.ts tests/verdict.test.ts
git commit -m "feat: decide buy/caution/skip verdict from fit score and match severity"
```

**게이트:** 여기까지가 스펙 §14 Phase 4의 핵심(`lib/fit/*`, `lib/verdict.ts`)이다. AI 없이도 `scoreDeviation` + `decideVerdict(fitScore, hasFatalViolation, null)` 조합만으로 이미 완결된 판정이 나온다 — Task 8에서 `/api/analyze`가 이 조합을 먼저 쓰고, Task 11에서 Gemini의 `matchSeverity`를 채워 넣는다.

---

### Task 7: 등록 파이프라인 공유화

계획 1 Task 11에서 만든 `app/api/garments/route.ts`의 등록 로직(중복 확인 → 이미지 복사 → insert → 실측 저장 → 캐시 병합)을 `lib/garments/register.ts`로 뽑아낸다. `/api/analyze`(Task 8)가 `status='considering'`으로 같은 로직을 재사용해야 하기 때문이다 — 코드를 복붙하면 무신사 파서가 바뀌었을 때 두 곳을 따로 고쳐야 한다.

**Files:**
- Create: `lib/garments/register.ts`
- Modify: `app/api/garments/route.ts` (등록 로직을 `registerGarment` 호출로 교체)

**Interfaces:**
- Consumes: `copyImageToStorage` (계획 1 Task 11), `mergeSizeTableIntoCache` (계획 1 Task 11), `AUTO_PARSED_FIELDS` (계획 1 Task 5)
- Produces:
  - `RegisterGarmentInput` — 기존 `GarmentSubmitPayload`와 필드 동일
  - `RegisterGarmentResult = { id: string; duplicate: boolean; measurementsFailed: boolean }` — 원래 라우트가 실측 저장만 실패했을 때 207을 주던 동작을 잃지 않기 위해 플래그로 넘긴다
  - `registerGarment(supabase, ownerId: string, status: GarmentStatus, input: RegisterGarmentInput): Promise<RegisterGarmentResult>`

- [ ] **Step 1: 공유 등록 함수 작성**

`lib/garments/register.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { copyImageToStorage } from '@/lib/storage'
import { mergeSizeTableIntoCache } from '@/lib/musinsa/cache'
import { AUTO_PARSED_FIELDS, type SizeTable } from '@/lib/musinsa/types'
import type { Category, GarmentStatus, ParseMode } from '@/lib/types'

export type RegisterGarmentInput = {
  goodsNo: string
  sourceUrl: string
  name: string
  brand: string | null
  price: number | null
  imageUrl: string | null
  category: Category
  colorOption: string
  sizeOption: string
  measurements: Record<string, number>
  fullSizeTable: SizeTable | null
  manualFields: string[]
}

export type RegisterGarmentResult = {
  id: string
  duplicate: boolean
  /** 옷 자체는 저장됐지만 실측 저장이 실패한 경우. 호출부가 응답 상태 코드를 결정할 때 쓴다. */
  measurementsFailed: boolean
}

/**
 * options·sizeTable은 제외한다 — 항상 실패가 정상인 필드라 포함시키면
 * 모든 옷이 영원히 'manual'로 찍힌다 (스펙 §7, 계획 1 Task 5의 AUTO_PARSED_FIELDS 참고).
 */
function computeParseMode(manualFields: readonly string[]): ParseMode {
  const autoFieldSet: readonly string[] = AUTO_PARSED_FIELDS
  const failedAutoFields = manualFields.filter((field) => autoFieldSet.includes(field))
  if (failedAutoFields.length === 0) return 'auto'
  if (failedAutoFields.length >= AUTO_PARSED_FIELDS.length) return 'manual'
  return 'partial'
}

/**
 * garments insert + 이미지 Storage 복사 + garment_measurements insert + 사이즈표 캐시 병합을
 * 한 번에 수행한다. 옷장 등록(status='owned')과 구매 판단 후보 등록(status='considering')이
 * 이 파이프라인을 그대로 공유한다(스펙 §5) — 파싱·이미지·실측 저장 로직이 두 곳에서 따로
 * 갈라지면 무신사가 개편될 때 한쪽만 고치고 잊어버리는 사고가 난다.
 *
 * RLS를 그대로 태우기 위해 항상 세션 기반 클라이언트(supabase)를 받는다 — service_role을
 * 쓰지 않는다. status='considering'이고 recommended_by가 없는 이번 계획 범위에서는
 * ownerId가 항상 로그인한 본인이므로 garments_insert 정책(owner_id = auth.uid())을 그대로 만족한다.
 */
export async function registerGarment(
  supabase: SupabaseClient,
  ownerId: string,
  status: GarmentStatus,
  input: RegisterGarmentInput,
): Promise<RegisterGarmentResult> {
  const storedImageUrl = input.imageUrl
    ? await copyImageToStorage(input.imageUrl, input.goodsNo, input.colorOption)
    : null

  const { count: duplicateCount } = await supabase
    .from('garments')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('goods_no', input.goodsNo)
    .eq('color_option', input.colorOption)
    .eq('size_option', input.sizeOption)

  const { data: garment, error: insertError } = await supabase
    .from('garments')
    .insert({
      owner_id: ownerId,
      status,
      source_url: input.sourceUrl,
      goods_no: input.goodsNo,
      brand: input.brand,
      name: input.name,
      price: input.price,
      image_url: storedImageUrl ?? input.imageUrl,
      category: input.category,
      color_option: input.colorOption,
      size_option: input.sizeOption,
      parse_mode: computeParseMode(input.manualFields),
    })
    .select('id')
    .single()

  if (insertError || !garment) {
    throw new Error('옷장에 저장하지 못했습니다.')
  }

  const rows = Object.entries(input.measurements).map(([key, value]) => ({
    garment_id: garment.id,
    key,
    value,
  }))

  let measurementsFailed = false
  if (rows.length > 0) {
    const { error: measurementError } = await supabase.from('garment_measurements').insert(rows)
    if (measurementError) measurementsFailed = true
  }

  if (input.fullSizeTable) {
    try {
      await mergeSizeTableIntoCache(input.goodsNo, input.fullSizeTable)
    } catch {
      // 무시 — 캐시는 다음 파싱 시도에서 다시 채워진다.
    }
  }

  return {
    id: garment.id,
    duplicate: Boolean(duplicateCount && duplicateCount > 0),
    measurementsFailed,
  }
}
```

- [ ] **Step 2: 기존 라우트가 공유 함수를 쓰도록 교체**

`app/api/garments/route.ts`를 다음으로 교체한다 (요청 검증·인증은 그대로 두고, insert 로직만 `registerGarment` 호출로 바꾼다):

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import { registerGarment } from '@/lib/garments/register'

export const maxDuration = 30

const Body = z.object({
  goodsNo: z.string(),
  sourceUrl: z.string(),
  name: z.string().min(1),
  brand: z.string().nullable(),
  price: z.number().int().nonnegative().nullable(),
  imageUrl: z.string().nullable(),
  category: z.enum(['top', 'bottom', 'outer', 'shoes', 'acc']),
  colorOption: z.string(),
  sizeOption: z.string(),
  measurements: z.record(z.string(), z.number()),
  fullSizeTable: z.record(z.string(), z.record(z.string(), z.number())).nullable(),
  manualFields: z.array(z.string()),
})

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }

  let result
  try {
    result = await registerGarment(supabase, user.id, 'owned', parsed.data)
  } catch {
    return NextResponse.json({ error: '옷장에 저장하지 못했습니다.' }, { status: 500 })
  }

  if (result.measurementsFailed) {
    // 실측만 실패한 경우 옷 자체는 남기고 알린다. 상세 화면에서 나중에 채울 수 있다.
    return NextResponse.json(
      { id: result.id, warning: '실측 정보를 저장하지 못했습니다.' },
      { status: 207 },
    )
  }

  return NextResponse.json(
    {
      id: result.id,
      ...(result.duplicate ? { warning: '이미 옷장에 같은 상품·색상·사이즈가 있습니다.' } : {}),
    },
    { status: 201 },
  )
}
```

`lib/storage.ts`, `lib/musinsa/cache.ts`는 계획 1에서 만든 그대로 재사용하므로 수정하지 않는다.

- [ ] **Step 3: 회귀 확인 — 기존 옷장 등록이 그대로 동작하는지**

Run: `npm test && npm run build`
Expected: 전체 PASS, 빌드 성공. 그리고 `npm run dev`로 `/wardrobe`에서 무신사 링크 등록이 리팩터 전과 동일하게 동작하는지 한 번 더 확인한다(회귀 테스트가 없는 라우트이므로 수동 확인이 유일한 안전망이다).

- [ ] **Step 4: 커밋**

```bash
git add lib/garments/register.ts app/api/garments/route.ts
git commit -m "refactor: share garment registration pipeline between wardrobe and analyze"
```

---

### Task 8: `analyses` 테이블과 구매 판단 API

`/api/analyze`가 후보 옷을 `considering`으로 등록하고, Task 4~6의 순수 함수로 결정론적 리포트를 만들어 `analyses`에 저장한다. **이 태스크에서는 아직 Gemini를 부르지 않는다** — `matchSeverity = null`로 `decideVerdict`를 호출해 fit_score만으로 판정한다(스펙 §14 Phase 4 "AI 없이 이미 쓸 만한 제품"). Task 11에서 Gemini 호출을 끼워 넣는다.

**Files:**
- Create: `supabase/migrations/0004_analyses.sql`
- Create: `app/api/analyze/route.ts`
- Modify: `tests/rls.test.ts`

**Interfaces:**
- Consumes: `registerGarment` (Task 7), `fetchPreferenceProfile` (Task 4), `scoreDeviation` (Task 5), `decideVerdict` (Task 6)
- Produces:
  - `verdict` enum, `analyses` 테이블 + RLS
  - `POST /api/analyze` — 요청은 `RegisterGarmentInput`과 동일, 응답 `{ analysisId, garmentId, verdict, fitScore, report }` 또는 `{ error }`

- [ ] **Step 1: 마이그레이션 작성**

`supabase/migrations/0004_analyses.sql`:

```sql
create type verdict as enum ('buy', 'caution', 'skip');

create table analyses (
  id uuid primary key default gen_random_uuid(),
  garment_id uuid not null references garments (id) on delete cascade,
  requester_id uuid not null references profiles (id) on delete cascade,
  verdict verdict not null,
  fit_score integer not null,
  report jsonb not null,
  feedback jsonb,
  model text,
  prompt_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index analyses_garment_idx on analyses (garment_id);
create index analyses_requester_idx on analyses (requester_id);

alter table analyses enable row level security;

-- 스펙 §7: analyses는 모든 작업에 대해 requester_id = auth.uid()만 허용한다.
-- UPDATE 정책은 만들지 않는다 — 분석 결과는 재계산해서 새로 남길 뿐 수정하지 않는다(불변 기록).
create policy analyses_select on analyses for select
  using (requester_id = auth.uid());

create policy analyses_insert on analyses for insert
  with check (requester_id = auth.uid());

create policy analyses_delete on analyses for delete
  using (requester_id = auth.uid());
```

- [ ] **Step 2: 마이그레이션 적용**

```bash
npx supabase db push
```

Expected: 오류 없이 완료. `npx supabase db diff --schema public`으로 차이 없음을 확인한다.

- [ ] **Step 3: RLS 테스트 추가**

`tests/rls.test.ts`의 `musinsa_cache` describe 블록 뒤에 이어서 작성한다:

```ts
describe('analyses', () => {
  let aliceAnalysisId: string

  beforeAll(async () => {
    const { data, error } = await alice.client
      .from('analyses')
      .insert({
        garment_id: aliceGarmentId,
        requester_id: alice.id,
        verdict: 'buy',
        fit_score: 0,
        report: {},
      })
      .select('id')
      .single()
    if (error) throw error
    aliceAnalysisId = data.id
  })

  it('본인 분석 결과는 조회된다', async () => {
    const { data } = await alice.client.from('analyses').select('id').eq('id', aliceAnalysisId)
    expect(data?.length).toBe(1)
  })

  it('남의 분석 결과는 조회되지 않는다', async () => {
    const { data } = await bob.client.from('analyses').select('id').eq('id', aliceAnalysisId)
    expect(data).toEqual([])
  })

  it('requester_id를 위조해 남 이름으로 분석 결과를 남길 수 없다', async () => {
    const { error } = await bob.client.from('analyses').insert({
      garment_id: aliceGarmentId, requester_id: alice.id, verdict: 'buy', fit_score: 0, report: {},
    })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/rls.test.ts`
Expected: PASS (기존 시나리오 + 새 3개)

- [ ] **Step 5: 분석 API 작성**

`app/api/analyze/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import { registerGarment } from '@/lib/garments/register'
import { fetchPreferenceProfile } from '@/lib/fit/profile'
import { scoreDeviation } from '@/lib/fit/engine'
import { decideVerdict } from '@/lib/verdict'

export const maxDuration = 30

const Body = z.object({
  goodsNo: z.string(),
  sourceUrl: z.string(),
  name: z.string().min(1),
  brand: z.string().nullable(),
  price: z.number().int().nonnegative().nullable(),
  imageUrl: z.string().nullable(),
  category: z.enum(['top', 'bottom', 'outer', 'shoes', 'acc']),
  colorOption: z.string(),
  sizeOption: z.string(),
  measurements: z.record(z.string(), z.number()),
  fullSizeTable: z.record(z.string(), z.record(z.string(), z.number())).nullable(),
  manualFields: z.array(z.string()),
})

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }
  const input = parsed.data

  let garmentId: string
  try {
    ({ id: garmentId } = await registerGarment(supabase, user.id, 'considering', input))
  } catch {
    return NextResponse.json({ error: '옷 정보를 저장하지 못했습니다.' }, { status: 500 })
  }

  const profile = await fetchPreferenceProfile(supabase, user.id, input.category)
  const report = scoreDeviation(input.measurements, profile, input.category)

  // Task 11에서 Gemini의 matchSeverity로 채워진다. 지금은 null → match_penalty=0,
  // fit_score만으로 판정한다(스펙 §12 "Gemini 호출 실패" 폴백과 같은 경로).
  const { verdict, matchPenalty } = decideVerdict(report.fitScore, report.hasFatalViolation, null)

  const { data: analysis, error: analysisError } = await supabase
    .from('analyses')
    .insert({
      garment_id: garmentId,
      requester_id: user.id,
      verdict,
      fit_score: report.fitScore + matchPenalty,
      report,
    })
    .select('id')
    .single()

  if (analysisError || !analysis) {
    return NextResponse.json({ error: '판단 결과를 저장하지 못했습니다.' }, { status: 500 })
  }

  return NextResponse.json({
    analysisId: analysis.id,
    garmentId,
    verdict,
    fitScore: report.fitScore + matchPenalty,
    report,
  })
}
```

- [ ] **Step 6: 수동 검증**

`npm run dev` 후 로그인 상태에서, 옷장에 같은 카테고리 옷이 3벌 미만이면 `report.status === 'insufficient'`인지, 3벌 이상이면 실제 편차가 계산되는지 브라우저 콘솔에서 확인한다:

```js
await (await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ /* GarmentForm의 payload와 동일한 모양 */ }),
})).json()
```

Expected: `verdict`가 `buy`/`caution`/`skip` 중 하나로 오고, Supabase Table Editor의 `analyses`에 행이 쌓인다.

- [ ] **Step 7: 커밋**

```bash
git add supabase/migrations/0004_analyses.sql tests/rls.test.ts app/api/analyze
git commit -m "feat: add deterministic purchase analysis api without gemini"
```

---

### Task 9: 분석 결과 화면 + 장바구니

링크를 넣으면 옵션을 고르고 판정을 보는 화면과, `considering` 옷을 모아 보여주는 장바구니 화면이다.

**Files:**
- Create: `components/VerdictBadge.tsx`
- Create: `components/DeviationReport.tsx`
- Create: `components/AnalyzeLinkBar.tsx`
- Create: `components/CartItemCard.tsx`
- Create: `app/analyze/page.tsx`
- Create: `app/cart/page.tsx`
- Modify: `components/GarmentForm.tsx` (제출 대상 엔드포인트를 옷장/분석 공용으로)

**Interfaces:**
- Consumes: `POST /api/analyze` (Task 8), `PATCH /api/garments/:id` (Task 1), `ParseResult` (계획 1 Task 5)
- Produces: `/analyze`, `/cart` 화면

- [ ] **Step 1: `GarmentForm`을 옷장/분석 공용으로 만든다**

`components/GarmentForm.tsx`의 `Props`와 `handleSubmit`을 다음처럼 바꾼다(나머지 렌더 부분은 그대로 둔다):

```tsx
type Props = {
  parsed: ParseResult
  sourceUrl: string
  submitEndpoint: string
  submitLabel: string
  onSubmitted: (result: Record<string, unknown>) => void
}

export function GarmentForm({ parsed, sourceUrl, submitEndpoint, submitLabel, onSubmitted }: Props) {
  // ... 기존 상태 선언은 그대로 ...

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const hasFullPastedTable = Object.keys(pastedSizeTable).length > 0
    const payload: GarmentSubmitPayload = {
      // ... 기존과 동일 ...
    }

    const response = await fetch(submitEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSubmitting(false)

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? '처리하지 못했습니다.')
      return
    }
    onSubmitted(await response.json())
  }

  // ... Field 렌더 동일 ...
  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border p-5">
      {/* 기존 필드들 그대로 */}
      <button type="submit" disabled={submitting}
        className="w-full rounded-lg bg-black py-3 text-white disabled:bg-gray-300">
        {submitting ? '처리 중…' : submitLabel}
      </button>
    </form>
  )
}
```

`components/LinkInputBar.tsx`도 새 props를 전달하도록 고친다:

```tsx
{parsed && (
  <GarmentForm
    parsed={parsed}
    sourceUrl={url}
    submitEndpoint="/api/garments"
    submitLabel="옷장에 넣기"
    onSubmitted={() => {
      setParsed(null)
      setUrl('')
      router.refresh()
    }}
  />
)}
```

(`LinkInputBar`가 `useRouter`를 이미 쓰지 않으므로 `import { useRouter } from 'next/navigation'`과 `const router = useRouter()`를 추가하고, 기존 `onDone`이 하던 `setParsed(null); setUrl('')`을 `onSubmitted` 안으로 옮긴다. `router.refresh()`는 계획 1의 `GarmentForm` 내부에서 하던 것을 `LinkInputBar` 쪽으로 옮긴 것 — 옷장 등록만 새로고침이 필요하고 분석은 필요 없기 때문이다.)

- [ ] **Step 2: 판정 배지**

`components/VerdictBadge.tsx`:

```tsx
import type { Verdict } from '@/lib/verdict'

const VERDICT_LABELS: Record<Verdict, string> = { buy: '살만함', caution: '주의', skip: '비추천' }
const VERDICT_STYLES: Record<Verdict, string> = {
  buy: 'bg-green-100 text-green-800',
  caution: 'bg-amber-100 text-amber-800',
  skip: 'bg-red-100 text-red-800',
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`inline-block rounded-full px-4 py-1 text-sm font-semibold ${VERDICT_STYLES[verdict]}`}>
      {VERDICT_LABELS[verdict]}
    </span>
  )
}
```

- [ ] **Step 3: 근거 실측 비교 표**

`components/DeviationReport.tsx`:

```tsx
type FieldDeviation = {
  key: string
  candidateValue: number
  excess: number
  score: number
  avoidanceSignal: boolean
}

type Props = {
  status: 'ok' | 'low_confidence' | 'insufficient'
  fields: FieldDeviation[]
}

// "총장이 깁니다" 옆에 근거 수치를 항상 같이 보여준다(스펙 §11) — AI 말만 믿게 만들지 않는다.
export function DeviationReport({ status, fields }: Props) {
  if (status === 'insufficient') {
    return (
      <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
        옷장에 같은 카테고리 데이터가 부족해 핏 판단은 어렵습니다.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {status === 'low_confidence' && (
        <p className="text-xs text-amber-700">
          선호도(별점·착용빈도)를 남긴 옷이 없어 카테고리 전체 평균으로 비교했습니다 — 신뢰도가 낮습니다.
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1 font-normal">항목</th>
            <th className="py-1 text-right font-normal">실측값</th>
            <th className="py-1 text-right font-normal">편차</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.key} className="border-t">
              <td className="py-2">
                {f.key}
                {f.avoidanceSignal && <span className="ml-1 text-xs text-red-600">(과거 실패 이력)</span>}
              </td>
              <td className="py-2 text-right">{f.candidateValue}cm</td>
              <td className={`py-2 text-right ${f.score > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {f.excess === 0 ? '적합' : `${f.excess.toFixed(1)}cm 초과`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: 분석용 링크 입력 바**

`components/AnalyzeLinkBar.tsx` (`LinkInputBar`와 거의 같지만 제출 대상과 성공 후 동작이 다르다):

```tsx
'use client'

import { useState } from 'react'
import type { ParseResult } from '@/lib/musinsa/types'
import { GarmentForm } from '@/components/GarmentForm'
import { VerdictBadge } from '@/components/VerdictBadge'
import { DeviationReport } from '@/components/DeviationReport'
import type { Verdict } from '@/lib/verdict'

type AnalyzeResult = {
  verdict: Verdict
  fitScore: number
  report: { status: 'ok' | 'low_confidence' | 'insufficient'; fields: unknown[] }
}

export function AnalyzeLinkBar() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [result, setResult] = useState<AnalyzeResult | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setParsed(null)
    setResult(null)

    const response = await fetch('/api/musinsa/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(data.error ?? '상품 정보를 가져오지 못했습니다.')
      return
    }
    setParsed(data as ParseResult)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="구매를 고민 중인 무신사 상품 링크를 붙여넣으세요"
          className="flex-1 rounded-lg border px-4 py-2"
        />
        <button type="submit" disabled={loading || url.trim().length === 0}
          className="rounded-lg bg-black px-5 py-2 text-white disabled:bg-gray-300">
          {loading ? '불러오는 중…' : '불러오기'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {parsed && !result && (
        <GarmentForm
          parsed={parsed}
          sourceUrl={url}
          submitEndpoint="/api/analyze"
          submitLabel="판단하기"
          onSubmitted={(data) => setResult(data as AnalyzeResult)}
        />
      )}

      {result && (
        <div className="space-y-3 rounded-xl border p-5">
          <VerdictBadge verdict={result.verdict} />
          <DeviationReport status={result.report.status} fields={result.report.fields as never} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: 분석 화면**

`app/analyze/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { AnalyzeLinkBar } from '@/components/AnalyzeLinkBar'

export default async function AnalyzePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">살까 말까</h1>
      <AnalyzeLinkBar />
    </main>
  )
}
```

- [ ] **Step 6: 장바구니 카드**

`components/CartItemCard.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export type CartItem = {
  id: string
  name: string
  brand: string | null
  image_url: string | null
  latestVerdict: 'buy' | 'caution' | 'skip' | null
}

const VERDICT_LABELS = { buy: '살만함', caution: '주의', skip: '비추천' } as const

export function CartItemCard({ item }: { item: CartItem }) {
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
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-gray-100">
        {item.image_url && <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="48px" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="text-xs text-gray-500">
          {item.brand} {item.latestVerdict && `· ${VERDICT_LABELS[item.latestVerdict]}`}
        </p>
      </div>
      <button type="button" onClick={markAsBought} disabled={saving}
        className="shrink-0 rounded-lg bg-black px-3 py-2 text-xs text-white disabled:bg-gray-300">
        {saving ? '처리 중…' : '샀어요'}
      </button>
    </div>
  )
}
```

- [ ] **Step 7: 장바구니 화면**

`app/cart/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { CartItemCard, type CartItem } from '@/components/CartItemCard'

export default async function CartPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: garments } = await supabase
    .from('garments')
    .select('id, name, brand, image_url, analyses(verdict, created_at)')
    .eq('owner_id', user.id)
    .eq('status', 'considering')
    .order('created_at', { ascending: false })

  const items: CartItem[] = (garments ?? []).map((g) => {
    const analyses = (g.analyses ?? []) as { verdict: 'buy' | 'caution' | 'skip'; created_at: string }[]
    const latest = analyses.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    return { id: g.id, name: g.name, brand: g.brand, image_url: g.image_url, latestVerdict: latest?.verdict ?? null }
  })

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">장바구니</h1>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-gray-500">
          고민 중인 옷이 없습니다. &quot;살까 말까&quot;에서 링크를 넣어보세요.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => <CartItemCard key={item.id} item={item} />)}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 8: 수동 검증**

`npm run dev` → `/analyze`에서 무신사 링크로 판단 → 배지·근거 표 확인 → `/cart`에서 방금 분석한 옷이 목록에 뜨는지 → "샀어요" 클릭 → `/cart`에서 사라지고 `/wardrobe`에 나타나는지 확인.

- [ ] **Step 9: 전체 테스트·빌드**

Run: `npm test && npm run build`
Expected: 전체 PASS, 타입 오류 없음.

- [ ] **Step 10: 커밋**

```bash
git add components/VerdictBadge.tsx components/DeviationReport.tsx components/AnalyzeLinkBar.tsx components/CartItemCard.tsx app/analyze app/cart components/GarmentForm.tsx components/LinkInputBar.tsx
git commit -m "feat: add purchase analysis screen and cart with buy promotion"
```

**게이트:** 여기까지 스펙 §14 Phase 4 전체가 끝난다 — "AI 없이 이미 쓸 만한 제품"이 실제로 동작한다. Task 10부터는 Phase 5(Gemini)다.

---

### Task 10: Gemini 클라이언트와 등록 시 비전 태깅

**이 태스크를 시작하기 전에 사용자가 직접 해야 하는 일이 있다.**

1. https://aistudio.google.com/apikey 를 연다 (구글 계정으로 로그인).
2. "Create API key" 버튼을 누른다. 기존 Google Cloud 프로젝트가 있으면 골라도 되고, 없으면 새로 만들어도 된다(무료).
3. 발급된 키를 복사한다 — 이 화면을 벗어나면 다시 볼 수 없으니 바로 다음 단계로 붙여넣는다.
4. 프로젝트 루트의 `.env.local` 파일을 열고 `GEMINI_API_KEY=` 뒤에 붙여넣는다(`.env.local.example`에 이 태스크 Step 1에서 항목을 추가한다).
5. `gemini-3.5-flash`(무료 등급, rate limit 있음)를 쓴다 — 결제 정보를 등록할 필요는 없다. `gemini-2.5-flash`는 신규 발급 키에서 404가 나서 쓸 수 없었다(Step 5 참고).

**Files:**
- Modify: `package.json` (`@google/genai` 추가)
- Modify: `.env.local.example`
- Create: `lib/gemini/client.ts`
- Create: `lib/ai/tagger.ts`
- Modify: `lib/garments/register.ts` (태깅 호출 추가)
- Test: `tests/ai/tagger.test.ts`

**Interfaces:**
- Consumes: `registerGarment` (Task 7)
- Produces:
  - `getGeminiClient(): GoogleGenAI`
  - `AiTags` 타입, `tagGarmentImage(imageUrl: string): Promise<AiTags | null>`

- [ ] **Step 1: 의존성 설치, 환경변수 예시 갱신**

```bash
npm install @google/genai
```

`.env.local.example`에 한 줄 추가:

```
GEMINI_API_KEY=
```

- [ ] **Step 2: Gemini 클라이언트**

`lib/gemini/client.ts`:

```ts
import { GoogleGenAI } from '@google/genai'

/**
 * `@google/genai`는 방금 설치했다 — 실제 메서드 시그니처(특히 responseSchema 전달 방식)는
 * `node_modules/@google/genai`의 타입 정의를 열어 이 태스크 구현 시점에 다시 확인한다.
 * 아래 코드는 이 SDK의 통상적인 사용 패턴을 따른 것이며, 버전에 따라 이름이 달라질 수 있다.
 */
let client: GoogleGenAI | null = null

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  }
  return client
}

// gemini-2.5-flash는 신규 발급 API 키에서 404("no longer available to new users")를
// 반환한다 — 스펙 작성 시점(2026-08-13) 이후 Google이 신규 사용자 대상 접근을 막았다.
// 실제 이 키로 client.models.list()를 호출해 확인한 사용 가능한 flash 계열 중 하나로 바꿨다.
export const GEMINI_MODEL = 'gemini-3.5-flash'
```

- [ ] **Step 3: 실패하는 테스트 작성**

`tests/ai/tagger.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateContentMock = vi.fn()

vi.mock('@/lib/gemini/client', () => ({
  getGeminiClient: () => ({ models: { generateContent: generateContentMock } }),
  GEMINI_MODEL: 'gemini-3.5-flash',
}))

beforeEach(() => {
  generateContentMock.mockReset()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { 'content-type': 'image/jpeg' },
  })))
})

describe('tagGarmentImage', () => {
  it('구조화된 태그를 돌려준다', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        category: 'top', color_name: '차콜', color_tone: '쿨', brightness: '어두움',
        pattern: '무지', style_keywords: ['미니멀'], formality: 3, season: ['봄'],
      }),
    })

    const { tagGarmentImage } = await import('@/lib/ai/tagger')
    const tags = await tagGarmentImage('https://example.com/shirt.jpg')

    expect(tags?.color_name).toBe('차콜')
    expect(generateContentMock).toHaveBeenCalledTimes(1)
  })

  it('Gemini 호출이 실패하면 예외를 던지지 않고 null을 돌려준다', async () => {
    generateContentMock.mockRejectedValue(new Error('quota exceeded'))

    const { tagGarmentImage } = await import('@/lib/ai/tagger')
    await expect(tagGarmentImage('https://example.com/shirt.jpg')).resolves.toBeNull()
  })

  it('응답이 JSON이 아니면 null을 돌려준다', async () => {
    generateContentMock.mockResolvedValue({ text: '이건 JSON이 아님' })

    const { tagGarmentImage } = await import('@/lib/ai/tagger')
    await expect(tagGarmentImage('https://example.com/shirt.jpg')).resolves.toBeNull()
  })
})
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `npm test -- tests/ai/tagger.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 5: 구현 작성**

`lib/ai/tagger.ts`:

```ts
import { Type } from '@google/genai'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini/client'

export type AiTags = {
  category: string
  color_name: string
  color_tone: string
  brightness: string
  pattern: string
  style_keywords: string[]
  formality: number
  season: string[]
}

// responseSchema는 표준 JSON Schema가 아니라 Gemini 고유 포맷이다 — type 값은
// 소문자 'object'가 아니라 Type.OBJECT 같은 대문자 상수여야 런타임에서 실제로 적용된다
// (타입 자체는 SchemaUnion = Schema | unknown이라 소문자를 써도 컴파일은 통과하지만 틀린 스키마가 된다).
const TAG_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING },
    color_name: { type: Type.STRING },
    color_tone: { type: Type.STRING },
    brightness: { type: Type.STRING },
    pattern: { type: Type.STRING },
    style_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    formality: { type: Type.INTEGER },
    season: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['category', 'color_name', 'color_tone', 'brightness', 'pattern', 'style_keywords', 'formality', 'season'],
}

/**
 * 옷이 garments에 들어올 때 딱 한 번 이미지를 보내 스타일 태그를 받는다(스펙 §10-1).
 * 구매 판단 시점에는 이 저장된 태그만 재사용하고 이미지를 다시 보내지 않는다 —
 * 옷장이 30벌이어도 판단 1회에 이미지 전송은 0장이어야 한다.
 * 실패해도 등록 자체를 막지 않으므로 예외 대신 null을 돌려준다(스펙 §12).
 */
export async function tagGarmentImage(imageUrl: string): Promise<AiTags | null> {
  try {
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) return null
    const contentType = imageResponse.headers.get('content-type') ?? 'image/jpeg'
    const imageBytes = Buffer.from(await imageResponse.arrayBuffer()).toString('base64')

    const client = getGeminiClient()
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: '이 의류 상품 이미지를 분석해서 스타일 태그를 매겨줘.' },
            { inlineData: { mimeType: contentType, data: imageBytes } },
          ],
        },
      ],
      config: { responseMimeType: 'application/json', responseSchema: TAG_SCHEMA },
    })

    const parsed: unknown = JSON.parse(response.text ?? '')
    if (!isAiTags(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

function isAiTags(value: unknown): value is AiTags {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.category === 'string' &&
    typeof v.color_name === 'string' &&
    Array.isArray(v.style_keywords)
  )
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test -- tests/ai/tagger.test.ts`
Expected: PASS, 3 passed

- [ ] **Step 7: `registerGarment`이 태깅을 호출하도록 연결**

`lib/garments/register.ts`에서 garments insert 직후, 반환 전에 추가한다:

```ts
import { tagGarmentImage } from '@/lib/ai/tagger'

// ... insert 이후 ...

  const finalImageUrl = storedImageUrl ?? input.imageUrl
  if (finalImageUrl) {
    // 태깅 실패는 등록을 막지 않는다 — 실패하면 ai_tags는 null로 남고, 이후 판단 시점에
    // "AI 태그 없음"으로 처리된다(Task 11에서 advisor가 이 경우를 다룬다).
    const tags = await tagGarmentImage(finalImageUrl)
    if (tags) {
      await supabase.from('garments').update({ ai_tags: tags }).eq('id', garment.id)
    }
  }

  return { id: garment.id, duplicate: Boolean(duplicateCount && duplicateCount > 0) }
```

- [ ] **Step 8: 회귀 확인**

Run: `npm test && npm run build`
Expected: 전체 PASS. `npm run dev`로 실제 무신사 링크를 옷장에 등록해보고, Supabase Table Editor에서 `garments.ai_tags`가 채워지는지 확인한다(발급받은 `GEMINI_API_KEY`가 `.env.local`에 있어야 한다).

- [ ] **Step 9: 커밋**

```bash
git add package.json package-lock.json .env.local.example lib/gemini lib/ai/tagger.ts lib/garments/register.ts tests/ai/tagger.test.ts
git commit -m "feat: tag garment images with gemini vision on registration"
```

---

### Task 11: Gemini 판단 문장 생성과 `/api/analyze` 통합

`/api/analyze`에 Gemini 호출을 끼워 넣어 매칭 심각도와 한국어 피드백 문장을 채운다. **Gemini는 `verdict`를 출력하지 않는다** — `decideVerdict`(Task 6)에 `matchSeverity`만 넘긴다.

**Files:**
- Create: `lib/ai/advisor.ts`
- Modify: `app/api/analyze/route.ts`
- Modify: `components/DeviationReport.tsx` (피드백 문장 표시)
- Test: `tests/ai/advisor.test.ts`

**Interfaces:**
- Consumes: `getGeminiClient`, `GEMINI_MODEL` (Task 10), `DeviationReport` (Task 5), `AiTags` (Task 10)
- Produces:
  - `AdviceResult = { matchSeverity: MatchSeverity; sizeFeedback: string; matchFeedback: string; priceFeedback: string; summary: string }`
  - `getMatchAdvice(input: AdviceInput): Promise<AdviceResult | null>`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/ai/advisor.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateContentMock = vi.fn()

vi.mock('@/lib/gemini/client', () => ({
  getGeminiClient: () => ({ models: { generateContent: generateContentMock } }),
  GEMINI_MODEL: 'gemini-3.5-flash',
}))

beforeEach(() => generateContentMock.mockReset())

const baseInput = {
  candidateTags: null,
  wardrobeTagsSummary: [],
  deviationSummary: [{ key: '총장', excess: 4, severity: 'medium' as const }],
  candidatePrice: 39000,
  avgPrice: 30000,
}

describe('getMatchAdvice', () => {
  it('구조화된 조언을 돌려준다', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        match_severity: 'warn',
        size_feedback: '총장이 평소보다 깁니다.',
        match_feedback: '무난하게 매칭됩니다.',
        price_feedback: '평균보다 9천원 비쌉니다.',
        summary: '핏은 다소 크지만 매칭은 괜찮습니다.',
      }),
    })

    const { getMatchAdvice } = await import('@/lib/ai/advisor')
    const advice = await getMatchAdvice(baseInput)

    expect(advice?.matchSeverity).toBe('warn')
    expect(advice?.summary).toContain('매칭')
  })

  it('한 번 실패하면 재시도하고, 재시도까지 실패하면 null을 돌려준다', async () => {
    generateContentMock.mockRejectedValue(new Error('timeout'))

    const { getMatchAdvice } = await import('@/lib/ai/advisor')
    await expect(getMatchAdvice(baseInput)).resolves.toBeNull()
    expect(generateContentMock).toHaveBeenCalledTimes(2)
  })

  it('match_severity가 ok/warn/bad가 아니면 null을 돌려준다', async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ match_severity: '보통' }) })

    const { getMatchAdvice } = await import('@/lib/ai/advisor')
    await expect(getMatchAdvice(baseInput)).resolves.toBeNull()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- tests/ai/advisor.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현 작성**

`lib/ai/advisor.ts`:

```ts
import { Type } from '@google/genai'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini/client'
import type { AiTags } from '@/lib/ai/tagger'
import type { MatchSeverity } from '@/lib/verdict'

export type AdviceInput = {
  candidateTags: AiTags | null
  wardrobeTagsSummary: AiTags[]
  deviationSummary: { key: string; excess: number; severity: string }[]
  candidatePrice: number | null
  avgPrice: number | null
}

export type AdviceResult = {
  matchSeverity: MatchSeverity
  sizeFeedback: string
  matchFeedback: string
  priceFeedback: string
  summary: string
}

const ADVICE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    match_severity: { type: Type.STRING, enum: ['ok', 'warn', 'bad'] },
    size_feedback: { type: Type.STRING },
    match_feedback: { type: Type.STRING },
    price_feedback: { type: Type.STRING },
    summary: { type: Type.STRING },
  },
  required: ['match_severity', 'size_feedback', 'match_feedback', 'price_feedback', 'summary'],
}

function buildPrompt(input: AdviceInput): string {
  return [
    '아래는 이미 계산된 실측 편차 리포트와 스타일 태그다.',
    '숫자를 다시 계산하거나 반박하지 말고, 주어진 값을 한국어로 자연스럽게 설명해라.',
    `후보 옷 태그: ${JSON.stringify(input.candidateTags)}`,
    `옷장 태그 요약: ${JSON.stringify(input.wardrobeTagsSummary)}`,
    `실측 편차 리포트: ${JSON.stringify(input.deviationSummary)}`,
    `후보 가격: ${input.candidatePrice ?? '알 수 없음'}, 옷장 같은 카테고리 평균가: ${input.avgPrice ?? '알 수 없음'}`,
    'match_severity는 스타일·색상 조화가 얼마나 잘 맞는지를 ok/warn/bad 3단계로만 판단해라.',
  ].join('\n')
}

async function callOnce(input: AdviceInput): Promise<AdviceResult | null> {
  const client = getGeminiClient()
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
    config: { responseMimeType: 'application/json', responseSchema: ADVICE_SCHEMA },
  })

  const parsed: unknown = JSON.parse(response.text ?? '')
  if (!isAdviceJson(parsed)) return null

  return {
    matchSeverity: parsed.match_severity,
    sizeFeedback: parsed.size_feedback,
    matchFeedback: parsed.match_feedback,
    priceFeedback: parsed.price_feedback,
    summary: parsed.summary,
  }
}

type AdviceJson = {
  match_severity: MatchSeverity
  size_feedback: string
  match_feedback: string
  price_feedback: string
  summary: string
}

function isAdviceJson(value: unknown): value is AdviceJson {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (v.match_severity === 'ok' || v.match_severity === 'warn' || v.match_severity === 'bad') &&
    typeof v.size_feedback === 'string' &&
    typeof v.match_feedback === 'string' &&
    typeof v.price_feedback === 'string' &&
    typeof v.summary === 'string'
  )
}

/**
 * 편차 리포트 + 태그 비교 → 매칭 심각도 + 피드백 문장(스펙 §10-2).
 * Gemini가 verdict를 직접 내지 않는다 — matchSeverity만 돌려주고, 최종 판정은
 * 항상 lib/verdict.ts가 코드로 계산한다. 실패 시 1회 재시도, 그래도 실패하면 null —
 * 호출부(app/api/analyze/route.ts)가 null을 "AI 코멘트를 만들지 못했습니다"로 처리한다.
 */
export async function getMatchAdvice(input: AdviceInput): Promise<AdviceResult | null> {
  try {
    return await callOnce(input)
  } catch {
    try {
      return await callOnce(input)
    } catch {
      return null
    }
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/ai/advisor.test.ts`
Expected: PASS, 3 passed

- [ ] **Step 5: `/api/analyze`에 통합**

`app/api/analyze/route.ts`의 `decideVerdict` 호출 앞뒤를 다음으로 바꾼다:

```ts
import { getMatchAdvice } from '@/lib/ai/advisor'
import { GEMINI_MODEL } from '@/lib/gemini/client'

// ... report 계산 이후 ...

  const { data: candidateGarment } = await supabase
    .from('garments')
    .select('ai_tags, price')
    .eq('id', garmentId)
    .single()

  const { data: wardrobeGarments } = await supabase
    .from('garments')
    .select('ai_tags')
    .eq('owner_id', user.id)
    .eq('status', 'owned')
    .eq('category', input.category)
    .not('ai_tags', 'is', null)

  const advice = await getMatchAdvice({
    candidateTags: (candidateGarment?.ai_tags ?? null) as AiTags | null,
    wardrobeTagsSummary: (wardrobeGarments ?? []).map((g) => g.ai_tags) as AiTags[],
    deviationSummary: report.fields.map((f) => ({ key: f.key, excess: f.excess, severity: f.severity })),
    candidatePrice: candidateGarment?.price ?? null,
    avgPrice: profile.avgPrice,
  })

  const { verdict, matchPenalty } = decideVerdict(
    report.fitScore,
    report.hasFatalViolation,
    advice?.matchSeverity ?? null,
  )

  const { data: analysis, error: analysisError } = await supabase
    .from('analyses')
    .insert({
      garment_id: garmentId,
      requester_id: user.id,
      verdict,
      fit_score: report.fitScore + matchPenalty,
      report,
      feedback: advice ?? { note: 'AI 코멘트를 만들지 못했습니다.' },
      model: advice ? GEMINI_MODEL : null,
      prompt_snapshot: advice ? { deviationSummary: report.fields, candidateTags: candidateGarment?.ai_tags } : null,
    })
    .select('id')
    .single()

  // ... 이하 응답 구성에 feedback 추가 ...

  return NextResponse.json({
    analysisId: analysis.id,
    garmentId,
    verdict,
    fitScore: report.fitScore + matchPenalty,
    report,
    feedback: advice,
  })
```

(`import type { AiTags } from '@/lib/ai/tagger'`를 파일 상단에 추가한다.)

- [ ] **Step 6: 피드백 문장 표시**

`components/DeviationReport.tsx`의 `Props`에 `feedback?: { summary: string; sizeFeedback: string; matchFeedback: string; priceFeedback: string } | null`을 추가하고, 표 위에 렌더한다:

```tsx
{feedback ? (
  <div className="space-y-1 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
    <p className="font-medium">{feedback.summary}</p>
    <p>{feedback.sizeFeedback}</p>
    <p>{feedback.matchFeedback}</p>
    <p>{feedback.priceFeedback}</p>
  </div>
) : (
  <p className="text-sm text-gray-500">AI 코멘트를 만들지 못했습니다. 아래 실측 비교로 판단해주세요.</p>
)}
```

`components/AnalyzeLinkBar.tsx`의 `result` 렌더 부분에 `feedback={result.feedback}`을 넘기도록 고친다.

- [ ] **Step 7: 전체 테스트·빌드·수동 검증**

Run: `npm test && npm run build`
Expected: 전체 PASS.

`npm run dev` → `/analyze`에서 실제 무신사 링크로 끝까지 판단해보고, AI 피드백 문장 4개(요약·사이즈·매칭·가격)가 자연스러운 한국어로 나오는지, Supabase의 `analyses.feedback`·`model`이 채워지는지 확인한다. `GEMINI_API_KEY`를 잠깐 잘못된 값으로 바꿔 호출을 실패시켜보고, "AI 코멘트를 만들지 못했습니다" 폴백과 `fit_score`만으로의 판정이 정상 동작하는지도 확인한다(스펙 §12의 핵심 요구사항).

- [ ] **Step 8: 커밋**

```bash
git add lib/ai/advisor.ts app/api/analyze/route.ts components/DeviationReport.tsx components/AnalyzeLinkBar.tsx tests/ai/advisor.test.ts
git commit -m "feat: generate gemini match feedback and wire it into verdict"
```

---

## 완료 기준

계획 2가 끝나면 다음이 모두 성립한다.

- [ ] `npm test`가 전부 통과한다 (핏 규칙, 클러스터링, 채점 엔진, 최종 판정, Gemini 모킹 테스트, RLS 포함)
- [ ] `npm run build`가 타입 오류 없이 성공한다
- [ ] 옷 상세 화면에서 별점·핏태그·착용빈도를 남기면 즉시 저장된다
- [ ] 같은 카테고리 옷이 3벌 미만이면 핏 판단이 "데이터 부족"으로 명시된다
- [ ] `/analyze`에 무신사 링크를 넣으면 옵션 선택 후 `buy`/`caution`/`skip` 판정과 근거 실측 비교 표가 나온다
- [ ] 분석한 옷은 `/cart`에 쌓이고, "샀어요"를 누르면 `/wardrobe`로 옮겨진다
- [ ] 등록 시 1회 Gemini 비전 태깅이 이루어지고 `ai_tags`에 저장된다
- [ ] `GEMINI_API_KEY`를 지우거나 호출이 실패해도 `/analyze`가 죽지 않고 fit_score만으로 판정한다
- [ ] `analyses` 테이블에 남의 분석 결과를 조회·삽입할 수 없다 (RLS 테스트로 증명)

## 다음 계획으로 넘기는 것

- 옷장 공유 토글, `/u/[share_slug]` 공개 열람 — 계획 3
- 친구의 추천 아이템 등록 — 계획 3
- 룩(`outfits`, `outfit_items`) 만들기 — 계획 3
- 공유 링크 OG 이미지, 빈 상태·로딩 상태 다듬기, 최종 마감 — 계획 3
