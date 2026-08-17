# 다크모드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** 마이페이지에서 시스템/라이트/다크 중 화면 테마를 고를 수 있게 하고, `profiles`에 저장해 기기 간 동기화한다.

**Architecture:** `app/globals.css`의 색 토큰(`@theme`의 `--color-*`)에 다크 값을 `@media (prefers-color-scheme: dark)`와 `:root[data-theme="dark"]` 두 곳에서 재정의한다. 시맨틱 토큰(`bg-canvas`, `text-ink` 등)만 쓰는 기존 컴포넌트는 코드 변경 없이 자동으로 다크모드를 따른다. `profiles.theme` 컬럼 → `PATCH /api/profile` → 루트 레이아웃이 서버에서 읽어 `<html data-theme>`로 반영(깜빡임 없음) → 마이페이지의 `ThemeToggle`이 즉시 반영 + 저장, 순으로 이어진다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Tailwind CSS v4 · Supabase(Postgres/RLS)

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-17-dark-mode-design.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- TypeScript `strict: true`, `any` 금지. `npm run build`가 타입 에러 0개로 통과해야 한다.
- 순수 검정(`#000000`)을 쓰지 않는다. 다크 팔레트도 기존 웜톤 기조를 유지한다(스펙의 팔레트 표를 그대로 쓴다).
- 판정 배지 3색(`components/ui/styles.ts`의 `PILL_TONES`)을 포함해 색은 전부 `@theme` 토큰을 거쳐야 한다 — 컴포넌트에 hex를 하드코딩하지 않는다.
- `app/u/[share_slug]/opengraph-image.tsx`(소셜 미리보기용 정적 이미지)는 건드리지 않는다.

### 마이그레이션 적용 방법에 대한 참고

계획 10부터 반복 확인된 사실: 이 프로젝트의 `npx supabase db push`는 계획 5의 마이그레이션이 CLI가 아니라 Supabase MCP의 `apply_migration` 도구로 적용된 이력 때문에 막혀 있다. 계획 10·11과 같은 방식대로 **Supabase MCP `apply_migration` 도구로 직접 적용**한다.

---

## Task 1: 마이그레이션 — `profiles.theme`

**Files:**
- Create: `supabase/migrations/0009_profile_theme.sql`

**Interfaces:**
- Produces: `profiles.theme text not null default 'system'`, 값은 `'system' | 'light' | 'dark'`만 허용.

- [ ] **Step 1: 마이그레이션 작성**

`supabase/migrations/0009_profile_theme.sql`:

```sql
-- 다크모드 설정. profiles에 저장해 기기 간 동기화된다(핏 강도·옷장 공개 여부와 같은 자리).
-- 'system'이 기본값 — CSS만으로 OS 다크모드를 그대로 따르고, 사용자가 명시적으로
-- light/dark를 고르면 그 값이 우선한다(app/layout.tsx가 <html data-theme>로 반영).
-- 기존 profiles_update RLS 정책(id = auth.uid())이 이 컬럼도 그대로 커버해 새 정책이 필요 없다.
alter table profiles
  add column theme text not null default 'system'
  check (theme in ('system', 'light', 'dark'));
```

- [ ] **Step 2: 마이그레이션 적용**

Supabase MCP의 `apply_migration` 도구로 위 SQL을 이름 `profile_theme`으로 그대로 적용한다.

- [ ] **Step 3: 컬럼이 실제로 생겼는지 확인**

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'theme';
```

Expected: 한 행, `data_type = 'text'`, `column_default`에 `'system'` 포함.

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/0009_profile_theme.sql
git commit -m "feat: add theme column to profiles"
git push
```

---

## Task 2: 다크 팔레트 토큰

**Files:**
- Modify: `app/globals.css`
- Modify: `components/ui/styles.ts`

**Interfaces:**
- Produces: `--color-buy-bg`·`--color-buy-text`·`--color-caution-bg`·`--color-caution-text`·`--color-skip-bg`·`--color-skip-text` 6개 신규 토큰(`bg-buy-bg` 등 유틸리티 클래스로 자동 노출).

- [ ] **Step 1: `@theme`에 판정 배지 토큰을 추가한다**

`app/globals.css`의 `@theme` 블록. **기존**:

```css
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
```

**변경**:

```css
@theme {
  --color-canvas: #f7f5f0;
  --color-surface: #ffffff;
  --color-ink: #28261f;
  --color-ink-muted: #8a8677;
  --color-border: #e4e0d6;
  --color-accent: #c1502e;
  --color-accent-ink: #ffffff;
  --color-danger: #b3261e;

  /* 판정 배지 3색. 예전엔 components/ui/styles.ts에 하드코딩된 hex였는데, 다크모드에서
     이 색들도 같이 바뀌어야 해서 다른 색처럼 토큰으로 옮겼다(계획 15). */
  --color-buy-bg: #e3ede1;
  --color-buy-text: #2f5d3a;
  --color-caution-bg: #f4ebd8;
  --color-caution-text: #8a6320;
  --color-skip-bg: #f5e0dd;
  --color-skip-text: #8f2f26;

  --radius-btn: 8px;
  --radius-card: 12px;
}
```

