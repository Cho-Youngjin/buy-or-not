# 네비게이션 & 디자인 시스템 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** 모든 화면을 공통 네비게이션으로 연결하고, 웜톤 디자인 토큰과 공통 UI 프리미티브로 전 화면의 시각적 톤을 통일한다.

**Architecture:** `app/(app)/` 라우트 그룹의 레이아웃이 PC 헤더(`md:` 이상)와 모바일 하단 탭바(`md:` 미만)를 공통 렌더링한다. 네비게이션 데이터와 활성 경로 판정은 React에 의존하지 않는 순수 모듈(`lib/nav.ts`)로 분리해 node 환경에서 단위 테스트한다. 색상·모서리·입력칸 스타일은 Tailwind v4 `@theme` 토큰과 `components/ui/`의 프리미티브로 한 곳에 모으고, 기존 화면의 하드코딩된 `bg-black`/`text-gray-*` 클래스를 전부 그 토큰으로 치환한다.

**Tech Stack:** Next.js 16 App Router · TypeScript strict · Tailwind CSS v4 (CSS-first `@theme`) · `@phosphor-icons/react` v2 · Supabase Auth · Vitest (node 환경)

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-16-nav-and-design-system.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- TypeScript `strict: true`, `any` 금지. `npm run build`가 타입 에러 0개로 통과해야 한다.
- 사용자에게 하는 설명·요약·질문, 그리고 UI 문구는 한국어로 쓴다.
- 기능 단위마다 그 코드가 무엇을 하고 왜 그렇게 짰는지 설명하는 주석을 남긴다 (이 프로젝트의 학습 목적 예외 규칙).
- 태스크마다 커밋하고 push한다. 여러 태스크를 한 커밋에 몰아넣지 않는다.
- 커밋 메시지에 `Co-Authored-By: Claude` 등 AI 기여자 트레일러를 넣지 않는다.
- 이모지 금지 — 아이콘은 `@phosphor-icons/react`를 쓴다.
- 순검정(`#000000`) 금지. 색은 아래 토큰만 쓰고 새 색을 즉흥적으로 추가하지 않는다.
- 애니메이션 라이브러리(framer-motion 등)를 새로 도입하지 않는다. CSS transition만 쓴다.
- 화면의 구조·레이아웃 자체는 재설계하지 않는다. 색상·타이포·모서리·버튼/카드/입력칸 스타일만 통일한다.

### 이 계획의 테스트 전략 (TDD를 어디에 적용하는가)

이 프로젝트의 Vitest는 `environment: 'node'`, `include: ['tests/**/*.test.ts']`로 설정돼 있고 jsdom·React Testing Library가 없다. 컴포넌트 렌더링 테스트 인프라를 새로 깔면 이 계획의 범위를 크게 벗어나므로 도입하지 않는다.

따라서 검증은 이렇게 나눈다:

- **단위 테스트(TDD)**: 순수 로직 — `lib/nav.ts`의 `isActiveNav`. Task 2에서 red→green으로 진행한다.
- **빌드 검증**: `npm run build` — 타입 에러, 잘못된 import, 라우트 규약 위반을 잡는다. 모든 태스크에서 돌린다.
- **회귀 검증**: `npm test` — 기존 98개 테스트가 계속 통과해야 한다. UI 변경이므로 원칙적으로 영향이 없어야 하고, 깨지면 그 자체가 신호다.
- **수동 검증**: 태스크마다 "무엇을 열어 무엇을 확인하는지" 구체적으로 적어 두었다. 그대로 확인한다.

### 디자인 토큰 (Task 1에서 정의, 이후 전 태스크가 이것만 쓴다)

| 클래스 | 값 | 용도 |
|---|---|---|
| `bg-canvas` | `#f7f5f0` | 페이지 배경 |
| `bg-surface` | `#ffffff` | 카드·입력칸 배경 |
| `text-ink` | `#28261f` | 본문 |
| `text-ink-muted` | `#8a8677` | 보조 텍스트 |
| `border-border` | `#e4e0d6` | 헤어라인 |
| `bg-accent` / `text-accent` | `#c1502e` | 주요 CTA, 활성 탭 |
| `text-accent-ink` | `#ffffff` | accent 배경 위 텍스트 |
| `bg-danger` / `text-danger` | `#b3261e` | 삭제 등 파괴적 동작 |
| `rounded-btn` | `8px` | 버튼·입력칸 |
| `rounded-card` | `12px` | 카드 |

`VerdictBadge`의 살만함/주의/비추천 3색(green/amber/red)은 의미 전달용이라 위 "액센트 1개" 원칙의 명시적 예외다. Task 6에서 웜톤에 맞게 값만 조정하고 3색 구분은 유지한다.

---

## Task 1: 디자인 토큰 + 공통 UI 프리미티브 + 랜딩 페이지

토큰과 프리미티브를 정의하고, 첫 소비자인 랜딩 페이지에 적용해 눈으로 확인 가능한 상태로 만든다.

**Files:**
- Modify: `app/globals.css` (전체 교체)
- Create: `components/ui/Button.tsx`
- Create: `components/ui/styles.ts`
- Modify: `components/LoginButton.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `Button` 컴포넌트 — `props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }`
- Produces: `CARD_SURFACE: string`, `INPUT: string`, `pillClass(tone: PillTone): string`, `type PillTone = 'neutral' | 'active' | 'buy' | 'caution' | 'skip'`

- [ ] **Step 1: `app/globals.css`를 새 토큰으로 교체**

기존 파일은 `--background`/`--foreground`만 정의하고, `body`에 `font-family: Arial, Helvetica, sans-serif`를 걸어 두어 **레이아웃이 로드한 Geist 폰트를 덮어쓰고 있다** — 이것이 지금 UI가 밋밋한 원인 중 하나다. 아래로 전체 교체한다.

```css
@import "tailwindcss";

/*
 * 색·모서리 토큰. 값이 리터럴이므로 inline 없이 @theme에 둔다.
 * Tailwind v4는 --color-* 를 bg-*/text-*/border-* 로, --radius-* 를 rounded-* 로 자동 노출한다.
 * 새 색이 필요해 보이면 여기 추가하고, 컴포넌트에 하드코딩하지 않는다.
 */
@theme {
  --color-canvas: #f7f5f0;
  --color-surface: #ffffff;
  --color-ink: #28261f;
  --color-ink-muted: #8a8677;
  --color-border: #e4e0d6;
  --color-accent: #c1502e;
  --color-accent-ink: #ffffff;
  --color-danger: #b3261e;

  --radius-btn: 8px;
  --radius-card: 12px;
}

/*
 * 폰트는 next/font가 <html>에 심는 CSS 변수를 가리켜야 하므로 inline이 필요하다
 * (inline이 없으면 Tailwind가 var()를 한 겹 더 감싸 폰트 변수 해석이 어긋난다).
 */
