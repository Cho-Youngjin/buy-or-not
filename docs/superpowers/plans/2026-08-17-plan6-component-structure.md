# 코드 구조 정리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** 링크 입력 3형제(`LinkInputBar`/`AnalyzeLinkBar`/`RecommendLinkBar`)의 중복 90줄을 훅 하나와 컴포넌트 하나로 합치고, `components/` 최상위 17개 파일을 도메인별 4개 폴더로 정리한다.

**Architecture:** 파싱 상태·API 호출은 `useMusinsaParse` 훅으로, 입력창·버튼·에러 마크업은 `MusinsaLinkInput` 컴포넌트로 뽑는다. 세 파일에는 각자 진짜로 다른 부분(엔드포인트·버튼 라벨·제출 후 동작)만 남는다. 폴더 이동은 중복 제거가 끝난 뒤 별도 태스크로 진행해, 로직 변경 diff와 경로 변경 diff가 섞이지 않게 한다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Tailwind CSS v4 · Vitest(node 환경)

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-17-component-structure-design.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- **기능 변화는 0이다.** 화면에 보이는 것, 클릭했을 때 일어나는 일이 하나라도 달라지면 그것은 버그다. 이 계획은 순수 리팩터링이다.
- TypeScript `strict: true`, `any` 금지. `npm run build`가 타입 에러 0개로 통과해야 한다.
- 사용자에게 하는 설명·요약·질문, 그리고 UI 문구는 한국어로 쓴다.
- 기능 단위마다 그 코드가 무엇을 하고 왜 그렇게 짰는지 설명하는 주석을 남긴다 (이 프로젝트의 학습 목적 예외 규칙).
- 태스크마다 커밋하고 push한다. 여러 태스크를 한 커밋에 몰아넣지 않는다.
- 커밋 메시지에 `Co-Authored-By: Claude` 등 AI 기여자 트레일러를 넣지 않는다.
- **새 의존성을 설치하지 않는다.** 특히 컴포넌트 테스트 인프라(jsdom·React Testing Library)는 이 계획의 범위 밖이다(스펙 §7).
- **`lib/`에는 React 의존을 넣지 않는다.** node 환경 Vitest가 `lib/`를 그대로 import하므로, 새 훅은 `lib/`이 아니라 `components/garment/`에 둔다.
- 파일 이동은 **파일 단위 `git mv`**로 한다. 계획 4에서 Windows의 `git mv`로 디렉터리를 통째 옮기려다 "Permission denied"로 실패한 전례가 있다.

### 이 계획의 테스트 전략

이 프로젝트의 Vitest는 `environment: 'node'`, `include: ['tests/**/*.test.ts']`이고 jsdom·React Testing Library가 없다. 훅과 컴포넌트를 렌더링해 테스트할 방법이 없으므로 이 계획에는 **새 단위 테스트가 없다.** 대신:

- **`npm run build`** — 순수한 경로·구조 변경이라 import가 하나라도 어긋나면 반드시 잡힌다. 이 리팩터링에서 가장 강력한 검증 수단이다.
- **`npm test`** — 기존 107개 회귀. 이 계획은 `lib/`를 건드리지 않으므로 전부 통과해야 하고, 하나라도 깨지면 그 자체가 신호다.
- **브라우저 수동 검증** — 세 흐름을 끝까지 확인한다. 태스크마다 무엇을 열어 무엇을 보는지 구체적으로 적어 두었다.

### 사전 확인된 사실 (계획 작성 중 실제로 검증함)

- `components/` 최상위 `.tsx` 파일은 **17개**다. 폴더 배정 합계도 17로 일치한다(garment 8 + analyze 3 + share 3 + account 3).
- `@/components`를 import하는 파일은 **24개**, import 줄은 **48개**다.
- `tests/`는 `@/components`를 **전혀 import하지 않는다** — 테스트 파일은 경로 치환 대상이 아니다.
- 모든 import가 **홑따옴표**를 쓴다.
- 컴포넌트 이름 중 **한 이름이 다른 이름의 접두어인 경우가 없다** — 그래서 Task 2의 일괄 치환이 안전하다.

---

