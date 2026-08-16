# 계획 3: 공유 옷장 · 친구 추천 · 룩 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: 이 프로젝트는 `superpowers:subagent-driven-development`를 기본 실행 방식으로 쓰지 않는다(`CLAUDE.md` 참고 — 기능 단위로 사용자와 상호 리뷰하며 진행). `superpowers:executing-plans`로 태스크 단위로 실행하고, 완료할 때마다 사용자에게 알린다. Steps는 체크박스(`- [ ]`)로 진행 상황을 추적한다.

**Goal:** 옷장을 공유 링크로 켜고, 링크를 받은 친구가 로그인해서 무신사 링크로 아이템을 추천하거나 옷장의 옷들을 골라 룩을 만들어 줄 수 있다. 룩을 받은 사람은 `/looks`에서 누가 만들어 줬는지와 함께 확인한다.

**Architecture:** 계획 1·2가 만든 `garments` 등록 파이프라인(`lib/garments/register.ts`)과 RLS 정책(계획 1 `0002_rls.sql`)이 이미 "공개 옷장에 추천 아이템 넣기"를 지원하도록 설계돼 있었다 — 이번 계획은 그 위에 UI와 `outfits`/`outfit_items` 테이블만 얹는다. 접근 제어는 이번에도 애플리케이션 코드가 아니라 RLS가 전담한다.

**Tech Stack:** 계획 1·2와 동일. 신규 의존성 없음(`next/og`는 Next.js 내장).

**설계 문서:** `docs/superpowers/specs/2026-08-13-buy-or-not-design.md` (§6 데이터 모델의 `outfits`/`outfit_items`, §7 RLS, §11 화면)

**이 계획의 범위:** 스펙 §14 Phase 6(공유 옷장), Phase 7(룩), Phase 8(마감). 이걸로 스펙에 정의된 전 범위가 끝난다.

## Global Constraints

- Node.js 20 이상, npm.
- TypeScript `strict: true`, `any` 사용 금지.
- **외부 서비스 호출은 서버 코드에서만 한다.**
- **`SUPABASE_SERVICE_ROLE_KEY`는 `lib/supabase/admin.ts` 밖에서 import하지 않는다.**
- **접근 제어는 RLS가 전담한다.** 이번 계획에서 다루는 "친구는 남의 옷장에 `owned`로 못 넣는다", "룩에는 그 옷장 소유 옷만 담을 수 있다", "비공개 옷장은 404"는 전부 RLS 정책과 서버 컴포넌트의 자연스러운 null 처리로 구현하고, 애플리케이션 레이어의 중복 권한 체크를 추가하지 않는다.
- 사용자에게 보이는 모든 문구는 한국어.
- 커밋 메시지는 Conventional Commits. AI 공동작성자 트레일러는 넣지 않는다.
- 기능 하나를 추가·변경할 때마다 사용자에게 알리고, 기능/작업 단위로 커밋·push한다.
- Next.js 16의 특수 파일 규칙(`opengraph-image.tsx`, `loading.tsx`)은 이 리포의 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/`에서 실제 시그니처를 확인한 뒤 작성한다 — 학습 데이터의 옛 Next.js 관례를 가정하지 않는다.

## File Structure

```
buy-or-not/
├── app/
│   ├── u/[share_slug]/
│   │   ├── page.tsx                공유 옷장 공개 열람 + (로그인 시) 추천·룩 만들기 폼
│   │   ├── opengraph-image.tsx     공유 링크 OG 이미지 (동적 생성)
│   │   └── loading.tsx
│   ├── looks/
│   │   ├── page.tsx                나를 위해 만들어진 룩 목록
│   │   └── loading.tsx
│   ├── wardrobe/
│   │   ├── page.tsx                (수정) 공유 토글 추가
│   │   └── loading.tsx
│   ├── cart/loading.tsx
│   ├── analyze/loading.tsx
│   └── api/
│       ├── profile/route.ts        PATCH: is_wardrobe_public 토글
│       ├── recommend/route.ts      POST: 공개 옷장에 추천 아이템(considering) 등록
│       └── outfits/route.ts        POST: 룩 생성
├── components/
│   ├── ShareToggle.tsx             공유 켜기/끄기 + 링크 복사
│   ├── RecommendLinkBar.tsx        추천용 링크 입력 바 (AnalyzeLinkBar의 세 번째 변형)
│   ├── OutfitBuilder.tsx           옷 여러 개 골라 룩 만들기
│   └── GarmentForm.tsx             (수정) noteField·extraBody 지원
├── lib/
│   └── garments/register.ts        (수정) recommendedBy·note 지원
├── supabase/migrations/
│   └── 0005_outfits.sql            outfits, outfit_items 테이블 + RLS
└── tests/
    └── rls.test.ts                 (수정) outfits/outfit_items 시나리오 추가
