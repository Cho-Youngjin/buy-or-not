# 등록·삭제 UX 개선 설계 문서

작성일: 2026-08-17

## 1. 배경

계획 6(코드 구조 정리, A)에 이어 합의한 순서(A→F)대로 **B: 등록·삭제 UX 개선**을 진행한다. 사용자가 실제로 앱을 써보며 겪은 불편 4가지를 다룬다:

| # | 항목 | 문제 |
|---|---|---|
| 1 | 폼 접기 | 링크를 잘못 넣었거나 등록을 취소하고 싶을 때 폼을 닫을 방법이 없다 |
| 2 | 사이즈 매칭 유연화 | 상품 옵션이 `"2 (L)"`인데 실측표 행 라벨은 `"L"`만 있으면 정확히 같지 않아 자동 채움이 안 된다 |
| 3 | 삭제 버튼 디자인 | 옷장 상세의 삭제 버튼이 밑줄 그은 빨간 텍스트 링크뿐이라 눈에 잘 안 띄고 다른 버튼들과 스타일이 다르다 |
| 4 | 장바구니 선택·전체 삭제 | 장바구니에 쌓인 "고민만 하고 안 산" 옷을 하나씩만 지울 수 있다 |

## 2. 섹션 1 — 폼 접기

`useMusinsaParse`(계획 6에서 만든 훅)에 이미 있는 `reset()`을 그대로 재사용한다. `reset()`은 `parsed`와 `url`을 모두 비우므로 "접기 = 완전히 처음 상태로 되돌리기"라는 사용자 요구와 정확히 맞아떨어진다 — 새 메서드를 추가할 필요가 없다.

`GarmentForm`에 `onCancel?: () => void` prop을 추가하고, 값이 주어지면 폼 상단(안내 문구 옆)에 "접기" 텍스트 버튼을 렌더링한다. 세 화면(`LinkInputBar`/`AnalyzeLinkBar`/`RecommendLinkBar`) 모두 `<GarmentForm onCancel={parse.reset} .../>`로 넘긴다.

```ts
// components/garment/GarmentForm.tsx의 Props에 추가
onCancel?: () => void
```

```tsx
{manualFields.length > 0 && (
  <p className="rounded-btn border border-border bg-canvas p-3 text-sm text-ink-muted">
    일부 정보를 자동으로 가져오지 못했습니다. 아래 표시된 칸만 채워주세요.
  </p>
)}

{onCancel && (
  <button type="button" onClick={onCancel} className="text-sm text-ink-muted underline">
    접기
  </button>
)}
```

## 3. 섹션 2 — 사이즈 매칭 유연화

새 순수 함수 `lib/musinsa/sizeMatch.ts`를 만든다.

```ts
/** 라벨에서 숫자 토큰과 영단어 토큰을 뽑는다. "2 (L)" → ["2", "L"]. */
function extractSizeTokens(label: string): string[]

/** 두 라벨의 토큰 집합에 교집합이 있으면 매칭으로 본다. 대소문자 구분 없음. */
export function sizesMatch(a: string, b: string): boolean
```

- `extractSizeTokens`는 정규식 `/[A-Za-z]+|\d+/g`로 숫자 덩어리와 영문자 덩어리를 모두 뽑는다. `"2 (L)"` → `["2", "L"]`, `"XL"` → `["XL"]`, `"95"` → `["95"]`.
- `sizesMatch`는 양쪽 토큰을 대문자로 정규화한 뒤 교집합이 있는지 본다. `"XL"`과 `"L"`은 토큰이 각각 `["XL"]`/`["L"]`로 서로 다른 토큰이라 **오매칭되지 않는다**(단순 substring 검사와 다른 점).

`GarmentForm`의 `matchedSizeKey` 계산을 이 함수로 교체한다:

```ts
// 기존
const matchedSizeKey = Object.keys(pastedSizeTable).find(
  (key) => key.toLowerCase() === size.trim().toLowerCase(),
)
// 변경
const matchedSizeKey = Object.keys(pastedSizeTable).find((key) => sizesMatch(key, size))
```

`size`는 옵션 `<select>`에서 오든 수동 `<input>`이든 같은 상태 변수이므로, 두 경로 모두 자동으로 이 매칭을 탄다 — 컴포넌트 코드를 갈라 짤 필요가 없다.

## 4. 섹션 3 — 삭제 UI 통일 + 장바구니 선택·전체 삭제

### 4.1 시각 디자인

`@phosphor-icons/react`의 `Trash` 아이콘(export 이름 실제 확인됨, `components/nav/MobileTabBar.tsx`가 같은 패키지에서 아이콘을 가져오는 기존 패턴을 따름)을 `Button variant="danger"`와 함께 쓰는 작은 정사각형 아이콘 버튼으로 통일한다. 새 클래스 상수는 만들지 않고 `Button`에 아이콘만 자식으로 넣는다.

```tsx
<Button variant="danger" className="p-2" aria-label="삭제">
  <Trash size={16} weight="bold" />
</Button>
```

### 4.2 `DeleteGarmentButton`(옷장 상세) — 아이콘으로 교체

