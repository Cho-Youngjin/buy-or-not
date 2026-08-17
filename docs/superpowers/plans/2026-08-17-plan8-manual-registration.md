# 수동 등록 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** 무신사 링크 없이도 옷장 등록(`/wardrobe`)·구매 판단(`/analyze`)에서 옷을 등록할 수 있게 한다. 새 폼을 만들지 않고 기존 `GarmentForm`(파싱 실패 시 이미 전부 수동 입력이 되는 폼)을 재사용하고, 진입점과 사진 파일 업로드만 더한다.

**Architecture:** "직접 등록하기" 버튼이 합성 `ParseResult`(모든 필드 실패, `goodsNo`는 `crypto.randomUUID()`)를 만들어 `GarmentForm`에 그대로 넘긴다. `GarmentForm`의 기존 "이미지 주소" 칸에 파일 입력을 더해, 제출 시 새 API(`/api/garments/upload-image`)로 먼저 올리고 받은 URL을 쓴다. `registerGarment`·DB 스키마는 그대로 두고, `source_url`이 없을 수 있다는 사실만 타입에 반영한다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Tailwind CSS v4 · Vitest(node 환경) · Supabase Storage

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-17-manual-registration-design.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- TypeScript `strict: true`, `any` 금지. `npm run build`가 타입 에러 0개로 통과해야 한다.
- 사용자에게 하는 설명·요약·질문, 그리고 UI 문구는 한국어로 쓴다.
- 기능 단위마다 그 코드가 무엇을 하고 왜 그렇게 짰는지 설명하는 주석을 남긴다 (이 프로젝트의 학습 목적 예외 규칙).
- 태스크마다 커밋하고 push한다. 여러 태스크를 한 커밋에 몰아넣지 않는다.
- 커밋 메시지에 `Co-Authored-By: Claude` 등 AI 기여자 트레일러를 넣지 않는다.
- **새 의존성을 설치하지 않는다.** 파일 업로드는 브라우저 기본 `<input type="file">`·`FormData`·Route Handler의 `request.formData()`만으로 충분하다.
- **`lib/`에는 React 의존을 넣지 않는다.** `lib/musinsa/manualParseResult.ts`는 순수 함수이고 `crypto.randomUUID()`(Web Crypto 전역, React 아님)만 쓴다.
- **Storage 업로드는 `supabaseAdmin`(service_role)을 쓴다** — RLS가 걸린 테이블에는 절대 쓰지 않는다(`lib/supabase/admin.ts` 주석 참고). 새 업로드 라우트도 로그인 여부는 세션 클라이언트로 확인한다.
- **새 Storage 버킷을 만들지 않는다.** 기존 `garments` 버킷(공개 읽기, service_role만 쓰기)을 그대로 쓴다.

### 이 계획의 테스트 전략

`lib/musinsa/manualParseResult.ts`는 순수 함수라 단위 테스트를 쓴다(Task 2). 나머지(진입점 UI·업로드 API·GarmentForm 변경)는 계획 6·7과 같은 이유로 컴포넌트 렌더링 테스트 인프라가 없어 `npm run build`(타입 검증) + `npm test`(회귀) + 브라우저 수동 검증을 쓴다.

### 사전 확인된 사실 (계획 작성 중 실제로 확인함)

- `source_url`을 화면에 표시하는 곳이 전체 코드베이스에 한 군데도 없다(`grep`으로 확인) — nullable로 바꿔도 UI 영향은 없다.
- `computeParseMode`(`lib/garments/register.ts`)는 `manualFields`를 `AUTO_PARSED_FIELDS`(`name, brand, price, imageUrl, category` 5개)와 교집합해서 판단한다. `createManualParseResult`가 7개 필드를 전부 실패로 만들면 교집합이 5개 전부가 되어 `computeParseMode`가 별도 수정 없이 `'manual'`을 돌려준다.
- `RegisterGarmentInput.goodsNo`가 문자열이기만 하면 되고 실제 무신사 상품번호인지 검증하는 곳이 없다 — 합성 UUID를 그대로 태워도 저장·중복 검사·`musinsa_cache` 어디에도 부작용이 없다(단, `fullSizeTable`이 없으므로 `mergeSizeTableIntoCache`는 애초에 호출되지 않는다).
- `getPublicUrl('')`이 버킷의 공개 URL 접두어만 돌려준다 — Supabase JS SDK가 `{프로젝트 URL}/storage/v1/object/public/{버킷}/{경로}` 형식을 조합해 만들어 주므로, 이중 업로드 방지 검사에 이 값을 그대로 쓰면 문자열을 손으로 맞출 필요가 없다.

