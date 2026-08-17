# 룩 페이지 자체 제작 + 선택삭제 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** `/looks`에서 옷장 주인이 스스로 룩을 만들 수 있게 하고(비공개 옷장이어도), 만들어진 룩을 장바구니처럼 체크박스로 선택 삭제·전체 삭제할 수 있게 한다.

**Architecture:** `outfits_insert` RLS를 고쳐 "본인 옷장이면 공개 여부와 무관하게 허용"으로 넓힌다. `/looks` 페이지에 기존 `OutfitBuilder`(계획 9, 친구 추천 흐름에서 이미 검증됨)를 그대로 재사용해 룩 만들기 폼을 추가한다. 룩 목록은 `/cart`의 `CartList`와 똑같은 체크박스+선택삭제/전체삭제 패턴을 따르는 새 `LooksList`로 바꾸고, 벌크 API 없이 새로 만드는 단건 `DELETE /api/outfits/[id]`를 병렬로 부른다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Supabase(Postgres/RLS)

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-17-self-serve-looks-design.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- TypeScript `strict: true`, `any` 금지. `npm run build`가 타입 에러 0개로 통과해야 한다.
- `OutfitBuilder`·`POST /api/outfits`·`RecommendAndBuild`·`app/u/[share_slug]/page.tsx`(친구 추천 흐름)는 건드리지 않는다 — 두 경로가 같은 컴포넌트·같은 POST API를 공유하되 서로 간섭하지 않아야 한다.
- 벌크 삭제 API를 새로 만들지 않는다. `CartList`가 이미 확립한 "단건 DELETE를 병렬로 부른다" 패턴을 그대로 따른다.

### 마이그레이션 적용 방법에 대한 참고

계획 10부터 반복 확인된 사실: 이 프로젝트의 `npx supabase db push`는 계획 5의 마이그레이션이 CLI가 아니라 Supabase MCP의 `apply_migration` 도구로 적용된 이력 때문에 막혀 있다. 계획 10·11·15와 같은 방식대로 **Supabase MCP `apply_migration` 도구로 직접 적용**한다.

---

## Task 1: RLS 수정 — 비공개 옷장이어도 본인은 룩을 만들 수 있게

**Files:**
- Create: `supabase/migrations/0010_self_serve_looks.sql`
- Modify: `tests/rls.test.ts`

**Interfaces:**
- 변경 없음(테이블·컬럼 추가 없음, 정책만 교체).

- [ ] **Step 1: 마이그레이션 작성**

`supabase/migrations/0010_self_serve_looks.sql`:

```sql
-- 옷장 주인이 비공개 옷장이어도 자기 옷으로 룩을 만들 수 있게 한다(계획 16).
-- 기존 정책은 "대상 옷장이 공개 상태"를 예외 없이 요구해서, 비공개 옷장 주인이
-- 자기 옷으로 룩을 만들려 해도 막혔다 — 친구 추천 흐름(계획 9)만 상정하고 짠 정책이었다.
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

- [ ] **Step 2: 마이그레이션 적용**

Supabase MCP의 `apply_migration` 도구로 위 SQL을 이름 `self_serve_looks`로 그대로 적용한다.

- [ ] **Step 3: 기존 테스트를 뒤집고 회귀 테스트를 추가한다**

`tests/rls.test.ts`의 `describe('outfits', ...)` 블록 안, "비공개 옷장으로는(자기 자신이 대상이어도) 룩을 만들 수 없다" 테스트. **기존**:

```ts
  it('비공개 옷장으로는(자기 자신이 대상이어도) 룩을 만들 수 없다', async () => {
    // bob 본인은 공개로 전환한 적이 없으므로 is_wardrobe_public=false다.
    const { error } = await bob.client
      .from('outfits')
      .insert({ wardrobe_owner_id: bob.id, author_id: bob.id, title: '내 룩' })
    expect(error).not.toBeNull()
  })
