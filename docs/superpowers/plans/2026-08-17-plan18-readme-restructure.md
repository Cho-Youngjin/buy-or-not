# README 재구성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 프로젝트의 CLAUDE.md는 `superpowers:subagent-driven-development`(태스크 통째 위임)를 금지한다 — 사용자와 태스크 단위로 상호 리뷰하며 진행한다.

**Goal:** `README.md`를 일반적인 프로젝트 소개 문서로 바꾸고, 기존 시행착오 기록("진행 기록")은 새 파일 `DEVLOG.md`로 옮긴다.

**Architecture:** `README.md`의 `## 진행 기록`부터 끝까지를 셸 명령으로 그대로 잘라 `DEVLOG.md`로 옮긴 뒤(내용 변경 없음), `README.md`는 스펙에서 이미 확정한 내용으로 통째로 새로 쓴다. 이 계획 자체의 회고는 (이제부터 회고가 쌓이는 곳인) `DEVLOG.md`에 남긴다.

**Tech Stack:** Markdown, 셸 명령(`tail`)

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-17-readme-restructure-design.md`다. 코드와 스펙이 어긋나면 임의로 고르지 말고 사용자에게 알린다.
- 코드·설정 파일은 건드리지 않는다. `README.md`·`DEVLOG.md` 두 파일만 바뀐다.
- `DEVLOG.md`로 옮기는 내용은 한 글자도 새로 쓰지 않는다 — 손으로 옮겨 적지 않고 셸 명령으로 기계적으로 잘라 붙인다.
- 새 `README.md`의 문구·로드맵 항목은 스펙에 확정된 내용을 그대로 쓴다.

---

## Task 1: 기존 진행 기록을 `DEVLOG.md`로 이동

**Files:**
- Create: `DEVLOG.md`

**Interfaces:**
- 변경 없음(문서 파일).

- [ ] **Step 1: 셸 명령으로 옮긴다**

`README.md`의 5번째 줄(`## 진행 기록`)부터 끝까지가 정확히 그대로 복사되도록, 제목 한 줄만 앞에 붙여서 새 파일을 만든다:

```bash
{
  echo "# 개발 일지 (buy-or-not)"
  echo ""
  echo "README.md에서 분리한 시행착오 기록이다. Phase 단위(Phase 0~8)와 계획 단위(계획 4~)로, 겪은 문제·원인·해결·검증·결과를 남긴다."
  echo ""
  tail -n +5 README.md
} > DEVLOG.md
```

- [ ] **Step 2: 내용이 안 깨졌는지 확인**

```bash
wc -l README.md DEVLOG.md
diff <(tail -n +5 README.md) <(tail -n +5 DEVLOG.md)
```

Expected: `DEVLOG.md`가 `README.md`보다 4줄 많다(제목 3줄 + 빈 줄 1줄만큼). `diff`는 출력이 없어야 한다(=본문이 한 글자도 안 틀리고 그대로 옮겨졌다는 뜻).

- [ ] **Step 3: 커밋**

```bash
git add DEVLOG.md
git commit -m "docs: extract project devlog from README"
git push
```

---

## Task 2: `README.md`를 프로젝트 소개 문서로 다시 쓴다

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 전체를 교체한다**

`README.md` 전체를 아래 내용으로 완전히 덮어쓴다(스펙에서 이미 확정됨):