@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--color-canvas);
  color: var(--color-ink);
  /* 기존 코드는 여기서 Arial을 강제해 레이아웃이 로드한 Geist를 무력화하고 있었다. */
  font-family: var(--font-geist-sans), system-ui, sans-serif;
}
```

다크모드 `@media (prefers-color-scheme: dark)` 블록은 삭제한다 (스펙 §3: 라이트 전용 웜톤으로 통일).

- [ ] **Step 2: `components/ui/styles.ts` 생성**

카드와 필(pill)은 루트 엘리먼트가 `Link`·`article`·`form`·`span`으로 제각각이라, 컴포넌트로 만들면 래퍼 `div`가 하나씩 더 생긴다. 그래서 컴포넌트가 아니라 클래스 문자열로 공유한다.

```ts
/**
 * 카드 표면 공통 클래스.
 * 컴포넌트가 아니라 클래스 상수인 이유: 카드의 루트가 Link(옷장 카드)·article(룩)·form(등록 폼)으로
 * 제각각이라, <Card> 컴포넌트로 만들면 의미 없는 래퍼 div가 한 겹씩 더 생긴다.
 * 그림자 대신 헤어라인 보더만 쓴다(스펙 §3).
 */
export const CARD_SURFACE = 'rounded-card border border-border bg-surface'

/**
 * 입력칸 공통 클래스. GarmentForm 한 파일에서만 같은 조합이 10번 넘게 반복되고 있었다.
 * read-only:는 파싱에 성공해 잠긴 필드를 시각적으로 구분한다(스펙의 "필드 단위 파싱 실패" 원칙).
 */
export const INPUT =
  'w-full rounded-btn border border-border bg-surface px-3 py-2 text-sm text-ink ' +
  'placeholder:text-ink-muted focus:border-accent focus:outline-none ' +
  'read-only:bg-canvas read-only:text-ink-muted'

export type PillTone = 'neutral' | 'active' | 'buy' | 'caution' | 'skip'

const PILL_TONES: Record<PillTone, string> = {
  neutral: 'border-border bg-surface text-ink-muted',
  active: 'border-accent bg-accent text-accent-ink',
  // buy/caution/skip은 판정을 색으로 구분해야 해서 "액센트 1개" 원칙의 예외다(계획 서두 참고).
  buy: 'border-transparent bg-[#e3ede1] text-[#2f5d3a]',
  caution: 'border-transparent bg-[#f4ebd8] text-[#8a6320]',
  skip: 'border-transparent bg-[#f5e0dd] text-[#8f2f26]',
}

/** 필 모양 배지/칩의 클래스를 만든다. 배지는 span, 카테고리 칩은 Link라 컴포넌트로 묶지 않았다. */
export function pillClass(tone: PillTone): string {
  return `inline-block rounded-full border px-3 py-1 text-sm transition ${PILL_TONES[tone]}`
}
```

- [ ] **Step 3: `components/ui/Button.tsx` 생성**

버튼은 루트가 항상 `<button>`이라 컴포넌트로 만들 수 있다. 훅을 쓰지 않으므로 `'use client'`가 필요 없고 서버·클라이언트 양쪽에서 쓸 수 있다.

```tsx
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

const BASE =
  'inline-flex items-center justify-center rounded-btn px-4 py-2 text-sm font-medium ' +
  'transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent/90',
  secondary: 'border border-border bg-surface text-ink hover:bg-canvas',
  danger: 'bg-danger text-white hover:opacity-90',
}

/**
 * 앱 전체가 공유하는 버튼.
 * 지금까지는 파일마다 bg-black / bg-gray-800 / bg-red-600을 따로 하드코딩해 눌림 피드백도 제각각이었다.
 * active:scale-[0.98]로 물리적으로 눌리는 느낌을 주고, disabled는 색을 바꾸는 대신 투명도를 낮춰
 * 어떤 variant에서도 같은 방식으로 동작하게 한다.
 */
export function Button({ variant = 'primary', className = '', ...props }: Props) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />
}
```

- [ ] **Step 4: `components/LoginButton.tsx`의 버튼을 교체**

`import { Button } from '@/components/ui/Button'`를 추가하고, 반환부를 아래로 바꾼다 (`signIn` 함수와 `'use client'`는 그대로 둔다).

```tsx
  return (
    <Button onClick={signIn} className="px-6 py-3">
      구글로 시작하기
    </Button>
  )
```

- [ ] **Step 5: `app/page.tsx` 랜딩 화면 정리**

구조는 그대로 두고 정렬과 타이포만 손본다. 가운데 정렬 대신 좌측 정렬 편집형 히어로로 바꾼다.

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { LoginButton } from '@/components/LoginButton'

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

`min-h-screen` 대신 `min-h-[100dvh]`를 쓴다 — 모바일 브라우저 주소창 때문에 `100vh`가 실제 화면보다 커져 레이아웃이 튀는 문제를 피한다.

- [ ] **Step 6: 빌드와 테스트 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 기존 테스트 전부 통과.

- [ ] **Step 7: 브라우저로 수동 확인**

`npm run dev` 후 로그아웃 상태로 `http://localhost:3000/` 접속. 확인할 것:
- 배경이 순백이 아니라 따뜻한 크림색(`#f7f5f0`)인지
- 글꼴이 Arial이 아니라 Geist인지 (자간이 좁고 `a`·`g` 모양이 다르다)
- "구글로 시작하기" 버튼이 검정이 아니라 테라코타(`#c1502e`)이고, 누르는 순간 살짝 작아지는지

- [ ] **Step 8: 커밋**

```bash
git add app/globals.css components/ui/Button.tsx components/ui/styles.ts components/LoginButton.tsx app/page.tsx
git commit -m "feat: add warm design tokens and shared ui primitives"
git push
```

---

## Task 2: 네비게이션 데이터와 활성 경로 판정 (TDD)

**Files:**
- Create: `lib/nav.ts`
- Test: `tests/nav.test.ts`

**Interfaces:**
- Produces: `NAV_ITEMS: readonly { href: string; label: string }[]`
- Produces: `isActiveNav(pathname: string, href: string): boolean`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

Create `tests/nav.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { NAV_ITEMS, isActiveNav } from '@/lib/nav'

describe('NAV_ITEMS', () => {
  it('스펙이 정한 5개 목적지를 순서대로 가진다', () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      '/wardrobe', '/analyze', '/cart', '/looks', '/mypage',
    ])
  })
})

describe('isActiveNav', () => {
  it('경로가 정확히 같으면 활성이다', () => {
    expect(isActiveNav('/wardrobe', '/wardrobe')).toBe(true)
  })

  it('하위 경로에서도 부모 탭이 활성이다 — 옷 상세에서 "옷장" 탭이 켜져 있어야 한다', () => {
    expect(isActiveNav('/wardrobe/abc-123', '/wardrobe')).toBe(true)
  })

  it('다른 목적지는 활성이 아니다', () => {
    expect(isActiveNav('/wardrobe', '/analyze')).toBe(false)
  })

  it('앞부분만 겹치는 다른 경로를 활성으로 오인하지 않는다', () => {
    // '/looksomething'.startsWith('/looks')는 true이므로 구분자 검사가 없으면 틀린다.
    expect(isActiveNav('/looksomething', '/looks')).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- tests/nav.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/nav"`

