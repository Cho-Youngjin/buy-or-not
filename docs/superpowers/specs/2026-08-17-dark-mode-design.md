# 다크모드 — 설계

**날짜**: 2026-08-17
**분류**: 사용자가 직접 제안한 6개 기능 중 2번(진행 순서 6→1→3→2→4→5의 네 번째).

## 배경

`app/globals.css`는 색을 리터럴이 아니라 Tailwind v4 `@theme`의 CSS 커스텀 프로퍼티(`--color-canvas`, `--color-ink` 등)로 정의하고 있고, 거의 모든 컴포넌트가 `bg-canvas`·`text-ink`·`border-border` 같은 시맨틱 유틸리티만 쓴다(하드코딩된 hex는 `components/ui/styles.ts`의 판정 배지 3색과 OG 이미지 생성 코드뿐 — OG 이미지는 소셜 크롤러용 정적 이미지라 테마 대상이 아니다). 이 토큰 구조 덕분에, 커스텀 프로퍼티 값 자체를 다크 모드에서 다시 정의하기만 하면 대부분의 컴포넌트가 코드 변경 없이 자동으로 다크모드에 대응한다.

## 결정 사항 (사용자 확인)

- **저장 위치**: `profiles` 테이블(핏 강도·옷장 공개 여부와 같은 자리, `PATCH /api/profile`로 관리). 다른 기기로 로그인해도 같은 테마가 적용된다.
- **선택지**: 시스템/라이트/다크 3단계. 기본값은 "시스템 설정 따름"(OS 다크모드를 JS 없이 CSS만으로 자동 추종). 명시적으로 라이트나 다크를 고르면 그게 우선한다.

## 설계

### 1. 다크 팔레트

기존 웜톤(따뜻한 오프화이트/차콜) 기조를 유지하며 반전한다. 순수 검정(`#000000`)은 쓰지 않는다.

| 토큰 | 라이트 (기존) | 다크 (신규) |
|---|---|---|
| `--color-canvas` | `#f7f5f0` | `#1c1a17` |
| `--color-surface` | `#ffffff` | `#262320` |
| `--color-ink` | `#28261f` | `#f0ede5` |
| `--color-ink-muted` | `#8a8677` | `#a39c8c` |
| `--color-border` | `#e4e0d6` | `#3a352e` |
| `--color-accent` | `#c1502e` | `#d97449`(다크 배경 대비 확보를 위해 살짝 밝게) |
| `--color-accent-ink` | `#ffffff` | `#1c1a17` |
| `--color-danger` | `#b3261e` | `#e0574a` |

`components/ui/styles.ts`의 `PILL_TONES`(`buy`/`caution`/`skip` 판정 배지 배경·글자색)는 지금 하드코딩된 hex(`bg-[#e3ede1]` 등)라 다크모드에 반응할 수 없다. 이것도 `@theme`에 6개 토큰(`--color-buy-bg`, `--color-buy-text`, `--color-caution-bg`, `--color-caution-text`, `--color-skip-bg`, `--color-skip-text`)으로 옮기고, `PILL_TONES`는 그 토큰을 가리키는 유틸리티 클래스(`bg-buy-bg text-buy-text` 등)로 바꾼다. 다크 값은 어두운 바탕에 얹힌 저채도 배경 + 밝은 글자 조합으로 정한다(예: buy는 어두운 초록 배경 `#24352a` + 밝은 초록 글자 `#8fc79c`).

### 2. CSS 구조

`@theme`에 남겨둔 값이 곧 라이트(기본값)다. 그 아래 일반 CSS로 두 블록을 추가한다:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* 다크 값 */
  }
}
:root[data-theme="dark"] {
  /* 다크 값(위와 동일) */
}
```

- `data-theme` 속성이 없으면(=시스템 따름) OS가 다크면 첫 번째 블록이 적용된다.
- `data-theme="light"`를 명시하면 첫 번째 블록의 `:not(...)` 조건에 걸려 라이트로 고정된다.
- `data-theme="dark"`를 명시하면 두 번째 블록이 OS 설정과 무관하게 항상 이긴다.

### 3. 저장·적용 경로

- **마이그레이션**: `profiles.theme text not null default 'system' check (theme in ('system','light','dark'))`. 기존 `garments_update`류 패턴과 같게 기존 `profiles_update` RLS 정책(`id = auth.uid()`)이 이 컬럼도 그대로 커버해 새 정책이 필요 없다.
- **`PATCH /api/profile`**: 기존 `Body` 스키마에 `theme: z.enum(['system','light','dark']).optional()`을 추가한다. 기존 `fitStrictness`/`isWardrobePublic`과 같은 자리에 나란히 둔다.
- **`app/layout.tsx`(루트 레이아웃)**: 지금은 정적 마크업만 있는데, 로그인 사용자면 `profiles.theme`을 서버에서 읽어 `<html data-theme={theme !== 'system' ? theme : undefined}>`로 렌더한다. 첫 페인트부터 맞는 테마가 적용돼 깜빡임(FOUC)이 없다. 비로그인 방문자(랜딩페이지, 공유 옷장을 구경하는 친구)는 프로필이 없으니 항상 시스템 설정을 따른다 — 페이지마다 이미 `auth.getUser()`를 각자 부르고 있는 기존 관례와 같은 선상에서, 레이아웃도 자기 몫의 조회를 한 번 더 하는 것으로 처리한다(요청마다 프로필 조회가 하나 늘지만, 이 프로젝트는 스펙 서두부터 "대규모 트래픽을 위해 만들지 않는다"는 전제라 문제 삼지 않는다).
- **`ThemeToggle`(신규, `components/account/ThemeToggle.tsx`)**: `/mypage`의 "핏 판단 설정" 카드 옆에 새 카드로 둔다. 3단 세그먼트 버튼(시스템/라이트/다크). 누르면 `PATCH /api/profile`을 부르는 동시에 `document.documentElement.setAttribute('data-theme', ...)`(시스템이면 `removeAttribute`)를 직접 호출해, 새로고침 없이 그 자리에서 바로 테마가 바뀌게 한다.

## 영향 범위

- `app/globals.css`, `components/ui/styles.ts`, `app/layout.tsx`가 수정된다. 새 컴포넌트(`ThemeToggle`) 하나, 마이그레이션 하나, `mypage`에 카드 하나가 늘어난다.
- 기존 컴포넌트들(`GarmentCard`, `CartItemCard`, 각종 폼 등)은 전부 시맨틱 토큰만 쓰고 있어 코드 변경이 필요 없다 — 이번 계획의 핵심 전제이자 검증 대상이다.
- `app/u/[share_slug]/opengraph-image.tsx`는 소셜 미리보기용 정적 이미지 생성 코드라 테마 대상에서 제외한다.

## 테스트

새 순수 로직은 거의 없다(토큰 값과 CSS 선택자 우선순위가 핵심). `npm run build`(타입 체크) + 브라우저 확인(OS 다크모드에서 시스템 옵션이 자동으로 다크를 따르는지, 라이트를 명시하면 OS가 다크여도 라이트로 고정되는지, 다크를 명시하면 OS가 라이트여도 다크로 고정되는지, 판정 배지 3색이 다크에서도 읽기 편한지, 새로고침해도 깜빡임 없이 선택한 테마가 바로 뜨는지)으로 검증한다.