```

**`RecommendLinkBar`가 세 번째 "링크 입력 → 파싱 → `GarmentForm`" 반복이라는 점에 대한 메모.** `LinkInputBar`(계획 1)·`AnalyzeLinkBar`(계획 2)와 거의 같은 모양이 세 번째로 생긴다 — "rule of three" 기준으로는 공용 컴포넌트로 뽑아낼 타이밍이지만, 이번 계획은 이미 8개 태스크로 범위가 크고 세 컴포넌트의 차이(성공 후 렌더링: 그리드 새로고침 vs 판정 배지 vs 완료 메시지)가 매번 조금씩 달라 추상화가 깔끔하게 떨어지지 않는다. 검증된 패턴을 한 번 더 복붙하는 쪽을 택하고, 리팩터는 다음에 코드 정리 기회가 생기면 하기로 미룬다.

---

### Task 1: 옷장 공유 토글

`/wardrobe`에서 공유를 켜고 끄고, 켜져 있으면 공유 링크를 복사할 수 있게 한다. RLS(`profiles_select`: 본인 또는 `is_wardrobe_public`)는 계획 1에서 이미 구현돼 있으므로 이 태스크는 그 값을 바꾸는 API와 UI만 만든다.

**Files:**
- Create: `app/api/profile/route.ts`
- Create: `components/ShareToggle.tsx`
- Modify: `app/wardrobe/page.tsx`

**Interfaces:**
- Consumes: `createServerSupabase` (계획 1 Task 8)
- Produces:
  - `PATCH /api/profile` — 요청 `{ isWardrobePublic: boolean }`, 응답 `{ ok: true }` 또는 `{ error }`
  - `<ShareToggle shareSlug initialIsPublic />`

- [ ] **Step 1: 프로필 수정 API**

`app/api/profile/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'

const Body = z.object({ isWardrobePublic: z.boolean() })

export async function PATCH(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_wardrobe_public: parsed.data.isWardrobePublic })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: '설정을 저장하지 못했습니다.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: 공유 토글 컴포넌트**

`components/ShareToggle.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  shareSlug: string
  initialIsPublic: boolean
}

export function ShareToggle({ shareSlug, initialIsPublic }: Props) {
  const router = useRouter()
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  async function toggle() {
    const next = !isPublic
    setSaving(true)
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isWardrobePublic: next }),
    })
    setSaving(false)
    if (response.ok) {
      setIsPublic(next)
      router.refresh()
    }
  }

  async function copyLink() {
    // 서버에서 origin을 추측하지 않고, 지금 접속한 브라우저의 origin을 그대로 쓴다.
    const url = `${window.location.origin}/u/${shareSlug}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className={`rounded-full px-4 py-1 ${isPublic ? 'bg-black text-white' : 'bg-gray-100'}`}
      >
        {isPublic ? '옷장 공개 중' : '옷장 비공개'}
      </button>
      {isPublic && (
        <button type="button" onClick={copyLink} className="text-blue-600 underline">
          {copied ? '복사됨!' : '공유 링크 복사'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: `/wardrobe`에 연결**

`app/wardrobe/page.tsx`의 `user` 조회 직후에 프로필을 함께 조회하고, `<LinkInputBar />` 아래에 `<ShareToggle />`을 추가한다:

```tsx
import { ShareToggle } from '@/components/ShareToggle'

// ... export default async function WardrobePage 안, user 조회 직후 ...

  const { data: profile } = await supabase
    .from('profiles')
    .select('share_slug, is_wardrobe_public')
    .eq('id', user.id)
    .single()

// ... <LinkInputBar /> 다음 줄에 ...

      {profile && <ShareToggle shareSlug={profile.share_slug} initialIsPublic={profile.is_wardrobe_public} />}
```

- [ ] **Step 4: 수동 검증**

`npm run dev` → `/wardrobe`에서 토글 클릭 → "옷장 공개 중"으로 바뀌고 "공유 링크 복사" 버튼이 나타나는지 확인. Supabase Table Editor의 `profiles.is_wardrobe_public`이 `true`로 바뀌었는지 확인. 복사 버튼을 눌러 클립보드에 `http://localhost:3000/u/{share_slug}` 형태 URL이 담기는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add app/api/profile components/ShareToggle.tsx app/wardrobe/page.tsx
git commit -m "feat: add wardrobe share toggle"
```

---

### Task 2: 공유 옷장 공개 열람

`/u/[share_slug]`를 만든다. 비공개면 404, 공개면 누구나(비로그인 포함) 옷장을 볼 수 있다.

**Files:**
- Create: `app/u/[share_slug]/page.tsx`

**Interfaces:**
- Consumes: `createServerSupabase`, `CATEGORY_LABELS` (계획 1 Task 3)
- Produces: `/u/:share_slug` 화면. 이후 태스크가 이 페이지에 추천·룩 만들기 섹션을 이어 붙인다.

- [ ] **Step 1: 공유 옷장 페이지**

`app/u/[share_slug]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createServerSupabase } from '@/lib/supabase/server'
import { CATEGORY_LABELS, type Category } from '@/lib/types'

type Props = {
  params: Promise<{ share_slug: string }>
  searchParams: Promise<{ category?: string }>
}

type PublicGarment = {
  id: string
  name: string
  brand: string | null
  image_url: string | null
  category: Category
  color_option: string | null
  size_option: string | null
}

export default async function SharedWardrobePage({ params, searchParams }: Props) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  const { share_slug } = await params
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nickname, is_wardrobe_public')
    .eq('share_slug', share_slug)
    .single()

  // RLS(profiles_select: 본인 또는 is_wardrobe_public)가 비공개 프로필은 이미 null로
  // 돌려주지만, is_wardrobe_public을 한 번 더 확인해 "본인이 비로그인 상태로 자기 비공개
  // 프로필을 본다"는 경우(RLS가 막아 애초에 null이라 사실 발생하지 않는다)까지 명확히 한다.
  if (!profile || !profile.is_wardrobe_public) notFound()

  const { category } = await searchParams
  let query = supabase
    .from('garments')
    .select('id, name, brand, image_url, category, color_option, size_option')
    .eq('owner_id', profile.id)
    .eq('status', 'owned')
    .order('created_at', { ascending: false })

  if (category && category in CATEGORY_LABELS) {
    query = query.eq('category', category as Category)
  }

  const { data: garments } = await query.overrideTypes<PublicGarment[], { merge: false }>()

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-bold">{profile.nickname ?? '사용자'}님의 옷장</h1>

      <nav className="flex flex-wrap gap-2">
        <FilterLink href={`/u/${share_slug}`} label="전체" active={!category} />
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <FilterLink key={value} href={`/u/${share_slug}?category=${value}`} label={label} active={category === value} />
        ))}
      </nav>

      {!garments || garments.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-gray-500">
          아직 등록된 옷이 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {garments.map((garment) => <PublicGarmentCard key={garment.id} garment={garment} />)}
        </div>
      )}
    </main>
  )
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a href={href}
      className={`rounded-full border px-4 py-1 text-sm ${active ? 'bg-black text-white' : 'bg-white'}`}>
      {label}
    </a>
  )
}