- [ ] **Step 3: `lib/nav.ts` 구현**

```ts
/**
 * 네비게이션 목적지 정의.
 * 아이콘 컴포넌트를 여기 두지 않는 이유: 이 파일은 node 환경 Vitest에서 그대로 import되는데
 * React 아이콘을 끌고 오면 테스트가 렌더러를 필요로 하게 된다. 아이콘 매핑은 탭바 컴포넌트가 갖는다.
 */
export const NAV_ITEMS = [
  { href: '/wardrobe', label: '옷장' },
  { href: '/analyze', label: '살까말까' },
  { href: '/cart', label: '장바구니' },
  { href: '/looks', label: '룩' },
  { href: '/mypage', label: '마이페이지' },
] as const satisfies readonly { href: string; label: string }[]

/**
 * 현재 경로가 해당 탭에 속하는지 판정한다.
 * 하위 경로(/wardrobe/[id])에서도 부모 탭이 켜져 있어야 하므로 startsWith를 쓰되,
 * '/looksomething'이 '/looks'를 켜 버리지 않도록 반드시 '/'까지 붙여 비교한다.
 */
export function isActiveNav(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `npm test -- tests/nav.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/nav.ts tests/nav.test.ts
git commit -m "feat: add navigation destinations and active path matching"
git push
```

---

## Task 3: 라우트 그룹 + 공통 헤더/탭바

인증 화면들을 `app/(app)/`로 옮기고 공통 네비게이션을 붙인다. 라우트 그룹은 URL에 나타나지 않으므로 기존 경로(`/wardrobe` 등)는 그대로 유지된다.

**Files:**
- Move: `app/wardrobe/` → `app/(app)/wardrobe/` (하위 `[id]/`, `loading.tsx` 포함)
- Move: `app/analyze/` → `app/(app)/analyze/`
- Move: `app/cart/` → `app/(app)/cart/`
- Move: `app/looks/` → `app/(app)/looks/`
- Create: `app/(app)/layout.tsx`
- Create: `components/nav/AppHeader.tsx`
- Create: `components/nav/MobileTabBar.tsx`

**Interfaces:**
- Consumes: `NAV_ITEMS`, `isActiveNav` (Task 2)
- Produces: `AppHeader`, `MobileTabBar` — 둘 다 props 없음

- [ ] **Step 1: `@phosphor-icons/react` 설치 확인**

```bash
npm ls @phosphor-icons/react
```

Expected: `@phosphor-icons/react@2.1.10` (계획 작성 중 이미 설치했다). 없으면 `npm install @phosphor-icons/react`.

쓸 아이콘 이름은 실제 패키지에서 존재를 확인해 둔 것들이다: `Coathanger`, `Scales`, `ShoppingBag`, `Sparkle`, `UserCircle`.

- [ ] **Step 2: 파일을 라우트 그룹으로 옮긴다**

`git mv`를 써서 이력을 보존한다.

```bash
mkdir -p "app/(app)"
git mv app/wardrobe "app/(app)/wardrobe"
git mv app/analyze "app/(app)/analyze"
git mv app/cart "app/(app)/cart"
git mv app/looks "app/(app)/looks"
```

`app/page.tsx`, `app/layout.tsx`, `app/auth/`, `app/u/`, `app/api/`는 옮기지 않는다 (스펙 §4.1).

- [ ] **Step 3: `components/nav/AppHeader.tsx` 생성**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isActiveNav } from '@/lib/nav'

/**
 * PC(md 이상) 전용 상단 헤더. 현재 경로를 알아야 활성 탭을 칠할 수 있어 클라이언트 컴포넌트다.
 * 모바일에서는 hidden이고, 대신 MobileTabBar가 화면 하단에 뜬다.
 */
export function AppHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-canvas/90 backdrop-blur md:block">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/wardrobe" className="text-base font-semibold tracking-tight text-ink">
          살까 말까
        </Link>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-btn px-3 py-1.5 text-sm transition ${
                isActiveNav(pathname, item.href)
                  ? 'font-medium text-accent'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: `components/nav/MobileTabBar.tsx` 생성**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Coathanger, Scales, ShoppingBag, Sparkle, UserCircle } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { NAV_ITEMS, isActiveNav } from '@/lib/nav'

/**
 * 아이콘 매핑을 lib/nav.ts가 아니라 여기 두는 이유는 lib/nav.ts의 주석 참고 —
 * 그 파일은 node 환경 테스트가 그대로 import하므로 React 의존을 넣지 않는다.
 */
const ICONS: Record<string, Icon> = {
  '/wardrobe': Coathanger,
  '/analyze': Scales,
  '/cart': ShoppingBag,
  '/looks': Sparkle,
  '/mypage': UserCircle,
}

/** 모바일(md 미만) 전용 하단 고정 탭바. PC에서는 hidden이고 AppHeader가 대신 뜬다. */
export function MobileTabBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-canvas/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg">
        {NAV_ITEMS.map((item) => {
          const active = isActiveNav(pathname, item.href)
          const IconComponent = ICONS[item.href]
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition ${
                active ? 'text-accent' : 'text-ink-muted'
              }`}
            >
              <IconComponent size={22} weight={active ? 'fill' : 'regular'} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 5: `app/(app)/layout.tsx` 생성**

```tsx
import { AppHeader } from '@/components/nav/AppHeader'
import { MobileTabBar } from '@/components/nav/MobileTabBar'

/**
 * 로그인한 사용자가 쓰는 화면들의 공통 껍데기.
 * 인증 검사는 여기서 하지 않는다 — 각 페이지가 이미 user를 직접 가져와 쿼리에 쓰고 리다이렉트하므로,
 * 레이아웃에서 한 번 더 getUser()를 부르면 화면마다 Auth 서버 왕복이 두 번씩 생긴다.
 *
 * props 타입에 Next가 생성하는 LayoutProps를 쓰지 않고 직접 적는다 — 라우트 그룹은 URL 세그먼트가
 * 없어 LayoutRoutes에 대응하는 키가 없기 때문이다.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {/* pb-20: 모바일에서 하단 탭바가 콘텐츠 마지막 줄을 가리지 않도록 띄운다. */}
      <div className="flex-1 pb-20 md:pb-0">{children}</div>
      <MobileTabBar />
    </>
  )
}
```