- [ ] **Step 2: 다크 팔레트를 파일 끝에 추가한다**

`app/globals.css` 맨 끝(`body { ... }` 블록 뒤)에 추가:

```css

/*
 * 다크 팔레트(계획 15). data-theme 속성이 없으면(=시스템 따름) 아래 media query가
 * OS 다크모드를 그대로 반영한다. 명시적으로 라이트를 고르면(:not([data-theme='light']))
 * media query가 안 먹혀 라이트로 고정되고, 명시적으로 다크를 고르면 OS 설정과 무관하게
 * 아래 :root[data-theme='dark'] 블록이 항상 이긴다. 순수 검정 대신 웜톤 차콜을 쓴다.
 */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --color-canvas: #1c1a17;
    --color-surface: #262320;
    --color-ink: #f0ede5;
    --color-ink-muted: #a39c8c;
    --color-border: #3a352e;
    --color-accent: #d97449;
    --color-accent-ink: #1c1a17;
    --color-danger: #e0574a;

    --color-buy-bg: #24352a;
    --color-buy-text: #8fc79c;
    --color-caution-bg: #3a3020;
    --color-caution-text: #e0b968;
    --color-skip-bg: #3a2422;
    --color-skip-text: #e0938c;
  }
}

:root[data-theme='dark'] {
  --color-canvas: #1c1a17;
  --color-surface: #262320;
  --color-ink: #f0ede5;
  --color-ink-muted: #a39c8c;
  --color-border: #3a352e;
  --color-accent: #d97449;
  --color-accent-ink: #1c1a17;
  --color-danger: #e0574a;

  --color-buy-bg: #24352a;
  --color-buy-text: #8fc79c;
  --color-caution-bg: #3a3020;
  --color-caution-text: #e0b968;
  --color-skip-bg: #3a2422;
  --color-skip-text: #e0938c;
}
```

- [ ] **Step 3: `PILL_TONES`가 토큰을 가리키게 바꾼다**

`components/ui/styles.ts`. **기존**:

```ts
const PILL_TONES: Record<PillTone, string> = {
  neutral: 'border-border bg-surface text-ink-muted',
  active: 'border-accent bg-accent text-accent-ink',
  // buy/caution/skip은 판정을 색으로 구분해야 해서 "액센트 1개" 원칙의 예외다(계획 서두 참고).
  buy: 'border-transparent bg-[#e3ede1] text-[#2f5d3a]',
  caution: 'border-transparent bg-[#f4ebd8] text-[#8a6320]',
  skip: 'border-transparent bg-[#f5e0dd] text-[#8f2f26]',
}
```

**변경**:

```ts
const PILL_TONES: Record<PillTone, string> = {
  neutral: 'border-border bg-surface text-ink-muted',
  active: 'border-accent bg-accent text-accent-ink',
  // buy/caution/skip은 판정을 색으로 구분해야 해서 "액센트 1개" 원칙의 예외다(계획 서두 참고).
  // 하드코딩된 hex 대신 @theme 토큰을 쓴다 — 다크모드에서 이 값들도 같이 바뀌어야 한다(계획 15).
  buy: 'border-transparent bg-buy-bg text-buy-text',
  caution: 'border-transparent bg-caution-bg text-caution-text',
  skip: 'border-transparent bg-skip-bg text-skip-text',
}
```

- [ ] **Step 4: 빌드로 확인**

```bash
npm run build
```

Expected: 타입 에러 0개.

- [ ] **Step 5: 브라우저로 토큰이 실제로 반영되는지 확인**

아직 UI 토글이 없으니(Task 4에서 만든다) 개발자 도구로 직접 확인한다. 아무 페이지(`/wardrobe` 등)에서:

```js
document.documentElement.setAttribute('data-theme', 'dark')
getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim()
```

