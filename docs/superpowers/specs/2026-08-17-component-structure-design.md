# 코드 구조 정리 설계 문서

작성일: 2026-08-17

## 1. 배경

계획 1~5로 스펙 전체 범위와 네비게이션·디자인·핏 강도 설정까지 구현이 끝난 뒤, 사용자가 다음에 하고 싶은 일 9가지를 정리해 왔다. 하나의 스펙으로 묶기엔 성격이 너무 다른 독립 작업들이라 6개 하위 프로젝트로 분해했고, **A(코드 구조 정리)부터 F까지 순서대로** 진행하기로 합의했다.

| # | 묶음 | 포함 항목 |
|---|---|---|
| **A** | 코드 구조 정리 | 링크 입력 3형제 중복 제거, `components/` 폴더 도메인별 정리 |
| B | 등록·삭제 UX 개선 | 폼 접기, 사이즈 입력 유연화, 삭제 버튼 디자인, 장바구니 선택·전체 삭제 |
| C | 수동 등록 | 무신사 링크 없이 사진 업로드 + 직접 입력 |
| D | 추천 → 룩 흐름 | 추천 직후 그 아이템으로 바로 룩 짜기 |
| E | 핏 판단 정밀화 | 항목별 개별 허용오차, 심각도·가중치·판정 경계값 |
| F | 가격 인하 표시 | 주기적으로 장바구니 상품 가격 재확인, "원래 얼마 → 얼마" 표시 |

이 문서는 **A**만 다룬다. B~F는 각자 별도 스펙·계획 사이클로 진행한다.

**A를 먼저 하는 이유**: B의 "폼 접기"와 C·D가 전부 `LinkInputBar`/`AnalyzeLinkBar`/`RecommendLinkBar` 세 파일을 건드린다. 중복이 남아 있으면 같은 수정을 매번 세 번씩 반복하게 되므로, 먼저 합쳐두면 이후 작업이 전부 싸진다.

**F 범위 축소 기록**: 원래 사용자가 이메일 알림까지 얘기했으나, 이메일 발송·알림 끄기 토글은 빼고 **장바구니 화면에 가격 변화만 표시**하는 것으로 합의했다. 외부 이메일 서비스 의존성이 사라져 배포 전에도 만들 수 있게 됐다. (참고: 원래 설계 스펙 §3은 "알림, 가격 인하 추적"을 명시적으로 제외 항목에 넣어뒀었다 — F는 그 결정을 되살리는 셈이다.)

## 2. 해결하려는 문제

### 2.1 링크 입력 3형제의 중복

`LinkInputBar`(옷장 등록) · `AnalyzeLinkBar`(구매 판단) · `RecommendLinkBar`(친구 추천) 세 파일이 아래를 글자 단위로 똑같이 갖고 있다:

- `url` / `loading` / `error` / `parsed` 네 개 상태 선언
- `/api/musinsa/parse` 호출 + 에러 처리 `handleSubmit` (약 20줄)
- 입력창 + "불러오기" 버튼 + 에러 문구 마크업 (약 10줄)

합쳐서 **약 90줄이 3벌 복사**돼 있다. 계획 3·계획 4에서 두 번 "rule of three"로 기록만 남기고 미뤄뒀던 항목이다.

세 파일이 **진짜로 다른** 부분은 다음뿐이다:

| 파일 | 다른 점 |
|---|---|
| `LinkInputBar` | placeholder, `/api/garments` + "옷장에 넣기", 제출 후 초기화 + `router.refresh()` |
| `AnalyzeLinkBar` | placeholder, `/api/analyze` + "판단하기", 제출 후 결과 카드 렌더 |
| `RecommendLinkBar` | placeholder, `/api/recommend` + "추천하기" + `noteField` + `extraBody`, 제출 후 완료 메시지 |

### 2.2 평평한 components 폴더

`components/` 최상위에 17개 파일이 나열돼 있고 `nav/`·`ui/`만 하위 폴더로 분리돼 있다. 어떤 게 옷장용이고 어떤 게 판단용인지 파일 이름으로만 구분해야 한다.

### 2.3 이 문서가 다루지 않는 것 (사용자 요청의 정정)

사용자는 "React 컨벤션에 맞게 폴더링하고 `App.jsx`는 컴포넌트를 조립하는 형태로 가볍게"라고 요청했으나, **이 프로젝트에 `App.jsx`는 없고 만들지 않는다.** Create React App/Vite 같은 SPA의 구조이고, 이 프로젝트는 Next.js App Router라서 그 역할을 `app/layout.tsx`와 각 `page.tsx`가 이미 맡고 있다. "페이지는 조립만 하고 가볍게"라는 의도도 이미 충족돼 있다 — 예를 들어 `app/(app)/mypage/page.tsx`는 데이터를 가져와 `ShareToggle`·`FitStrictnessSlider`·`LogoutButton`을 배치하는 게 전부다. 사용자에게 이 점을 알렸고, A는 **중복 제거 + 폴더 정리**로 범위를 확정했다.

## 3. 새로 만드는 모듈

### 3.1 `components/garment/useMusinsaParse.ts`

상태와 파싱 API 호출을 담는 훅.

```ts
export function useMusinsaParse(options?: { onStart?: () => void }): {
  url: string
  setUrl: (url: string) => void
  loading: boolean
  error: string | null
  parsed: ParseResult | null
  submit: (event: React.FormEvent) => Promise<void>
  /** url과 parsed를 비운다. 제출 성공 후 입력 상태를 되돌릴 때 쓴다. */
  reset: () => void
}
```

`onStart`가 필요한 이유: 세 파일 중 둘이 파싱 외에 자기만의 결과 상태를 갖고 있고, 새 링크를 파싱하기 시작할 때 그것을 지워야 한다. 현재는 각자의 `handleSubmit` 안에서 지우는데 그 함수가 훅으로 옮겨가므로 훅이 대신 불러줘야 한다.