```

**변경**(이번 계획으로 동작이 정반대가 됐으므로 테스트 이름과 기대값을 뒤집고, 그 아래에 회귀 테스트를 하나 추가한다):

```ts
  it('비공개 옷장이어도 본인은 자기 옷으로 룩을 만들 수 있다', async () => {
    // bob 본인은 공개로 전환한 적이 없으므로 is_wardrobe_public=false다 — 그래도 본인 옷장이면 허용돼야 한다.
    const { error } = await bob.client
      .from('outfits')
      .insert({ wardrobe_owner_id: bob.id, author_id: bob.id, title: '내 룩' })
    expect(error).toBeNull()
  })

  it('다른 사람은 남의 비공개 옷장으로 룩을 만들 수 없다', async () => {
    // bob의 옷장은 여전히 비공개다 — alice가 bob 대신 룩을 만들려 하면 막혀야 한다.
    const { error } = await alice.client
      .from('outfits')
      .insert({ wardrobe_owner_id: bob.id, author_id: alice.id, title: '침입 시도' })
    expect(error).not.toBeNull()
  })
```

- [ ] **Step 4: 테스트 실행**

```bash
npm test -- tests/rls.test.ts
```

Expected: 전부 통과(수정한 테스트 포함, 총 개수 1개 늘어남).

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0010_self_serve_looks.sql tests/rls.test.ts
git commit -m "fix: allow wardrobe owners to build looks from private wardrobes"
git push
```

---

## Task 2: `DELETE /api/outfits/[id]`

**Files:**
- Create: `app/api/outfits/[id]/route.ts`

**Interfaces:**
- Produces: `DELETE /api/outfits/{id}` — 성공 시 `{ ok: true }`, 실패 시 `{ error: string }`.

- [ ] **Step 1: 라우트를 만든다**

`app/api/garments/[id]/route.ts`의 기존 `DELETE` 핸들러와 정확히 같은 구조다(`garments` 대신 `outfits`). 전체:

```ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { id } = await params
  // outfits_delete RLS(author_id = 나 또는 wardrobe_owner_id = 나)가 소유자를 검증한다.
  // outfit_items는 outfits(id) on delete cascade라 별도 정리가 필요 없다.
  const { error, count } = await supabase
    .from('outfits')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: '삭제하지 못했습니다.' }, { status: 500 })
  if (!count) return NextResponse.json({ error: '룩을 찾을 수 없습니다.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: 빌드로 확인**

```bash
npm run build
```

Expected: 타입 에러 0개. `/api/outfits/[id]` 라우트가 목록에 나온다.

- [ ] **Step 3: 커밋**

```bash
git add "app/api/outfits/[id]/route.ts"
git commit -m "feat: add outfit delete endpoint"
git push
```

---

## Task 3: `/looks` — 자체 제작 폼 + 선택삭제 목록

**Files:**
- Create: `components/share/LooksList.tsx`
- Modify: `app/(app)/looks/page.tsx`

**Interfaces:**
- Consumes: `OutfitBuilder`·`BuilderGarment`(`@/components/share/OutfitBuilder`) — 계획 9부터 존재, 변경 없음.
- Produces: `LooksList({ looks: Look[] })`, `Look = { id, title, description, authorNickname, garments }`.

- [ ] **Step 1: `LooksList.tsx`를 만든다**

`components/share/LooksList.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { CARD_SURFACE } from '@/components/ui/styles'

type LookGarment = { id: string; name: string; image_url: string | null }

export type Look = {
  id: string
  title: string
  description: string | null
  authorNickname: string | null
  garments: LookGarment[]
}

type Props = { looks: Look[] }

/**
 * 룩 목록 + 선택/전체 삭제. /cart의 CartList(계획 7)와 정확히 같은 패턴이다(계획 16) —
 * RLS(outfits_delete)가 이미 소유자를 검증하므로 벌크 삭제 API 없이 단건 DELETE를 병렬로 부른다.
 * 친구가 만들어준 룩도 옷장 주인이면 지울 수 있다(outfits_delete: author든 wardrobe_owner든 허용).
 */