// 옷장 주인 전용 컨트롤(선호도 편집·삭제)이 있는 /wardrobe/[id]로 링크하지 않는다 —
// 방문자는 자기 것이 아닌 옷을 고칠 수 없어야 하고, 그 페이지는 비로그인 접근 시 리다이렉트된다.
function PublicGarmentCard({ garment }: { garment: PublicGarment }) {
  return (
    <article className="overflow-hidden rounded-xl border">
      <div className="relative aspect-[3/4] bg-gray-100">
        {garment.image_url ? (
          <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="200px" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">이미지 없음</div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="text-xs text-gray-500">{garment.brand ?? CATEGORY_LABELS[garment.category]}</p>
        <h3 className="line-clamp-2 text-sm font-medium">{garment.name}</h3>
        <p className="text-xs text-gray-600">
          {[garment.color_option, garment.size_option].filter(Boolean).join(' · ')}
        </p>
      </div>
    </article>
  )
}
```

- [ ] **Step 2: 수동 검증**

`npm run dev` → Task 1에서 켜둔 공유 링크(`/u/{share_slug}`)를 비로그인 시크릿 창에서 열어 옷장이 보이는지 확인. `profiles.is_wardrobe_public`을 Supabase Table Editor에서 잠깐 `false`로 바꾸고 새로고침해 404가 뜨는지 확인한 뒤 다시 `true`로 되돌린다. 존재하지 않는 `share_slug`로도 404 확인.

- [ ] **Step 3: 커밋**

```bash
git add app/u
git commit -m "feat: add public shared wardrobe view"
```

---

### Task 3: 친구 추천 아이템 등록

로그인한 방문자가 공유 옷장 페이지에서 무신사 링크로 아이템을 추천하면 옷장 주인의 장바구니(`considering`)에 들어간다. `lib/garments/register.ts`(계획 2 Task 7)를 확장해 재사용한다.

**Files:**
- Modify: `lib/garments/register.ts`
- Modify: `components/GarmentForm.tsx`
- Create: `components/RecommendLinkBar.tsx`
- Create: `app/api/recommend/route.ts`
- Modify: `app/u/[share_slug]/page.tsx`

**Interfaces:**
- Consumes: `registerGarment` (계획 2 Task 7), `GarmentForm` (계획 1 Task 10, 계획 2 Task 9)
- Produces:
  - `RegisterGarmentInput`에 `recommendedBy?: string`, `note?: string | null` 추가
  - `GarmentForm`에 `noteField?: boolean`, `extraBody?: Record<string, unknown>` prop 추가
  - `POST /api/recommend` — 요청 `GarmentSubmitPayload & { wardrobeOwnerId: string; note: string | null }`, 응답 `{ id: string }` 또는 `{ error }`
  - `<RecommendLinkBar wardrobeOwnerId />`

- [ ] **Step 1: `registerGarment`이 추천 필드를 받도록 확장**

`lib/garments/register.ts`의 `RegisterGarmentInput`에 필드를 추가한다:

```ts
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
  /** 친구 추천으로 등록될 때만 채워진다(계획 3 Task 3). 옷장 등록·구매 판단에서는 비운다. */
  recommendedBy?: string
  note?: string | null
}
```

insert 객체에 두 줄을 추가한다(`parse_mode: computeParseMode(...)` 다음 줄):

```ts
      parse_mode: computeParseMode(input.manualFields),
      recommended_by: input.recommendedBy ?? null,
      note: input.note ?? null,
    })
