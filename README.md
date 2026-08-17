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
