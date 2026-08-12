# 계획 1: 기반 + 옷장 등록 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구글 계정으로 로그인한 사용자가 무신사 상품 링크를 붙여넣어 색상·사이즈를 고르면, 상품 이미지·색상·사이즈·실측이 옷장에 저장되고 그리드로 조회된다. 파싱이 실패한 항목은 사용자가 직접 채운다.

**Architecture:** 단일 Next.js 15 App Router 리포. 브라우저는 무신사에 직접 요청하지 않고 항상 Route Handler를 경유한다(CORS·키 보호). 무신사 파싱은 `lib/musinsa/`에 어댑터로 격리되며, 순수 함수(HTML → `ParseResult`)와 네트워크 계층이 분리되어 fixture로 테스트된다. 데이터는 Supabase Postgres에 저장하고 접근 제어는 전적으로 RLS가 담당한다.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase (Postgres/Auth/Storage), cheerio, zod, Vitest

**설계 문서:** `docs/superpowers/specs/2026-08-13-buy-or-not-design.md`

**이 계획의 범위:** 스펙 Phase 0, 1, 2. 선호도 편집·핏 판단·Gemini·공유·룩은 계획 2, 3에서 다룬다.

## Global Constraints

- Node.js 20 이상. 패키지 매니저는 npm.
- TypeScript `strict: true`. `any` 사용 금지.
- **외부 서비스(무신사, 이후 Gemini) 호출은 서버 코드에서만 한다.** 클라이언트 컴포넌트에서 직접 `fetch`하지 않는다.
- **`SUPABASE_SERVICE_ROLE_KEY`는 `lib/supabase/admin.ts` 밖에서 import하지 않는다.** 이 키는 RLS를 우회한다.
- 파싱 실패는 예외를 던지지 않고 `FieldResult`의 `{ ok: false, reason }`로 표현한다.
- 사용자에게 보이는 모든 문구는 한국어.
- 실측 표준 항목명은 정확히 다음 9개다: `총장`, `어깨너비`, `가슴단면`, `소매길이`, `허리단면`, `엉덩이단면`, `허벅지단면`, `밑위`, `밑단단면`.
- 표준 목록에 없는 실측 항목은 **버리지 않고 원문 그대로 저장한다.**
- 커밋 메시지는 Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`).
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. `.env.local`은 커밋하지 않는다.

## File Structure

```
buy-or-not/
├── app/
│   ├── layout.tsx                       루트 레이아웃
│   ├── page.tsx                         랜딩 (비로그인: 로그인 버튼)
│   ├── auth/callback/route.ts           OAuth 콜백
│   ├── wardrobe/page.tsx                옷장 그리드 (Server Component)
│   └── api/
│       ├── musinsa/parse/route.ts       링크 → ParseResult
│       └── garments/route.ts            옷장 등록
├── components/
│   ├── LoginButton.tsx                  구글 로그인
│   ├── LinkInputBar.tsx                 링크 붙여넣기
│   ├── GarmentForm.tsx                  옵션 선택 + 실패 필드 수동 입력
│   └── GarmentCard.tsx                  옷장 카드
├── lib/
│   ├── types.ts                         도메인 enum·타입
│   ├── supabase/
│   │   ├── client.ts                    브라우저 클라이언트
│   │   ├── server.ts                    세션 기반 서버 클라이언트 (RLS 적용)
│   │   └── admin.ts                     service_role 클라이언트 (캐시·스토리지 전용)
│   └── musinsa/
│       ├── types.ts                     FieldResult, ParseResult
│       ├── url.ts                       goods_no 추출
│       ├── measurements.ts              실측 항목명 정규화
│       ├── parser.ts                    HTML → ParseResult (순수 함수)
│       ├── fetcher.ts                   네트워크 계층 (timeout·재시도)
│       └── cache.ts                     musinsa_cache 읽기/쓰기
├── supabase/migrations/
│   ├── 0001_init.sql                    확장·enum·테이블·인덱스
│   ├── 0002_rls.sql                     RLS 정책
│   └── 0003_profile_trigger.sql         가입 시 profiles 자동 생성
├── tests/
│   ├── fixtures/musinsa/                Phase 0에서 저장한 실제 HTML
│   ├── musinsa/url.test.ts
│   ├── musinsa/measurements.test.ts
│   ├── musinsa/parser.test.ts
│   └── rls.test.ts
├── docs/superpowers/notes/
│   └── phase0-musinsa-findings.md       Phase 0 조사 결과
├── vitest.config.ts
└── .env.local.example
```

**분리 근거.** `parser.ts`는 네트워크를 모르는 순수 함수라 fixture만으로 테스트된다. `fetcher.ts`가 timeout·재시도·헤더를 전담한다. 이 둘을 합치면 파서 테스트에 네트워크가 필요해지고, 무신사가 개편될 때 어디가 깨졌는지 구분되지 않는다. `admin.ts`를 따로 두는 이유는 service_role 키의 사용처를 한 파일로 좁혀 감사 가능하게 만들기 위해서다.

---

### Task 1: Phase 0 — 무신사 파싱 타당성 확인

이 태스크만 TDD가 아니다. 코드를 쓰기 전에 **무신사에서 무엇을 얻을 수 있는지 확인하는 조사**이며, 산출물은 fixture HTML과 조사 노트다. Task 5(파서)의 구현이 이 결과에 직접 의존한다.

**Files:**
- Create: `tests/fixtures/musinsa/top.html`
- Create: `tests/fixtures/musinsa/bottom.html`
- Create: `tests/fixtures/musinsa/outer.html`
- Create: `docs/superpowers/notes/phase0-musinsa-findings.md`

**Interfaces:**
- Consumes: 없음
- Produces: fixture HTML 3개 (Task 5의 파서 테스트 입력), 조사 노트

- [ ] **Step 1: robots.txt 확인**

```bash
curl -s https://www.musinsa.com/robots.txt
```

상품 상세 경로(`/products/`, `/app/goods/`)가 `Disallow`에 있는지 확인한다. 있으면 **중단하고 사용자에게 보고한다.** 이 경우 계획은 전 항목 수동 입력 모드로 축소되어야 한다.

- [ ] **Step 2: 상품 페이지 3개 HTML 저장**

무신사에서 상의·하의·아우터 상품을 하나씩 고르고, URL을 아래에 대입해 실행한다.

```bash
mkdir -p tests/fixtures/musinsa
curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" \
  -H "Accept-Language: ko-KR,ko;q=0.9" \
  -w "\nHTTP %{http_code} / %{size_download} bytes\n" \
  "<상의 상품 URL>" -o tests/fixtures/musinsa/top.html
```

하의·아우터도 같은 명령으로 `bottom.html`, `outer.html`에 저장한다.

기대: HTTP 200, 수십 KB 이상. **403이거나 본문이 1KB 미만이면 봇 차단**이므로 Step 6으로 간다.

- [ ] **Step 3: JSON-LD 존재 확인**

```bash
grep -o 'application/ld+json' tests/fixtures/musinsa/top.html | head -3
grep -o '"@type"[[:space:]]*:[[:space:]]*"Product"' tests/fixtures/musinsa/top.html | head -3
```

`Product` 타입 JSON-LD가 있으면 상품명·브랜드·가격·이미지는 여기서 안정적으로 뽑을 수 있다.

- [ ] **Step 4: 사이즈표(실측) 존재 확인**

```bash
grep -o '총장' tests/fixtures/musinsa/top.html | head -3
grep -o '가슴단면\|가슴 단면' tests/fixtures/musinsa/top.html | head -3
grep -o '허리단면\|허리 단면' tests/fixtures/musinsa/bottom.html | head -3
```

**여기서 결과가 갈린다.** 실측 문자열이 정적 HTML에 있으면 cheerio로 `<table>` 파싱이 가능하다. 없으면 클라이언트에서 별도 API로 불러오는 구조이므로 Step 6이 필요하다.

- [ ] **Step 5: 색상·사이즈 옵션 존재 확인**

```bash
grep -o '"optionItems"\|"colorName"\|"sizeName"\|__NEXT_DATA__\|self.__next_f' tests/fixtures/musinsa/top.html | sort -u | head
```

`__NEXT_DATA__`나 `self.__next_f`가 있으면 페이지에 삽입된 JSON 안에 옵션 데이터가 들어 있을 가능성이 높다. 해당 스크립트 블록을 추출해 구조를 살펴본다.

- [ ] **Step 6: (Step 4 또는 5가 실패한 경우에만) 내부 API 엔드포인트 조사**

이 단계는 브라우저에서 수동으로 한다. 자동화할 수 없으므로 사용자에게 요청해도 된다.

1. Chrome에서 무신사 상품 페이지를 연다.
2. 개발자도구 → Network → Fetch/XHR 필터.
3. 페이지를 새로고침하고, 응답에 실측/옵션 데이터가 들어 있는 요청을 찾는다.
4. 해당 요청의 **URL, 메서드, 필수 헤더**를 기록한다.
5. 터미널에서 그 URL을 `curl`로 재현해 인증 없이도 응답이 오는지 확인한다.

```bash
curl -s -A "Mozilla/5.0" "<찾아낸 API URL>" | head -c 2000
```

응답이 오면 그 JSON을 `tests/fixtures/musinsa/top-api.json`으로 저장한다.

- [ ] **Step 7: 조사 노트 작성**

`docs/superpowers/notes/phase0-musinsa-findings.md`에 아래 형식으로 기록한다. 물음표 없이 확정된 사실만 적는다.

```markdown
# Phase 0: 무신사 파싱 타당성 조사 결과