```

- [ ] **Step 2: `GarmentForm`에 코멘트 입력과 추가 바디 지원**

`components/GarmentForm.tsx`의 `Props`에 두 필드를 추가한다:

```ts
type Props = {
  parsed: ParseResult
  sourceUrl: string
  submitEndpoint: string
  submitLabel: string
  onSubmitted: (result: Record<string, unknown>) => void
  /** 추천 등록(RecommendLinkBar)에서만 켠다 — 코멘트 입력칸을 추가로 보여준다. */
  noteField?: boolean
  /** 요청 바디에 합쳐 보낼 필드(예: wardrobeOwnerId). 옷장 등록·구매 판단에서는 비워둔다. */
  extraBody?: Record<string, unknown>
}
```

함수 시그니처와 상태, 제출 로직을 고친다:

```ts
export function GarmentForm({
  parsed, sourceUrl, submitEndpoint, submitLabel, onSubmitted, noteField, extraBody,
}: Props) {
  // ... 기존 상태 선언들 그대로 ...
  const [note, setNote] = useState('')

  // ... manualMeasurementsAsNumbers 그대로 ...

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const hasFullPastedTable = Object.keys(pastedSizeTable).length > 0

    const payload: GarmentSubmitPayload = {
      // ... 기존과 동일 ...
    }

    const body: Record<string, unknown> = { ...payload, ...extraBody }
    if (noteField) body.note = note.trim() || null

    const response = await fetch(submitEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSubmitting(false)

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? '처리하지 못했습니다.')
      return
    }
    onSubmitted(await response.json())
  }
```

`{!f.imageUrl.ok && (...)}` 블록 바로 다음에 코멘트 입력 필드를 추가한다:

```tsx
      {noteField && (
        <Field label="코멘트" manual={false}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            placeholder="추천 이유를 남겨보세요 (선택)" className="w-full rounded border px-3 py-2" />
        </Field>
      )}
```

- [ ] **Step 3: 추천 등록 API**

`app/api/recommend/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import { registerGarment } from '@/lib/garments/register'

export const maxDuration = 30

const Body = z.object({
  wardrobeOwnerId: z.string().uuid(),
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
  note: z.string().nullable(),
})

// 대상 옷장이 실제로 공개 상태인지는 여기서 검사하지 않는다 — garments_insert RLS 정책이
// "공개 옷장 + status='considering' + recommended_by=auth.uid()"만 허용하므로, 비공개
// 옷장에 추천을 시도하면 insert 자체가 RLS에서 조용히 막힌다(계획 1에서 이미 검증된 정책).
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
  const { wardrobeOwnerId, note, ...input } = parsed.data

  try {
    const result = await registerGarment(supabase, wardrobeOwnerId, 'considering', {
      ...input,
      recommendedBy: user.id,
      note,
    })
    return NextResponse.json({ id: result.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: '추천하지 못했습니다. 옷장이 비공개일 수 있습니다.' }, { status: 500 })
  }
}
```

- [ ] **Step 4: 추천용 링크 입력 바**

`components/RecommendLinkBar.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { ParseResult } from '@/lib/musinsa/types'
import { GarmentForm } from '@/components/GarmentForm'

type Props = { wardrobeOwnerId: string }

export function RecommendLinkBar({ wardrobeOwnerId }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setParsed(null)
    setDone(false)

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
          placeholder="추천하고 싶은 무신사 상품 링크를 붙여넣으세요"
          className="flex-1 rounded-lg border px-4 py-2"
        />
        <button type="submit" disabled={loading || url.trim().length === 0}
          className="rounded-lg bg-black px-5 py-2 text-white disabled:bg-gray-300">
          {loading ? '불러오는 중…' : '불러오기'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {parsed && !done && (
        <GarmentForm
          parsed={parsed}
          sourceUrl={url}
          submitEndpoint="/api/recommend"
          submitLabel="추천하기"
          noteField
          extraBody={{ wardrobeOwnerId }}
          onSubmitted={() => {
            setParsed(null)
            setUrl('')
            setDone(true)
          }}
        />
      )}

      {done && <p className="text-sm text-green-700">추천했습니다! 상대방의 장바구니에 담겼습니다.</p>}
    </div>
  )
}
```

- [ ] **Step 5: 공유 옷장 페이지에 연결**

`app/u/[share_slug]/page.tsx`의 옷장 그리드 다음, `</main>` 앞에 추가한다(로그인 상태이고 본인 옷장이 아닐 때만 보여준다):

```tsx
import { RecommendLinkBar } from '@/components/RecommendLinkBar'

// ... 그리드 렌더 다음 ...

      {user && user.id !== profile.id && (
        <section className="space-y-3 border-t pt-6">
          <h2 className="text-lg font-semibold">추천하기</h2>
          <RecommendLinkBar wardrobeOwnerId={profile.id} />
        </section>
      )}