## Task 1: 중복 제거 — 훅과 입력창 컴포넌트 추출

폴더는 아직 옮기지 않는다. 새로 만드는 두 파일만 최종 위치(`components/garment/`)에 바로 만들어, Task 2에서 다시 옮기는 헛수고를 피한다.

**Files:**
- Create: `components/garment/useMusinsaParse.ts`
- Create: `components/garment/MusinsaLinkInput.tsx`
- Modify: `components/LinkInputBar.tsx` (전체 교체)
- Modify: `components/AnalyzeLinkBar.tsx` (전체 교체)
- Modify: `components/RecommendLinkBar.tsx` (전체 교체)

**Interfaces:**
- Produces: `useMusinsaParse(options?: { onStart?: () => void })` → `{ url: string; setUrl: (url: string) => void; loading: boolean; error: string | null; parsed: ParseResult | null; submit: (event: FormEvent) => Promise<void>; reset: () => void }`
- Produces: `MusinsaLinkInput` — `props: { url: string; setUrl: (url: string) => void; loading: boolean; error: string | null; submit: (event: FormEvent) => void; placeholder: string }` (`Promise<void>`는 `void`에 대입 가능하므로 훅의 `submit`을 그대로 넘길 수 있다)
- Consumes: 기존 `GarmentForm`(`@/components/GarmentForm`), `Button`(`@/components/ui/Button`), `INPUT`·`CARD_SURFACE`(`@/components/ui/styles`) — 시그니처 변경 없음

- [ ] **Step 1: `components/garment/useMusinsaParse.ts` 생성**

기존 컴포넌트들은 `React.FormEvent`처럼 전역 `React` 네임스페이스를 그냥 참조하지만, 이 파일은 이 코드베이스에서 **React 타입을 쓰는 첫 `.ts`(비 `.tsx`) 파일**이다. 전역 참조가 모듈 파일에서 되는지 애매한 영역이라, 여기서는 `import type`으로 명시해 불확실성을 없앤다(타입 전용 import라 런타임 비용은 0이다).

```ts
'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ParseResult } from '@/lib/musinsa/types'

type Options = {
  /**
   * 새 파싱이 시작될 때 호출된다. 링크 입력 바가 각자 갖고 있는 추가 결과 상태
   * (판단 결과·추천 완료 메시지)를 지우는 데 쓴다 — 새 링크를 넣었는데 이전 결과가
   * 그대로 남아 있으면 안 되기 때문이다. LinkInputBar는 그런 상태가 없어 쓰지 않는다.
   */
  onStart?: () => void
}

/**
 * 무신사 링크를 받아 /api/musinsa/parse를 호출하는 상태 묶음.
 * 옷장 등록·구매 판단·친구 추천 세 화면이 이 로직(상태 4개 + fetch + 에러 처리)을
 * 글자 단위로 똑같이 복사해 갖고 있었다 — 이제 여기 한 곳에만 있다.
 *
 * useCallback으로 감싸지 않는다: 기존 세 컴포넌트가 본문에 평범한 async 함수를 두던 방식이고,
 * 이 규모에서 메모이제이션은 이득 없이 코드만 복잡해진다.
 */
export function useMusinsaParse(options?: Options) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    options?.onStart?.()
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

  /** 제출 성공 후 입력 상태를 되돌린다(입력창 비우기 + 폼 감추기). */
  function reset() {
    setParsed(null)
    setUrl('')
  }

  return { url, setUrl, loading, error, parsed, submit, reset }
}
```

- [ ] **Step 2: `components/garment/MusinsaLinkInput.tsx` 생성**