---

## Task 1: `source_url`을 null로 허용

**Files:**
- Modify: `lib/garments/register.ts`
- Modify: `components/garment/GarmentForm.tsx`
- Modify: `app/api/garments/route.ts`
- Modify: `app/api/analyze/route.ts`

**Interfaces:**
- Produces: `RegisterGarmentInput.sourceUrl: string | null`, `GarmentSubmitPayload.sourceUrl: string | null`, `GarmentForm`의 `Props.sourceUrl: string | null`
- Consumes: 없음(순수 타입 완화). 기존 호출부(`LinkInputBar`·`AnalyzeLinkBar`·`RecommendLinkBar`)는 항상 `string`을 넘기므로 `string | null`에 그대로 대입 가능해 수정이 필요 없다.

- [ ] **Step 1: `lib/garments/register.ts`의 `sourceUrl` 타입을 완화한다**

`RegisterGarmentInput` 타입 선언에서:

```ts
export type RegisterGarmentInput = {
  goodsNo: string
  sourceUrl: string
```

를 아래로 바꾼다:

```ts
export type RegisterGarmentInput = {
  goodsNo: string
  sourceUrl: string | null
```

(`garments.insert({ source_url: input.sourceUrl, ... })` 줄은 그대로 둔다 — `text` 컬럼이 이미 nullable이라 `null`을 그대로 넘겨도 된다.)

- [ ] **Step 2: `components/garment/GarmentForm.tsx`의 두 타입을 완화한다**

`GarmentSubmitPayload`에서:

```ts
export type GarmentSubmitPayload = {
  goodsNo: string
  sourceUrl: string
```

를:

```ts
export type GarmentSubmitPayload = {
  goodsNo: string
  sourceUrl: string | null
```

`Props`에서:

```ts
type Props = {
  parsed: ParseResult
  sourceUrl: string
```

를:

```ts
type Props = {
  parsed: ParseResult
  sourceUrl: string | null
```

- [ ] **Step 3: `app/api/garments/route.ts`의 검증 스키마를 완화한다**

```ts
const Body = z.object({
  goodsNo: z.string(),
  sourceUrl: z.string(),
```

를:

```ts
const Body = z.object({
  goodsNo: z.string(),
  sourceUrl: z.string().nullable(),
```

- [ ] **Step 4: `app/api/analyze/route.ts`도 같은 줄을 같은 방식으로 고친다**

`app/api/garments/route.ts`와 완전히 같은 `Body` 스키마를 가지고 있다. Step 3과 동일하게 `sourceUrl: z.string()` → `sourceUrl: z.string().nullable()`.

- [ ] **Step 5: 빌드와 테스트로 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 123개 전부 통과(이 태스크는 타입만 완화하므로 로직 변화가 없다 — 회귀가 깨지면 그 자체가 신호다).

- [ ] **Step 6: 커밋**

```bash
git add lib/garments/register.ts components/garment/GarmentForm.tsx app/api/garments/route.ts app/api/analyze/route.ts
git commit -m "refactor: allow null source_url for garments without a musinsa link"
git push
```

---

## Task 2: 합성 ParseResult 유틸

**Files:**
- Create: `lib/musinsa/manualParseResult.ts`
- Create: `tests/musinsa/manualParseResult.test.ts`

