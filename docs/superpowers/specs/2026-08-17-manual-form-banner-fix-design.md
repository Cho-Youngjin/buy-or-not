# 직접 등록 화면 안내문 제거 — 설계

**날짜**: 2026-08-17
**분류**: 사용자가 직접 제안한 6개 기능 중 6번(가장 먼저 진행). UX 버그 수정에 가까운 작은 항목이라 스펙을 짧게 쓴다.

## 문제

`components/garment/GarmentForm.tsx:194-198`에는 아래 배너가 있다.

```tsx
{manualFields.length > 0 && (
  <p className="rounded-btn border border-border bg-canvas p-3 text-sm text-ink-muted">
    일부 정보를 자동으로 가져오지 못했습니다. 아래 표시된 칸만 채워주세요.
  </p>
)}
```

이 배너는 무신사 링크를 파싱했는데 일부 필드만 실패했을 때("일부 정보를") 안내하려고 만들어졌다(계획 1). 그런데 계획 8(수동 등록)이 도입한 "직접 등록하기" 경로는 `createManualParseResult()`(`lib/musinsa/manualParseResult.ts`)로 **모든** 필드를 `fail()` 처리한 합성 `ParseResult`를 만들어 같은 `GarmentForm`을 그대로 띄운다. 그 결과 `manualFields.length > 0` 조건이 완전 수동 입력 화면에서도 항상 참이 되어, "일부만 실패했다"는 문구가 "처음부터 전부 수동으로 입력하려는" 사용자에게도 그대로 뜬다 — 사실과 다른 안내라 혼란을 준다.

## 원인

`GarmentForm`은 두 가지 서로 다른 상황(①무신사 링크 파싱 부분 실패, ②링크 없이 완전 수동 등록)을 구분 없이 같은 컴포넌트·같은 `manualFields` 파생값으로 렌더링한다. 두 상황을 구분할 신호가 이미 존재하는데도(아래) 배너 조건이 그 신호를 안 쓰고 있었다.

## 해결

`GarmentForm`은 이미 `sourceUrl: string | null` prop을 받는다(`LinkInputBar.tsx:42,56`):
- 실제 무신사 링크 파싱 경로: `sourceUrl={parse.url}` — 항상 문자열.
- "직접 등록하기" 경로: `sourceUrl={null}`.

이 prop이 정확히 "실제 링크에서 왔는가"를 나타내므로, 새 prop이나 새 상태를 추가하지 않고 배너 조건에 `sourceUrl !== null`을 추가하는 것으로 충분하다.

```tsx
{manualFields.length > 0 && sourceUrl !== null && (
  <p className="rounded-btn border border-border bg-canvas p-3 text-sm text-ink-muted">
    일부 정보를 자동으로 가져오지 못했습니다. 아래 표시된 칸만 채워주세요.
  </p>
)}
```

## 영향 범위

- 무신사 링크를 붙여넣었고 일부 필드가 파싱 실패한 경우: 배너가 그대로 뜬다(동작 변화 없음).
- 무신사 링크를 붙여넣었고 전부 파싱 성공한 경우: `manualFields.length === 0`이라 원래도 안 떴다(동작 변화 없음).
- "직접 등록하기"로 들어온 경우: 배너가 더 이상 뜨지 않는다(이번 수정의 목적).
- 추천 등록(`RecommendLinkBar`)도 같은 `GarmentForm`을 쓰지만 항상 실제 무신사 링크를 통해서만 진입하므로 `sourceUrl`이 항상 채워져 있다 — 영향 없음.

## 테스트

이 변경은 JSX 조건문 하나로, 별도 순수 함수나 훅으로 뽑아낼 로직이 없어 단위 테스트 대상이 없다. `npm run build`(타입 체크)와 브라우저 수동 확인(①무신사 링크 부분 실패 시 배너 뜨는지, ②직접 등록 화면에서 배너 안 뜨는지)으로 검증한다.
