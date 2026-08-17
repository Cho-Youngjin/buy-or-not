# 직접 등록 화면 안내문 제거 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** "직접 등록하기"(완전 수동 등록) 화면에서 "일부 정보를 자동으로 가져오지 못했습니다" 배너가 뜨지 않게 한다. 무신사 링크를 파싱했는데 일부 필드만 실패한 경우에는 그대로 뜨게 유지한다.

**Architecture:** `GarmentForm`이 이미 받고 있는 `sourceUrl: string | null` prop(실제 링크 파싱이면 문자열, "직접 등록하기"면 `null`)을 배너 표시 조건에 추가한다. 새 prop·새 상태·새 로직 없음.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-17-manual-form-banner-fix-design.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- TypeScript `strict: true`, `any` 금지. `npm run build`가 타입 에러 0개로 통과해야 한다.
- 새 prop·새 상태를 추가하지 않는다 — 기존 `sourceUrl` prop만 쓴다.

---

## Task 1: 배너 조건에 `sourceUrl` 반영

**Files:**
- Modify: `components/garment/GarmentForm.tsx:194-198`

**Interfaces:**
- 변경 없음(외부에 노출되는 타입·함수 시그니처 그대로).

- [ ] **Step 1: 조건 변경**

`components/garment/GarmentForm.tsx`의 배너 블록. **기존**:

```tsx
      {manualFields.length > 0 && (
        <p className="rounded-btn border border-border bg-canvas p-3 text-sm text-ink-muted">
          일부 정보를 자동으로 가져오지 못했습니다. 아래 표시된 칸만 채워주세요.
        </p>
      )}
```

**변경**:

```tsx
      {manualFields.length > 0 && sourceUrl !== null && (
        <p className="rounded-btn border border-border bg-canvas p-3 text-sm text-ink-muted">
          일부 정보를 자동으로 가져오지 못했습니다. 아래 표시된 칸만 채워주세요.
        </p>
      )}
```

`sourceUrl`은 이미 `Props`에 있고(`type Props = { parsed: ParseResult; sourceUrl: string | null; ... }`) 컴포넌트 함수 인자로 구조분해되어 있으므로 import나 prop 추가가 필요 없다. 구조분해 목록에 빠져 있다면 추가한다.

- [ ] **Step 2: 빌드로 확인**

```bash
npm run build
```

Expected: 타입 에러 0개.

- [ ] **Step 3: 브라우저로 확인**

1. `/wardrobe`에서 실제 무신사 링크를 하나 붙여넣어 파싱한다. 일부 필드가 실패 처리되는 링크라면 배너가 그대로 뜨는지 확인한다. (모든 필드가 성공하는 링크뿐이라면, 이 시나리오는 계획 1·6에서 이미 검증된 기존 동작이므로 코드 리딩으로 대체해도 된다 — `sourceUrl`이 non-null인 경로는 이번 변경으로 조건이 더 좁아지지 않았다.)
2. "무신사 링크가 없나요? 직접 등록하기"를 눌러 완전 수동 입력 폼을 연다. 배너가 뜨지 않는지 확인한다.
3. 카테고리를 "상의"로 바꿔 실측 섹션 등 나머지 폼이 정상 동작하는지(계획 8에서 검증된 부분이 이번 변경으로 안 깨졌는지) 훑어본다.

- [ ] **Step 4: 커밋**

```bash
git add components/garment/GarmentForm.tsx
git commit -m "fix: hide partial-parse banner on manual registration"
git push
```

---

## Task 2: README 기록

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 맨 끝에 "계획 12 — 직접 등록 화면 안내문 제거" 절을 추가한다**

기존 절들과 같은 형식으로 쓰되, 이번 건은 문제/원인/해결이 스펙 문서와 거의 동일하므로 길게 늘이지 말고 짧게: 무엇이 문제였고(계획 8이 만든 완전 수동 경로에 계획 1의 부분 실패 안내가 잘못 붙어 있었다), 왜 새 상태 없이 기존 `sourceUrl` prop 하나로 해결됐는지(두 경로가 이미 이 prop으로 구분되고 있었다는 걸 계획 8 코드에서 확인) 정도로 남긴다.

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: log manual form banner fix"
git push
```

---

## 남은 일 (이 계획 밖)

사용자가 제안한 6개 중 1(옷장 선호도 미설정 표시), 2(다크모드), 3(판단 리포트 재조회), 4(랜딩페이지 확장), 5(README 재구성)가 남아 있다. 합의된 진행 순서: 6(이 계획) → 1 → 3 → 2 → 4 → 5.
