# Phase 0: 무신사 파싱 타당성 조사 결과

조사일: 2026-08-15
조사 대상 URL:
- 상의: https://www.musinsa.com/products/6593921 (fixture: `tests/fixtures/musinsa/top.html`)
- 하의: https://www.musinsa.com/products/6815858 (fixture: `tests/fixtures/musinsa/bottom.html`)
- 아우터(비패딩): https://www.musinsa.com/products/2087860 (fixture: `tests/fixtures/musinsa/outer.html`)
- 아우터(패딩, 참고용 — fixture 저장 안 함): https://www.musinsa.com/products/6996910

## robots.txt

- 상품 상세 경로(`/products/`) 자체가 개별적으로 `Disallow`에 걸려있지는 **않음**.
- 다만 규칙이 그룹으로 나뉘어 있다:
  - Group 1 (`Claude-User`, `ChatGPT-User`, `Perplexity-User` 등 이름이 지정된 AI 에이전트)과 Group 2(Googlebot 등 주요 검색엔진)는 `Allow: /` (Group 2는 `/auth/`, `/mypage/` 등 일부 경로만 제외).
  - **Group 4 (와일드카드 `User-agent: *`)는 `Disallow: /` — 사이트 전체.** 이름이 지정되지 않은 모든 봇(우리 서버의 fetcher 포함)이 여기 해당한다.
- 결론: 개별 상품 페이지 경로가 콕 집어 금지된 건 아니지만, **우리 서버가 쓸 이름 없는 User-Agent는 robots.txt 기준으로 사이트 전체가 허용 범위 밖**이다. 법적 구속력은 아니지만 스펙 §8 "예의" 절에 이 사실을 반영했다.

## 정적 HTML 요청

| 카테고리 | HTTP 상태 | 본문 크기 |
|---|---|---|
| 상의 | 200 | 약 157KB |
| 하의 | 200 | 약 116KB |
| 아우터(비패딩) | 200 | 약 147KB |
| 아우터(패딩) | 200 | 약 125KB |

봇 차단 여부: 없음. 4개 카테고리 모두 정상적인 페이지 콘텐츠가 담긴 HTML을 받았다 (403이나 1KB 미만의 빈 응답 없음).

## 획득 가능한 필드

모든 카테고리에서 `<script id="__NEXT_DATA__">` 안에 Next.js `dehydratedState.queries` 형태로 상품 데이터가 JSON으로 들어있다. `queryKey`가 `["Detail", <상품번호>]`인 항목의 `state.data.data`가 상품 상세 데이터다.

| 필드 | 출처 | 추출 방법 |
|---|---|---|
| 상품명 | `__NEXT_DATA__` JSON | `state.data.data.goodsNm` |
| 브랜드 | `__NEXT_DATA__` JSON | `state.data.data.brand` / `.brandInfo.brandName` |
| 가격 | `__NEXT_DATA__` JSON | `state.data.data.goodsPrice` (하위 구조는 Task 5에서 세부 확정) |
| 대표 이미지 | `__NEXT_DATA__` JSON | `state.data.data.thumbnailImageUrl`, `.goodsImages[]` (상대 경로 — 도메인 접두사 필요) |
| 카테고리 | `__NEXT_DATA__` JSON | `state.data.data.baseCategoryFullPath` (예: `"Clothing > 바지 > 청/데님 팬츠"`), `.category` |
| 색상·사이즈 옵션 | **미확인** | `sizeType`/`isUseSize` 필드는 존재 확인했지만, 실제 색상·사이즈 목록이 담긴 필드는 이번 조사에서 특정하지 못했다. Task 5에서 별도 확인 필요 — 최악의 경우 이것도 필드별 폴백 대상이 될 수 있다. |
| 사이즈 실측표 | **없음** | 정적 HTML, `__NEXT_DATA__` JSON, 그리고 실제 브라우저에서 "사이즈" 탭 클릭 시 관찰되는 네트워크 요청(Chrome 확장 네트워크 로그 + `performance.getEntriesByType('resource')` 둘 다 확인, `fetch`/`XHR`를 몽키패치해서 직접 감시도 시도) 어디에도 나타나지 않는다. DOM에는 `ActualSizeTable` 스타일드 컴포넌트로 렌더링되지만, 그 값이 어떤 요청으로 들어오는지 특정하지 못했다. |

## 실측 항목 원문 표기

브라우저에서 "사이즈" 탭을 열어 직접 확인한 표준 항목명 (카테고리별):

- **상의/아우터** (상의·비패딩 아우터·패딩 아우터 3개 모두 동일): `총장`, `어깨너비`, `가슴단면`, `소매길이`
- **하의**: `총장`, `허리단면`, `밑위`, `엉덩이단면`, `허벅지단면` (다이어그램상 `밑단단면`은 스크롤 하단에 있어 이번엔 캡처하지 않았으나 스펙의 표준 항목명과 일치)

→ 표기가 스펙 §문서에 이미 정의된 표준 항목명(`총장`, `어깨너비`, `가슴단면`, `소매길이`, `허리단면`, `엉덩이단면`, `허벅지단면`, `밑위`, `밑단단면`)과 그대로 일치한다. 별칭 사전에 추가로 반영할 새로운 표기는 발견되지 않았다.

패딩 아우터에는 실측표와 별개로 "충전량/충전재"(예: 구스다운 그램 수) 정보가 있을 가능성이 있으나, 이는 `garment_measurements`의 표준 9개 항목에 속하지 않는 별도 스펙 정보이므로 이번 조사에서는 더 파고들지 않았다.

## 결론

- [ ] 정적 HTML 파싱으로 충분
- [ ] 내부 API 호출 필요 (엔드포인트: )
- [x] **필드별로 갈린다** — 상품명·브랜드·가격·이미지·카테고리는 정적 HTML(`__NEXT_DATA__`)만으로 충분하지만, 색상·사이즈 옵션은 미확인 상태로 Task 5에서 재확인이 필요하고, **사이즈 실측표는 자동 파싱 경로가 없다**.

실측표는 "내부 API 호출"도 아니고 "완전 파싱 불가"도 아니다 — 관찰 가능한 네트워크 요청이 없어 자동화할 API 자체가 존재하지 않는 것으로 판단했다. 대신 사용자가 무신사 "사이즈" 탭의 표를 직접 복사해서 붙여넣으면 클라이언트에서 파싱하는 방식으로 대체한다 (스펙 §8-1 "붙여넣기 자동 파싱" 참고, `docs/superpowers/specs/2026-08-13-buy-or-not-design.md`).

**Task 5 파서 구현 시 참고사항**:
- `ParseResult.fields.sizeTable`은 항상 `{ ok: false }`로 시작한다 — 시도조차 하지 않는다(§8 참고).
- `ParseResult.fields.options`(색상·사이즈)는 이번 조사에서 확정하지 못했으므로, Task 5 착수 시 `__NEXT_DATA__` 구조를 다시 열어 실제 필드를 확인하는 단계가 선행되어야 한다.