- [ ] **Step 6: 빌드와 테스트 확인**

```bash
npm run build
npm test
```

Expected: 빌드 통과. 빌드 로그의 라우트 목록에 `/wardrobe`, `/analyze`, `/cart`, `/looks`가 그대로(라우트 그룹 이름 없이) 나와야 한다.

`@phosphor-icons/react` import에서 서버 컴포넌트 관련 에러가 나면 `@phosphor-icons/react/ssr`로 바꾼다 (패키지가 두 진입점을 모두 제공한다). `MobileTabBar`는 `'use client'`이므로 기본 진입점으로 통과해야 정상이다.

- [ ] **Step 7: 브라우저로 수동 확인**

로그인 상태로 `http://localhost:3000/wardrobe` 접속.
- PC 폭: 상단에 "살까 말까" 로고와 5개 메뉴가 보이고, "옷장"만 테라코타로 강조되는지
- 각 메뉴를 눌러 `/analyze`, `/cart`, `/looks`로 실제 이동하는지, 이동할 때마다 강조가 따라오는지
- 옷을 하나 눌러 `/wardrobe/<id>`로 들어갔을 때도 "옷장" 탭이 여전히 강조돼 있는지 (Task 2의 하위 경로 판정)
- 브라우저 창을 좁히면(개발자도구 모바일 뷰) 상단 헤더가 사라지고 하단에 아이콘 5개 탭바가 뜨는지, 페이지 마지막 콘텐츠가 탭바에 가리지 않는지
- **"마이페이지"는 아직 404가 정상이다** — Task 4에서 만든다.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: add shared header and mobile tab bar via app route group"
git push
```

---

## Task 4: 마이페이지 + 로그아웃

**Files:**
- Create: `app/(app)/mypage/page.tsx`
- Create: `components/LogoutButton.tsx`
- Modify: `components/ShareToggle.tsx`
- Modify: `app/(app)/wardrobe/page.tsx` (ShareToggle 제거)
- Modify: `next.config.ts` (구글 아바타 호스트 추가)

**Interfaces:**
- Consumes: `Button` (Task 1), `CARD_SURFACE`, `pillClass` (Task 1)
- Produces: `LogoutButton` — props 없음

- [ ] **Step 1: `next.config.ts`에 구글 아바타 호스트를 추가**

`profiles.avatar_url`은 구글이 준 `https://lh3.googleusercontent.com/...` 주소다. `remotePatterns`에 없으면 `<Image />`가 런타임 에러를 낸다.

`remotePatterns` 배열의 마지막 항목 뒤에 아래 줄을 추가한다:

```ts
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
```

- [ ] **Step 2: `components/LogoutButton.tsx` 생성**

이 앱에는 지금까지 로그아웃 수단이 아예 없었다.

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

/**
 * 로그아웃. signOut()이 브라우저의 auth 쿠키를 지운 뒤,
 * router.refresh()로 서버 컴포넌트를 다시 그리게 해야 서버가 새 세션(=비로그인)을 보고 판단한다.
 * refresh 없이 push만 하면 캐시된 서버 렌더 결과 때문에 여전히 로그인 상태로 보일 수 있다.
 */
export function LogoutButton() {
  const router = useRouter()

  async function signOut() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <Button variant="secondary" onClick={signOut}>
      로그아웃
    </Button>
  )
}
```

- [ ] **Step 3: `components/ShareToggle.tsx`를 새 토큰으로 바꾼다**

`toggle`·`copyLink` 함수와 상태는 그대로 두고, import와 반환부만 아래로 교체한다.

파일 상단 import에 추가:

```tsx
import { Button } from '@/components/ui/Button'
import { pillClass } from '@/components/ui/styles'
```

반환부 교체:

```tsx
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={toggle} disabled={saving}
        className={`${pillClass(isPublic ? 'active' : 'neutral')} disabled:opacity-40`}>
        {isPublic ? '옷장 공개 중' : '옷장 비공개'}
      </button>
      {isPublic && (
        <Button variant="secondary" onClick={copyLink}>
          {copied ? '복사됨' : '공유 링크 복사'}
        </Button>
      )}
    </div>
  )
```

바깥 `rounded-lg border p-3`는 뺀다 — 마이페이지에서 카드 안에 들어가므로 테두리가 겹친다.

- [ ] **Step 4: `app/(app)/mypage/page.tsx` 생성**

```tsx
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { ShareToggle } from '@/components/ShareToggle'
import { LogoutButton } from '@/components/LogoutButton'
import { CARD_SURFACE } from '@/components/ui/styles'

/**
 * 마이페이지. 프로필·옷장 공유·설정 진입점·로그아웃을 한곳에 모은다.
 * 닉네임과 아바타는 Auth 메타데이터가 아니라 profiles에서 읽는다 —
 * 가입 시 handle_new_user() 트리거(마이그레이션 0003)가 이미 채워 두기 때문이다.
 */
export default async function MyPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, avatar_url, share_slug, is_wardrobe_public')
    .eq('id', user.id)
    .single()

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight text-ink">마이페이지</h1>

      <section className={`${CARD_SURFACE} flex items-center gap-4 p-5`}>
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-canvas">
          {profile?.avatar_url && (
            <Image src={profile.avatar_url} alt="" fill className="object-cover" sizes="56px" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{profile?.nickname ?? '사용자'}</p>
          <p className="truncate text-sm text-ink-muted">{user.email}</p>
        </div>
      </section>

      <section className={`${CARD_SURFACE} space-y-3 p-5`}>
        <h2 className="text-sm font-medium text-ink">옷장 공유</h2>
        <p className="text-sm text-ink-muted">
          공유를 켜면 링크를 받은 친구가 옷장을 구경하고 아이템이나 룩을 추천할 수 있습니다.
        </p>
        {profile && (
          <ShareToggle shareSlug={profile.share_slug} initialIsPublic={profile.is_wardrobe_public} />
        )}
      </section>

      {/* 2단계(핏 판단 설정)에서 실제 화면으로 교체한다. 지금은 존재만 알린다. */}
      <section className={`${CARD_SURFACE} flex items-center justify-between p-5`}>
        <div>
          <h2 className="text-sm font-medium text-ink">핏 판단 설정</h2>
          <p className="text-sm text-ink-muted">허용 편차 같은 수치를 직접 조정합니다.</p>
        </div>
        <span className="shrink-0 text-sm text-ink-muted">준비 중</span>
      </section>

      <LogoutButton />
    </main>
  )
}
```

- [ ] **Step 5: `app/(app)/wardrobe/page.tsx`에서 ShareToggle을 제거**

공유 토글은 이제 마이페이지에 있다. 아래를 지운다:

- `import { ShareToggle } from '@/components/ShareToggle'` 줄
- `profile`을 가져오는 `supabase.from('profiles')...single()` 쿼리 블록
- `{profile && <ShareToggle ... />}` 줄

- [ ] **Step 6: 빌드와 테스트 확인**

```bash
npm run build
npm test
```

Expected: 통과. `profile` 변수를 지운 뒤 미사용 import가 남아 있으면 lint가 잡는다.

- [ ] **Step 7: 브라우저로 수동 확인**

- `/mypage`에서 구글 아바타 이미지와 닉네임, 이메일이 보이는지 (이미지가 깨지면 Step 1의 remotePatterns를 확인)
- 공유 토글을 눌러 "옷장 공개 중"으로 바뀌고, "공유 링크 복사"가 나타나 실제로 클립보드에 복사되는지
- `/wardrobe`에서 공유 토글이 사라졌는지
- "로그아웃"을 눌러 `/`로 이동하고, 그 상태에서 `/wardrobe`로 직접 접근하면 다시 `/`로 튕기는지

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: add my page with profile, share toggle and logout"
git push
```