Expected: `#1c1a17`이 나오고, 화면 배경이 실제로 어두워지는 것을 스크린샷으로 확인한다. `document.documentElement.removeAttribute('data-theme')`로 되돌리면 다시 라이트로 돌아오는지도 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add app/globals.css components/ui/styles.ts
git commit -m "feat: add dark color palette tokens"
git push
```

---

## Task 3: `PATCH /api/profile` + 루트 레이아웃 반영

**Files:**
- Modify: `app/api/profile/route.ts`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `PATCH /api/profile`가 `{ theme: 'system'|'light'|'dark' }`도 받는다.

- [ ] **Step 1: API에 `theme` 필드를 추가한다**

`app/api/profile/route.ts`. **기존**:

```ts
const Body = z.object({
  isWardrobePublic: z.boolean().optional(),
  fitStrictness: z.number().min(0.5).max(2).optional(),
})
```

**변경**:

```ts
const Body = z.object({
  isWardrobePublic: z.boolean().optional(),
  fitStrictness: z.number().min(0.5).max(2).optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
})
```

`updates` 객체 타입과 조립부. **기존**:

```ts
  const updates: Record<string, boolean | number> = {}
  if (parsed.data.isWardrobePublic !== undefined) {
    updates.is_wardrobe_public = parsed.data.isWardrobePublic
  }
  if (parsed.data.fitStrictness !== undefined) {
    updates.fit_strictness = parsed.data.fitStrictness
  }
```

**변경**:

```ts
  const updates: Record<string, boolean | number | string> = {}
  if (parsed.data.isWardrobePublic !== undefined) {
    updates.is_wardrobe_public = parsed.data.isWardrobePublic
  }
  if (parsed.data.fitStrictness !== undefined) {
    updates.fit_strictness = parsed.data.fitStrictness
  }
  if (parsed.data.theme !== undefined) {
    updates.theme = parsed.data.theme
  }
```

- [ ] **Step 2: 루트 레이아웃이 로그인 사용자의 테마를 읽어 반영한다**

`app/layout.tsx` 전체. **기존**:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "살까 말까",
  description: "가진 옷을 옷장에 모아두면, 새로 사려는 옷이 내 사이즈와 스타일에 맞는지 알려드립니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

**변경**:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { createServerSupabase } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "살까 말까",
  description: "가진 옷을 옷장에 모아두면, 새로 사려는 옷이 내 사이즈와 스타일에 맞는지 알려드립니다.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 로그인 사용자의 테마를 서버에서 미리 읽어 <html>에 반영한다 — 첫 페인트부터 맞는
  // 테마가 적용되어 깜빡임(FOUC)이 없다. 'system'이거나 비로그인 방문자면 data-theme을
  // 아예 안 붙여, globals.css의 media query가 OS 설정을 그대로 따르게 둔다.
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  let dataTheme: "light" | "dark" | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("theme")
      .eq("id", user.id)
      .single();
    if (profile?.theme === "light" || profile?.theme === "dark") {
      dataTheme = profile.theme;
    }
  }

  return (
    <html
      lang="ko"
      data-theme={dataTheme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: 빌드로 확인**

```bash
npm run build
```

Expected: 타입 에러 0개.

- [ ] **Step 4: 브라우저로 확인**

로그인한 계정의 `profiles.theme`을 SQL로 직접 `'dark'`로 바꾼 뒤 아무 페이지나 새로고침해 `<html>`에 `data-theme="dark"`가 붙고 어두운 화면으로 뜨는지 확인한다. 확인 후 SQL로 `'system'`으로 되돌린다.

```sql
update profiles set theme = 'dark' where id = '<내 uid>';
-- 확인 후
update profiles set theme = 'system' where id = '<내 uid>';
```

- [ ] **Step 5: 커밋**

```bash
git add app/api/profile/route.ts app/layout.tsx
git commit -m "feat: apply saved theme on the server before first paint"
git push
```

---

## Task 4: 마이페이지 테마 토글

**Files:**
- Create: `components/account/ThemeToggle.tsx`
- Modify: `app/(app)/mypage/page.tsx`

**Interfaces:**
- Consumes: `pillClass`(`@/components/ui/styles`) — 계획 4부터 존재.
- Produces: `ThemeToggle({ initialValue: 'system'|'light'|'dark' })`.

- [ ] **Step 1: `ThemeToggle` 컴포넌트를 만든다**

`components/account/ThemeToggle.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { pillClass } from '@/components/ui/styles'

type Theme = 'system' | 'light' | 'dark'

const THEME_LABELS: Record<Theme, string> = { system: '시스템', light: '라이트', dark: '다크' }

type Props = { initialValue: Theme }

/**
 * 3단 테마 선택. 누르면 <html data-theme>을 직접 바꿔 새로고침 없이 그 자리에서 반영하고,
 * 동시에 서버에도 저장해 다른 기기에서 로그인해도 같은 테마가 적용되게 한다.
 * 'system'을 고르면 속성을 아예 지워 globals.css의 media query가 OS 설정을 따르게 둔다.
 */