```markdown
# 살까 말까 (buy-or-not)

무신사 링크 하나로 가진 옷을 옷장에 등록하고, 새로 사려는 옷의 링크를 넣으면 실측·선호도를 비교해 살만한지 판단해주는 개인 프로젝트.

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)

## 목차

- [프로젝트 소개](#프로젝트-소개)
- [사용법](#사용법)
- [로드맵](#로드맵)

## 프로젝트 소개

온라인에서 옷을 사고 반품하는 가장 큰 이유는 "실제로 받아보니 사이즈가 안 맞거나, 이미 가진 옷들과 안 어울려서"다. 살까 말까는 무신사(MUSINSA) 상품 링크를 스크래핑해 실측·옵션을 자동으로 채우는 방식으로 옷장 등록의 진입장벽을 낮추고, 등록된 옷의 실측·선호도(별점·핏·착용빈도)를 기준으로 새로 사려는 옷의 적합도를 결정론적으로 계산한 뒤, Google Gemini로 그 결과를 자연스러운 한국어 문장과 스타일 매칭 판단으로 보강한다. 옷장은 링크로 공유해 친구에게 아이템·룩을 추천받을 수도 있다.

취업 준비용 사이드 프로젝트로 진행 중이다.

## 사용법

1. 무신사 링크로 옷장에 옷을 등록한다 — 실측·사이즈가 자동으로 채워진다.
2. 별점으로 선호도를 남긴다 — 같은 카테고리 옷 3벌 이상이면 판단이 더 정확해진다.
3. 사려는 옷 링크를 넣어 판단받는다 — 사이즈·스타일이 맞는지 바로 알려준다.

이 외에도:

- 옷장을 친구에게 공유하고 아이템·룩을 추천받을 수 있다.
- 가진 옷을 조합해 나만의 룩을 만들 수 있다.
- 장바구니에 담아둔 옷의 가격이 내리면 확인할 수 있다.
- 마이페이지에서 핏 판단 강도, 화면 테마(라이트/다크/시스템)를 설정할 수 있다.

## 로드맵

- [ ] 무신사 액세서리 대분류명 확인 후 `MUSINSA_CATEGORY_MAP` 확장
- [ ] 옷장·장바구니 삭제 되돌리기(휴지통)
- [ ] 친구 추천 경로에도 수동 등록(무신사 링크 없는 옷) 지원
- [ ] 추천 실시간 알림, 여러 탭 간 동기화
- [ ] 핏 판단 심각도·가중치·판정 경계값 직접 조정
- [ ] Vercel 실제 배포
- [ ] Vercel Cron 기반 장바구니 가격 자동 갱신
```

- [ ] **Step 2: 렌더링 확인**

GitHub에 푸시하기 전에, 로컬에서 마크다운 렌더링을 눈으로 한 번 확인한다(에디터의 마크다운 프리뷰나 `npx serve`로 열어 봐도 되고, 커밋 후 GitHub 웹에서 확인해도 된다) — 목차 링크(`#프로젝트-소개` 등)가 실제 헤딩과 정확히 매칭되는지, 배지 5개가 깨지지 않고 나오는지 확인한다.

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: rewrite README as project overview"
git push
```

---

## Task 3: 이 계획의 회고를 `DEVLOG.md`에 남긴다

**Files:**
- Modify: `DEVLOG.md`

- [ ] **Step 1: `DEVLOG.md` 맨 끝에 "계획 18 — README 재구성" 절을 추가한다**

기존 절들과 같은 형식으로 쓴다. 이 계획부터 회고 대상 파일이 `README.md`에서 `DEVLOG.md`로 바뀌었다는 점을 명시하고, 최소한 아래는 근거와 함께 남길 가치가 있다:

- **레퍼런스 템플릿([othneildrew/Best-README-Template](https://github.com/othneildrew/Best-README-Template))에서 어떤 섹션을 빼고 남겼는지와 그 이유** — 기여·라이선스·연락처·Acknowledgments는 컨트리뷰터가 없는 개인 포트폴리오 저장소엔 의미가 없어 뺐고, 시작하기(Getting Started)와 개발 일지 링크도 사용자가 최종적으로 더 덜어내기로 했다.
- **내용을 손으로 옮겨 적지 않고 `tail` 명령으로 기계적으로 이동한 이유** — 500줄 넘는 한국어 기술 기록을 손으로 복사하면 오탈자·문단 누락 위험이 있어, `diff`로 한 글자도 안 틀렸음을 기계적으로 검증할 수 있는 방법을 택했다.
- **로드맵 항목을 새로 짓지 않고 계획 11의 "남은 일" 목록을 그대로 옮긴 이유** — 이미 여러 계획 문서에 근거와 함께 남아있던 백로그를 다시 만들 필요가 없었다.

- [ ] **Step 2: 커밋**

```bash
git add DEVLOG.md
git commit -m "docs: log readme restructure work"
git push
```

---

## 남은 일 (이 계획 밖)

사용자가 제안한 6개(6·1·3·2·7·4·5)가 이 계획으로 전부 끝난다. 새 작업이 필요해지면 그때 다시 브레인스토밍부터 시작한다.