**Interfaces:**
- Produces: `createManualParseResult(): ParseResult` — `goodsNo`는 호출마다 새 UUID, `fields`의 7개 필드 전부 `{ ok: false, reason: '직접 입력' }`
- Consumes: `fail`, `ParseResult`, `ParsedFields`(`@/lib/musinsa/types`, 계획 1부터 존재, 변경 없음)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/musinsa/manualParseResult.test.ts`를 새로 만든다:

```ts
import { describe, it, expect } from 'vitest'
import { createManualParseResult } from '@/lib/musinsa/manualParseResult'
import { PARSEABLE_FIELDS } from '@/lib/musinsa/types'

describe('createManualParseResult', () => {
  it('모든 필드를 실패(직접 입력 대상)로 만든다', () => {
    const result = createManualParseResult()
    for (const key of PARSEABLE_FIELDS) {
      expect(result.fields[key].ok).toBe(false)
    }
  })

  it('호출마다 다른 goodsNo를 만든다', () => {
    const a = createManualParseResult()
    const b = createManualParseResult()
    expect(a.goodsNo).not.toBe(b.goodsNo)
  })

  it('goodsNo가 빈 문자열이 아니다', () => {
    expect(createManualParseResult().goodsNo.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npm test -- tests/musinsa/manualParseResult.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/musinsa/manualParseResult'`.

- [ ] **Step 3: 최소 구현을 쓴다**

`lib/musinsa/manualParseResult.ts`를 새로 만든다:

```ts
import { fail } from '@/lib/musinsa/types'
import type { ParseResult } from '@/lib/musinsa/types'

/**
 * 무신사 링크 없이 "직접 등록"할 때 쓰는 합성 ParseResult.
 * GarmentForm은 ParseResult.fields의 각 필드가 ok:false면 그 칸을 직접 입력 칸으로 그린다
 * (스펙의 "필드 단위 파싱 실패" 원칙) — 전부 실패로 채우면 자동으로 완전 수동 입력 폼이 된다.
 *
 * goodsNo는 실제 상품번호가 없으므로 crypto.randomUUID()로 대신한다. registerGarment의
 * 이미지 저장 경로·중복 검사가 goodsNo를 전제하므로, null로 두고 그 로직들을 전부 예외
 * 처리하는 대신 값 하나를 만들어 기존 파이프라인에 그대로 태운다.
 */
export function createManualParseResult(): ParseResult {
  return {
    goodsNo: crypto.randomUUID(),
    fields: {
      name: fail('직접 입력'),
      brand: fail('직접 입력'),
      price: fail('직접 입력'),
      imageUrl: fail('직접 입력'),
      category: fail('직접 입력'),
      options: fail('직접 입력'),
      sizeTable: fail('직접 입력'),
    },
  }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
npm test -- tests/musinsa/manualParseResult.test.ts
```

Expected: PASS — 3개 테스트 전부 통과.

- [ ] **Step 5: 커밋**

```bash
git add lib/musinsa/manualParseResult.ts tests/musinsa/manualParseResult.test.ts
git commit -m "feat: add synthetic parse result for manual garment registration"
git push
```

---

## Task 3: "직접 등록" 진입점

**Files:**
- Modify: `components/garment/LinkInputBar.tsx`
- Modify: `components/analyze/AnalyzeLinkBar.tsx`

**Interfaces:**
- Consumes: `createManualParseResult()`(Task 2), `GarmentForm`의 `sourceUrl: string | null`(Task 1)
- Produces: 없음(두 컴포넌트의 export 시그니처는 변경 없음)

- [ ] **Step 1: `LinkInputBar.tsx` 전체를 아래로 바꾼다**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GarmentForm } from '@/components/garment/GarmentForm'
import { useMusinsaParse } from '@/components/garment/useMusinsaParse'
import { MusinsaLinkInput } from '@/components/garment/MusinsaLinkInput'
import { createManualParseResult } from '@/lib/musinsa/manualParseResult'
import type { ParseResult } from '@/lib/musinsa/types'

/**
 * 옷장 등록의 진입점.
 * 링크 파싱은 useMusinsaParse가, 입력 UI는 MusinsaLinkInput이 맡는다 —
 * 여기 남은 건 "어디로 저장할지"와 "저장 후 무엇을 할지"뿐이다.
 * 무신사 링크가 없는 옷(보세 등)은 "직접 등록하기"를 누르면 합성 ParseResult로
 * 같은 GarmentForm을 그대로 띄운다 — 파싱이 전부 실패했을 때와 동일한 화면이다.
 */
export function LinkInputBar() {
  const router = useRouter()
  const parse = useMusinsaParse()
  const [manualParsed, setManualParsed] = useState<ParseResult | null>(null)

  return (
    <div className="space-y-4">
      {!manualParsed && (
        <>
          <MusinsaLinkInput {...parse} placeholder="무신사 상품 링크를 붙여넣으세요" />

          <button
            type="button"
            onClick={() => setManualParsed(createManualParseResult())}
            className="text-sm text-ink-muted underline"
          >
            무신사 링크가 없나요? 직접 등록하기
          </button>
        </>
      )}

      {parse.parsed && !manualParsed && (
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
      )}

      {manualParsed && (
        <GarmentForm
          parsed={manualParsed}
          sourceUrl={null}
          submitEndpoint="/api/garments"
          submitLabel="옷장에 넣기"
          onCancel={() => setManualParsed(null)}
          onSubmitted={() => {
            setManualParsed(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: `AnalyzeLinkBar.tsx` 전체를 아래로 바꾼다**

```tsx
'use client'

import { useState } from 'react'
import { GarmentForm } from '@/components/garment/GarmentForm'
import { VerdictBadge } from '@/components/analyze/VerdictBadge'
import { DeviationReport } from '@/components/analyze/DeviationReport'
import { useMusinsaParse } from '@/components/garment/useMusinsaParse'
import { MusinsaLinkInput } from '@/components/garment/MusinsaLinkInput'
import { createManualParseResult } from '@/lib/musinsa/manualParseResult'
import { CARD_SURFACE } from '@/components/ui/styles'
import type { ParseResult } from '@/lib/musinsa/types'
import type { Verdict } from '@/lib/verdict'

type AnalyzeResult = {
  verdict: Verdict
  fitScore: number
  report: { status: 'ok' | 'low_confidence' | 'insufficient'; fields: unknown[] }
  feedback: { summary: string; sizeFeedback: string; matchFeedback: string; priceFeedback: string } | null
}

export function AnalyzeLinkBar() {
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  // 새 링크를 파싱하기 시작하면 이전 판단 결과를 지운다 — 기존 handleSubmit의 setResult(null)와 같은 역할.
  const parse = useMusinsaParse({ onStart: () => setResult(null) })
  const [manualParsed, setManualParsed] = useState<ParseResult | null>(null)

  return (
    <div className="space-y-4">
      {!manualParsed && !result && (
        <>
          <MusinsaLinkInput {...parse} placeholder="구매를 고민 중인 무신사 상품 링크를 붙여넣으세요" />

          <button
            type="button"
            onClick={() => setManualParsed(createManualParseResult())}
            className="text-sm text-ink-muted underline"
          >
            무신사 링크가 없나요? 직접 등록하기
          </button>
        </>
      )}

      {parse.parsed && !manualParsed && !result && (
        <GarmentForm
          parsed={parse.parsed}
          sourceUrl={parse.url}
          submitEndpoint="/api/analyze"
          submitLabel="판단하기"
          onCancel={parse.reset}
          onSubmitted={(data) => setResult(data as AnalyzeResult)}
        />
      )}

      {manualParsed && !result && (
        <GarmentForm
          parsed={manualParsed}
          sourceUrl={null}
          submitEndpoint="/api/analyze"
          submitLabel="판단하기"
          onCancel={() => setManualParsed(null)}
          onSubmitted={(data) => setResult(data as AnalyzeResult)}
        />
      )}

      {result && (
        <div className={`${CARD_SURFACE} space-y-3 p-5`}>
          <VerdictBadge verdict={result.verdict} />
          <DeviationReport status={result.report.status} fields={result.report.fields as never} feedback={result.feedback} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 빌드와 테스트로 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 126개(123 + Task 2의 3개) 전부 통과.

- [ ] **Step 4: 브라우저로 확인**

개발 서버를 띄우고 로그인한 상태에서:

1. `/wardrobe`에서 "무신사 링크가 없나요? 직접 등록하기" 클릭 → 링크를 입력·불러오지 않았는데도 **모든 칸이 빈 채로 GarmentForm이 바로 뜨는지**(상품명·브랜드·가격·카테고리·색상·사이즈·실측·이미지 주소 전부 "직접 입력" 표시)
2. 우측 상단 "접기" 클릭 → 폼이 사라지고 원래 링크 입력 화면(입력창 + "직접 등록하기" 버튼)으로 돌아가는지
3. `/analyze`에서도 같은 방식으로 "직접 등록하기"가 동작하는지

이 단계에서는 아직 사진 업로드가 없으므로("이미지 주소" 칸은 텍스트만) 상품명·카테고리·색상·사이즈만 채워 실제로 제출까지 해보고, 등록된 항목은 확인 후 정리한다.

- [ ] **Step 5: 커밋**

```bash
git add components/garment/LinkInputBar.tsx components/analyze/AnalyzeLinkBar.tsx
git commit -m "feat: add manual registration entry point without a musinsa link"
git push
```

---

## Task 4: 사진 업로드 API + GarmentForm 파일 입력 칸

**Files:**
- Create: `app/api/garments/upload-image/route.ts`
- Modify: `components/garment/GarmentForm.tsx`

**Interfaces:**
- Produces: `POST /api/garments/upload-image` — `multipart/form-data`로 `file` 하나를 받아 `{ url: string }` 또는 `{ error: string }`을 돌려준다.
- Consumes: `supabaseAdmin`(`@/lib/supabase/admin`), `createServerSupabase`(`@/lib/supabase/server`) — 둘 다 계획 1부터 존재, 변경 없음.

- [ ] **Step 1: 업로드 라우트를 만든다**

`app/api/garments/upload-image/route.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const maxDuration = 30

const MAX_BYTES = 4 * 1024 * 1024 // 4MB — Vercel 서버리스 함수 요청 본문 기본 한도(4.5MB) 아래로 여유를 둔다.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/**
 * 수동 등록("직접 등록하기")에서 올린 사진을 Storage에 저장한다.
 * garments 테이블에는 쓰지 않으므로 세션 클라이언트(RLS)가 아니라 supabaseAdmin으로
 * Storage에 쓴다 — 로그인 여부만 세션 클라이언트로 확인한다(admin.ts 주석 참고).
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'JPG·PNG·WEBP 파일만 올릴 수 있습니다.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: '4MB 이하 파일만 올릴 수 있습니다.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const objectPath = `manual/${user.id}/${randomUUID()}.${EXTENSIONS[file.type]}`
  const { error } = await supabaseAdmin.storage
    .from('garments')
    .upload(objectPath, buffer, { contentType: file.type, upsert: false })

  if (error) {
    return NextResponse.json({ error: '사진을 올리지 못했습니다.' }, { status: 500 })
  }

  const url = supabaseAdmin.storage.from('garments').getPublicUrl(objectPath).data.publicUrl
  return NextResponse.json({ url })
}
```

- [ ] **Step 2: `GarmentForm.tsx`에 이미지 관련 상수를 모듈 최상단에 추가한다**

import 목록 바로 아래, `export type GarmentSubmitPayload` 앞에 추가한다:

```ts
// 렌더마다 새로 만들 이유가 없는 고정값이라 컴포넌트 함수 바깥에 둔다.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4MB — 업로드 API(app/api/garments/upload-image)와 같은 한도.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
```

- [ ] **Step 3: 이미지 파일 상태와 검증 함수를 추가한다**

`const [error, setError] = useState<string | null>(null)` 바로 아래에 추가한다:

```ts
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
```

`manualMeasurementsAsNumbers` 함수 뒤, `handleSubmit` 앞에 추가한다:

```ts
  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (file && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError('JPG·PNG·WEBP 파일만 올릴 수 있습니다.')
      setImageFile(null)
      return
    }
    if (file && file.size > MAX_IMAGE_BYTES) {
      setImageError('4MB 이하 파일만 올릴 수 있습니다.')
      setImageFile(null)
      return
    }
    setImageError(null)
    setImageFile(file)
  }
```

- [ ] **Step 4: `handleSubmit`에 업로드 단계를 넣는다**

**기존**:

```tsx
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const hasFullPastedTable = Object.keys(pastedSizeTable).length > 0

    const payload: GarmentSubmitPayload = {
      goodsNo: parsed.goodsNo,
      sourceUrl,
      name: name.trim(),
      brand: brand.trim() || null,
      price: price ? Number(price) : null,
      imageUrl: imageUrl.trim() || null,
```

**변경**:

```tsx
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    // 파일을 골랐으면 URL 입력보다 우선한다 — 완전 수동 등록은 URL이 애초에 없고,
    // 무신사 링크를 썼는데 이미지만 파싱 실패한 경우에도 사진을 직접 올리는 쪽이 더 쉽다.
    let uploadedImageUrl: string | null = null
    if (imageFile) {
      const uploadBody = new FormData()
      uploadBody.append('file', imageFile)
      const uploadResponse = await fetch('/api/garments/upload-image', { method: 'POST', body: uploadBody })
      if (!uploadResponse.ok) {
        setSubmitting(false)
        setError('사진을 올리지 못했습니다.')
        return
      }
      uploadedImageUrl = (await uploadResponse.json()).url
    }

    const hasFullPastedTable = Object.keys(pastedSizeTable).length > 0

    const payload: GarmentSubmitPayload = {
      goodsNo: parsed.goodsNo,
      sourceUrl,
      name: name.trim(),
      brand: brand.trim() || null,
      price: price ? Number(price) : null,
      imageUrl: uploadedImageUrl ?? (imageUrl.trim() || null),
```

- [ ] **Step 5: JSX의 이미지 칸에 파일 입력을 추가한다**

**기존**:

```tsx
      {!f.imageUrl.ok && (
        <Field label="이미지 주소" manual>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…" className={INPUT} />
        </Field>
      )}
```

**변경**:

```tsx
      {!f.imageUrl.ok && (
        <Field label="사진" manual>
          <input
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            onChange={handleImageChange}
            className="block text-sm text-ink-muted file:mr-3 file:rounded-btn file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-ink"
          />
          {imageFile && <p className="text-sm text-ink">선택한 파일: {imageFile.name}</p>}
          {imageError && <p className="text-sm text-danger">{imageError}</p>}
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
            placeholder="또는 이미지 주소를 붙여넣으세요" className={`${INPUT} mt-2`} />
        </Field>
      )}
```

- [ ] **Step 6: 빌드와 테스트로 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 126개 전부 통과.

- [ ] **Step 7: 브라우저로 확인**

`/wardrobe`에서 "직접 등록하기"로 폼을 연 뒤:

1. 상품명·카테고리·색상·사이즈를 채우고 "사진" 칸에서 4MB 이하 jpg/png 파일을 골라 선택한 파일명이 뜨는지 확인
2. 4MB보다 큰 파일이나 gif 같은 다른 형식을 골랐을 때 에러 문구가 뜨고 `imageFile`이 비워지는지(같은 파일 크기 제한을 넘는 이미지를 하나 준비해서 테스트)
3. "옷장에 넣기" → 등록 후 `/wardrobe` 카드에 방금 고른 사진이 뜨는지
4. Supabase 대시보드(Storage → garments 버킷) 또는 아래 쿼리로 `manual/{내 uid}/...` 경로에 파일이 실제로 저장됐는지 확인:
   ```sql
   select name from storage.objects where bucket_id = 'garments' and name like 'manual/%' order by created_at desc limit 5;
   ```
5. `/analyze`에서도 같은 방식으로 사진을 올려 판단까지 끝까지 진행

검증용으로 만든 옷·업로드한 사진은 확인 후 정리한다(Storage 객체는 `garments` 행 삭제만으로는 안 지워지므로, 대시보드에서 직접 지운다 — 계획 밖 자동 정리는 다루지 않는다).

- [ ] **Step 8: 커밋**

```bash
git add app/api/garments/upload-image/route.ts components/garment/GarmentForm.tsx
git commit -m "feat: upload a photo for manually registered garments"
git push
```

---

## Task 5: 이중 업로드 방지

**Files:**
- Modify: `lib/storage.ts`

**Interfaces:**
- Consumes: `supabaseAdmin`(변경 없음)
- Produces: `copyImageToStorage`의 시그니처는 그대로다. 동작만 바뀐다.

- [ ] **Step 1: `copyImageToStorage`가 자기 버킷 URL을 그대로 통과시키게 한다**

`lib/storage.ts` 전체를 아래로 바꾼다:

```ts
import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

const BUCKET = 'garments'

// URL을 직접 조립하지 않고 SDK가 실제로 만드는 형식을 그대로 얻어 비교한다 —
// NEXT_PUBLIC_SUPABASE_URL의 트레일링 슬래시 유무 등으로 문자열을 손으로 맞추면 어긋날 수 있다.
const BUCKET_PUBLIC_PREFIX = supabaseAdmin.storage.from(BUCKET).getPublicUrl('').data.publicUrl

/**
 * 무신사 이미지를 내려받아 Storage에 사본을 만든다.
 * CDN URL은 만료되거나 외부 참조가 차단될 수 있으므로 직접 링크하지 않는다.
 * 실패해도 등록 자체는 진행되어야 하므로 예외 대신 null을 돌려준다.
 *
 * imageUrl이 이미 이 버킷의 공개 URL이면(직접 등록에서 /api/garments/upload-image로
 * 미리 올린 사진) 그대로 돌려준다 — 다시 내려받아 재업로드하면 같은 사진이 두 번
 * 저장되고, 원본은 아무 데서도 참조되지 않는 채로 버킷에 남는다.
 */
export async function copyImageToStorage(
  imageUrl: string,
  goodsNo: string,
  colorOption: string,
): Promise<string | null> {
  if (imageUrl.startsWith(BUCKET_PUBLIC_PREFIX)) return imageUrl

  try {
    const response = await fetch(imageUrl)
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    const extension = contentType.includes('png') ? 'png'
      : contentType.includes('webp') ? 'webp' : 'jpg'
    // Supabase Storage 오브젝트 키는 비-ASCII 문자(한글 포함)를 거부한다(실제 등록 테스트에서
    // "블랙" 같은 색상명으로 업로드가 매번 InvalidKey로 실패하는 걸 확인했다). 무신사 색상 옵션은
    // 거의 항상 한국어라 원문을 그대로 못 쓰므로, 색상 문자열을 짧은 해시로 바꿔 키를 만든다.
    // 이 경로는 사용자에게 노출되지 않고(공개 URL만 노출) 같은 색상이면 같은 해시라 upsert로 재사용된다.
    const colorSlug = createHash('sha1').update(colorOption || 'default').digest('hex').slice(0, 10)
    const objectPath = `${goodsNo}/${colorSlug}.${extension}`

    const buffer = Buffer.from(await response.arrayBuffer())
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(objectPath, buffer, { contentType, upsert: true })
    if (error) return null

    return supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl
  } catch {
    return null
  }
}
```

- [ ] **Step 2: 빌드와 테스트로 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 126개 전부 통과.

- [ ] **Step 3: 브라우저로 이중 업로드가 사라졌는지 확인**

`/wardrobe`에서 "직접 등록하기"로 사진을 올려 등록한 뒤, 아래 쿼리로 `manual/` 아래 방금 올린 파일 **하나만** 있고 `{goodsNo}/...` 형태의 두 번째 사본이 **생기지 않았는지** 확인한다(Task 4 Step 7에서 쓴 쿼리를 다시 쓰되, 이번엔 `garments` 테이블의 `image_url` 컬럼도 함께 봐서 그 URL이 `manual/` 경로를 그대로 가리키는지 확인):

```sql
select id, image_url from garments where owner_id = auth.uid() order by created_at desc limit 1;
select name from storage.objects where bucket_id = 'garments' order by created_at desc limit 5;
```

`image_url`이 `manual/{uid}/{uuid}.ext` 형태이고, `storage.objects`에 같은 경로의 파일이 하나만 있으면 성공이다.

- [ ] **Step 4: 커밋**

```bash
git add lib/storage.ts
git commit -m "fix: skip re-uploading images already in our own storage bucket"
git push
```

---

## Task 6: README 기록

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 맨 끝에 "계획 8 — 수동 등록" 절을 추가한다**

기존 절들과 같은 형식(문제 / 원인 / 해결 / 검증 / 결과)으로 쓴다. **이 계획을 실행하며 실제로 겪은 문제만 적는다** — 미리 예상한 문제를 적지 않는다. 겪은 문제가 없었다면 그렇게 쓰고, 대신 내린 설계 판단과 근거를 남긴다.

최소한 아래는 계획 작성 시점에 이미 확정된 판단이라 기록할 가치가 있다:

- **새 폼을 만들지 않고 기존 `GarmentForm`을 재사용한 것** — 처음엔 별도 컴포넌트(탭 UI + 새 폼)를 설계했지만, 사용자가 "무신사 상품 등록 폼 그대로 쓰고 사진만 넣을 수 있게 하면 될 것 같다"고 정정해줘서 훨씬 단순해졌다. 파싱이 전부 실패했을 때 이미 완전 수동 입력 폼이 되는 `GarmentForm`의 기존 동작을, 합성 `ParseResult`로 "링크 없이도" 트리거하는 것으로 끝났다.
- **`goodsNo`에 무신사 상품번호 대신 `crypto.randomUUID()`를 쓴 이유** — DB 컬럼은 nullable이지만 `registerGarment`의 이미지 저장 경로·중복 검사 로직이 값이 있다고 전제한다. null로 두고 그 로직들을 전부 예외 처리하는 대신, 어차피 실제 상품번호인지 검증하는 곳이 없다는 걸 확인하고 합성 ID를 그대로 태웠다.
- **이미지 업로드를 별도 API(`/api/garments/upload-image`)로 뺀 이유와, 이중 업로드를 막기 위해 `copyImageToStorage`에 조건을 하나 더한 이유** — 업로드 후 `registerGarment`가 그 URL을 다시 내려받아 재업로드하려는 걸 발견해서, "이미 우리 버킷 URL이면 그대로 쓴다"는 조건으로 막았다.
- **파일 크기를 4MB로 잡은 이유** — Vercel 서버리스 함수의 기본 요청 본문 한도(4.5MB)를 넘지 않게 여유를 뒀다.

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: log manual registration work"
git push
```

---

## 남은 일 (이 계획 밖)

합의한 A~F 중 A(계획 6)·B(계획 7)·C(이 계획)가 끝난다. 나머지는 각자 별도 스펙·계획 사이클로 진행한다.

- **D. 추천 → 룩 흐름** — 추천 직후 그 아이템으로 바로 룩 짜기
- **E. 핏 판단 정밀화** — 항목별 개별 허용오차, 심각도·가중치·판정 경계값
- **F. 가격 인하 표시** — 주기적으로 장바구니 상품 가격 재확인, "원래 얼마 → 얼마" 표시. 이메일·알림 토글은 범위에서 뺐다.
- **`MUSINSA_CATEGORY_MAP` 확장** — 액세서리류의 실제 무신사 대분류명을 확인하면 추가한다(커밋 `2893adf` 참고).
- **삭제 되돌리기(휴지통)** — 계획 7 스펙 §7에서 범위 밖으로 남겨둔 것.
- **`RecommendLinkBar`(친구 추천)에도 직접 등록 지원** — 이번 계획 스펙 §7에서 범위 밖으로 남겨둔 것. 필요해지면 `createManualParseResult` + 이 계획의 파일 업로드 칸을 그대로 적용할 수 있다.
- **업로드 전 이미지 미리보기·자르기·여러 장 업로드** — 스펙 §7에서 범위 밖으로 남겨둔 것.