export function LooksList({ looks }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState<'selected' | 'all' | null>(null)
  const [deleting, setDeleting] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const targetIds = confirming === 'all' ? looks.map((look) => look.id) : [...selected]

  async function handleDelete() {
    setDeleting(true)
    await Promise.all(targetIds.map((id) => fetch(`/api/outfits/${id}`, { method: 'DELETE' })))
    setDeleting(false)
    setConfirming(null)
    setSelected(new Set())
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
          <span>
            {confirming === 'all' ? `전체 ${looks.length}개를` : `선택한 ${selected.size}개를`} 삭제할까요?
          </span>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? '삭제 중…' : '삭제'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(null)} disabled={deleting}>
            취소
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-ink-muted">
            {selected.size > 0 ? `${selected.size}개 선택됨` : `${looks.length}개`}
          </span>
          <div className="flex gap-2">
            {selected.size > 0 && (
              <Button variant="danger" onClick={() => setConfirming('selected')} className="gap-1.5">
                <Trash size={16} weight="bold" />
                선택 삭제
              </Button>
            )}
            <Button variant="secondary" onClick={() => setConfirming('all')} className="gap-1.5">
              <Trash size={16} weight="bold" />
              전체 삭제
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {looks.map((look) => (
          <article key={look.id} className={`${CARD_SURFACE} flex gap-3 p-4`}>
            <input
              type="checkbox"
              checked={selected.has(look.id)}
              onChange={() => toggle(look.id)}
              aria-label={`${look.title} 선택`}
              className="mt-1 h-4 w-4 shrink-0 accent-accent"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-muted">{look.authorNickname ?? '알 수 없음'}님이 만듦</p>
              <h2 className="text-lg font-medium text-ink">{look.title}</h2>
              {look.description && <p className="text-sm text-ink-muted">{look.description}</p>}
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {look.garments.map((garment) => (
                  <div key={garment.id} className="relative h-24 w-20 shrink-0 overflow-hidden rounded-btn bg-canvas">
                    {garment.image_url && (
                      <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="80px" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `/looks` 페이지를 고친다**

`app/(app)/looks/page.tsx` 전체. **기존**:

```tsx
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { CARD_SURFACE } from '@/components/ui/styles'

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
      <h1 className="text-2xl font-medium tracking-tight text-ink">나를 위한 룩</h1>

      {!outfits || outfits.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-10 text-center text-sm text-ink-muted">
          아직 만들어진 룩이 없습니다. 옷장을 공유하면 친구가 룩을 만들어 줄 수 있어요.
        </p>
      ) : (
        <div className="space-y-4">
          {outfits.map((outfit) => (
            <article key={outfit.id} className={`${CARD_SURFACE} p-4`}>
              <p className="text-xs text-ink-muted">{outfit.author?.nickname ?? '알 수 없음'}님이 만듦</p>
              <h2 className="text-lg font-medium text-ink">{outfit.title}</h2>
              {outfit.description && <p className="text-sm text-ink-muted">{outfit.description}</p>}
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {outfit.outfit_items.map((item) => item.garments && (
                  <div key={item.garments.id} className="relative h-24 w-20 shrink-0 overflow-hidden rounded-btn bg-canvas">
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

**변경**:

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { OutfitBuilder, type BuilderGarment } from '@/components/share/OutfitBuilder'
import { LooksList, type Look } from '@/components/share/LooksList'

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

  const { data: garments } = await supabase
    .from('garments')
    .select('id, name, image_url')
    .eq('owner_id', user.id)
    .eq('status', 'owned')
    .order('created_at', { ascending: false })
    .overrideTypes<BuilderGarment[], { merge: false }>()

  // profiles를 참조하는 외래키가 outfits에 두 개(wardrobe_owner_id, author_id)라
  // PostgREST 임베딩에 어떤 컬럼을 쓸지 !author_id로 명시해야 한다.
  const { data: outfits } = await supabase
    .from('outfits')
    .select('id, title, description, author:profiles!author_id(nickname), outfit_items(garments(id, name, image_url))')
    .eq('wardrobe_owner_id', user.id)
    .order('created_at', { ascending: false })
    .overrideTypes<LookRow[], { merge: false }>()

  const looks: Look[] = (outfits ?? []).map((outfit) => ({
    id: outfit.id,
    title: outfit.title,
    description: outfit.description,
    authorNickname: outfit.author?.nickname ?? null,
    garments: outfit.outfit_items
      .map((item) => item.garments)
      .filter((g): g is LookGarment => g !== null),
  }))

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight text-ink">나를 위한 룩</h1>

      <OutfitBuilder wardrobeOwnerId={user.id} garments={garments ?? []} />

      {looks.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-10 text-center text-sm text-ink-muted">
          아직 만들어진 룩이 없습니다. 위에서 옷을 골라 첫 룩을 만들어보세요.
        </p>
      ) : (
        <LooksList looks={looks} />
      )}
    </main>
  )
}
```

- [ ] **Step 3: 빌드로 확인**

```bash
npm run build
```

Expected: 타입 에러 0개.

- [ ] **Step 4: 브라우저로 확인**

1. 옷장을 비공개로 둔 채(또는 공개든 상관없이 — 이제 본인 옷장이면 둘 다 되어야 한다) `/looks`에 들어가 "룩 만들기" 폼이 뜨는지 확인한다.
2. 옷 2~3벌을 골라 제목을 넣고 "룩 만들기"를 눌러, 성공 메시지가 뜨고 아래 목록에 방금 만든 룩이 나타나는지 확인한다.
3. DB에서 `select wardrobe_owner_id, author_id from outfits order by created_at desc limit 1;`로 두 값이 모두 본인 uid인지 확인한다.
4. 체크박스로 하나를 선택해 "선택 삭제"가 뜨는지, 눌러서 확인 문구가 뜨고 실제로 삭제되는지 확인한다.
5. 룩을 하나 더 만든 뒤 "전체 삭제"로 목록이 완전히 비고 빈 상태 문구("위에서 옷을 골라 첫 룩을 만들어보세요")가 뜨는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add components/share/LooksList.tsx "app/(app)/looks/page.tsx"
git commit -m "feat: let wardrobe owners build and manage their own looks"
git push
```

---

## Task 4: README 기록

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 맨 끝에 "계획 16 — 룩 페이지 자체 제작 + 선택삭제" 절을 추가한다**

기존 절들과 같은 형식으로 쓴다. 이 계획이 랜딩페이지(4번) 문구를 검토하다가 발견된 것이라는 맥락을 남기고, 최소한 아래는 근거와 함께 남길 가치가 있다:

- **`outfits_insert` RLS의 사각지대를 발견한 경위** — 랜딩페이지 카피를 검토하다가 사용자가 "자기 자신은 룩을 못 만들지 않냐"고 지적해서 코드를 다시 봤고, `app/api/outfits/route.ts`의 주석에 이미 "RLS가 대상 옷장 공개 여부를 막는다"는 사실이 적혀 있었다는 걸 확인했다.
- **`OutfitBuilder`를 그대로 재사용한 이유** — 계획 9에서 "친구"를 전제하는 로직이 하드코딩되지 않도록 이미 순수하게 짜여 있었다. `wardrobeOwnerId`만 본인으로 넘기면 그대로 동작해 새 컴포넌트가 필요 없었다.
- **벌크 삭제 API 대신 단건 DELETE 병렬 호출을 그대로 재사용한 이유** — `CartList`(계획 7)가 이미 "RLS가 요청마다 소유자를 검증하고, 개인 규모에서 요청 수가 문제 될 일이 없다"는 근거로 이 패턴을 확립해뒀다. 똑같은 근거가 룩 목록에도 그대로 적용된다.
- 이번 계획을 실행하며 실제로 겪은 문제만 추가로 적는다(예상한 문제를 미리 적지 않는다). 문제가 없었다면 없었다고 쓴다.

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: log self-serve looks work"
git push
```

---

## 남은 일 (이 계획 밖)

랜딩페이지(4번)로 돌아간다 — "가진 옷을 조합해 룩 만들기" 문구가 이제 실제로 맞는 말이 됐으니 그대로 쓰거나 다듬고, "핏 판단 엄격도" 항목은 뺀다(사용자 확인). 그 뒤 5번(README 재구성)이 남는다.