기존 2단계 확인 흐름(눌러야 "정말 삭제할까요?"가 뜨는 것)은 그대로 두고, 첫 버튼만 밑줄 텍스트 링크에서 위 아이콘 버튼으로 바꾼다.

### 4.3 장바구니 — 체크박스 상시 노출 + 선택/전체 삭제

**`CartItemCard`**: 좌측에 체크박스를 추가한다. 선택 상태는 부모가 들고 있어야 하므로 `checked`/`onToggle` prop을 받는다.

```ts
type Props = {
  item: CartItem
  checked: boolean
  onToggle: (id: string) => void
}
```

**새 클라이언트 컴포넌트 `components/garment/CartList.tsx`**: `/cart`(서버 컴포넌트)가 가져온 아이템 배열을 받아 선택 상태(`Set<string>`)와 상단 액션 바("선택 삭제 (N)" / "전체 삭제")를 관리한다. 둘 다 위 4.1의 아이콘 버튼 스타일에 텍스트 라벨을 붙인 형태이며, 누르면 `DeleteGarmentButton`과 같은 인라인 2단계 확인("정말 삭제할까요? [삭제] [취소]")을 거친다.

```ts
type Props = { items: CartItem[] }

export function CartList({ items }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState<'selected' | 'all' | null>(null)
  const [deleting, setDeleting] = useState(false)

  function toggle(id: string) { /* Set에 추가/제거 */ }

  async function deleteIds(ids: string[]) {
    setDeleting(true)
    // 기존 단건 DELETE 엔드포인트를 재사용 — 새 벌크 API를 만들지 않는다.
    // RLS가 이미 소유자 확인을 하고, 개인 옷장 규모(최대 수십 개)에서 병렬 호출 비용은 무시할 만하다.
    await Promise.all(ids.map((id) => fetch(`/api/garments/${id}`, { method: 'DELETE' })))
    setDeleting(false)
    setConfirming(null)
    setSelected(new Set())
    router.refresh()
  }

  // ...
}
```

`app/(app)/cart/page.tsx`(서버 컴포넌트)는 지금처럼 데이터만 가져오고, 렌더링을 `<CartItemCard>` 직접 나열에서 `<CartList items={items} />` 하나로 바꾼다.

### 4.4 API — 새 엔드포인트 없음

`DELETE /api/garments/:id`(계획 1부터 존재, RLS로 소유자 검증됨)를 그대로 재사용한다. 서버 코드 변경이 전혀 없다.

## 5. 에러 처리

- 선택/전체 삭제 중 일부 요청이 실패하면(네트워크 오류 등), 성공한 것만 반영되고 실패한 항목은 목록에 남는다(`router.refresh()`가 실제 DB 상태를 다시 가져오므로 자연히 드러남). 별도 에러 배너는 만들지 않는다 — 실패해도 남은 항목이 화면에 그대로 보이는 것 자체가 사용자에게 충분한 신호다.
- `sizesMatch`는 라벨이 비어 있거나 토큰이 하나도 없으면(`extractSizeTokens`가 빈 배열) 매칭되지 않는다 — 빈 문자열끼리 우연히 매칭되는 걸 방지한다.

## 6. 테스트 전략

- **`tests/musinsa/sizeMatch.test.ts`**(신규): `extractSizeTokens`·`sizesMatch`를 순수 함수로 단위 테스트한다. 케이스: `"2 (L)"`↔`"L"` 매칭, `"2 (L)"`↔`"2"` 매칭, `"XL"`↔`"L"` **비매칭**(오매칭 방지 확인), 빈 문자열 비매칭, 대소문자 무관(`"l"`↔`"L"`).
- **`npm run build`/`npm test`**: 기존 107개 + 신규 sizeMatch 테스트 회귀.
- **브라우저 수동 검증**:
  1. 폼 접기 — 세 화면 각각에서 링크 불러오기 → 폼 뜬 상태에서 "접기" → URL과 폼이 모두 사라지는지
  2. 사이즈 매칭 — 실제 무신사 상품(옵션 라벨이 `"2 (L)"`류인 것)으로 실측표를 붙여넣어 자동 채움이 되는지
  3. 옷장 상세 삭제 — 아이콘 버튼 → 2단계 확인 → 삭제
  4. 장바구니 — 여러 개 체크 → "선택 삭제 (N)" → 확인 → 선택한 것만 지워지는지. "전체 삭제" → 확인 → 전부 지워지는지

## 7. 범위 밖

- **벌크 삭제 전용 API**: 기존 단건 엔드포인트 재사용으로 충분해 만들지 않는다(§4.4).
- **`GarmentForm` 그 외 리팩터링**: 계획 6 스펙에서 이미 "B에서 손댈 파일이라 지금 건드리면 충돌"이라고 미뤄둔 부분 중, 이번엔 필요한 곳(폼 접기 버튼, 사이즈 매칭)만 건드리고 그 외 구조는 유지한다.
- **삭제 취소(휴지통/복구)**: 이번엔 즉시 삭제만 다룬다. 되돌리기는 별도 논의 대상이다.