export function ThemeToggle({ initialValue }: Props) {
  const [theme, setTheme] = useState<Theme>(initialValue)
  const [saving, setSaving] = useState(false)

  async function select(next: Theme) {
    setTheme(next)
    if (next === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', next)
    }
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    })
    setSaving(false)
  }

  return (
    <div className="flex gap-2">
      {(Object.keys(THEME_LABELS) as Theme[]).map((value) => (
        <button
          key={value}
          type="button"
          disabled={saving}
          onClick={() => select(value)}
          className={`${pillClass(theme === value ? 'active' : 'neutral')} disabled:opacity-40`}
        >
          {THEME_LABELS[value]}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 마이페이지에 연결한다**

`app/(app)/mypage/page.tsx`의 import 목록에 추가:

```ts
import { ThemeToggle } from '@/components/account/ThemeToggle'
```

`profiles` 쿼리의 `select`. **기존**:

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
    .select('nickname, avatar_url, share_slug, is_wardrobe_public, fit_strictness, theme')
    .eq('id', user.id)
    .single()
```

"핏 판단 설정" `<section>` 바로 뒤(`</section>` 다음, `<LogoutButton />` 앞)에 새 카드를 추가한다. **기존**:

```tsx
        <div className="border-t border-border pt-3">
          <h3 className="mb-2 text-xs font-medium text-ink-muted">항목별 직접 입력 (선택)</h3>
          <FitFieldOverrides initialOverrides={fitOverrides} />
        </div>
      </section>

      <LogoutButton />
    </main>
  )
}
```

**변경**:

```tsx
        <div className="border-t border-border pt-3">
          <h3 className="mb-2 text-xs font-medium text-ink-muted">항목별 직접 입력 (선택)</h3>
          <FitFieldOverrides initialOverrides={fitOverrides} />
        </div>
      </section>

      <section className={`${CARD_SURFACE} space-y-3 p-5`}>
        <h2 className="text-sm font-medium text-ink">화면 테마</h2>
        {/* theme 컬럼은 DB CHECK로 세 값만 허용되지만 PostgREST 타입은 그냥 string이라 캐스팅한다
            (profile?.fit_strictness를 Number()로 감싸는 위 코드와 같은 이유). */}
        <ThemeToggle initialValue={(profile?.theme as 'system' | 'light' | 'dark') ?? 'system'} />
      </section>

      <LogoutButton />
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

1. `/mypage`에서 "화면 테마" 카드가 뜨는지 확인한다.
2. "다크"를 눌러 새로고침 없이 화면이 즉시 어두워지는지 확인한다. DB에서 `select theme from profiles where id = '<내 uid>'`로 `'dark'`가 저장됐는지 확인한다.
3. 페이지를 새로고침해도(서버 렌더 시점부터) 깜빡임 없이 다크로 뜨는지 확인한다.
4. "시스템"을 눌러 되돌리고, DB 값도 `'system'`으로 돌아왔는지 확인한다.
5. 판정 배지(장바구니나 `/cart/[id]`에서 "살만함"/"주의"/"비추천")가 다크에서도 읽기 편한 대비로 뜨는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add components/account/ThemeToggle.tsx "app/(app)/mypage/page.tsx"
git commit -m "feat: add theme toggle to mypage"
git push
```

---

## Task 5: README 기록

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 맨 끝에 "계획 15 — 다크모드" 절을 추가한다**

기존 절들과 같은 형식으로 쓴다. 최소한 아래 설계 판단은 근거와 함께 남길 가치가 있다:

- **토큰 기반 설계 덕분에 컴포넌트를 거의 안 건드린 것** — `bg-canvas`·`text-ink` 같은 시맨틱 유틸리티만 쓰던 기존 컴포넌트들이 `@theme` 커스텀 프로퍼티 값을 다시 정의하는 것만으로 전부 자동으로 다크모드에 대응했다. 유일하게 손댄 컴포넌트 파일은 판정 배지가 하드코딩된 hex를 쓰고 있던 `components/ui/styles.ts` 하나뿐이었다.
- **`system`/`light`/`dark`를 CSS만으로 구현한 것** — `@media (prefers-color-scheme: dark)`를 `:not([data-theme='light'])`로 좁혀서, JS 없이도 "시스템 따름"과 "명시적 선택"을 한 세트의 CSS 규칙으로 구분했다.
- **루트 레이아웃에서 서버가 미리 `data-theme`를 정하는 이유** — 클라이언트에서만 테마를 적용하면 첫 페인트에 라이트가 잠깐 보였다가 다크로 바뀌는 깜빡임(FOUC)이 생긴다. 서버 컴포넌트인 루트 레이아웃이 로그인 사용자의 `profiles.theme`을 미리 읽어 `<html>`에 반영해 이 문제를 피했다.
- 이번 계획을 실행하며 실제로 겪은 문제만 추가로 적는다(예상한 문제를 미리 적지 않는다). 문제가 없었다면 없었다고 쓴다.

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: log dark mode work"
git push
```

---

## 남은 일 (이 계획 밖)

사용자가 제안한 6개 중 4(랜딩페이지 확장), 5(README 재구성)가 남아 있다. 합의된 진행 순서: 6 → 1 → 3 → 2(이 계획) → 4 → 5.
