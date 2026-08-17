# README 재구성 — 설계

**날짜**: 2026-08-17
**분류**: 사용자가 직접 제안한 6개 기능 중 5번(마지막). 레퍼런스: [othneildrew/Best-README-Template](https://github.com/othneildrew/Best-README-Template)(기여·라이선스·연락처 절 제외, 나머지 구조 참고).

## 배경

지금 `README.md`(510줄)는 세 줄짜리 프로젝트 소개 뒤로 Phase 0~8과 계획 4~17의 "문제/원인/해결/검증/결과" 기록이 전부다. 일반적인 오픈소스 프로젝트 소개 문서로 보기엔 시행착오 기록의 비중이 너무 크고, 정작 "이게 뭐 하는 프로젝트인지·어떻게 쓰는지"는 세 줄로 끝난다.

## 결정 사항 (사용자 확인)

레퍼런스 템플릿의 섹션 중 아래만 가져온다(순서대로): 제목+한 줄 소개, 기술 스택 배지, 목차, 프로젝트 소개(About), 사용법(Usage), 로드맵(Roadmap). **시작하기(Getting Started)·개발 일지 링크·Acknowledgments·기여(Contributing)·라이선스(License)·연락처(Contact)는 전부 뺀다.**

기존 "진행 기록"(Phase 0~8, 계획 4~17)은 저장소 루트의 새 파일 `DEVLOG.md`로 그대로 옮긴다 — 내용은 그대로 보존하되 README에서는 그쪽으로 가는 링크도 두지 않는다(사용자 확인).

## 설계

### 새 `README.md` 내용

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

로드맵 항목은 새로 지어낸 게 아니라 계획 11 README 절의 "남은 일" 목록(액세서리 카테고리 확장·휴지통·수동 등록 확장·실시간 알림·심각도·가중치 조정·실제 배포·Cron 자동화)을 그대로 옮긴 것이다.

### `DEVLOG.md`

지금 `README.md`의 `## 진행 기록`(5번째 줄)부터 끝까지를 그대로 옮기고, 맨 위에 이 파일이 무엇인지 짧게 설명하는 제목 한 줄만 더한다. 문장 하나도 새로 쓰지 않는다 — 손으로 옮겨적다 생기는 오탈자·누락을 피하려고 셸 명령(`tail`)으로 기계적으로 잘라 붙인다.

## 영향 범위

- `README.md`·`DEVLOG.md` 두 파일만 바뀐다. 코드·설정 파일은 전혀 안 건드린다.
- 이후 계획들의 "README 기록" 관례(CLAUDE.md)는 계속 유지하되, 대상 파일이 `README.md`에서 `DEVLOG.md`로 바뀐다 — 다음 계획부터는 회고를 `DEVLOG.md`에 이어서 적는다.

## 테스트

문서 변경이라 자동화된 테스트가 없다. 두 파일을 직접 읽어 내용이 안 깨졌는지(특히 코드 블록·표·링크가 그대로 옮겨졌는지) 확인하는 것으로 검증한다.