```tsx
'use client'

import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { INPUT } from '@/components/ui/styles'

type Props = {
  url: string
  setUrl: (url: string) => void
  loading: boolean
  error: string | null
  /** 훅의 submit은 Promise<void>를 돌려주지만 여기서는 기다리지 않으므로 void로 받는다. */
  submit: (event: FormEvent) => void
  placeholder: string
}

/**
 * 무신사 링크 입력창 + 불러오기 버튼 + 에러 문구.
 *
 * useMusinsaParse의 반환값을 그대로 펼쳐 넘기는 걸 전제로 한다:
 *   <MusinsaLinkInput {...parse} placeholder="…" />
 * 훅이 추가로 돌려주는 parsed·reset도 같이 펼쳐지지만, JSX 스프레드는 TypeScript의
 * 초과 속성 검사 대상이 아니고 컴포넌트는 모르는 prop을 무시하므로 문제없다.
 *
 * div가 아니라 프래그먼트로 감싸는 것이 중요하다: 부모의 space-y-4가 form·에러 문구·
 * GarmentForm을 각각 직접 자식으로 보고 간격을 주고 있어서, div로 묶으면 셋이 한 덩어리가
 * 되어 지금과 간격이 달라진다. 이 리팩터링은 화면이 바뀌면 안 된다.
 */
export function MusinsaLinkInput({ url, setUrl, loading, error, submit, placeholder }: Props) {
  return (
    <>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={placeholder}
          className={`${INPUT} flex-1`}
        />
        <Button type="submit" disabled={loading || url.trim().length === 0}>
          {loading ? '불러오는 중…' : '불러오기'}
        </Button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}
    </>
  )
}
```

- [ ] **Step 3: `components/LinkInputBar.tsx` 전체 교체**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { GarmentForm } from '@/components/GarmentForm'
import { useMusinsaParse } from '@/components/garment/useMusinsaParse'
import { MusinsaLinkInput } from '@/components/garment/MusinsaLinkInput'

/**
 * 옷장 등록의 진입점.
 * 링크 파싱은 useMusinsaParse가, 입력 UI는 MusinsaLinkInput이 맡는다 —
 * 여기 남은 건 "어디로 저장할지"와 "저장 후 무엇을 할지"뿐이다.
 */