조사일: 2026-08-__
조사 대상 URL: (3개)

## robots.txt
- 상품 상세 경로 Disallow 여부: 있음 / 없음

## 정적 HTML 요청
- HTTP 상태 / 본문 크기:
- 봇 차단 여부:

## 획득 가능한 필드

| 필드 | 출처 | 추출 방법 |
|---|---|---|
| 상품명 | JSON-LD / DOM / 내부 API | (선택자 또는 JSON 경로) |
| 브랜드 | | |
| 가격 | | |
| 대표 이미지 | | |
| 카테고리 | | |
| 색상·사이즈 옵션 | | |
| 사이즈 실측표 | | |

## 실측 항목 원문 표기
(실제로 발견된 항목명을 그대로 나열. 예: "총장", "가슴 단면", "어깨너비")
→ Task 4의 별칭 사전에 반영할 것.

## 결론
- [ ] 정적 HTML 파싱으로 충분
- [ ] 내부 API 호출 필요 (엔드포인트: )
- [ ] 파싱 불가 — 전 항목 수동 입력으로 진행
```

- [ ] **Step 8: 커밋**

```bash
git add tests/fixtures/musinsa docs/superpowers/notes/phase0-musinsa-findings.md
git commit -m "chore: add musinsa fixtures and phase 0 findings"
```

**게이트:** 조사 노트의 "실측 항목 원문 표기"와 "결론"이 채워지기 전에는 Task 5를 시작하지 않는다. Task 5의 파서는 여기서 확인된 구조를 대상으로 작성한다.

---

### Task 2: 프로젝트 셋업

**Files:**
- Create: 프로젝트 스캐폴드 (`app/`, `package.json`, `tsconfig.json`, `tailwind.config.ts` 등)
- Create: `vitest.config.ts`
- Create: `.env.local.example`
- Create: `tests/smoke.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: 없음
- Produces: `npm test`로 Vitest 실행 가능, `@/` 경로 별칭 동작

- [ ] **Step 1: Next.js 스캐폴드 생성**

리포 루트에서 실행한다. 이미 `README.md`와 `docs/`가 있으므로 현재 디렉터리에 생성한다.

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --no-turbopack
```

기존 파일 덮어쓰기를 묻거든 `README.md`는 유지한다.

- [ ] **Step 2: 의존성 설치**

```bash
npm install @supabase/supabase-js @supabase/ssr cheerio zod
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 3: Vitest 설정 작성**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

