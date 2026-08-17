# 비로그인 랜딩페이지 확장 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** 비로그인 랜딩페이지(`/`)에 3단계 이용 가이드와 부가 기능 소개를 추가한다. 레이아웃·카피는 브라우저 목업으로 이미 확정됐다.

**Architecture:** `app/page.tsx` 한 파일에 정적 마크업만 추가한다. 새 컴포넌트·새 API·새 데이터 로직이 없다. 콘텐츠가 늘어나면서 기존의 "뷰포트 전체를 채우고 세로 가운데 정렬"하던 레이아웃을 위에서부터 자연스럽게 흐르는 레이아웃으로 바꾼다(다른 페이지들이 이미 쓰는 `space-y-*` 컨테이너 패턴과 동일).

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-17-landing-page-design.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- TypeScript `strict: true`, `any` 금지. `npm run build`가 타입 에러 0개로 통과해야 한다.
- 카피는 스펙에 확정된 문구를 그대로 쓴다(브라우저 목업으로 이미 사용자 승인됨) — 임의로 다듬지 않는다.
- 새 컴포넌트·새 데이터 파일을 만들지 않는다. `app/page.tsx` 안에 상수 배열로 둔다.

---

## Task 1: 랜딩페이지에 가이드·기능 소개 추가

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- 변경 없음(페이지 컴포넌트, 새 export 없음).

- [ ] **Step 1: `app/page.tsx`를 고친다**

전체 파일. **기존**:

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { LoginButton } from '@/components/account/LoginButton'

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/wardrobe')

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col justify-center gap-6 px-6">
      <p className="text-sm text-ink-muted">무신사 링크 하나로 시작하는 옷장</p>
      <h1 className="text-4xl font-medium tracking-tight text-ink sm:text-5xl">살까 말까</h1>
      <p className="max-w-[46ch] leading-relaxed text-ink-muted">
        가진 옷을 옷장에 모아두면, 새로 사려는 옷이 내 사이즈와 스타일에 맞는지 알려드립니다.
      </p>
      <div>
        <LoginButton />
      </div>
    </main>
  )
}
```

**변경**:

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { LoginButton } from '@/components/account/LoginButton'

// MIN_OWNED_GARMENTS_FOR_FIT(lib/fit/rules.ts)와 정확히 일치하는 값이다 — 과장 없는 카피를 위해
// 실제 규칙에서 가져왔다. 규칙이 바뀌면 이 문구도 같이 확인해야 한다.
const GUIDE_STEPS = [
  { title: '무신사 링크로 옷장에 옷을 등록하세요', description: '실측·사이즈가 자동으로 채워집니다' },
  { title: '별점으로 선호도를 남기세요', description: '같은 카테고리 옷 3벌 이상이면 더 정확해져요' },
  { title: '사려는 옷 링크를 넣어 판단받으세요', description: '사이즈·스타일이 맞는지 바로 알려드립니다' },
] as const

const EXTRA_FEATURES = [
  '옷장을 친구에게 공유하고 추천받기',
  '가진 옷을 조합해 나만의 룩 만들기',
  '담아둔 옷 가격이 내리면 확인하기',
] as const

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/wardrobe')

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-6 py-16">
      <div className="space-y-6">
        <p className="text-sm text-ink-muted">무신사 링크 하나로 시작하는 옷장</p>
        <h1 className="text-4xl font-medium tracking-tight text-ink sm:text-5xl">살까 말까</h1>
        <p className="max-w-[46ch] leading-relaxed text-ink-muted">
          가진 옷을 옷장에 모아두면, 새로 사려는 옷이 내 사이즈와 스타일에 맞는지 알려드립니다.
        </p>
        <div>
          <LoginButton />
        </div>
      </div>

      <ol className="space-y-4">
        {GUIDE_STEPS.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-semibold text-ink">
              {index + 1}
            </span>
            <div>
              <p className="font-medium text-ink">{step.title}</p>
              <p className="text-sm text-ink-muted">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="space-y-2 border-t border-border pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">이런 것도 할 수 있어요</p>
        <ul className="space-y-1.5 text-sm text-ink-muted">
          {EXTRA_FEATURES.map((feature) => (
            <li key={feature}>· {feature}</li>
          ))}
        </ul>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: 빌드로 확인**

```bash
npm run build
```

Expected: 타입 에러 0개.

- [ ] **Step 3: 브라우저로 확인**

1. 로그아웃 상태(또는 시크릿 창)로 `/`에 접속해 히어로 → 3단계 가이드 → "이런 것도 할 수 있어요" 목록이 순서대로 뜨는지 확인한다.
2. 화면을 좁혀(모바일 폭) 줄바꿈이 자연스러운지 확인한다.
3. `/mypage`에서 다크로 바꾼 뒤(계획 15) 다시 `/`에 접속해 — 비로그인 상태라 다크 설정은 적용 안 되는 게 맞지만, OS 자체가 다크라면 시스템 추종으로 다크가 뜨는 게 맞는지 확인한다. 라이트/다크 양쪽에서 텍스트 대비가 읽기 편한지 확인한다.
4. 로그인 상태로 `/`에 접속하면 여전히 `/wardrobe`로 즉시 리다이렉트되는지(기존 동작 회귀 없음) 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add app/page.tsx
git commit -m "feat: add guide and feature overview to landing page"
git push
```

---

## Task 2: README 기록

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 맨 끝에 "계획 17 — 비로그인 랜딩페이지 확장" 절을 추가한다**

기존 절들과 같은 형식으로 쓰되, 이번 건은 새 로직이 없는 정적 마크업 추가라 짧게 쓴다. 최소한 아래는 근거와 함께 남길 가치가 있다:

- **레이아웃을 "뷰포트 세로 가운데 정렬"에서 "위에서부터 자연스러운 흐름"으로 바꾼 이유** — 콘텐츠가 히어로 한 덩어리에서 가이드·기능 소개까지 늘어나면서, 전체를 뷰포트 높이에 강제로 가운데 정렬하면 화면이 좁을 때 위쪽이 잘려 보이는 문제가 있었다. 다른 페이지들이 이미 쓰던 `space-y-*` 컨테이너 패턴으로 통일했다.
- **"3벌 이상" 문구가 실제 규칙과 일치하는지 확인한 것** — `lib/fit/rules.ts`의 `MIN_OWNED_GARMENTS_FOR_FIT = 3`을 직접 확인하고 카피에 반영했다. 마케팅 문구가 실제 동작과 어긋나지 않게 하려는 목적이었다.
- 이번 계획을 실행하며 실제로 겪은 문제만 추가로 적는다(예상한 문제를 미리 적지 않는다). 문제가 없었다면 없었다고 쓴다. 이 계획이 브레인스토밍 도중 계획 16(룩 자체 제작)을 먼저 끼워 넣게 된 계기였다는 맥락도 남긴다.

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: log landing page work"
git push
```

---

## 남은 일 (이 계획 밖)

사용자가 제안한 6개 중 5번(README 재구성)이 남는다. 이 계획이 끝나면 6→1→3→2→(7)→4까지 전부 끝난다.