---

## Task 5: 옷장·상세 화면 토큰 적용 + 뒤로가기

**Files:**
- Modify: `app/(app)/wardrobe/page.tsx`
- Modify: `app/(app)/wardrobe/[id]/page.tsx`
- Modify: `components/GarmentCard.tsx`
- Modify: `components/MeasurementsTable.tsx`
- Modify: `components/PreferenceForm.tsx`
- Modify: `components/DeleteGarmentButton.tsx`

- [ ] **Step 1: `components/GarmentCard.tsx`**

`Link`를 카드 표면 클래스로 감싸고 회색 계열을 토큰으로 바꾼다.

```tsx
import Link from 'next/link'
import Image from 'next/image'
import { CATEGORY_LABELS, type Category } from '@/lib/types'
import { CARD_SURFACE } from '@/components/ui/styles'

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
    <Link
      href={`/wardrobe/${garment.id}`}
      className={`${CARD_SURFACE} block overflow-hidden transition hover:border-accent`}
    >
      <div className="relative aspect-[3/4] bg-canvas">
        {garment.image_url ? (
          <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="200px" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">
            이미지 없음
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="text-xs text-ink-muted">{garment.brand ?? CATEGORY_LABELS[garment.category]}</p>
        <h3 className="line-clamp-2 text-sm font-medium text-ink">{garment.name}</h3>
        <p className="text-xs text-ink-muted">
          {[garment.color_option, garment.size_option].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: `app/(app)/wardrobe/page.tsx`의 제목·빈 상태·필터 칩**

제목, 빈 상태 문구, `FilterLink`를 아래로 바꾼다 (Task 4에서 이미 ShareToggle은 제거된 상태다).

`import { pillClass } from '@/components/ui/styles'`와 `import Link from 'next/link'`를 추가하고:

```tsx
      <h1 className="text-2xl font-medium tracking-tight text-ink">내 옷장</h1>
```

```tsx
        <p className={`rounded-card border border-dashed border-border p-10 text-center text-sm text-ink-muted`}>
          아직 등록한 옷이 없습니다. 위에 무신사 상품 링크를 붙여넣어 첫 옷을 추가해 보세요.
        </p>
```

파일 하단의 `FilterLink`를 교체한다. 기존에는 `<a>`라 클릭할 때마다 전체 페이지가 새로 로드됐다 — `Link`로 바꿔 클라이언트 내비게이션이 되게 한다.

```tsx
function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={pillClass(active ? 'active' : 'neutral')}>
      {label}
    </Link>
  )
}
```

- [ ] **Step 3: `app/(app)/wardrobe/[id]/page.tsx`에 뒤로가기와 토큰 적용**

`import Link from 'next/link'`와 `import { ArrowLeft } from '@phosphor-icons/react/ssr'`를 추가한다. 서버 컴포넌트이므로 `/ssr` 진입점을 쓴다.

`<main>` 안 맨 위에 뒤로가기를 추가한다:

```tsx
      {/* 어떤 경로로 들어왔든 항상 옷장 목록으로 돌아가게 고정 링크로 둔다 — 브라우저 뒤로가기와 달리 동작이 일정하다. */}
      <Link href="/wardrobe" className="inline-flex items-center gap-1 text-sm text-ink-muted transition hover:text-ink">
        <ArrowLeft size={16} />
        옷장으로
      </Link>
```

그리고 나머지 회색 클래스를 바꾼다:

- `bg-gray-100` (이미지 배경) → `bg-canvas`
- `text-sm text-gray-500` (브랜드) → `text-sm text-ink-muted`
- `text-xl font-bold` (상품명) → `text-xl font-medium tracking-tight text-ink`
- `text-sm text-gray-600` (색상·사이즈·가격) → `text-sm text-ink-muted`
- 두 개의 `text-sm font-semibold text-gray-700` (섹션 제목) → `text-sm font-medium text-ink`

- [ ] **Step 4: `components/MeasurementsTable.tsx`**

```tsx
import { CARD_SURFACE } from '@/components/ui/styles'

type Props = {
  measurements: { key: string; value: number }[]
}