| 파일 | 지워야 할 상태 | 현재 코드 |
|---|---|---|
| `AnalyzeLinkBar` | `result` (판단 결과) | `setResult(null)` |
| `RecommendLinkBar` | `done` (완료 메시지) | `setDone(false)` |
| `LinkInputBar` | 없음 | — |

`LinkInputBar`만 이 옵션 없이 `useMusinsaParse()`를 그냥 호출한다.

`useCallback`·`useMemo`로 감싸지 않는다 — 현재 세 파일이 컴포넌트 본문에 평범한 `async function`을 두는 방식이고, 이 규모에서 메모이제이션은 이득 없이 코드만 복잡해진다.

### 3.2 `components/garment/MusinsaLinkInput.tsx`

입력창 + "불러오기" 버튼 + 에러 문구 마크업.

```ts
type Props = {
  url: string
  setUrl: (url: string) => void
  loading: boolean
  error: string | null
  submit: (event: React.FormEvent) => void
  placeholder: string
}
```

호출하는 쪽은 훅 결과를 그대로 펼쳐 넘긴다: `<MusinsaLinkInput {...parse} placeholder="…" />`. 훅이 추가로 돌려주는 `parsed`·`reset`이 함께 펼쳐지지만, JSX 스프레드는 TypeScript의 초과 속성 검사 대상이 아니고 컴포넌트는 모르는 prop을 무시하므로 문제없다.

## 4. 세 파일에 남는 것

각 파일은 자기만의 엔드포인트·라벨·제출 후 동작만 남기고 25~35줄로 줄어든다. 예를 들어 `LinkInputBar`는 이렇게 된다:

```tsx
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

`AnalyzeLinkBar`는 `reset()`을 부르지 않는다 — 현재 동작이 제출 후에도 입력 URL을 남겨두고 `{parsed && !result && …}`로 폼만 감추는 방식이기 때문이다. 이 차이를 그대로 보존한다.

## 5. 폴더 구조

`ui/`·`nav/`는 그대로 두고, 최상위 17개 파일을 도메인별 4개 폴더로 옮긴다(`garment/` 8 + `analyze/` 3 + `share/` 3 + `account/` 3 = 17). `garment/`는 여기에 새로 만드는 2개(`useMusinsaParse`, `MusinsaLinkInput`)가 더해져 10개가 된다.

```
components/
  ui/          Button, styles                          (기존 유지)
  nav/         AppHeader, MobileTabBar, PublicHeader    (기존 유지)

  garment/     GarmentForm, PasteSizeTableField,
               useMusinsaParse, MusinsaLinkInput,
               LinkInputBar, GarmentCard, CartItemCard,
               MeasurementsTable, PreferenceForm,
               DeleteGarmentButton

  analyze/     AnalyzeLinkBar, VerdictBadge, DeviationReport

  share/       ShareToggle, RecommendLinkBar, OutfitBuilder

  account/     LoginButton, LogoutButton, FitStrictnessSlider
```

`garment/`가 10개로 가장 크지만 전부 "옷 하나를 등록·표시·편집하는 일"이라 진짜 한 도메인이다.

**영향 범위**: `@/components`를 import하는 파일 24개, import 줄 48개가 바뀐다. 순수한 경로 변경이라 기능 영향은 없다.

**이동 방법**: 계획 4에서 Windows의 `git mv`로 디렉터리를 통째 옮기려다 "Permission denied"로 실패한 전례가 있으므로, **파일 단위로 `git mv`** 한다. 파일 단위 이동은 Git 이력이 rename으로 보존된다.

## 6. 검증

이 프로젝트의 Vitest는 `environment: 'node'`, `include: ['tests/**/*.test.ts']`이고 jsdom·React Testing Library가 없다. 컴포넌트·훅 테스트 인프라를 새로 도입하는 건 A의 범위를 크게 벗어나므로 하지 않는다(§7 참고). 대신:

- **`npm run build`** — 순수한 파일 이동이므로 import 경로가 하나라도 어긋나면 반드시 잡힌다. 이 리팩터링에서 가장 강력한 검증 수단이다.
- **`npm test`** — 기존 107개 회귀. UI 리팩터링이라 영향이 없어야 하며, 깨지면 그 자체가 신호다.
- **브라우저 수동 검증** — 세 흐름을 끝까지 확인한다:
  1. `/wardrobe`: 링크 입력 → 폼 → "옷장에 넣기" → 목록이 갱신되고 입력창이 비워짐
  2. `/analyze`: 링크 입력 → 폼 → "판단하기" → 판정 배지 + 편차 표가 뜨고 폼이 사라짐
  3. `/u/[share_slug]`(타 계정 옷장): 링크 입력 → 폼 → "추천하기" → 완료 메시지. 이어서 새 링크를 넣으면 완료 메시지가 사라지는지(`onStart` 동작) 확인

**기능 변화는 0이다.** 동작이 하나라도 달라지면 그것은 버그다.

## 7. 범위 밖

- **컴포넌트 테스트 인프라(jsdom·RTL) 도입** — 별도로 판단할 큰 결정이고, 도입하면 A의 diff가 두 배가 된다.
- **`GarmentForm` 내부 리팩터링** — B에서 폼 접기·사이즈 입력 유연화를 하며 어차피 손댈 파일이라, 지금 건드리면 충돌만 난다.
- **`lib/` 구조 변경** — 현재 `lib/`에는 React 의존이 전혀 없고 node 환경 테스트가 그대로 import한다. 이 경계가 유지되도록 새 훅은 `lib/`이 아니라 `components/garment/`에 둔다.