```

- [ ] **Step 6: 회귀 확인 및 수동 검증**

Run: `npm test && npm run build`
Expected: 전체 PASS (기존 옷장 등록·구매 판단 API는 `recommendedBy`/`note`를 안 보내므로 그대로 동작해야 한다).

두 계정으로 확인한다(계획이 없다면 브라우저 시크릿 창으로 두 번째 세션을 만든다): A 계정이 옷장을 공개하고, B 계정으로 `/u/{A의 share_slug}`에 접속해 무신사 링크로 추천 → A 계정의 `/cart`에 추천받은 옷이 뜨는지 확인. Supabase에서 해당 `garments` 행의 `recommended_by`가 B의 id, `note`가 입력한 코멘트인지 확인.

- [ ] **Step 7: 커밋**

```bash
git add lib/garments/register.ts components/GarmentForm.tsx components/RecommendLinkBar.tsx app/api/recommend app/u/[share_slug]/page.tsx
git commit -m "feat: let logged-in visitors recommend items to a shared wardrobe"
```

---

### Task 4: `outfits`/`outfit_items` 테이블과 RLS

룩 데이터 모델을 만든다. `garments`(계획 1)는 이미 있으므로 이 테이블 둘만 새로 필요하다.

**Files:**
- Create: `supabase/migrations/0005_outfits.sql`
- Modify: `tests/rls.test.ts`

**Interfaces:**
- Consumes: `garments`, `profiles` (계획 1 Task 6)
- Produces: `outfits`, `outfit_items` 테이블 + RLS

- [ ] **Step 1: 마이그레이션 작성**

`supabase/migrations/0005_outfits.sql`:

```sql
create table outfits (
  id uuid primary key default gen_random_uuid(),
  wardrobe_owner_id uuid not null references profiles (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table outfit_items (
  outfit_id uuid not null references outfits (id) on delete cascade,
  garment_id uuid not null references garments (id) on delete cascade,
  primary key (outfit_id, garment_id)
);

create index outfits_wardrobe_owner_idx on outfits (wardrobe_owner_id);

alter table outfits enable row level security;
alter table outfit_items enable row level security;

create policy outfits_select on outfits for select
  using (
    wardrobe_owner_id = auth.uid()
    or exists (select 1 from profiles p where p.id = wardrobe_owner_id and p.is_wardrobe_public)
  );

-- 스펙 §7 원문 그대로: author_id=auth.uid()"이고" 대상 옷장이 공개 중이어야 한다 —
-- 본인 옷장이라는 예외가 없다. 즉 자기 옷장으로 룩을 만들려면 그 옷장도 공개돼 있어야 한다.
create policy outfits_insert on outfits for insert
  with check (
    author_id = auth.uid()
    and exists (select 1 from profiles p where p.id = wardrobe_owner_id and p.is_wardrobe_public)
  );

create policy outfits_delete on outfits for delete
  using (author_id = auth.uid() or wardrobe_owner_id = auth.uid());

create policy outfit_items_select on outfit_items for select
  using (
    exists (
      select 1 from outfits o
      where o.id = outfit_items.outfit_id
        and (
          o.wardrobe_owner_id = auth.uid()
          or exists (select 1 from profiles p where p.id = o.wardrobe_owner_id and p.is_wardrobe_public)
        )
    )
  );

-- 룩에 담기는 옷은 그 옷장 소유의 옷이어야 한다(스펙 §6) — garments.owner_id = outfits.wardrobe_owner_id를
-- 조인으로 검증한다. 친구가 남의 옷장 룩에 제3자의(자기 것 포함) 옷을 끼워 넣을 수 없다.
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

create policy outfit_items_delete on outfit_items for delete
  using (
    exists (
      select 1 from outfits o
      where o.id = outfit_items.outfit_id
        and (o.author_id = auth.uid() or o.wardrobe_owner_id = auth.uid())
    )
  );
```

- [ ] **Step 2: 마이그레이션 적용**

```bash
npx supabase db push
```

Expected: 오류 없이 완료.

- [ ] **Step 3: RLS 테스트 추가**

`tests/rls.test.ts`의 `analyses` describe 블록 뒤에 이어서 작성한다:

```ts
describe('outfits', () => {
  let bobGarmentId: string
  let outfitId: string

  beforeAll(async () => {
    const { data, error } = await bob.client
      .from('garments')
      .insert({ owner_id: bob.id, name: '밥의 셔츠', category: 'top', status: 'owned' })
      .select('id')
      .single()
    if (error) throw error
    bobGarmentId = data.id
  })

  it('공개 옷장이면 옷장 주인이 아닌 사람도 룩을 만들 수 있다', async () => {
    // alice는 앞선 '공개 옷장' describe에서 이미 is_wardrobe_public=true로 바뀌어 있다.
    const { data, error } = await bob.client
      .from('outfits')
      .insert({ wardrobe_owner_id: alice.id, author_id: bob.id, title: '가을 코디' })
      .select('id')
      .single()
    expect(error).toBeNull()
    outfitId = data!.id
  })

  it('룩에는 그 옷장 소유가 아닌 옷을 넣을 수 없다', async () => {
    const { error } = await bob.client
      .from('outfit_items')
      .insert({ outfit_id: outfitId, garment_id: bobGarmentId })
    expect(error).not.toBeNull()
  })

  it('그 옷장 소유의 옷은 넣을 수 있다', async () => {
    const { error } = await bob.client
      .from('outfit_items')
      .insert({ outfit_id: outfitId, garment_id: aliceGarmentId })
    expect(error).toBeNull()
  })

  it('비공개 옷장으로는(자기 자신이 대상이어도) 룩을 만들 수 없다', async () => {
    // bob 본인은 공개로 전환한 적이 없으므로 is_wardrobe_public=false다.
    const { error } = await bob.client
      .from('outfits')
      .insert({ wardrobe_owner_id: bob.id, author_id: bob.id, title: '내 룩' })
    expect(error).not.toBeNull()
  })

  it('옷장 주인은 남이 만들어 준 룩을 삭제할 수 있다', async () => {
    const { data } = await alice.client.from('outfits').delete().eq('id', outfitId).select()
    expect(data?.length).toBe(1)
  })
})
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/rls.test.ts`
Expected: PASS (기존 12개 + 새 5개)

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0005_outfits.sql tests/rls.test.ts
git commit -m "feat: add outfits and outfit_items tables with rls"
```

---

### Task 5: 룩 만들기

공유 옷장 페이지에서 로그인한 방문자가 옷을 여러 개 골라 룩을 만든다.

**Files:**
- Create: `app/api/outfits/route.ts`
- Create: `components/OutfitBuilder.tsx`
- Modify: `app/u/[share_slug]/page.tsx`

**Interfaces:**
- Consumes: `outfits`, `outfit_items` (Task 4)
- Produces:
  - `POST /api/outfits` — 요청 `{ wardrobeOwnerId, title, description, garmentIds }`, 응답 `{ id: string }` 또는 `{ error }`
  - `<OutfitBuilder wardrobeOwnerId garments />`

- [ ] **Step 1: 룩 생성 API**

`app/api/outfits/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'

const Body = z.object({
  wardrobeOwnerId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  garmentIds: z.array(z.string().uuid()).min(1),
})

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }
  const input = parsed.data

  const { data: outfit, error: outfitError } = await supabase
    .from('outfits')
    .insert({
      wardrobe_owner_id: input.wardrobeOwnerId,
      author_id: user.id,
      title: input.title,
      description: input.description,
    })
    .select('id')
    .single()

  // RLS(outfits_insert)가 "대상 옷장이 공개 중"이 아니면 이 insert 자체를 막는다.
  if (outfitError || !outfit) {
    return NextResponse.json({ error: '룩을 만들지 못했습니다.' }, { status: 500 })
  }

  const rows = input.garmentIds.map((garmentId) => ({ outfit_id: outfit.id, garment_id: garmentId }))
  const { error: itemsError } = await supabase.from('outfit_items').insert(rows)

  if (itemsError) {
    // outfit_items RLS(그 옷장 소유 검증)에 걸리면 빈 룩만 남는다 — 정리하고 에러로 알린다.
    await supabase.from('outfits').delete().eq('id', outfit.id)
    return NextResponse.json({ error: '선택한 옷 중 이 옷장 소유가 아닌 항목이 있습니다.' }, { status: 400 })
  }

  return NextResponse.json({ id: outfit.id }, { status: 201 })
}
```

- [ ] **Step 2: 룩 빌더 컴포넌트**

`components/OutfitBuilder.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

type BuilderGarment = { id: string; name: string; image_url: string | null }

type Props = {
  wardrobeOwnerId: string
  garments: BuilderGarment[]
}

export function OutfitBuilder({ wardrobeOwnerId, garments }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const response = await fetch('/api/outfits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wardrobeOwnerId,
        title: title.trim(),
        description: description.trim() || null,
        garmentIds: selected,
      }),
    })
    setSubmitting(false)

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? '룩을 만들지 못했습니다.')
      return
    }
    setDone(true)
    setTitle('')
    setDescription('')
    setSelected([])
    router.refresh()
  }

  if (garments.length === 0) {
    return <p className="text-sm text-gray-500">옷장에 옷이 없어 룩을 만들 수 없습니다.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border p-5">
      <input value={title} onChange={(e) => setTitle(e.target.value)} required
        placeholder="룩 제목" className="w-full rounded border px-3 py-2" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="설명 (선택)" rows={2} className="w-full rounded border px-3 py-2" />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {garments.map((garment) => (
          <label
            key={garment.id}
            className={`relative aspect-[3/4] cursor-pointer overflow-hidden rounded-lg border-2 ${
              selected.includes(garment.id) ? 'border-black' : 'border-transparent'
            }`}
          >
            <input type="checkbox" checked={selected.includes(garment.id)} onChange={() => toggle(garment.id)}
              className="sr-only" />
            <div className="relative h-full w-full bg-gray-100">
              {garment.image_url && (
                <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="150px" />
              )}
            </div>
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">룩을 만들었습니다!</p>}

      <button type="submit" disabled={submitting || selected.length === 0}
        className="w-full rounded-lg bg-black py-3 text-white disabled:bg-gray-300">
        {submitting ? '만드는 중…' : `룩 만들기 (${selected.length}벌 선택)`}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: 공유 옷장 페이지에 연결**

`app/u/[share_slug]/page.tsx`의 `RecommendLinkBar` 섹션 다음에 추가한다:

```tsx
import { OutfitBuilder } from '@/components/OutfitBuilder'

// ... 추천하기 섹션 다음 ...

      {user && user.id !== profile.id && (
        <section className="space-y-3 border-t pt-6">
          <h2 className="text-lg font-semibold">룩 만들기</h2>
          <OutfitBuilder wardrobeOwnerId={profile.id} garments={garments ?? []} />
        </section>
      )}
```

(`garments`는 이 페이지가 이미 조회해둔 목록을 그대로 재사용한다 — 카테고리 필터가 걸려 있으면 필터된 목록만 룩 빌더에 보인다는 뜻이다. 지금 범위에서는 자연스러운 동작으로 두고, 필터와 무관하게 전체 옷장을 보여주고 싶다면 이후 별도 쿼리로 분리한다.)

- [ ] **Step 4: 수동 검증**

`npm run dev` → B 계정으로 A의 공유 옷장 페이지에서 옷 2~3벌을 선택하고 제목을 넣어 "룩 만들기" → "룩을 만들었습니다!" 확인. Supabase에서 `outfits`에 행이 생기고 `outfit_items`에 선택한 만큼 행이 쌓였는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add app/api/outfits components/OutfitBuilder.tsx app/u/[share_slug]/page.tsx
git commit -m "feat: let visitors build outfits from a shared wardrobe"
```

---

### Task 6: 룩 목록

`/looks`에서 내 옷장을 위해 만들어진 룩을 제작자와 함께 본다.

**Files:**
- Create: `app/looks/page.tsx`

**Interfaces:**
- Consumes: `outfits`, `outfit_items` (Task 4)
- Produces: `/looks` 화면

- [ ] **Step 1: 룩 목록 페이지**

`app/looks/page.tsx`:

```tsx
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'

type LookGarment = { id: string; name: string; image_url: string | null }

type LookRow = {
  id: string
  title: string
  description: string | null
  author: { nickname: string | null } | null
  outfit_items: { garments: LookGarment | null }[]
}

export default async function LooksPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // profiles를 참조하는 외래키가 outfits에 두 개(wardrobe_owner_id, author_id)라
  // PostgREST 임베딩에 어떤 컬럼을 쓸지 !author_id로 명시해야 한다.
  const { data: outfits } = await supabase
    .from('outfits')
    .select('id, title, description, author:profiles!author_id(nickname), outfit_items(garments(id, name, image_url))')
    .eq('wardrobe_owner_id', user.id)
    .order('created_at', { ascending: false })
    .overrideTypes<LookRow[], { merge: false }>()

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">나를 위한 룩</h1>

      {!outfits || outfits.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-gray-500">
          아직 만들어진 룩이 없습니다. 옷장을 공유하면 친구가 룩을 만들어 줄 수 있어요.
        </p>
      ) : (
        <div className="space-y-4">
          {outfits.map((outfit) => (
            <article key={outfit.id} className="rounded-xl border p-4">
              <p className="text-xs text-gray-500">{outfit.author?.nickname ?? '알 수 없음'}님이 만듦</p>
              <h2 className="text-lg font-semibold">{outfit.title}</h2>
              {outfit.description && <p className="text-sm text-gray-600">{outfit.description}</p>}
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {outfit.outfit_items.map((item) => item.garments && (
                  <div key={item.garments.id} className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {item.garments.image_url && (
                      <Image src={item.garments.image_url} alt={item.garments.name} fill className="object-cover" sizes="80px" />
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: 전체 테스트·빌드**

Run: `npm test && npm run build`
Expected: 전체 PASS.

- [ ] **Step 3: 수동 검증**

`npm run dev` → 로그인 계정으로 `/looks` 접속 → Task 5에서 만든 룩이 제작자 닉네임·제목·설명·옷 썸네일과 함께 보이는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add app/looks
git commit -m "feat: add looks list for wardrobe owner"
```

---

### Task 7: 공유 링크 OG 이미지

메신저에 공유 링크를 붙였을 때 미리보기 썸네일이 뜨게 한다.

**Files:**
- Create: `app/u/[share_slug]/opengraph-image.tsx`
- Modify: `app/u/[share_slug]/page.tsx` (`generateMetadata` 추가)

**Interfaces:**
- Consumes: `createServerSupabase`
- Produces: `/u/:share_slug` 경로의 OG 이미지·메타데이터

- [ ] **Step 1: 동적 OG 이미지**

`app/u/[share_slug]/opengraph-image.tsx`. `next/og`의 `ImageResponse`를 쓴다 — 정확한 함수 시그니처는 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`에서 확인했다(`params`는 `Promise`로 받는다):

```tsx
import { ImageResponse } from 'next/og'
import { createServerSupabase } from '@/lib/supabase/server'

export const alt = '살까 말까 - 공유 옷장'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ share_slug: string }> }) {
  const { share_slug } = await params
  const supabase = await createServerSupabase()
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('share_slug', share_slug)
    .single()

  const nickname = profile?.nickname ?? '누군가'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#111827', color: 'white',
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700 }}>{nickname}님의 옷장</div>
        <div style={{ fontSize: 28, marginTop: 20, color: '#9ca3af' }}>살까 말까</div>
      </div>
    ),
    { ...size },
  )
}
```

- [ ] **Step 2: 페이지 메타데이터**

`app/u/[share_slug]/page.tsx`에 `generateMetadata`를 추가한다(파일 상단, `SharedWardrobePage` 앞):

```tsx
import type { Metadata } from 'next'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { share_slug } = await params
  const supabase = await createServerSupabase()
  const { data: profile } = await supabase.from('profiles').select('nickname').eq('share_slug', share_slug).single()
  const nickname = profile?.nickname ?? '사용자'

  return {
    title: `${nickname}님의 옷장 - 살까 말까`,
    description: `${nickname}님이 공유한 옷장을 구경해보세요.`,
  }
}
```

- [ ] **Step 3: 수동 검증**

`npm run dev` 후 `http://localhost:3000/u/{share_slug}/opengraph-image`로 직접 접속해 이미지가 렌더링되는지 확인한다. 브라우저 개발자도구에서 `/u/{share_slug}` 페이지의 `<head>`에 `og:image`, `og:title` 메타 태그가 채워지는지 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add app/u/[share_slug]/opengraph-image.tsx app/u/[share_slug]/page.tsx
git commit -m "feat: generate dynamic og image for shared wardrobe links"
```

---

### Task 8: 로딩 상태와 최종 마감

주요 라우트에 로딩 UI를 추가하고, 계획 3(스펙 Phase 6~8, 즉 스펙 전 범위)을 README에 기록해 마무리한다.

**Files:**
- Create: `app/wardrobe/loading.tsx`
- Create: `app/cart/loading.tsx`
- Create: `app/analyze/loading.tsx`
- Create: `app/u/[share_slug]/loading.tsx`
- Create: `app/looks/loading.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: 없음 (Next.js의 `loading.js` 파일 컨벤션 — 파라미터를 받지 않는다. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` 참고)
- Produces: 각 라우트의 Suspense 로딩 UI

- [ ] **Step 1: 로딩 UI 5개 작성**

각 페이지의 `<main>` 래퍼와 같은 `max-w-*`를 써서 로딩 중에도 레이아웃이 크게 안 튀게 한다.

`app/wardrobe/loading.tsx`:

```tsx
export default function Loading() {
  return <main className="mx-auto max-w-4xl px-4 py-8 text-sm text-gray-400">불러오는 중…</main>
}
```

`app/cart/loading.tsx`, `app/analyze/loading.tsx`, `app/looks/loading.tsx`는 `max-w-2xl`로 동일한 패턴을 반복한다:

```tsx
export default function Loading() {
  return <main className="mx-auto max-w-2xl px-4 py-8 text-sm text-gray-400">불러오는 중…</main>
}
```

`app/u/[share_slug]/loading.tsx`는 `max-w-4xl`을 쓴다(공유 옷장 페이지와 동일):

```tsx
export default function Loading() {
  return <main className="mx-auto max-w-4xl px-4 py-8 text-sm text-gray-400">불러오는 중…</main>
}
```

- [ ] **Step 2: 전체 테스트·빌드**

Run: `npm test && npm run build`
Expected: 전체 PASS.

- [ ] **Step 3: 수동 검증**

`npm run dev` 후 네트워크를 느리게 시뮬레이션(브라우저 개발자도구 Network 탭 → Slow 3G)해서 `/wardrobe`, `/cart`, `/analyze`, `/looks`, `/u/{share_slug}` 이동 시 "불러오는 중…"이 잠깐 보이는지 확인한다.

- [ ] **Step 4: README 최종 기록**

CLAUDE.md 지시대로 Phase 단위 기록을 남긴다. 계획 1·2와 같은 형식(문제/원인/해결/검증/결과)으로, 이번 계획에서 실제로 겪은 문제(RLS 정책이 "본인 예외" 없이 문자 그대로 동작하는 걸 테스트로 확인한 것, PostgREST가 같은 테이블에 대한 이중 외래키를 임베딩할 때 `!column_name` 힌트가 필요했던 것, OG 이미지 특수 파일 시그니처를 문서로 재확인한 것 등)을 실제로 겪은 그대로 적는다 — 계획 1·2의 README 항목처럼 사전에 예측한 문제를 나열하지 말고, Task 1~7을 진행하며 실제로 부딪힌 것만 기록한다. 스펙 §14의 전 Phase(0~8)가 이걸로 끝나므로, "계획 3 완료" 항목 마지막에 스펙 전체 범위가 구현됐다는 점도 짧게 남긴다.

- [ ] **Step 5: 커밋**

```bash
git add app/wardrobe/loading.tsx app/cart/loading.tsx app/analyze/loading.tsx app/u/[share_slug]/loading.tsx app/looks/loading.tsx README.md
git commit -m "feat: add loading states and log final phase in README"
```

---

## 완료 기준

계획 3이 끝나면 다음이 모두 성립한다.

- [ ] `npm test`가 전부 통과한다 (기존 테스트 + `outfits`/`outfit_items` RLS 시나리오 포함)
- [ ] `npm run build`가 타입 오류 없이 성공한다
- [ ] 옷장을 공개로 켜면 공유 링크가 생기고, 끄면 `/u/[share_slug]`가 404가 된다
- [ ] 로그인한 다른 사용자가 공유 옷장에서 무신사 링크로 아이템을 추천하면 옷장 주인의 장바구니에 들어간다
- [ ] 친구는 공유 옷장에 `owned` 상태로는 아무것도 넣을 수 없다 (계획 1에서 이미 RLS로 검증됨, 이번엔 UI 흐름으로 확인)
- [ ] 로그인한 방문자가 공유 옷장의 옷을 여러 개 골라 룩을 만들 수 있고, 그 옷장 소유가 아닌 옷은 룩에 넣을 수 없다
- [ ] 룩을 받은 사람이 `/looks`에서 제작자와 함께 확인할 수 있다
- [ ] 공유 링크를 메신저 등에 붙였을 때 OG 썸네일이 뜬다
- [ ] 주요 라우트에 로딩 상태가 있다
- [ ] README에 계획 3(스펙 Phase 6~8) 완료 기록이 남아있고, 이걸로 스펙 §14의 전 Phase가 구현 완료된 상태다

## 다음 계획으로 넘기는 것

스펙에 정의된 범위는 이 계획으로 전부 끝난다. 이후 작업이 있다면 배포(Vercel), 실사용 피드백에 따른 조정, 또는 스펙 §3 "제외" 항목(카카오 로그인, 알림 등) 중 추가하고 싶은 것을 새 계획으로 시작한다.