`package.json`의 `scripts`에 추가:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 스모크 테스트 작성**

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('테스트 환경', () => {
  it('실행된다', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: 테스트 실행**

Run: `npm test`
Expected: PASS, 1 passed

- [ ] **Step 6: 환경변수 예시 파일 작성**

`.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`.gitignore`에 `.env.local`이 포함되어 있는지 확인하고, 없으면 추가한다.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "chore: scaffold next.js project with vitest"
```

---

### Task 3: 도메인 타입과 상품번호 추출

**Files:**
- Create: `lib/types.ts`
- Create: `lib/musinsa/url.ts`
- Test: `tests/musinsa/url.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `Category = 'top' | 'bottom' | 'outer' | 'shoes' | 'acc'`
  - `GarmentStatus`, `FitTag`, `WearFrequency`, `ParseMode`
  - `extractGoodsNo(input: string): string | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/musinsa/url.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractGoodsNo } from '@/lib/musinsa/url'

describe('extractGoodsNo', () => {
  it('신형 상품 URL에서 번호를 뽑는다', () => {
    expect(extractGoodsNo('https://www.musinsa.com/products/1234567')).toBe('1234567')
  })

  it('구형 상품 URL에서 번호를 뽑는다', () => {
    expect(extractGoodsNo('https://www.musinsa.com/app/goods/1234567')).toBe('1234567')
  })

  it('쿼리스트링 형식에서도 뽑는다', () => {
    expect(extractGoodsNo('https://www.musinsa.com/app/goods/?goodsNo=1234567')).toBe('1234567')
  })

  it('경로 뒤에 쿼리가 붙어도 뽑는다', () => {
    expect(extractGoodsNo('https://www.musinsa.com/products/1234567?color=black')).toBe('1234567')
  })

  it('앞뒤 공백을 무시한다', () => {
    expect(extractGoodsNo('  https://www.musinsa.com/products/1234567  ')).toBe('1234567')
  })

  it('무신사가 아닌 도메인은 거부한다', () => {
    expect(extractGoodsNo('https://www.example.com/products/1234567')).toBeNull()
  })

  it('도메인 이름에 musinsa가 섞인 위장 주소를 거부한다', () => {
    expect(extractGoodsNo('https://musinsa.com.evil.io/products/123')).toBeNull()
  })

  it('URL이 아니면 null을 반환한다', () => {
    expect(extractGoodsNo('그냥 문자열')).toBeNull()
  })

  it('상품번호가 없는 무신사 주소는 null을 반환한다', () => {
    expect(extractGoodsNo('https://www.musinsa.com/main')).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- tests/musinsa/url.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/musinsa/url"`

- [ ] **Step 3: 도메인 타입 작성**

`lib/types.ts`:

```ts
export type Category = 'top' | 'bottom' | 'outer' | 'shoes' | 'acc'
export type GarmentStatus = 'owned' | 'considering'
export type FitTag = 'tight' | 'just' | 'loose'
export type WearFrequency = 'often' | 'sometimes' | 'rarely'
export type ParseMode = 'auto' | 'partial' | 'manual'

export const CATEGORY_LABELS: Record<Category, string> = {
  top: '상의',
  bottom: '하의',
  outer: '아우터',
  shoes: '신발',
  acc: '액세서리',
}
```

- [ ] **Step 4: 최소 구현 작성**

`lib/musinsa/url.ts`:

```ts
const GOODS_NO_PATTERNS = [
  /\/products\/(\d+)/,
  /\/app\/goods\/(\d+)/,
  /[?&]goodsNo=(\d+)/,
]

/** 무신사 상품 URL에서 상품번호를 뽑는다. 무신사 주소가 아니거나 번호가 없으면 null. */
export function extractGoodsNo(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }

  // 하위 도메인은 허용하되, musinsa.com으로 끝나야 한다.
  if (!/(^|\.)musinsa\.com$/.test(url.hostname)) return null

  const target = url.pathname + url.search
  for (const pattern of GOODS_NO_PATTERNS) {
    const match = target.match(pattern)
    if (match) return match[1]
  }
  return null
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- tests/musinsa/url.test.ts`
Expected: PASS, 9 passed

- [ ] **Step 6: 커밋**

```bash
git add lib/types.ts lib/musinsa/url.ts tests/musinsa/url.test.ts
git commit -m "feat: extract musinsa goods number from product url"
```

---

### Task 4: 실측 항목명 정규화

무신사 사이즈표 표기가 상품마다 흔들린다(`가슴단면` / `가슴 단면` / `흉위`). 표준 키로 매핑하되, **모르는 키는 버리지 않고 원문 그대로 돌려준다.**

**Files:**
- Create: `lib/musinsa/measurements.ts`
- Test: `tests/musinsa/measurements.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `STANDARD_KEYS: ReadonlySet<string>`
  - `normalizeMeasurementKey(raw: string): string`
  - `isStandardKey(key: string): boolean`

**주의:** Task 1의 조사 노트 "실측 항목 원문 표기" 절에 기록된 실제 표기를 아래 `ALIASES`에 반드시 추가한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/musinsa/measurements.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeMeasurementKey, isStandardKey, STANDARD_KEYS } from '@/lib/musinsa/measurements'

describe('normalizeMeasurementKey', () => {
  it('표준 키는 그대로 둔다', () => {
    expect(normalizeMeasurementKey('총장')).toBe('총장')
    expect(normalizeMeasurementKey('허리단면')).toBe('허리단면')
  })

  it('공백이 섞인 표기를 표준화한다', () => {
    expect(normalizeMeasurementKey('가슴 단면')).toBe('가슴단면')
    expect(normalizeMeasurementKey('어깨 너비')).toBe('어깨너비')
  })

  it('단위 표기를 떼어낸다', () => {
    expect(normalizeMeasurementKey('총장(cm)')).toBe('총장')
    expect(normalizeMeasurementKey('가슴단면 (CM)')).toBe('가슴단면')
  })

  it('별칭을 표준 키로 바꾼다', () => {
    expect(normalizeMeasurementKey('흉위')).toBe('가슴단면')
    expect(normalizeMeasurementKey('기장')).toBe('총장')
    expect(normalizeMeasurementKey('힙단면')).toBe('엉덩이단면')
  })

  it('모르는 항목은 원문 그대로 돌려준다', () => {
    expect(normalizeMeasurementKey('밴딩둘레')).toBe('밴딩둘레')
  })

  it('앞뒤 공백을 제거한다', () => {
    expect(normalizeMeasurementKey('  총장  ')).toBe('총장')
  })
})

describe('isStandardKey', () => {
  it('표준 9개 항목을 인식한다', () => {
    expect(STANDARD_KEYS.size).toBe(9)
    expect(isStandardKey('밑위')).toBe(true)
    expect(isStandardKey('밴딩둘레')).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- tests/musinsa/measurements.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 최소 구현 작성**

`lib/musinsa/measurements.ts`:

```ts
/** 핏 판단에 사용하는 표준 실측 항목. 이 목록에 없는 항목은 저장은 되지만 판단에서 제외된다. */
export const STANDARD_KEYS: ReadonlySet<string> = new Set([
  '총장', '어깨너비', '가슴단면', '소매길이',
  '허리단면', '엉덩이단면', '허벅지단면', '밑위', '밑단단면',
])

/** 무신사 표기 → 표준 키. 키는 공백을 제거한 형태로 비교한다. */
const ALIASES: Record<string, string> = {
  기장: '총장',
  옷길이: '총장',
  흉위: '가슴단면',
  가슴둘레: '가슴단면',
  어깨: '어깨너비',
  견장: '어깨너비',
  소매: '소매길이',
  팔길이: '소매길이',
  허리: '허리단면',
  힙단면: '엉덩이단면',
  엉덩이: '엉덩이단면',
  허벅지: '허벅지단면',
  밑위길이: '밑위',
  밑단: '밑단단면',
}

export function normalizeMeasurementKey(raw: string): string {
  const compact = raw
    .replace(/\(\s*cm\s*\)/gi, '')
    .replace(/\s+/g, '')
    .trim()

  if (STANDARD_KEYS.has(compact)) return compact
  if (ALIASES[compact]) return ALIASES[compact]
  return raw.trim()
}

export function isStandardKey(key: string): boolean {
  return STANDARD_KEYS.has(key)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/musinsa/measurements.test.ts`
Expected: PASS, 7 passed

- [ ] **Step 5: 커밋**

```bash
git add lib/musinsa/measurements.ts tests/musinsa/measurements.test.ts
git commit -m "feat: normalize musinsa measurement key aliases"
```

---

### Task 5: 무신사 상품 파서

HTML 문자열을 받아 `ParseResult`를 돌려주는 **순수 함수**다. 네트워크를 모르므로 fixture만으로 테스트된다. 필드별로 성공/실패를 따로 담아 부분 성공을 표현한다.

**Files:**
- Create: `lib/musinsa/types.ts`
- Create: `lib/musinsa/parser.ts`
- Test: `tests/musinsa/parser.test.ts`
- Read: `docs/superpowers/notes/phase0-musinsa-findings.md`

**Interfaces:**
- Consumes: `normalizeMeasurementKey`, `isStandardKey` (Task 4), `Category` (Task 3)
- Produces:
  - `FieldResult<T> = { ok: true; value: T } | { ok: false; reason: string }`
  - `SizeTable = Record<string, Record<string, number>>`
  - `ParseResult`, `ParsedFields`
  - `parseProductHtml(html: string, goodsNo: string): ParseResult`

**시작 전 확인:** Task 1의 조사 노트를 읽는다. 조사 결과가 "내부 API 필요"였다면 아래 `extractSizeTable`·`extractOptions`의 입력이 HTML이 아니라 JSON이 되므로, 해당 함수만 JSON 경로로 바꾸고 나머지 구조와 테스트 형태는 그대로 유지한다.

- [ ] **Step 1: 타입 정의 작성**

`lib/musinsa/types.ts`:

```ts
import type { Category } from '@/lib/types'

export type FieldResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string }

/** 사이즈 → 항목 → 값(cm). 예: { L: { 총장: 72, 가슴단면: 55 } } */
export type SizeTable = Record<string, Record<string, number>>

export type ProductOptions = {
  colors: string[]
  sizes: string[]
}

export type ParsedFields = {
  name: FieldResult<string>
  brand: FieldResult<string>
  price: FieldResult<number>
  imageUrl: FieldResult<string>
  category: FieldResult<Category>
  options: FieldResult<ProductOptions>
  sizeTable: FieldResult<SizeTable>
}

export type ParseResult = {
  goodsNo: string
  fields: ParsedFields
}

/** 수동 입력 폴백 화면이 다루는 필드 목록. parse_mode 계산에도 쓰인다. */
export const PARSEABLE_FIELDS = [
  'name', 'brand', 'price', 'imageUrl', 'category', 'options', 'sizeTable',
] as const

export type ParseableField = (typeof PARSEABLE_FIELDS)[number]

export function ok<T>(value: T): FieldResult<T> {
  return { ok: true, value }
}

export function fail<T>(reason: string): FieldResult<T> {
  return { ok: false, reason }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/musinsa/parser.test.ts`. fixture는 Task 1에서 저장한 실제 HTML이다. **기대값은 fixture의 실제 상품 정보로 바꿔 쓴다.**

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseProductHtml } from '@/lib/musinsa/parser'

function fixture(name: string): string {
  return readFileSync(path.resolve(__dirname, '../fixtures/musinsa', name), 'utf-8')
}

describe('parseProductHtml — 상의', () => {
  const result = parseProductHtml(fixture('top.html'), '1234567')

  it('상품번호를 그대로 담는다', () => {
    expect(result.goodsNo).toBe('1234567')
  })

  it('상품명을 뽑는다', () => {
    expect(result.fields.name.ok).toBe(true)
    if (result.fields.name.ok) {
      expect(result.fields.name.value.length).toBeGreaterThan(0)
    }
  })

  it('가격을 숫자로 뽑는다', () => {
    expect(result.fields.price.ok).toBe(true)
    if (result.fields.price.ok) {
      expect(result.fields.price.value).toBeGreaterThan(0)
      expect(Number.isInteger(result.fields.price.value)).toBe(true)
    }
  })

  it('대표 이미지 URL을 뽑는다', () => {
    expect(result.fields.imageUrl.ok).toBe(true)
    if (result.fields.imageUrl.ok) {
      expect(result.fields.imageUrl.value).toMatch(/^https?:\/\//)
    }
  })

  it('사이즈표에서 표준 항목을 뽑는다', () => {
    expect(result.fields.sizeTable.ok).toBe(true)
    if (result.fields.sizeTable.ok) {
      const sizes = Object.keys(result.fields.sizeTable.value)
      expect(sizes.length).toBeGreaterThan(0)
      const firstRow = result.fields.sizeTable.value[sizes[0]]
      expect(Object.keys(firstRow)).toContain('총장')
    }
  })
})

describe('parseProductHtml — 하의', () => {
  const result = parseProductHtml(fixture('bottom.html'), '7654321')

  it('하의 실측 항목을 뽑는다', () => {
    expect(result.fields.sizeTable.ok).toBe(true)
    if (result.fields.sizeTable.ok) {
      const sizes = Object.keys(result.fields.sizeTable.value)
      const firstRow = result.fields.sizeTable.value[sizes[0]]
      expect(Object.keys(firstRow)).toContain('허리단면')
    }
  })
})

describe('parseProductHtml — 견고성', () => {
  it('빈 HTML에도 예외를 던지지 않고 전 필드를 실패로 표시한다', () => {
    const result = parseProductHtml('<html><body></body></html>', '1')
    expect(result.fields.name.ok).toBe(false)
    expect(result.fields.sizeTable.ok).toBe(false)
    if (!result.fields.name.ok) {
      expect(result.fields.name.reason.length).toBeGreaterThan(0)
    }
  })

  it('깨진 JSON-LD가 있어도 예외를 던지지 않는다', () => {
    const html = '<html><script type="application/ld+json">{not json</script></html>'
    expect(() => parseProductHtml(html, '1')).not.toThrow()
  })

  it('사이즈표에 숫자가 아닌 셀이 섞여도 그 항목만 건너뛴다', () => {
    const html = `
      <table>
        <tr><th>사이즈</th><th>총장</th><th>가슴단면</th></tr>
        <tr><td>M</td><td>70</td><td>-</td></tr>
      </table>`
    const result = parseProductHtml(html, '1')
    expect(result.fields.sizeTable.ok).toBe(true)
    if (result.fields.sizeTable.ok) {
      expect(result.fields.sizeTable.value['M']).toEqual({ 총장: 70 })
    }
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npm test -- tests/musinsa/parser.test.ts`
Expected: FAIL — `parseProductHtml` 모듈 없음

- [ ] **Step 4: 파서 구현 작성**

`lib/musinsa/parser.ts`:

```ts
import * as cheerio from 'cheerio'
import type { Category } from '@/lib/types'
import { normalizeMeasurementKey, isStandardKey } from '@/lib/musinsa/measurements'
import {
  ok, fail,
  type FieldResult, type ParseResult, type ProductOptions, type SizeTable,
} from '@/lib/musinsa/types'

type JsonLdProduct = {
  '@type'?: string
  name?: string
  image?: string | string[]
  brand?: { name?: string } | string
  offers?: { price?: string | number } | Array<{ price?: string | number }>
}

/** 무신사 카테고리 문자열 → 표준 카테고리. 판정 불가 시 null. */
const CATEGORY_HINTS: Array<[RegExp, Category]> = [
  [/아우터|코트|자켓|재킷|점퍼|패딩/, 'outer'],
  [/상의|티셔츠|셔츠|맨투맨|니트|후드/, 'top'],
  [/바지|팬츠|데님|슬랙스|하의|스커트/, 'bottom'],
  [/신발|스니커즈|운동화|부츠|샌들|슬리퍼/, 'shoes'],
  [/가방|모자|양말|액세서리|주얼리/, 'acc'],
]

export function parseProductHtml(html: string, goodsNo: string): ParseResult {
  const $ = cheerio.load(html)
  const ld = readJsonLdProduct($)

  return {
    goodsNo,
    fields: {
      name: extractName(ld),
      brand: extractBrand(ld),
      price: extractPrice(ld),
      imageUrl: extractImage(ld),
      category: extractCategory($),
      options: extractOptions($),
      sizeTable: extractSizeTable($),
    },
  }
}

function readJsonLdProduct($: cheerio.CheerioAPI): JsonLdProduct | null {
  const nodes = $('script[type="application/ld+json"]').toArray()
  for (const node of nodes) {
    const raw = $(node).contents().text()
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue // 깨진 JSON-LD는 조용히 건너뛴다
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed]
    for (const candidate of candidates) {
      const product = candidate as JsonLdProduct
      if (product && product['@type'] === 'Product') return product
    }
  }
  return null
}

function extractName(ld: JsonLdProduct | null): FieldResult<string> {
  const name = ld?.name?.trim()
  return name ? ok(name) : fail('상품명을 찾지 못했습니다')
}

function extractBrand(ld: JsonLdProduct | null): FieldResult<string> {
  const brand = typeof ld?.brand === 'string' ? ld.brand : ld?.brand?.name
  const trimmed = brand?.trim()
  return trimmed ? ok(trimmed) : fail('브랜드를 찾지 못했습니다')
}

function extractPrice(ld: JsonLdProduct | null): FieldResult<number> {
  const offers = Array.isArray(ld?.offers) ? ld?.offers[0] : ld?.offers
  const raw = offers?.price
  if (raw === undefined || raw === null) return fail('가격을 찾지 못했습니다')
  const price = Math.round(Number(String(raw).replace(/[^\d.]/g, '')))
  if (!Number.isFinite(price) || price <= 0) return fail('가격을 숫자로 읽지 못했습니다')
  return ok(price)
}

function extractImage(ld: JsonLdProduct | null): FieldResult<string> {
  const image = Array.isArray(ld?.image) ? ld?.image[0] : ld?.image
  if (!image) return fail('상품 이미지를 찾지 못했습니다')
  const absolute = image.startsWith('//') ? `https:${image}` : image
  if (!/^https?:\/\//.test(absolute)) return fail('이미지 주소 형식을 읽지 못했습니다')
  return ok(absolute)
}

function extractCategory($: cheerio.CheerioAPI): FieldResult<Category> {
  // 빵부스러기(breadcrumb) 텍스트를 훑어 카테고리 힌트를 찾는다.
  const crumbs = $('[class*="breadcrumb"] a, nav a').toArray()
    .map((el) => $(el).text().trim())
    .join(' ')
  for (const [pattern, category] of CATEGORY_HINTS) {
    if (pattern.test(crumbs)) return ok(category)
  }
  return fail('카테고리를 판정하지 못했습니다')
}

function extractOptions($: cheerio.CheerioAPI): FieldResult<ProductOptions> {
  const colors = uniqueTexts($, '[data-option-type="color"] option, select[name*="color"] option')
  const sizes = uniqueTexts($, '[data-option-type="size"] option, select[name*="size"] option')
  if (colors.length === 0 && sizes.length === 0) {
    return fail('색상·사이즈 옵션을 찾지 못했습니다')
  }
  return ok({ colors, sizes })
}

function uniqueTexts($: cheerio.CheerioAPI, selector: string): string[] {
  const texts = $(selector).toArray()
    .map((el) => $(el).text().trim())
    .filter((t) => t.length > 0 && !/선택|choose/i.test(t))
  return [...new Set(texts)]
}

function extractSizeTable($: cheerio.CheerioAPI): FieldResult<SizeTable> {
  for (const node of $('table').toArray()) {
    const $table = $(node)
    const headerCells = $table.find('thead th, thead td').toArray()
    const headers = (headerCells.length > 0
      ? headerCells
      : $table.find('tr').first().find('th, td').toArray()
    ).map((el) => $(el).text().trim())

    if (headers.length < 2) continue

    // 첫 칸은 사이즈 라벨, 나머지가 실측 항목이다.
    const keys = headers.slice(1).map(normalizeMeasurementKey)
    if (!keys.some(isStandardKey)) continue

    const bodyRows = $table.find('tbody tr').toArray()
    const rows = bodyRows.length > 0 ? bodyRows : $table.find('tr').slice(1).toArray()

    const table: SizeTable = {}
    for (const row of rows) {
      const cells = $(row).find('th, td').toArray().map((el) => $(el).text().trim())
      if (cells.length < 2) continue
      const sizeLabel = cells[0]
      if (!sizeLabel) continue

      const entry: Record<string, number> = {}
      keys.forEach((key, index) => {
        const cell = cells[index + 1]
        if (!cell) return
        const value = Number(cell.replace(/[^\d.]/g, ''))
        if (Number.isFinite(value) && value > 0) entry[key] = value
      })
      if (Object.keys(entry).length > 0) table[sizeLabel] = entry
    }

    if (Object.keys(table).length > 0) return ok(table)
  }
  return fail('사이즈 실측표를 찾지 못했습니다')
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- tests/musinsa/parser.test.ts`
Expected: PASS

fixture 기반 테스트가 실패하면 **fixture의 실제 HTML을 열어 선택자를 맞춘다.** 조사 노트의 "추출 방법" 열이 근거다. 견고성 테스트 3개는 무조건 통과해야 한다.

- [ ] **Step 6: 커밋**

```bash
git add lib/musinsa/types.ts lib/musinsa/parser.ts tests/musinsa/parser.test.ts
git commit -m "feat: parse musinsa product page into field-level result"
```

---

### Task 6: 데이터베이스 스키마와 RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `supabase/migrations/0002_rls.sql`
- Create: `supabase/migrations/0003_profile_trigger.sql`

**Interfaces:**
- Consumes: 없음
- Produces: `profiles`, `garments`, `garment_measurements`, `musinsa_cache` 테이블과 RLS 정책, `garments` Storage 버킷

**사전 준비:** Supabase 프로젝트를 만들고 `.env.local`에 URL·anon key·service_role key를 채운다. Supabase CLI를 설치한다(`npm install -D supabase`). Docker Desktop이 있으면 `npx supabase start`로 로컬 실행이 가능하고, 없으면 `npx supabase link --project-ref <ref>` 후 `npx supabase db push`로 원격에 적용한다.

`analyses`, `outfits`, `outfit_items`는 계획 2·3에서 쓰므로 지금 만들지 않는다.

- [ ] **Step 1: 초기 스키마 마이그레이션 작성**

`supabase/migrations/0001_init.sql`:

```sql
create extension if not exists pgcrypto;

create type category as enum ('top', 'bottom', 'outer', 'shoes', 'acc');
create type garment_status as enum ('owned', 'considering');
create type fit_tag as enum ('tight', 'just', 'loose');
create type wear_frequency as enum ('often', 'sometimes', 'rarely');
create type parse_mode as enum ('auto', 'partial', 'manual');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  avatar_url text,
  share_slug text unique not null,
  is_wardrobe_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table garments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  status garment_status not null default 'owned',
  source_url text,
  goods_no text,
  brand text,
  name text not null,
  price integer check (price is null or price >= 0),
  image_url text,
  category category not null,
  color_option text,
  size_option text,
  ai_tags jsonb,
  rating smallint check (rating is null or rating between 1 and 5),
  fit_tag fit_tag,
  wear_frequency wear_frequency,
  parse_mode parse_mode not null default 'manual',
  recommended_by uuid references profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index garments_owner_status_idx on garments (owner_id, status);
create index garments_owner_category_idx on garments (owner_id, category);
create index garments_goods_no_idx on garments (goods_no);

create table garment_measurements (
  garment_id uuid not null references garments (id) on delete cascade,
  key text not null,
  value numeric(5, 1) not null,
  primary key (garment_id, key)
);

create table musinsa_cache (
  goods_no text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

-- 상품 이미지 사본 버킷 (공개 읽기, 쓰기는 service_role만)
insert into storage.buckets (id, name, public)
values ('garments', 'garments', true)
on conflict (id) do nothing;
```

- [ ] **Step 2: RLS 마이그레이션 작성**

`supabase/migrations/0002_rls.sql`:

```sql
alter table profiles enable row level security;
alter table garments enable row level security;
alter table garment_measurements enable row level security;
alter table musinsa_cache enable row level security;
-- musinsa_cache에는 정책을 만들지 않는다. service_role만 접근한다.

create policy profiles_select on profiles for select
  using (id = auth.uid() or is_wardrobe_public);

create policy profiles_insert on profiles for insert
  with check (id = auth.uid());

create policy profiles_update on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy garments_select on garments for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = garments.owner_id and p.is_wardrobe_public
    )
  );

-- 본인 옷장에는 자유롭게, 남의 공개 옷장에는 '추천(장바구니)'으로만 넣을 수 있다.
create policy garments_insert on garments for insert
  with check (
    owner_id = auth.uid()
    or (
      status = 'considering'
      and recommended_by = auth.uid()
      and exists (
        select 1 from profiles p
        where p.id = owner_id and p.is_wardrobe_public
      )
    )
  );

create policy garments_update on garments for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy garments_delete on garments for delete
  using (owner_id = auth.uid());

create policy gm_select on garment_measurements for select
  using (
    exists (
      select 1 from garments g
      where g.id = garment_measurements.garment_id
        and (
          g.owner_id = auth.uid()
          or exists (
            select 1 from profiles p
            where p.id = g.owner_id and p.is_wardrobe_public
          )
        )
    )
  );

-- 실측 삽입은 그 옷을 넣을 수 있었던 사람(주인 또는 추천자)에게 허용한다.
create policy gm_insert on garment_measurements for insert
  with check (
    exists (
      select 1 from garments g
      where g.id = garment_measurements.garment_id
        and (g.owner_id = auth.uid() or g.recommended_by = auth.uid())
    )
  );

create policy gm_update on garment_measurements for update
  using (
    exists (
      select 1 from garments g
      where g.id = garment_measurements.garment_id and g.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from garments g
      where g.id = garment_measurements.garment_id and g.owner_id = auth.uid()
    )
  );

create policy gm_delete on garment_measurements for delete
  using (
    exists (
      select 1 from garments g
      where g.id = garment_measurements.garment_id and g.owner_id = auth.uid()
    )
  );
```

- [ ] **Step 3: 가입 트리거 마이그레이션 작성**

`supabase/migrations/0003_profile_trigger.sql`:

```sql
-- URL 안전한 무작위 공유 slug를 만든다.
create or replace function public.generate_share_slug()
returns text
language sql
volatile
as $$
  select replace(replace(encode(gen_random_bytes(9), 'base64'), '/', '_'), '+', '-');
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, avatar_url, share_slug)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '사용자'),
    new.raw_user_meta_data ->> 'avatar_url',
    public.generate_share_slug()
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 4: 마이그레이션 적용**

로컬 Supabase를 쓰는 경우:

```bash
npx supabase start
npx supabase db reset
```

원격 프로젝트에 직접 적용하는 경우:

```bash
npx supabase link --project-ref <프로젝트 ref>
npx supabase db push
```

Expected: 오류 없이 완료

- [ ] **Step 5: 테이블 생성 확인**

```bash
npx supabase db diff --schema public
```

Expected: 차이 없음 (마이그레이션과 DB 상태가 일치)

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations
git commit -m "feat: add schema, rls policies and profile trigger"
```

---

### Task 7: RLS 정책 테스트

RLS가 이 앱 보안의 전부다. 정책이 의도대로 막는지 실제 DB에 대고 확인한다.

**Files:**
- Create: `tests/rls.test.ts`
- Create: `tests/helpers/supabase.ts`

**Interfaces:**
- Consumes: Task 6의 스키마와 정책
- Produces: `createTestUser(email: string)` 헬퍼

**주의:** 이 테스트는 실제 DB에 사용자를 만든다. 로컬 Supabase(`npx supabase start`)에서 실행하는 것을 권장한다. 원격 프로젝트에 대고 돌리면 테스트 사용자가 남으므로, 반드시 `afterAll`의 정리 코드가 동작하는지 확인한다.

- [ ] **Step 1: 테스트 헬퍼 작성**

`tests/helpers/supabase.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export type TestUser = {
  id: string
  client: SupabaseClient
}

/** service_role로 사용자를 만들고, 그 사용자 세션으로 로그인한 클라이언트를 돌려준다. */
export async function createTestUser(email: string, password = 'test-password-1234'): Promise<TestUser> {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) throw createError

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  return { id: created.user.id, client }
}

export async function deleteTestUser(id: string): Promise<void> {
  await admin.auth.admin.deleteUser(id)
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/rls.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { admin, createTestUser, deleteTestUser, type TestUser } from './helpers/supabase'

let alice: TestUser
let bob: TestUser
let aliceGarmentId: string

beforeAll(async () => {
  const stamp = Date.now()
  alice = await createTestUser(`alice-${stamp}@test.local`)
  bob = await createTestUser(`bob-${stamp}@test.local`)

  const { data, error } = await alice.client
    .from('garments')
    .insert({ owner_id: alice.id, name: '검정 후드', category: 'top', status: 'owned' })
    .select('id')
    .single()
  if (error) throw error
  aliceGarmentId = data.id
})

afterAll(async () => {
  await deleteTestUser(alice.id)
  await deleteTestUser(bob.id)
})

describe('profiles 트리거', () => {
  it('가입 시 프로필과 share_slug가 생성된다', async () => {
    const { data } = await admin.from('profiles').select('share_slug').eq('id', alice.id).single()
    expect(data?.share_slug).toBeTruthy()
    expect(data?.share_slug).not.toMatch(/[/+]/)
  })
})

describe('비공개 옷장', () => {
  it('남의 비공개 옷장은 조회되지 않는다', async () => {
    const { data } = await bob.client.from('garments').select('id').eq('owner_id', alice.id)
    expect(data).toEqual([])
  })
})

describe('공개 옷장', () => {
  beforeAll(async () => {
    await admin.from('profiles').update({ is_wardrobe_public: true }).eq('id', alice.id)
  })

  it('공개하면 남도 조회할 수 있다', async () => {
    const { data } = await bob.client.from('garments').select('id').eq('owner_id', alice.id)
    expect(data?.length).toBe(1)
  })

  it('남의 옷장에 owned 상태로는 넣을 수 없다', async () => {
    const { error } = await bob.client.from('garments').insert({
      owner_id: alice.id, name: '침입 시도', category: 'top',
      status: 'owned', recommended_by: bob.id,
    })
    expect(error).not.toBeNull()
  })

  it('남의 공개 옷장에 추천(considering)으로는 넣을 수 있다', async () => {
    const { error } = await bob.client.from('garments').insert({
      owner_id: alice.id, name: '추천 아이템', category: 'top',
      status: 'considering', recommended_by: bob.id,
    })
    expect(error).toBeNull()
  })

  it('recommended_by를 위조하면 거부된다', async () => {
    const { error } = await bob.client.from('garments').insert({
      owner_id: alice.id, name: '위조 추천', category: 'top',
      status: 'considering', recommended_by: alice.id,
    })
    expect(error).not.toBeNull()
  })

  it('남의 옷은 수정할 수 없다', async () => {
    const { data } = await bob.client
      .from('garments').update({ name: '변조됨' }).eq('id', aliceGarmentId).select()
    expect(data).toEqual([])
  })

  it('남의 옷은 삭제할 수 없다', async () => {
    const { data } = await bob.client
      .from('garments').delete().eq('id', aliceGarmentId).select()
    expect(data).toEqual([])
  })
})

describe('musinsa_cache', () => {
  it('일반 사용자는 캐시를 읽을 수 없다', async () => {
    const { data } = await alice.client.from('musinsa_cache').select('goods_no')
    expect(data).toEqual([])
  })
})
```

- [ ] **Step 3: 환경변수를 읽도록 Vitest 설정 수정**

`vitest.config.ts`에 `.env.local` 로딩을 추가한다.

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { config } from 'dotenv'

config({ path: '.env.local' })

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

```bash
npm install -D dotenv
```

- [ ] **Step 4: 테스트 실행**

Run: `npm test -- tests/rls.test.ts`
Expected: PASS, 9 passed

실패하는 정책이 있으면 `supabase/migrations/0002_rls.sql`을 고치고 `npx supabase db reset`(로컬) 또는 `npx supabase db push`(원격) 후 다시 실행한다.

- [ ] **Step 5: 커밋**

```bash
git add tests/rls.test.ts tests/helpers/supabase.ts vitest.config.ts package.json package-lock.json
git commit -m "test: verify rls policies for wardrobe access"
```

---

### Task 8: Supabase 클라이언트와 구글 로그인

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`
- Create: `app/auth/callback/route.ts`
- Create: `components/LoginButton.tsx`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: Task 6의 `profiles` 테이블과 트리거
- Produces:
  - `createBrowserSupabase(): SupabaseClient` (`lib/supabase/client.ts`)
  - `createServerSupabase(): Promise<SupabaseClient>` (`lib/supabase/server.ts`)
  - `supabaseAdmin: SupabaseClient` (`lib/supabase/admin.ts`)

**사전 준비:** Supabase 대시보드 → Authentication → Providers → Google을 켜고, Google Cloud Console에서 OAuth 클라이언트를 만들어 Client ID/Secret을 넣는다. 승인된 리디렉션 URI에 `https://<project-ref>.supabase.co/auth/v1/callback`을 등록한다.

- [ ] **Step 1: 브라우저 클라이언트 작성**

`lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 2: 서버 클라이언트 작성**

`lib/supabase/server.ts`. **RLS가 적용되는 클라이언트다. 서버 코드에서는 기본적으로 이것을 쓴다.**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component에서는 쿠키를 쓸 수 없다. 미들웨어가 갱신을 맡으므로 무시한다.
          }
        },
      },
    },
  )
}
```

- [ ] **Step 3: 관리자 클라이언트 작성**

`lib/supabase/admin.ts`. **이 파일 외부에서 `SUPABASE_SERVICE_ROLE_KEY`를 참조하지 않는다.**

```ts
import { createClient } from '@supabase/supabase-js'

/**
 * RLS를 우회하는 클라이언트.
 * musinsa_cache 읽기/쓰기와 Storage 업로드에만 사용한다.
 * 사용자 데이터(garments 등)에는 절대 쓰지 않는다 — RLS가 무력화된다.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
```

- [ ] **Step 4: OAuth 콜백 라우트 작성**

`app/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}/wardrobe`)
  }

  return NextResponse.redirect(`${origin}/?error=login_failed`)
}
```

- [ ] **Step 5: 로그인 버튼 작성**

`components/LoginButton.tsx`:

```tsx
'use client'

import { createBrowserSupabase } from '@/lib/supabase/client'

export function LoginButton() {
  async function signIn() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <button
      onClick={signIn}
      className="rounded-lg bg-black px-6 py-3 text-white hover:bg-gray-800"
    >
      구글로 시작하기
    </button>
  )
}
```

- [ ] **Step 6: 랜딩 페이지 작성**

`app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { LoginButton } from '@/components/LoginButton'

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/wardrobe')

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-bold">살까 말까</h1>
      <p className="text-gray-600">
        가진 옷을 옷장에 모아두면, 새로 사려는 옷이 내 사이즈와 스타일에 맞는지 알려드립니다.
      </p>
      <LoginButton />
    </main>
  )
}
```

- [ ] **Step 7: 수동 검증**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 연다.

Expected:
1. 랜딩 화면과 "구글로 시작하기" 버튼이 보인다.
2. 버튼을 누르면 구글 로그인으로 이동한다.
3. 로그인 후 `/wardrobe`로 리디렉트된다 (아직 404여도 정상 — Task 12에서 만든다).
4. Supabase 대시보드 → Table Editor → `profiles`에 행이 하나 생기고 `share_slug`가 채워져 있다.

- [ ] **Step 8: 커밋**

```bash
git add lib/supabase app/auth app/page.tsx components/LoginButton.tsx
git commit -m "feat: add google oauth login with supabase"
```

---

### Task 9: 파싱 API와 캐시

**Files:**
- Create: `lib/musinsa/fetcher.ts`
- Create: `lib/musinsa/cache.ts`
- Create: `app/api/musinsa/parse/route.ts`
- Test: `tests/musinsa/fetcher.test.ts`

**Interfaces:**
- Consumes: `extractGoodsNo` (Task 3), `parseProductHtml` (Task 5), `supabaseAdmin` (Task 8)
- Produces:
  - `fetchProductHtml(url: string): Promise<string>`
  - `readCache(goodsNo: string): Promise<ParseResult | null>`
  - `writeCache(goodsNo: string, result: ParseResult): Promise<void>`
  - `POST /api/musinsa/parse` — 요청 `{ url: string }`, 응답 `ParseResult` 또는 `{ error: string }`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/musinsa/fetcher.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchProductHtml } from '@/lib/musinsa/fetcher'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchProductHtml', () => {
  it('HTML 본문을 돌려준다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>ok</html>', { status: 200 })))
    await expect(fetchProductHtml('https://www.musinsa.com/products/1')).resolves.toBe('<html>ok</html>')
  })

  it('첫 요청이 실패하면 한 번 재시도한다', async () => {
    const mock = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(new Response('<html>ok</html>', { status: 200 }))
    vi.stubGlobal('fetch', mock)

    await expect(fetchProductHtml('https://www.musinsa.com/products/1')).resolves.toBe('<html>ok</html>')
    expect(mock).toHaveBeenCalledTimes(2)
  })

  it('두 번 다 실패하면 예외를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    await expect(fetchProductHtml('https://www.musinsa.com/products/1')).rejects.toThrow()
  })

  it('403 응답은 차단으로 보고 예외를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })))
    await expect(fetchProductHtml('https://www.musinsa.com/products/1')).rejects.toThrow(/403/)
  })

  it('브라우저처럼 보이는 User-Agent를 보낸다', async () => {
    const mock = vi.fn(async () => new Response('<html></html>', { status: 200 }))
    vi.stubGlobal('fetch', mock)
    await fetchProductHtml('https://www.musinsa.com/products/1')

    const init = mock.mock.calls[0][1] as RequestInit
    expect(String((init.headers as Record<string, string>)['User-Agent'])).toMatch(/Mozilla/)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- tests/musinsa/fetcher.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 네트워크 계층 구현**

`lib/musinsa/fetcher.ts`:

```ts
const TIMEOUT_MS = 8000
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function requestOnce(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'ko-KR,ko;q=0.9',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!response.ok) throw new Error(`무신사 응답 ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

/** 상품 페이지 HTML을 가져온다. 실패 시 한 번만 재시도한다. */
export async function fetchProductHtml(url: string): Promise<string> {
  try {
    return await requestOnce(url)
  } catch (first) {
    try {
      return await requestOnce(url)
    } catch {
      throw first
    }
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/musinsa/fetcher.test.ts`
Expected: PASS, 5 passed

- [ ] **Step 5: 캐시 계층 구현**

`lib/musinsa/cache.ts`:

```ts
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ParseResult } from '@/lib/musinsa/types'

/** 가격은 변하므로 이 기간이 지나면 다시 파싱한다. 실측·이미지는 변하지 않는다. */
const PRICE_TTL_MS = 24 * 60 * 60 * 1000

export async function readCache(goodsNo: string): Promise<ParseResult | null> {
  const { data, error } = await supabaseAdmin
    .from('musinsa_cache')
    .select('payload, fetched_at')
    .eq('goods_no', goodsNo)
    .maybeSingle()

  if (error || !data) return null

  const age = Date.now() - new Date(data.fetched_at).getTime()
  if (age > PRICE_TTL_MS) return null

  return data.payload as ParseResult
}

export async function writeCache(goodsNo: string, result: ParseResult): Promise<void> {
  await supabaseAdmin
    .from('musinsa_cache')
    .upsert({ goods_no: goodsNo, payload: result, fetched_at: new Date().toISOString() })
}
```

- [ ] **Step 6: Route Handler 구현**

`app/api/musinsa/parse/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { extractGoodsNo } from '@/lib/musinsa/url'
import { fetchProductHtml } from '@/lib/musinsa/fetcher'
import { parseProductHtml } from '@/lib/musinsa/parser'
import { readCache, writeCache } from '@/lib/musinsa/cache'
import { createServerSupabase } from '@/lib/supabase/server'
import { fail, type ParseResult } from '@/lib/musinsa/types'

export const maxDuration = 30

const RequestBody = z.object({ url: z.string().min(1) })

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = RequestBody.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const goodsNo = extractGoodsNo(body.data.url)
  if (!goodsNo) {
    return NextResponse.json({ error: '무신사 상품 링크가 아닙니다.' }, { status: 400 })
  }

  const cached = await readCache(goodsNo)
  if (cached) return NextResponse.json(cached)

  let result: ParseResult
  try {
    const html = await fetchProductHtml(body.data.url)
    result = parseProductHtml(html, goodsNo)
  } catch {
    // 페이지를 아예 못 가져온 경우에도 전 필드 실패 결과를 돌려준다.
    // 화면은 수동 입력 폼으로 넘어가고, 사용자는 막히지 않는다.
    const reason = '무신사에서 상품 정보를 가져오지 못했습니다. 직접 입력해 주세요.'
    result = {
      goodsNo,
      fields: {
        name: fail(reason), brand: fail(reason), price: fail(reason),
        imageUrl: fail(reason), category: fail(reason),
        options: fail(reason), sizeTable: fail(reason),
      },
    }
    return NextResponse.json(result)
  }

  await writeCache(goodsNo, result)
  return NextResponse.json(result)
}
```

**전 필드 실패 결과도 200으로 돌려주는 것이 의도다.** 파싱이 안 됐다는 건 오류가 아니라 "수동 입력으로 넘어가라"는 신호이고, 화면은 이 응답을 받아 폴백 폼을 띄운다. 401·400만 오류 상태 코드를 쓴다. 이 경로에서는 캐시에 쓰지 않는다 — 일시적 네트워크 장애를 24시간 동안 캐시하면 안 된다.

- [ ] **Step 7: 수동 검증**

`npm run dev` 후 로그인한 상태에서 브라우저 콘솔에 붙여넣는다.

```js
await (await fetch('/api/musinsa/parse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: '<실제 무신사 상품 URL>' }),
})).json()
```

Expected: `goodsNo`와 `fields`가 담긴 객체. 같은 URL로 두 번째 호출 시 응답이 눈에 띄게 빨라진다(캐시 히트).

- [ ] **Step 8: 커밋**

```bash
git add lib/musinsa/fetcher.ts lib/musinsa/cache.ts app/api/musinsa/parse tests/musinsa/fetcher.test.ts
git commit -m "feat: add musinsa parse api with cache and retry"
```

---

### Task 10: 링크 입력과 옵션 선택 화면

파싱에 성공한 필드는 채워진 채 읽기 전용으로 잠기고, **실패한 필드만 입력 폼으로 뜬다.** 사용자는 "실패했습니다"가 아니라 "이 칸만 채워주세요"를 본다.

**Files:**
- Create: `components/LinkInputBar.tsx`
- Create: `components/GarmentForm.tsx`

**Interfaces:**
- Consumes: `ParseResult`, `PARSEABLE_FIELDS` (Task 5), `CATEGORY_LABELS` (Task 3), `POST /api/musinsa/parse` (Task 9)
- Produces:
  - `<LinkInputBar />` — 파싱 후 `<GarmentForm />`을 띄운다
  - `GarmentSubmitPayload` 타입 — Task 11의 API 요청 본문

- [ ] **Step 1: 링크 입력 바 작성**

`components/LinkInputBar.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { ParseResult } from '@/lib/musinsa/types'
import { GarmentForm } from '@/components/GarmentForm'

export function LinkInputBar() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setParsed(null)

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
          placeholder="무신사 상품 링크를 붙여넣으세요"
          className="flex-1 rounded-lg border px-4 py-2"
        />
        <button
          type="submit"
          disabled={loading || url.trim().length === 0}
          className="rounded-lg bg-black px-5 py-2 text-white disabled:bg-gray-300"
        >
          {loading ? '불러오는 중…' : '불러오기'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {parsed && (
        <GarmentForm
          parsed={parsed}
          sourceUrl={url}
          onDone={() => {
            setParsed(null)
            setUrl('')
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 옵션 선택 + 수동 폴백 폼 작성**

`components/GarmentForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORY_LABELS, type Category } from '@/lib/types'
import { PARSEABLE_FIELDS, type ParseResult, type ParseableField, type SizeTable } from '@/lib/musinsa/types'

export type GarmentSubmitPayload = {
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
  manualFields: ParseableField[]
}

type Props = {
  parsed: ParseResult
  sourceUrl: string
  onDone: () => void
}

export function GarmentForm({ parsed, sourceUrl, onDone }: Props) {
  const router = useRouter()
  const f = parsed.fields

  const manualFields = PARSEABLE_FIELDS.filter((key) => !f[key].ok)

  const [name, setName] = useState(f.name.ok ? f.name.value : '')
  const [brand, setBrand] = useState(f.brand.ok ? f.brand.value : '')
  const [price, setPrice] = useState(f.price.ok ? String(f.price.value) : '')
  const [imageUrl, setImageUrl] = useState(f.imageUrl.ok ? f.imageUrl.value : '')
  const [category, setCategory] = useState<Category>(f.category.ok ? f.category.value : 'top')

  const colors = f.options.ok ? f.options.value.colors : []
  const sizes = f.options.ok ? f.options.value.sizes : []
  const sizeTable: SizeTable = f.sizeTable.ok ? f.sizeTable.value : {}
  const sizeKeys = Object.keys(sizeTable)

  const [color, setColor] = useState(colors[0] ?? '')
  const [size, setSize] = useState(sizes[0] ?? sizeKeys[0] ?? '')
  const [manualMeasurements, setManualMeasurements] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const autoMeasurements = sizeTable[size] ?? {}

  function parseManualMeasurements(): Record<string, number> {
    // "총장 72, 가슴단면 55" 형식을 받는다.
    const entries: Record<string, number> = {}
    for (const chunk of manualMeasurements.split(',')) {
      const [key, raw] = chunk.trim().split(/\s+/)
      const value = Number(raw)
      if (key && Number.isFinite(value) && value > 0) entries[key] = value
    }
    return entries
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const payload: GarmentSubmitPayload = {
      goodsNo: parsed.goodsNo,
      sourceUrl,
      name: name.trim(),
      brand: brand.trim() || null,
      price: price ? Number(price) : null,
      imageUrl: imageUrl.trim() || null,
      category,
      colorOption: color.trim(),
      sizeOption: size.trim(),
      measurements: f.sizeTable.ok ? autoMeasurements : parseManualMeasurements(),
      manualFields,
    }

    const response = await fetch('/api/garments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSubmitting(false)

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? '옷장에 저장하지 못했습니다.')
      return
    }
    onDone()
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border p-5">
      {manualFields.length > 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          일부 정보를 자동으로 가져오지 못했습니다. 아래 표시된 칸만 채워주세요.
        </p>
      )}

      <Field label="상품명" manual={!f.name.ok}>
        <input value={name} onChange={(e) => setName(e.target.value)} readOnly={f.name.ok}
          required className="w-full rounded border px-3 py-2 read-only:bg-gray-50" />
      </Field>

      <Field label="브랜드" manual={!f.brand.ok}>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} readOnly={f.brand.ok}
          className="w-full rounded border px-3 py-2 read-only:bg-gray-50" />
      </Field>

      <Field label="가격" manual={!f.price.ok}>
        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} readOnly={f.price.ok}
          className="w-full rounded border px-3 py-2 read-only:bg-gray-50" />
      </Field>

      <Field label="카테고리" manual={!f.category.ok}>
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)}
          className="w-full rounded border px-3 py-2">
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </Field>

      <Field label="색상" manual={!f.options.ok}>
        {colors.length > 0 ? (
          <select value={color} onChange={(e) => setColor(e.target.value)}
            required className="w-full rounded border px-3 py-2">
            {colors.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <input value={color} onChange={(e) => setColor(e.target.value)} required
            placeholder="예: 블랙" className="w-full rounded border px-3 py-2" />
        )}
      </Field>

      <Field label="사이즈" manual={!f.options.ok && sizeKeys.length === 0}>
        {sizes.length > 0 || sizeKeys.length > 0 ? (
          <select value={size} onChange={(e) => setSize(e.target.value)}
            required className="w-full rounded border px-3 py-2">
            {(sizes.length > 0 ? sizes : sizeKeys).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input value={size} onChange={(e) => setSize(e.target.value)} required
            placeholder="예: L" className="w-full rounded border px-3 py-2" />
        )}
      </Field>

      <Field label="실측" manual={!f.sizeTable.ok}>
        {f.sizeTable.ok ? (
          <ul className="text-sm text-gray-700">
            {Object.entries(autoMeasurements).map(([key, value]) => (
              <li key={key}>{key} {value}cm</li>
            ))}
            {Object.keys(autoMeasurements).length === 0 && <li>선택한 사이즈의 실측 정보가 없습니다.</li>}
          </ul>
        ) : (
          <input value={manualMeasurements} onChange={(e) => setManualMeasurements(e.target.value)}
            placeholder="총장 72, 가슴단면 55, 어깨너비 46"
            className="w-full rounded border px-3 py-2" />
        )}
      </Field>

      {!f.imageUrl.ok && (
        <Field label="이미지 주소" manual>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…" className="w-full rounded border px-3 py-2" />
        </Field>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting}
        className="w-full rounded-lg bg-black py-3 text-white disabled:bg-gray-300">
        {submitting ? '저장 중…' : '옷장에 넣기'}
      </button>
    </form>
  )
}

function Field({ label, manual, children }: { label: string; manual: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">
        {label}
        {manual && <span className="ml-2 text-xs text-amber-700">직접 입력</span>}
      </span>
      {children}
    </label>
  )
}
```

- [ ] **Step 3: 커밋**

```bash
git add components/LinkInputBar.tsx components/GarmentForm.tsx
git commit -m "feat: add link input and garment form with manual fallback"
```

---

### Task 11: 옷장 등록 API

**Files:**
- Create: `app/api/garments/route.ts`
- Create: `lib/storage.ts`

**Interfaces:**
- Consumes: `GarmentSubmitPayload` (Task 10), `createServerSupabase` (Task 8), `supabaseAdmin` (Task 8), `PARSEABLE_FIELDS` (Task 5)
- Produces: `POST /api/garments` — 응답 `{ id: string }` 또는 `{ error: string }`

- [ ] **Step 1: 이미지 복사 유틸 작성**

`lib/storage.ts`:

```ts
import { supabaseAdmin } from '@/lib/supabase/admin'

const BUCKET = 'garments'

/**
 * 무신사 이미지를 내려받아 Storage에 사본을 만든다.
 * CDN URL은 만료되거나 외부 참조가 차단될 수 있으므로 직접 링크하지 않는다.
 * 실패해도 등록 자체는 진행되어야 하므로 예외 대신 null을 돌려준다.
 */
export async function copyImageToStorage(
  imageUrl: string,
  goodsNo: string,
  colorOption: string,
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    const extension = contentType.includes('png') ? 'png'
      : contentType.includes('webp') ? 'webp' : 'jpg'
    const safeColor = colorOption.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) || 'default'
    const objectPath = `${goodsNo}/${safeColor}.${extension}`

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

- [ ] **Step 2: 등록 Route Handler 작성**

`app/api/garments/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import { copyImageToStorage } from '@/lib/storage'
import { PARSEABLE_FIELDS } from '@/lib/musinsa/types'
import type { ParseMode } from '@/lib/types'

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
  manualFields: z.array(z.string()),
})

function computeParseMode(manualFieldCount: number): ParseMode {
  if (manualFieldCount === 0) return 'auto'
  if (manualFieldCount >= PARSEABLE_FIELDS.length) return 'manual'
  return 'partial'
}

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

  const storedImageUrl = input.imageUrl
    ? await copyImageToStorage(input.imageUrl, input.goodsNo, input.colorOption)
    : null

  const { data: garment, error: insertError } = await supabase
    .from('garments')
    .insert({
      owner_id: user.id,
      status: 'owned',
      source_url: input.sourceUrl,
      goods_no: input.goodsNo,
      brand: input.brand,
      name: input.name,
      price: input.price,
      image_url: storedImageUrl ?? input.imageUrl,
      category: input.category,
      color_option: input.colorOption,
      size_option: input.sizeOption,
      parse_mode: computeParseMode(input.manualFields.length),
    })
    .select('id')
    .single()

  if (insertError || !garment) {
    return NextResponse.json({ error: '옷장에 저장하지 못했습니다.' }, { status: 500 })
  }

  const rows = Object.entries(input.measurements).map(([key, value]) => ({
    garment_id: garment.id,
    key,
    value,
  }))

  if (rows.length > 0) {
    const { error: measurementError } = await supabase.from('garment_measurements').insert(rows)
    if (measurementError) {
      // 실측만 실패한 경우 옷 자체는 남기고 알린다. 상세 화면에서 나중에 채울 수 있다.
      return NextResponse.json(
        { id: garment.id, warning: '실측 정보를 저장하지 못했습니다.' },
        { status: 207 },
      )
    }
  }

  return NextResponse.json({ id: garment.id }, { status: 201 })
}
```

- [ ] **Step 3: 중복 등록 경고 확인 쿼리 추가**

같은 상품·색상·사이즈가 이미 있으면 경고만 하고 등록은 허용한다(같은 옷을 두 벌 살 수 있다). `insert` 직전에 넣는다.

```ts
  const { count: duplicateCount } = await supabase
    .from('garments')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .eq('goods_no', input.goodsNo)
    .eq('color_option', input.colorOption)
    .eq('size_option', input.sizeOption)
```

그리고 성공 응답을 다음으로 바꾼다.

```ts
  return NextResponse.json(
    {
      id: garment.id,
      ...(duplicateCount && duplicateCount > 0
        ? { warning: '이미 옷장에 같은 상품·색상·사이즈가 있습니다.' }
        : {}),
    },
    { status: 201 },
  )
```

- [ ] **Step 4: 수동 검증**

`npm run dev` 후 로그인하고, 다음 태스크에서 만들 `/wardrobe` 대신 임시로 랜딩에 `<LinkInputBar />`를 붙여 실제 무신사 링크로 등록해 본다.

Expected:
1. 링크를 넣으면 색상·사이즈 선택박스가 뜬다.
2. "옷장에 넣기"를 누르면 오류 없이 완료된다.
3. Supabase Table Editor의 `garments`에 행이 생기고 `parse_mode`가 채워져 있다.
4. `garment_measurements`에 선택한 사이즈의 실측 행들이 있다.
5. Storage의 `garments` 버킷에 이미지 파일이 올라와 있다.

- [ ] **Step 5: 커밋**

```bash
git add app/api/garments lib/storage.ts
git commit -m "feat: add garment registration api with image copy"
```

---

### Task 12: 옷장 화면

**Files:**
- Create: `app/wardrobe/page.tsx`
- Create: `components/GarmentCard.tsx`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (Task 8), `LinkInputBar` (Task 10), `CATEGORY_LABELS` (Task 3)
- Produces: `/wardrobe` 화면

- [ ] **Step 1: 이미지 도메인 허용 설정**

`next.config.ts`의 `images.remotePatterns`에 Supabase Storage 호스트를 추가한다. 와일드카드를 쓰므로 프로젝트 ref를 따로 넣을 필요는 없다.

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'image.msscdn.net' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 2: 옷장 카드 작성**

`components/GarmentCard.tsx`:

```tsx
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
    <article className="overflow-hidden rounded-xl border">
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
    </article>
  )
}
```

- [ ] **Step 3: 옷장 페이지 작성**

`app/wardrobe/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { LinkInputBar } from '@/components/LinkInputBar'
import { GarmentCard, type GarmentCardData } from '@/components/GarmentCard'
import { CATEGORY_LABELS, type Category } from '@/lib/types'

type Props = { searchParams: Promise<{ category?: string }> }

export default async function WardrobePage({ searchParams }: Props) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { category } = await searchParams

  let query = supabase
    .from('garments')
    .select('id, name, brand, price, image_url, category, color_option, size_option')
    .eq('owner_id', user.id)
    .eq('status', 'owned')
    .order('created_at', { ascending: false })

  if (category && category in CATEGORY_LABELS) {
    query = query.eq('category', category as Category)
  }

  const { data: garments } = await query

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">내 옷장</h1>

      <LinkInputBar />

      <nav className="flex flex-wrap gap-2">
        <FilterLink href="/wardrobe" label="전체" active={!category} />
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <FilterLink key={value} href={`/wardrobe?category=${value}`} label={label} active={category === value} />
        ))}
      </nav>

      {!garments || garments.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-gray-500">
          아직 등록한 옷이 없습니다. 위에 무신사 상품 링크를 붙여넣어 첫 옷을 추가해 보세요.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {garments.map((garment) => (
            <GarmentCard key={garment.id} garment={garment as GarmentCardData} />
          ))}
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
```

- [ ] **Step 4: 전체 흐름 수동 검증**

```bash
npm run dev
```

Expected:
1. 로그아웃 상태에서 `/wardrobe` 접근 시 `/`로 리디렉트된다.
2. 로그인하면 `/wardrobe`가 열리고 "아직 등록한 옷이 없습니다" 안내가 보인다.
3. 무신사 링크를 붙여넣으면 색상·사이즈 선택박스가 뜬다.
4. "옷장에 넣기"를 누르면 그리드에 카드가 나타나고 이미지·색상·사이즈가 표시된다.
5. 카테고리 필터를 누르면 해당 카테고리만 남는다.

- [ ] **Step 5: 전체 테스트 실행**

Run: `npm test`
Expected: 전체 PASS

- [ ] **Step 6: 프로덕션 빌드 확인**

Run: `npm run build`
Expected: 타입 오류 없이 빌드 성공

- [ ] **Step 7: 커밋**

```bash
git add app/wardrobe components/GarmentCard.tsx next.config.ts
git commit -m "feat: add wardrobe grid with category filter"
```

---

## 완료 기준

계획 1이 끝나면 다음이 모두 성립한다.

- [ ] `npm test`가 전부 통과한다 (URL 추출, 실측 정규화, 파서, fetcher, RLS)
- [ ] `npm run build`가 타입 오류 없이 성공한다
- [ ] 구글 로그인 후 `profiles` 행과 `share_slug`가 자동 생성된다
- [ ] 무신사 링크를 붙여넣어 색상·사이즈를 고르면 옷장에 저장된다
- [ ] 파싱이 실패한 필드만 수동 입력 폼으로 뜬다
- [ ] `garment_measurements`에 표준화된 항목명으로 실측이 쌓인다
- [ ] 상품 이미지가 Supabase Storage에 복사되어 표시된다
- [ ] 다른 사용자가 내 비공개 옷장을 조회·수정할 수 없다 (RLS 테스트로 증명)
- [ ] `docs/superpowers/notes/phase0-musinsa-findings.md`에 무신사 구조가 기록되어 있다

## 다음 계획으로 넘기는 것

- 선호도 편집(별점·핏 태그·착용빈도) 화면 — 계획 2
- `analyses` 테이블, 핏 판단 엔진(`lib/fit/*`), 판정 상수 — 계획 2
- Gemini 비전 태깅과 피드백 문장 생성 — 계획 2
- 장바구니 화면과 "샀어요" 승격 — 계획 2
- 공유 옷장, 친구 추천, 룩(`outfits`, `outfit_items`) — 계획 3
- OG 이미지, 마감 — 계획 3