export function MeasurementsTable({ measurements }: Props) {
  if (measurements.length === 0) {
    return <p className="text-sm text-ink-muted">등록된 실측 정보가 없습니다.</p>
  }

  return (
    <table className={`${CARD_SURFACE} w-full overflow-hidden text-sm`}>
      <tbody>
        {measurements.map((m) => (
          <tr key={m.key} className="border-b border-border last:border-0">
            <td className="px-4 py-2 text-ink-muted">{m.key}</td>
            {/* 수치는 자릿수가 세로로 맞도록 mono로 둔다. */}
            <td className="px-4 py-2 text-right font-mono text-ink">{m.value}cm</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 5: `components/PreferenceForm.tsx`**

`import { pillClass } from '@/components/ui/styles'`를 추가하고, 세 군데를 바꾼다.

별점 버튼의 className:

```tsx
              className={`text-2xl transition ${rating != null && n <= rating ? 'text-accent' : 'text-border'}`}
```

핏 태그 버튼의 className:

```tsx
              className={`${pillClass(fitTag === tag ? 'active' : 'neutral')} disabled:opacity-40`}
```

착용 빈도 버튼의 className:

```tsx
              className={`${pillClass(wearFrequency === freq ? 'active' : 'neutral')} disabled:opacity-40`}
```

그리고 세 개의 `<p className="mb-1 text-sm font-medium">`를 `<p className="mb-1 text-sm font-medium text-ink">`로 바꾼다.

- [ ] **Step 6: `components/DeleteGarmentButton.tsx`**

`import { Button } from '@/components/ui/Button'`를 추가하고, 반환부 두 곳을 바꾼다.

```tsx
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm text-danger underline">
        삭제
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm text-ink">
      <span>정말 삭제할까요?</span>
      <Button variant="danger" onClick={handleDelete} disabled={deleting}>
        {deleting ? '삭제 중…' : '삭제'}
      </Button>
      <Button variant="secondary" onClick={() => setConfirming(false)}>
        취소
      </Button>
    </div>
  )
```

- [ ] **Step 7: 빌드와 테스트 확인**

```bash
npm run build
npm test
```

- [ ] **Step 8: 브라우저로 수동 확인**

- `/wardrobe`: 카드가 크림 배경 위 흰 카드로 뜨고, 마우스를 올리면 테두리가 테라코타로 바뀌는지. 카테고리 칩을 눌렀을 때 페이지 전체가 깜빡이지 않고 부드럽게 필터되는지 (Step 2의 `Link` 전환)
- `/wardrobe/<id>`: 상단에 "← 옷장으로"가 있고 눌러서 실제로 목록으로 가는지
- 상세에서 별점을 매기면 별이 테라코타로 채워지는지, 핏/착용빈도 칩 선택이 강조되는지
- "삭제" → "정말 삭제할까요?"에서 삭제 버튼이 웜레드인지

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "feat: restyle wardrobe screens and add back link on detail"
git push
```

---

## Task 6: 살까말까·장바구니 화면 토큰 적용

**Files:**
- Modify: `app/(app)/analyze/page.tsx`
- Modify: `app/(app)/cart/page.tsx`
- Modify: `components/LinkInputBar.tsx`
- Modify: `components/AnalyzeLinkBar.tsx`
- Modify: `components/RecommendLinkBar.tsx`
- Modify: `components/GarmentForm.tsx`
- Modify: `components/PasteSizeTableField.tsx`
- Modify: `components/VerdictBadge.tsx`
- Modify: `components/DeviationReport.tsx`
- Modify: `components/CartItemCard.tsx`

- [ ] **Step 1: `components/VerdictBadge.tsx`**

```tsx
import type { Verdict } from '@/lib/verdict'
import { pillClass } from '@/components/ui/styles'

const VERDICT_LABELS: Record<Verdict, string> = { buy: '살만함', caution: '주의', skip: '비추천' }

// 판정 3색은 의미 전달용이라 "액센트 1개" 원칙의 명시적 예외다 — pillClass가 그 3색을 갖고 있다.
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <span className={`${pillClass(verdict)} font-medium`}>{VERDICT_LABELS[verdict]}</span>
}
```

- [ ] **Step 2: 링크 입력 바 3개를 같은 방식으로 바꾼다**

`LinkInputBar.tsx`, `AnalyzeLinkBar.tsx`, `RecommendLinkBar.tsx`는 입력+버튼 폼이 동일하다. 세 파일 모두 import에 아래를 추가하고,

```tsx
import { Button } from '@/components/ui/Button'
import { INPUT } from '@/components/ui/styles'
```

`<input ... className="flex-1 rounded-lg border px-4 py-2" />`의 className을 `` className={`${INPUT} flex-1`} ``로 바꾼다.

`<button type="submit" ... className="rounded-lg bg-black px-5 py-2 text-white disabled:bg-gray-300">`를 아래로 바꾼다 (내용 텍스트는 각 파일 그대로 유지):

```tsx
        <Button type="submit" disabled={loading || url.trim().length === 0}>
          {loading ? '불러오는 중…' : '불러오기'}
        </Button>
```

그리고 세 파일의 에러 문구 `className="text-sm text-red-600"`을 `className="text-sm text-danger"`로 바꾼다.

`RecommendLinkBar.tsx`의 완료 문구 `className="text-sm text-green-700"`은 `className="text-sm text-ink"`로 바꾼다.

`AnalyzeLinkBar.tsx`의 결과 카드 `className="space-y-3 rounded-xl border p-5"`는 `` className={`${CARD_SURFACE} space-y-3 p-5`} ``로 바꾸고 import에 `CARD_SURFACE`를 추가한다.

- [ ] **Step 3: `components/GarmentForm.tsx`**

import에 추가:

```tsx
import { Button } from '@/components/ui/Button'
import { INPUT, CARD_SURFACE } from '@/components/ui/styles'
```

바꿀 곳:

- `<form ... className="space-y-4 rounded-xl border p-5">` → `` className={`${CARD_SURFACE} space-y-4 p-5`} ``
- 안내 문구 `className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800"` → `className="rounded-btn border border-border bg-canvas p-3 text-sm text-ink-muted"`
- `className="w-full rounded border px-3 py-2 read-only:bg-gray-50"` 3곳 (상품명·브랜드·가격) → `className={INPUT}`
- `className="w-full rounded border px-3 py-2"` 전부 (카테고리 select, 색상 select/input, 사이즈 select/input, 이미지 주소 input, 코멘트 textarea) → `className={INPUT}`
- 실측 자동 채움 안내 `className="text-sm text-green-700"` → `className="text-sm text-ink"`
- 수동 실측 입력 `className="w-full rounded border px-2 py-1"` → `` className={`${INPUT} px-2 py-1`} ``
- 수동 실측 라벨 `className="text-xs"` → `className="text-xs text-ink-muted"`
- 에러 `className="text-sm text-red-600"` → `className="text-sm text-danger"`
- 제출 버튼:

```tsx
      <Button type="submit" disabled={submitting} className="w-full py-3">
        {submitting ? '처리 중…' : submitLabel}
      </Button>
```

- 하단 `Field` 함수의 `<span className="text-sm font-medium">` → `<span className="text-sm font-medium text-ink">`, `<span className="ml-2 text-xs text-amber-700">` → `<span className="ml-2 text-xs text-accent">`

- [ ] **Step 4: `components/PasteSizeTableField.tsx`**

`import { INPUT } from '@/components/ui/styles'`를 추가하고:

- 설명 문구 `className="text-sm text-gray-600"` → `className="text-sm text-ink-muted"`
- textarea `className="w-full rounded border px-3 py-2 font-mono text-sm"` → `` className={`${INPUT} font-mono`} ``
- 인식 결과 `className="rounded bg-green-50 p-2 text-sm text-green-800"` → `className="rounded-btn border border-border bg-canvas p-2 text-sm text-ink"`
- 실패 문구 `className="text-sm text-red-600"` → `className="text-sm text-danger"`
- 미인식 항목 `className="text-xs text-gray-500"` → `className="text-xs text-ink-muted"`

- [ ] **Step 5: `components/DeviationReport.tsx`**

- 데이터 부족 문구 `className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600"` → `className="rounded-btn border border-border bg-canvas p-3 text-sm text-ink-muted"`
- AI 피드백 블록 `className="space-y-1 rounded-lg bg-blue-50 p-3 text-sm text-blue-900"` → `className="space-y-1 rounded-btn border border-border bg-canvas p-3 text-sm text-ink"`
- 피드백 실패 문구 `className="text-sm text-gray-500"` → `className="text-sm text-ink-muted"`
- 낮은 신뢰도 경고 `className="text-xs text-amber-700"` → `className="text-xs text-accent"`
- 표 헤더 `className="text-left text-gray-500"` → `className="text-left text-ink-muted"`
- 표 행 `className="border-t"` → `className="border-t border-border"`
- 과거 실패 이력 `className="ml-1 text-xs text-red-600"` → `className="ml-1 text-xs text-danger"`
- 실측값 셀 `className="py-2 text-right"` → `className="py-2 text-right font-mono"` (수치 정렬)
- 편차 셀 `` className={`py-2 text-right ${f.score > 0 ? 'text-red-600' : 'text-gray-400'}`} `` → `` className={`py-2 text-right font-mono ${f.score > 0 ? 'text-danger' : 'text-ink-muted'}`} ``

- [ ] **Step 6: `components/CartItemCard.tsx`**

import에 `Button`, `CARD_SURFACE`, `pillClass`를 추가하고 반환부를 바꾼다. 판정 라벨을 텍스트 대신 배지로 보여준다.

```tsx
  return (
    <div className={`${CARD_SURFACE} flex items-center gap-3 p-3`}>
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-btn bg-canvas">
        {item.image_url && <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="48px" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="truncate text-xs text-ink-muted">{item.brand}</span>
          {item.latestVerdict && (
            <span className={`${pillClass(item.latestVerdict)} px-2 py-0.5 text-xs`}>
              {VERDICT_LABELS[item.latestVerdict]}
            </span>
          )}
        </div>
      </div>
      <Button onClick={markAsBought} disabled={saving} className="shrink-0 px-3 py-2 text-xs">
        {saving ? '처리 중…' : '샀어요'}
      </Button>
    </div>
  )
```

- [ ] **Step 7: `analyze`·`cart` 페이지의 제목과 빈 상태**

`app/(app)/analyze/page.tsx`:

```tsx
      <h1 className="text-2xl font-medium tracking-tight text-ink">살까 말까</h1>
```

`app/(app)/cart/page.tsx`:

```tsx
      <h1 className="text-2xl font-medium tracking-tight text-ink">장바구니</h1>
```

그리고 장바구니 빈 상태:

```tsx
        <p className="rounded-card border border-dashed border-border p-10 text-center text-sm text-ink-muted">
          고민 중인 옷이 없습니다. &quot;살까 말까&quot;에서 링크를 넣어보세요.
        </p>
```

- [ ] **Step 8: 빌드와 테스트 확인**

```bash
npm run build
npm test
```

- [ ] **Step 9: 브라우저로 수동 확인**

- `/analyze`에서 무신사 링크를 하나 넣어 폼이 뜨는지, 입력칸 테두리가 헤어라인이고 포커스하면 테라코타로 바뀌는지, 파싱 성공해 잠긴 필드가 크림색 배경으로 구분되는지
- "판단하기"까지 진행해 판정 배지와 편차 표가 새 색으로 나오는지, 수치가 mono로 자릿수 정렬되는지
- `/cart`에서 항목의 판정이 배지로 보이고 "샀어요" 버튼이 테라코타인지

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat: restyle purchase decision and cart screens"
git push
```

---

## Task 7: 룩·공유 옷장 화면 토큰 적용 + 공유 페이지 헤더

**Files:**
- Modify: `app/(app)/looks/page.tsx`
- Modify: `app/u/[share_slug]/page.tsx`
- Modify: `components/OutfitBuilder.tsx`
- Create: `components/nav/PublicHeader.tsx`
- Modify: `app/(app)/wardrobe/loading.tsx`, `app/(app)/analyze/loading.tsx`, `app/(app)/cart/loading.tsx`, `app/(app)/looks/loading.tsx`, `app/u/[share_slug]/loading.tsx`

**Interfaces:**
- Produces: `PublicHeader` — `props: { isLoggedIn: boolean }`

- [ ] **Step 1: `components/nav/PublicHeader.tsx` 생성**

공유 옷장은 비로그인 방문자도 보는 화면이라 "내 옷장/장바구니" 같은 탭바가 맞지 않는다. 로고와 상황에 맞는 링크 하나만 둔다.

```tsx
import Link from 'next/link'

/**
 * 공개 공유 옷장 전용 헤더.
 * (app) 그룹의 탭바를 쓰지 않는 이유: 방문자가 비로그인일 수 있고, 그 경우 "내 장바구니" 같은
 * 목적지는 전부 로그인 화면으로 튕겨 의미가 없다.
 * 로그인 여부는 페이지가 이미 조회한 값을 넘겨받는다 — 여기서 다시 getUser()를 부르지 않는다.
 */
export function PublicHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight text-ink">
          살까 말까
        </Link>
        <Link
          href={isLoggedIn ? '/wardrobe' : '/'}
          className="text-sm text-ink-muted transition hover:text-ink"
        >
          {isLoggedIn ? '내 옷장으로' : '로그인'}
        </Link>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: `app/u/[share_slug]/page.tsx`에 헤더를 붙이고 토큰을 적용**

import에 추가:

```tsx
import Link from 'next/link'
import { PublicHeader } from '@/components/nav/PublicHeader'
import { CARD_SURFACE, pillClass } from '@/components/ui/styles'
```

반환부를 프래그먼트로 감싸 헤더를 `<main>` 위에 둔다:

```tsx
  return (
    <>
      <PublicHeader isLoggedIn={Boolean(user)} />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        ...기존 내용...
      </main>
    </>
  )
```

그리고 안쪽 클래스를 바꾼다:

- `<h1 className="text-2xl font-bold">` → `<h1 className="text-2xl font-medium tracking-tight text-ink">`
- 빈 상태 `className="rounded-xl border border-dashed p-10 text-center text-gray-500"` → `className="rounded-card border border-dashed border-border p-10 text-center text-sm text-ink-muted"`
- 두 개의 `className="space-y-3 border-t pt-6"` → `className="space-y-3 border-t border-border pt-6"`
- 두 개의 `<h2 className="text-lg font-semibold">` → `<h2 className="text-lg font-medium text-ink">`
- 하단 `FilterLink`를 Task 5 Step 2와 같은 형태로 바꾼다:

```tsx
function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={pillClass(active ? 'active' : 'neutral')}>
      {label}
    </Link>
  )
}
```

- 하단 `PublicGarmentCard`의 카드 클래스를 바꾼다 (주석은 그대로 둔다):

```tsx
    <article className={`${CARD_SURFACE} overflow-hidden`}>
      <div className="relative aspect-[3/4] bg-canvas">
        {garment.image_url ? (
          <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="200px" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">이미지 없음</div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="text-xs text-ink-muted">{garment.brand ?? CATEGORY_LABELS[garment.category]}</p>
        <h3 className="line-clamp-2 text-sm font-medium text-ink">{garment.name}</h3>
        <p className="text-xs text-ink-muted">
          {[garment.color_option, garment.size_option].filter(Boolean).join(' · ')}
        </p>
      </div>
    </article>
```

- [ ] **Step 3: `components/OutfitBuilder.tsx`**

import에 `Button`, `INPUT`, `CARD_SURFACE`를 추가하고:

- 옷 없음 문구 `className="text-sm text-gray-500"` → `className="text-sm text-ink-muted"`
- `<form ... className="space-y-3 rounded-xl border p-5">` → `` className={`${CARD_SURFACE} space-y-3 p-5`} ``
- 제목 input, 설명 textarea의 `className="w-full rounded border px-3 py-2"` → `className={INPUT}`
- 선택 타일:

```tsx
            className={`relative aspect-[3/4] cursor-pointer overflow-hidden rounded-btn border-2 transition ${
              selected.includes(garment.id) ? 'border-accent' : 'border-transparent'
            }`}
```

- 타일 안 `className="relative h-full w-full bg-gray-100"` → `className="relative h-full w-full bg-canvas"`
- 에러 `className="text-sm text-red-600"` → `className="text-sm text-danger"`
- 완료 `className="text-sm text-green-700"` → `className="text-sm text-ink"`
- 제출 버튼:

```tsx
      <Button type="submit" disabled={submitting || selected.length === 0} className="w-full py-3">
        {submitting ? '만드는 중…' : `룩 만들기 (${selected.length}벌 선택)`}
      </Button>
```

- [ ] **Step 4: `app/(app)/looks/page.tsx`**

`import { CARD_SURFACE } from '@/components/ui/styles'`를 추가하고:

- `<h1 className="text-2xl font-bold">` → `<h1 className="text-2xl font-medium tracking-tight text-ink">`
- 빈 상태 `className="rounded-xl border border-dashed p-10 text-center text-gray-500"` → `className="rounded-card border border-dashed border-border p-10 text-center text-sm text-ink-muted"`
- `<article className="rounded-xl border p-4">` → `` className={`${CARD_SURFACE} p-4`} ``
- 작성자 `className="text-xs text-gray-500"` → `className="text-xs text-ink-muted"`
- `<h2 className="text-lg font-semibold">` → `<h2 className="text-lg font-medium text-ink">`
- 설명 `className="text-sm text-gray-600"` → `className="text-sm text-ink-muted"`
- 옷 썸네일 `className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100"` → `className="relative h-24 w-20 shrink-0 overflow-hidden rounded-btn bg-canvas"`

- [ ] **Step 5: 로딩 화면 5개의 색을 맞춘다**

다섯 파일 모두 `text-gray-400`을 `text-ink-muted`로 바꾼다. 예시(`app/(app)/wardrobe/loading.tsx`, 다른 파일은 `max-w-*`만 다르다):

```tsx
export default function Loading() {
  return <main className="mx-auto max-w-4xl px-4 py-8 text-sm text-ink-muted">불러오는 중…</main>
}
```

- [ ] **Step 6: 빌드와 테스트 확인**

```bash
npm run build
npm test
```

- [ ] **Step 7: 브라우저로 수동 확인**

- `/mypage`에서 공유를 켜고 링크를 복사해 **시크릿 창(비로그인)**으로 연다. 상단에 "살까 말까 / 로그인" 헤더가 보이고, 하단 탭바는 없어야 한다.
- 같은 링크를 로그인한 다른 계정(또는 본인 일반 창)으로 열면 우측이 "내 옷장으로"로 바뀌는지
- 다른 계정으로 룩을 하나 만들고, 주인 계정의 `/looks`에서 새 카드 스타일로 보이는지

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: restyle looks and shared wardrobe screens"
git push
```

---

## Task 8: 최종 점검과 README 기록

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 남은 하드코딩 색을 훑는다**

```bash
grep -rn "bg-black\|bg-gray-\|text-gray-\|border-gray-\|text-blue-\|text-red-6\|text-green-7\|bg-amber-\|text-amber-\|bg-green-\|bg-blue-" app components --include="*.tsx"
```

Expected: 결과 없음. 남아 있으면 해당 파일을 토큰으로 바꾼다. `VerdictBadge`/`pillClass`의 판정 3색은 `styles.ts` 안에 hex로 있으므로 이 검색에 걸리지 않는다.

- [ ] **Step 2: 전체 빌드·테스트를 마지막으로 돌린다**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 전부 통과 (Task 2에서 5개가 늘어 총 103개).

- [ ] **Step 3: README에 이번 작업 기록을 추가한다**

`README.md` 맨 끝에 아래 형식으로 절을 추가한다. **이 계획을 실행하며 실제로 겪은 문제만 적는다** — 미리 예상한 문제를 적지 않는다. 이 프로젝트의 README 기록은 "무엇이 어려웠고 왜 그렇게 풀었는지"를 남겨 면접에서 설명 근거로 쓰는 것이 목적이다.

최소한 아래는 실제로 확인된 사실이므로 기록할 가치가 있다:

- `globals.css`의 `body { font-family: Arial... }`가 레이아웃이 로드한 Geist 폰트를 덮어쓰고 있었다는 것 (Next.js 기본 스캐폴드에서 넘어온 잔재)
- 카드/필을 컴포넌트가 아니라 클래스 상수로 공유하기로 한 이유 (루트 엘리먼트가 Link·article·form으로 제각각이라 래퍼 div가 늘어난다)
- `lib/nav.ts`에 아이콘을 두지 않은 이유 (node 환경 Vitest가 그대로 import한다)
- `profiles.avatar_url`의 구글 호스트를 `next.config.ts`에 등록해야 했던 것

형식은 기존 절들과 맞춘다 (문제 / 원인 / 해결 / 검증 / 결과).

- [ ] **Step 4: 커밋**

```bash
git add README.md
git commit -m "docs: log navigation and design system work"
git push
```

---

## 남은 일 (이 계획 밖)

- **2단계: 핏 판단 설정 화면.** 마이페이지의 "핏 판단 설정 (준비 중)" 자리를 실제 화면으로 교체한다. `lib/fit/rules.ts`의 상수를 사용자별 값으로 바꾸는 작업이라 DB 스키마·RLS·엔진 수정이 함께 필요하므로, 별도 브레인스토밍 → 스펙 → 계획 사이클로 진행한다.
- **`GarmentForm` 재사용 3형제(`LinkInputBar`/`AnalyzeLinkBar`/`RecommendLinkBar`)의 중복.** 계획 3에서 이미 "rule of three"로 기록해 둔 항목이다. 이번 계획에서도 세 파일에 같은 수정을 반복하게 되는데, 구조 리팩터링은 이 계획의 범위(색·타이포 통일) 밖이라 그대로 둔다.