export function LinkInputBar() {
  const router = useRouter()
  const parse = useMusinsaParse()

  return (
    <div className="space-y-4">
      <MusinsaLinkInput {...parse} placeholder="무신사 상품 링크를 붙여넣으세요" />

      {parse.parsed && (
        <GarmentForm
          parsed={parse.parsed}
          sourceUrl={parse.url}
          submitEndpoint="/api/garments"
          submitLabel="옷장에 넣기"
          onSubmitted={() => {
            parse.reset()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: `components/AnalyzeLinkBar.tsx` 전체 교체**

`INPUT`은 더 이상 여기서 쓰지 않으므로 import에서 빠지고 `CARD_SURFACE`만 남는 점에 주의한다.

```tsx
'use client'

import { useState } from 'react'
import { GarmentForm } from '@/components/GarmentForm'
import { VerdictBadge } from '@/components/VerdictBadge'
import { DeviationReport } from '@/components/DeviationReport'
import { useMusinsaParse } from '@/components/garment/useMusinsaParse'
import { MusinsaLinkInput } from '@/components/garment/MusinsaLinkInput'
import { CARD_SURFACE } from '@/components/ui/styles'
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

  return (
    <div className="space-y-4">
      <MusinsaLinkInput {...parse} placeholder="구매를 고민 중인 무신사 상품 링크를 붙여넣으세요" />

      {parse.parsed && !result && (
        <GarmentForm
          parsed={parse.parsed}
          sourceUrl={parse.url}
          submitEndpoint="/api/analyze"
          submitLabel="판단하기"
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

여기서는 `parse.reset()`을 부르지 않는다 — 기존 동작이 판단 후에도 입력 URL을 남겨두고 `{parsed && !result && …}`로 폼만 감추는 방식이기 때문이다. 이 차이를 그대로 보존한다.

- [ ] **Step 5: `components/RecommendLinkBar.tsx` 전체 교체**

```tsx
'use client'

import { useState } from 'react'
import { GarmentForm } from '@/components/GarmentForm'
import { useMusinsaParse } from '@/components/garment/useMusinsaParse'
import { MusinsaLinkInput } from '@/components/garment/MusinsaLinkInput'

type Props = { wardrobeOwnerId: string }

export function RecommendLinkBar({ wardrobeOwnerId }: Props) {
  const [done, setDone] = useState(false)
  // 새 링크를 파싱하기 시작하면 이전 완료 메시지를 지운다 — 기존 handleSubmit의 setDone(false)와 같은 역할.
  const parse = useMusinsaParse({ onStart: () => setDone(false) })

  return (
    <div className="space-y-4">
      <MusinsaLinkInput {...parse} placeholder="추천하고 싶은 무신사 상품 링크를 붙여넣으세요" />

      {parse.parsed && !done && (
        <GarmentForm
          parsed={parse.parsed}
          sourceUrl={parse.url}
          submitEndpoint="/api/recommend"
          submitLabel="추천하기"
          noteField
          extraBody={{ wardrobeOwnerId }}
          onSubmitted={() => {
            parse.reset()
            setDone(true)
          }}
        />
      )}

      {done && <p className="text-sm text-ink">추천했습니다! 상대방의 장바구니에 담겼습니다.</p>}
    </div>
  )
}
```

- [ ] **Step 6: 빌드와 테스트 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 107개 전부 통과.

- [ ] **Step 7: 중복이 실제로 사라졌는지 확인**

```bash
grep -c "api/musinsa/parse" components/LinkInputBar.tsx components/AnalyzeLinkBar.tsx components/RecommendLinkBar.tsx components/garment/useMusinsaParse.ts
```

Expected: 세 링크 바는 전부 `0`, `useMusinsaParse.ts`만 `1`. 링크 바 중 하나라도 0이 아니면 그 파일 교체가 덜 된 것이다.

- [ ] **Step 8: 브라우저로 세 흐름을 끝까지 확인**

개발 서버(`npm run dev`)를 띄우고 로그인한 상태에서:

1. **옷장 등록** — `/wardrobe`에서 무신사 링크를 넣고 "불러오기" → 폼이 뜨는지 → 색상·사이즈를 채우고 "옷장에 넣기" → **목록이 갱신되고 입력창이 비워지는지**
2. **구매 판단** — `/analyze`에서 링크를 넣고 "불러오기" → 폼 → "판단하기" → **판정 배지와 편차 표가 뜨고 폼이 사라지는지**. 이어서 **같은 입력창에 새 링크를 넣고 "불러오기"를 누르면 이전 판정 결과가 사라지는지**(`onStart` 동작)
3. **친구 추천** — 다른 계정의 공유 옷장(`/u/[share_slug]`)에서 링크를 넣고 "불러오기" → 폼 → "추천하기" → **"추천했습니다" 메시지가 뜨는지**. 이어서 **새 링크를 넣고 "불러오기"를 누르면 그 메시지가 사라지는지**(`onStart` 동작)

세 흐름 모두 리팩터링 전과 **똑같이** 동작해야 한다. 검증하며 만든 옷·분석 데이터는 확인 후 정리한다.

- [ ] **Step 9: 커밋**

```bash
git add components/garment/useMusinsaParse.ts components/garment/MusinsaLinkInput.tsx components/LinkInputBar.tsx components/AnalyzeLinkBar.tsx components/RecommendLinkBar.tsx
git commit -m "refactor: extract shared musinsa link parsing into hook and input"
git push
```

---

## Task 2: components 폴더를 도메인별로 정리

**Files:**
- Move → `components/garment/`: `GarmentForm.tsx`, `PasteSizeTableField.tsx`, `LinkInputBar.tsx`, `GarmentCard.tsx`, `CartItemCard.tsx`, `MeasurementsTable.tsx`, `PreferenceForm.tsx`, `DeleteGarmentButton.tsx`
- Move → `components/analyze/`: `AnalyzeLinkBar.tsx`, `VerdictBadge.tsx`, `DeviationReport.tsx`
- Move → `components/share/`: `ShareToggle.tsx`, `RecommendLinkBar.tsx`, `OutfitBuilder.tsx`
- Move → `components/account/`: `LoginButton.tsx`, `LogoutButton.tsx`, `FitStrictnessSlider.tsx`
- Modify: `@/components/<Name>`을 import하는 모든 파일 (24개, 48줄)
- 변경 없음: `components/ui/`, `components/nav/`, `components/garment/useMusinsaParse.ts`, `components/garment/MusinsaLinkInput.tsx`

**Interfaces:**
- Consumes: Task 1이 만든 두 파일은 이미 `components/garment/`에 있으므로 경로가 바뀌지 않는다.
- Produces: 컴포넌트의 export 이름·props는 하나도 바뀌지 않는다. **import 경로만** 바뀐다.

- [ ] **Step 1: 폴더를 만들고 파일을 옮긴다**

계획 4에서 Windows의 `git mv`로 디렉터리를 통째 옮기다 "Permission denied"로 실패했으므로 파일 단위로 옮긴다.

```bash
mkdir -p components/garment components/analyze components/share components/account

for f in GarmentForm PasteSizeTableField LinkInputBar GarmentCard CartItemCard MeasurementsTable PreferenceForm DeleteGarmentButton; do
  git mv "components/$f.tsx" "components/garment/$f.tsx"
done

for f in AnalyzeLinkBar VerdictBadge DeviationReport; do
  git mv "components/$f.tsx" "components/analyze/$f.tsx"
done

for f in ShareToggle RecommendLinkBar OutfitBuilder; do
  git mv "components/$f.tsx" "components/share/$f.tsx"
done

for f in LoginButton LogoutButton FitStrictnessSlider; do
  git mv "components/$f.tsx" "components/account/$f.tsx"
done
```

- [ ] **Step 2: 옮겨졌는지 확인**

```bash
ls components/*.tsx 2>/dev/null && echo "!! 최상위에 남은 파일이 있다" || echo "OK: 최상위 .tsx 없음"
ls components/garment components/analyze components/share components/account
```

Expected: "OK: 최상위 .tsx 없음"이 나오고, `garment/`에 10개(옮긴 8 + Task 1의 2), `analyze/`·`share/`·`account/`에 각 3개.

- [ ] **Step 3: import 경로를 일괄 치환한다**

이름 접두어 충돌이 없음을 계획 작성 중 확인했으므로 단순 문자열 치환이 안전하다. 또한 치환 후 문자열(`@/components/garment/GarmentForm`)에는 원래 패턴(`@/components/GarmentForm`)이 더 이상 포함되지 않으므로 두 번 실행해도 경로가 중첩되지 않는다.

```bash
for pair in \
  "GarmentForm:garment" "PasteSizeTableField:garment" "LinkInputBar:garment" \
  "GarmentCard:garment" "CartItemCard:garment" "MeasurementsTable:garment" \
  "PreferenceForm:garment" "DeleteGarmentButton:garment" \
  "AnalyzeLinkBar:analyze" "VerdictBadge:analyze" "DeviationReport:analyze" \
  "ShareToggle:share" "RecommendLinkBar:share" "OutfitBuilder:share" \
  "LoginButton:account" "LogoutButton:account" "FitStrictnessSlider:account"
do
  name="${pair%%:*}"
  dir="${pair##*:}"
  grep -rl "@/components/$name" app components --include="*.tsx" --include="*.ts" \
    | xargs -r sed -i "s|@/components/$name|@/components/$dir/$name|g"
done
```

`tests/`는 대상에서 뺐다 — 계획 작성 중 확인한 대로 테스트 파일은 `@/components`를 전혀 import하지 않는다.

- [ ] **Step 4: 옛 경로가 남아 있지 않은지 확인**

```bash
grep -rn "@/components/[A-Z]" app components --include="*.tsx" --include="*.ts" || echo "OK: 최상위를 직접 가리키는 import 없음"
```

Expected: "OK: 최상위를 직접 가리키는 import 없음". 대문자로 시작하는 경로가 남아 있으면 그 파일이 아직 옛 위치를 가리키는 것이다(`ui/`·`nav/`는 소문자라 이 검색에 안 걸린다).

- [ ] **Step 5: 빌드와 테스트 확인**

```bash
npm run build
npm test
```

Expected: 빌드 타입 에러 0개, 테스트 107개 전부 통과. **이 단계가 이 태스크의 핵심 검증이다** — 경로가 하나라도 틀리면 빌드가 반드시 실패한다.

빌드가 "Module not found"로 실패하면 Step 3의 치환에서 빠진 이름이 있다는 뜻이므로, 에러가 가리키는 경로를 확인해 해당 이름을 Step 3 목록과 대조한다.

- [ ] **Step 6: 브라우저로 각 화면이 정상인지 확인**

빌드가 통과해도 실제 화면을 한 번 훑는다. 로그인한 상태에서 `/wardrobe` · `/wardrobe/<옷 id>` · `/analyze` · `/cart` · `/looks` · `/mypage`를 차례로 열어 각 화면이 에러 없이 뜨고 요소들이 그대로인지 확인한다. 비로그인 상태로 `/u/<share_slug>`도 한 번 연다.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "refactor: group components into domain folders"
git push
```

---

## Task 3: README 기록

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 맨 끝에 절을 추가한다**

기존 절들과 같은 형식(문제 / 원인 / 해결 / 검증 / 결과)으로 쓴다. **이 계획을 실행하며 실제로 겪은 문제만 적는다** — 미리 예상한 문제를 적지 않는다. 겪은 문제가 없었다면 그렇게 쓰고, 대신 이번에 내린 설계 판단과 근거를 남긴다.

최소한 아래는 계획 작성·실행 중 실제로 확인된 사실이라 기록할 가치가 있다:

- 사용자가 "React 컨벤션대로 `App.jsx`를 만들어 조립하게 해달라"고 요청했지만 이 프로젝트는 Next.js App Router라 `App.jsx`가 없고 만들면 안 되며, 그 역할은 이미 `app/layout.tsx`와 각 `page.tsx`가 하고 있다는 것 — 요청을 그대로 따르지 않고 의도를 확인해 범위를 "중복 제거 + 폴더 정리"로 바로잡은 과정
- 스펙에는 `onStart`가 `RecommendLinkBar`에만 필요하다고 적었는데, 계획을 쓰며 실제 코드를 읽어보니 `AnalyzeLinkBar`도 `handleSubmit`에서 `setResult(null)`을 하고 있어 **둘 다** 필요했다는 것 (스펙을 고쳐 커밋함)
- `MusinsaLinkInput`을 `div`가 아니라 **프래그먼트**로 감싸야 했던 이유 — 부모의 `space-y-4`가 form·에러 문구를 각각 직접 자식으로 보고 간격을 주고 있어서, div로 묶으면 화면 간격이 달라진다. "기능 변화 0"이 목표인 리팩터링에서 놓치기 쉬운 부분이다.
- 로직 변경(Task 1)과 경로 변경(Task 2)을 굳이 다른 커밋으로 나눈 이유 — 48줄의 기계적인 import 변경에 로직 diff가 섞이면 리뷰가 불가능해진다.
- 컴포넌트 테스트 인프라가 없어 이 리팩터링의 주 검증 수단이 `npm run build`였다는 것 (순수 구조 변경에서는 오히려 강력한 검증이다)

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: log component structure cleanup"
git push
```

---

## 남은 일 (이 계획 밖)

합의한 A~F 중 A만 이 계획이 다룬다. 나머지는 각자 별도 스펙·계획 사이클로 진행한다.

- **B. 등록·삭제 UX 개선** — 폼 접기, 사이즈 입력 유연화(`2 (L)`·숫자만·영어만), 삭제 버튼 디자인, 장바구니 선택·전체 삭제
- **C. 수동 등록** — 무신사 링크 없이 사진 업로드 + 직접 입력. `garments.source_url`·`goods_no`가 nullable이고 `parse_mode`에 `'manual'` 기본값이 이미 있어 DB 변경 없이 가능할 수 있다.
- **D. 추천 → 룩 흐름** — 추천 직후 그 아이템으로 바로 룩 짜기
- **E. 핏 판단 정밀화** — 항목별 개별 허용오차, 심각도·가중치·판정 경계값
- **F. 가격 인하 표시** — 주기적으로 장바구니 상품 가격 재확인, "원래 얼마 → 얼마" 표시. 이메일·알림 토글은 범위에서 뺐다.
- **`MUSINSA_CATEGORY_MAP` 확장** — 액세서리류의 실제 무신사 대분류명을 확인하면 추가한다(커밋 `2893adf` 참고).
