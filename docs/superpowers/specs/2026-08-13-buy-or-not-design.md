# buy-or-not 설계 문서

작성일: 2026-08-13

## 1. 개요

온라인에서 옷을 살 때 "예뻐 보여서 샀는데 핏이 안 맞거나 가진 옷과 매칭이 안 돼서 반품"하는 실패를 줄이는 웹 서비스.

사용자는 이미 가진 옷을 무신사 상품 링크로 옷장에 등록하고 선호도를 남긴다. 이후 구매를 고민하는 옷의 링크를 넣으면, 서비스가 옷장의 실측·선호도 데이터와 대조해 "이 옷은 총장이 너무 길다", "가진 옷들과 매칭이 어렵다" 같은 근거 있는 피드백을 준다. 옷장은 링크로 공유할 수 있고, 친구가 추천 아이템을 넣거나 코디(룩)를 만들어 줄 수 있다.

취업용 사이드 프로젝트다. 대규모 트래픽과 다중 리전은 고려하지 않는다.

## 2. 사용자 스토리

1. 구글 계정으로 로그인한다.
2. 가진 옷의 무신사 링크를 붙여넣는다. 구매 화면처럼 색상·사이즈 선택박스가 뜨고, 고르면 상품 이미지·색상·사이즈·실측이 옷장에 저장된다.
3. 옷장의 옷에 별점(1–5), 핏 태그(작음/딱맞음/큼), 착용 빈도(자주/가끔/거의안입음)를 남긴다.
4. 구매를 고민하는 옷의 링크를 넣는다. 색상·사이즈를 고르면 판정(살만함/주의/비추천)과 피드백 문장, 그리고 근거가 되는 실측 비교 표가 나온다.
5. 그 옷은 장바구니에 남는다. 실제로 샀으면 "샀어요"를 눌러 옷장으로 옮긴다.
6. 옷장 공유를 켜고 링크를 친구에게 보낸다.
7. 친구는 로그인 없이 옷장을 구경하고, 로그인하면 무신사 링크로 추천 아이템을 넣거나 옷장의 옷들을 조합해 룩을 만들어 준다.

## 3. 범위

**포함**
- 구글 OAuth 로그인
- 무신사 링크 파싱 → 옵션 선택 → 옷장 등록 (수동 입력 폴백 포함)
- 옷장 CRUD, 선호도 기록
- 결정론적 핏 판단 엔진
- Gemini 기반 스타일 태깅 및 피드백 문장 생성
- 장바구니 → 옷장 승격
- 옷장 공유, 친구 추천 아이템, 룩 만들기

**제외 (이번 범위 아님)**
- 무신사 이외 쇼핑몰
- AI 자동 코디 생성
- 알림, 가격 인하 추적
- 사용자 신체 치수 직접 입력 (옷장 실측에서 추론하므로 불필요)
- 카카오 로그인 (provider 추가만으로 되는 일이므로 나중)
- E2E 테스트

## 4. 기술 스택

| 항목 | 선택 |
|---|---|
| 프레임워크 | Next.js 15 App Router, TypeScript |
| 스타일 | Tailwind CSS |
| DB / 인증 / 스토리지 | Supabase (Postgres, Auth, Storage, RLS) |
| AI | Google Gemini API (`gemini-2.5-flash`) |
| HTML 파싱 | cheerio |
| 테스트 | Vitest |
| 배포 | Vercel |

**Next.js를 쓰는 이유.** 브라우저에서 무신사로 직접 요청하면 CORS에 막혀 동작하지 않고, Gemini API 키를 클라이언트에 두면 노출된다. 서버 코드가 반드시 필요하다. Route Handler가 그 역할을 하고, SSR이 있으므로 공유 링크를 메신저에 붙였을 때 OG 썸네일 미리보기가 나온다.

**Supabase(Postgres)를 쓰는 이유.** 이 앱의 핵심 쿼리가 "내가 자주 입는 상의들의 총장 범위"라는 집계다. Postgres에서는 SQL 한 줄이고, 문서 DB에서는 전량을 읽어와 클라이언트에서 계산해야 한다. RLS로 공유 옷장의 권한 정책을 DB 레벨에서 강제할 수 있다는 점도 크다.

## 5. 아키텍처

단일 Next.js 리포. 클라이언트는 외부 서비스에 직접 접근하지 않고 항상 Route Handler를 경유한다.

```
브라우저
   │
   ├── Server Component / Client Component
   │
   ▼
Next.js Route Handler  ──────►  무신사 (HTML/JSON 파싱)
   │                    ──────►  Gemini API
   ▼
Supabase (Postgres + Storage)
```

**옷장 등록 흐름**

```
링크 붙여넣기
 → POST /api/musinsa/parse   goods_no 추출 → 캐시 조회 → 미스면 파싱 → 캐시 저장
 → 상품정보 + 옵션 목록 반환 → 색상/사이즈 선택박스 렌더
 → POST /api/garments        garments insert
                             + 이미지 Storage 복사
                             + 선택 사이즈 행 → garment_measurements insert
                             + Gemini 비전 태깅 → ai_tags
```

**구매 판단 흐름**

```
링크 붙여넣기 → 파싱 → 옵션 선택
 → POST /api/analyze
      1. garments insert (status='considering') — 등록 파이프라인 재사용, 비전 태깅 포함
      2. 옷장 집계 쿼리로 선호 실측 범위 산출
      3. 결정론적 핏 편차 계산 (코드)
      4. Gemini 호출: 태그 비교 → 매칭 심각도 + 피드백 문장
      5. 핏 점수 + 매칭 심각도 합산 → verdict 확정 (코드)
      6. analyses insert → 결과 반환
```

### 서버 코드 모듈 경계

각 모듈은 하나의 책임만 가지며, 인터페이스로만 통신한다.

| 모듈 | 책임 | 의존 |
|---|---|---|
| `lib/musinsa/parser.ts` | URL → `ParseResult`. HTML/JSON 파싱을 전담하며 DB·AI를 모른다. | cheerio |
| `lib/musinsa/cache.ts` | `musinsa_cache` 읽기/쓰기 | Supabase (service role) |
| `lib/fit/rules.ts` | 카테고리별 실측 항목의 허용 편차·심각도 상수 | 없음 (순수) |
| `lib/fit/engine.ts` | 선호 범위 + 후보 실측 → 편차 리포트, 핏 점수 | `rules.ts` (순수 함수) |
| `lib/fit/profile.ts` | 옷장 집계 쿼리 → 선호 실측 범위 | Supabase |
| `lib/ai/tagger.ts` | 이미지 → `AiTags` | Gemini |
| `lib/ai/advisor.ts` | 편차 리포트 + 태그 → 매칭 심각도 + 문장 | Gemini |
| `lib/verdict.ts` | 핏 점수 + 매칭 심각도 → verdict | 없음 (순수) |

`lib/fit/engine.ts`와 `lib/verdict.ts`가 순수 함수인 것이 중요하다. 이 앱의 판단 로직 전체가 네트워크 없이 단위 테스트된다.

## 6. 데이터 모델

### 열거형

```
category         : 'top' | 'bottom' | 'outer' | 'shoes' | 'acc'
garment_status   : 'owned' | 'considering'
fit_tag          : 'tight' | 'just' | 'loose'
wear_frequency   : 'often' | 'sometimes' | 'rarely'
verdict          : 'buy' | 'caution' | 'skip'
parse_mode       : 'auto' | 'partial' | 'manual'
```

### profiles

`auth.users` 확장.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | → `auth.users.id` |
| nickname | text | |
| avatar_url | text | |
| share_slug | text UNIQUE | 공유 URL `/u/{share_slug}`. 가입 시 랜덤 생성 |
| is_wardrobe_public | boolean | 기본 `false`. 켜야 공유 링크가 살아난다 |
| created_at | timestamptz | |

### garments

옷장과 장바구니를 한 테이블로 둔다. "샀어요"는 `UPDATE status`이며, 파싱·이미지·태깅 파이프라인을 두 번 만들 필요가 없다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid | → `profiles.id`. 옷장 주인 |
| status | garment_status | `owned` = 옷장, `considering` = 장바구니 |
| source_url | text | 무신사 링크 |
| goods_no | text | 무신사 상품번호 |
| brand | text | |
| name | text | |
| price | integer | 등록 시점 가격 (원) |
| image_url | text | Supabase Storage 사본 URL |
| category | category | |
| color_option | text | 선택한 색상 |
| size_option | text | 선택한 사이즈 (예 `L`) |
| ai_tags | jsonb | 비전 태깅 결과. 집계하지 않고 프롬프트에만 쓰므로 jsonb |
| rating | smallint | 1–5, nullable |
| fit_tag | fit_tag | nullable |
| wear_frequency | wear_frequency | nullable |
| parse_mode | parse_mode | 파싱 성공도 기록. 관측 지표 |
| recommended_by | uuid | nullable → `profiles.id`. 친구가 추천해 들어온 아이템 |
| note | text | 추천자 코멘트 |
| created_at | timestamptz | |

선호도 3개 컬럼은 `status='owned'`인 옷에만 의미가 있으므로 nullable이다.

인덱스: `(owner_id, status)`, `(owner_id, category)`, `(goods_no)`.

### garment_measurements

실측. 무신사 사이즈표는 카테고리마다 항목이 다르고 앞으로 늘어날 수 있으므로 컬럼을 고정하지 않는다. 무엇보다 이 앱의 핵심 쿼리가 항목별 집계이므로 정규화가 필수다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| garment_id | uuid | → `garments.id` ON DELETE CASCADE |
| key | text | 표준화된 항목명 (예 `총장`) |
| value | numeric(5,1) | cm |

PK `(garment_id, key)`.

**표준 항목명**

- 상의 / 아우터: `총장`, `어깨너비`, `가슴단면`, `소매길이`
- 하의: `총장`, `허리단면`, `엉덩이단면`, `허벅지단면`, `밑위`, `밑단단면`

무신사 표기가 상품마다 흔들리므로(`가슴단면` / `가슴 단면` / `흉위`) 별칭 사전으로 표준 키에 매핑한다. **사전에 없는 키는 버리지 않고 원문 그대로 저장한다.** 나중에 사전에 추가하면 과거 데이터도 함께 살아난다. 표준 키가 아닌 항목은 핏 판단에서 제외되고 상세 화면에는 표시된다.

### analyses

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| garment_id | uuid | → `garments.id` ON DELETE CASCADE. 분석 대상 |
| requester_id | uuid | → `profiles.id` |
| verdict | verdict | |
| fit_score | integer | 심각도 가중 합계 |
| report | jsonb | 항목별 편차 리포트 (근거 표시용) |
| feedback | jsonb | Gemini 생성 문장들 |
| model | text | 예 `gemini-2.5-flash` |
| prompt_snapshot | jsonb | 재현·디버깅용 |
| created_at | timestamptz | |

### outfits

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| wardrobe_owner_id | uuid | → `profiles.id`. 누구의 옷장을 위한 룩인가 |
| author_id | uuid | → `profiles.id`. 룩을 만든 사람 |
| title | text | |
| description | text | |
| created_at | timestamptz | |

두 컬럼이 분리되어 있어 "친구 A가 내 옷장으로 만들어 준 룩"이 자연스럽게 표현된다.

### outfit_items

| 컬럼 | 타입 |
|---|---|
| outfit_id | uuid → `outfits.id` ON DELETE CASCADE |
| garment_id | uuid → `garments.id` ON DELETE CASCADE |

PK `(outfit_id, garment_id)`.

룩에 담기는 옷은 **해당 옷장 소유의 옷이어야 한다.** 즉 `garments.owner_id = outfits.wardrobe_owner_id` 를 만족해야 하며, 이는 INSERT 정책에서 조인으로 검증한다. 친구가 남의 옷장 룩에 제3자의 옷을 끼워 넣을 수 없다.

### musinsa_cache

| 컬럼 | 타입 | 비고 |
|---|---|---|
| goods_no | text PK | |
| payload | jsonb | 파싱된 상품 정보 전체 (옵션 목록, 사이즈×항목 매트릭스 포함) |
| fetched_at | timestamptz | |

가격은 24시간 TTL로 재검증하고, 실측·이미지·옵션은 변하지 않으므로 영구 캐시로 취급한다.

### 이미지 저장

무신사 CDN URL을 직접 참조하지 않고 **Supabase Storage에 사본을 둔다.** CDN URL은 만료되거나 외부 참조가 차단될 수 있고, Gemini에 전달할 때도 자체 URL이 안정적이다. 버킷은 공개 읽기, 쓰기는 서버만.

## 7. 권한 (RLS)

이 앱 보안의 전부가 RLS다. 모든 테이블에 RLS를 켠다.

| 테이블 | 정책 |
|---|---|
| `profiles` | SELECT: 본인 또는 `is_wardrobe_public = true`. UPDATE: 본인만 |
| `garments` | SELECT: `owner_id = auth.uid()` 또는 소유자가 옷장 공개 중<br>INSERT: `owner_id = auth.uid()` — **또는** 공개 옷장에 `status='considering'` 이고 `recommended_by = auth.uid()` 인 경우에 한해 허용<br>UPDATE / DELETE: `owner_id = auth.uid()` 만 |
| `garment_measurements` | 상위 `garments` 권한을 조인으로 따른다 |
| `analyses` | 모든 작업에 대해 `requester_id = auth.uid()` |
| `outfits` | SELECT: 대상 옷장이 내 것이거나 공개 중<br>INSERT: `author_id = auth.uid()` 이고 대상 옷장이 공개 중<br>DELETE: `author_id = auth.uid()` 또는 `wardrobe_owner_id = auth.uid()` |
| `outfit_items` | 상위 `outfits` 권한을 따른다 |
| `musinsa_cache` | 클라이언트 접근 전면 차단. 서버(service role) 전용 |

`garments` INSERT 정책이 핵심이다. 친구는 남의 옷장에 `status='owned'`인 옷을 심을 수 없다. 추천은 항상 장바구니로 들어가고, 옷장 승격은 주인만 할 수 있다.

**Route Handler에서는 사용자 세션으로 Supabase 클라이언트를 만든다.** `service_role` 키는 RLS를 통째로 우회하므로, 캐시 읽기/쓰기와 Storage 업로드처럼 반드시 필요한 곳에만 쓴다.

## 8. 무신사 연동

이 프로젝트에서 유일하게 통제 밖에 있는 부분이므로 깨지는 것을 전제로 설계한다.

### 단계적 시도

1. URL에서 상품번호 추출. 구형 `/app/goods/{no}`, 신형 `/products/{no}` 두 패턴 모두 대응.
2. `musinsa_cache` 조회. 히트하면 네트워크 요청 없음.
3. 미스면 파싱 시도:
   1. 정적 HTML 요청 후 cheerio 파싱. JSON-LD(`application/ld+json`)와 페이지에 삽입된 Next.js 데이터 블록을 우선 확인한다.
   2. 실패하면 Phase 0에서 확인한 내부 JSON 엔드포인트 직접 호출.
   3. 둘 다 실패하면 수동 입력 폴백.
4. 요청에는 timeout과 재시도 1회를 둔다. 파싱 결과는 성공·부분성공 모두 캐시에 저장한다.

### 파서 계약

파서는 어댑터로 격리한다. 나머지 코드는 `parseProduct(url)` 하나만 알고, 내부 구현이 HTML 파싱인지 JSON API인지 상관하지 않는다. 무신사가 개편되면 이 모듈만 고친다.

```ts
type FieldResult<T> = { ok: true; value: T } | { ok: false; reason: string }

type ParseResult = {
  goodsNo: string
  fields: {
    name:      FieldResult<string>
    brand:     FieldResult<string>
    price:     FieldResult<number>
    imageUrl:  FieldResult<string>
    category:  FieldResult<Category>
    options:   FieldResult<{ colors: string[]; sizes: string[] }>
    sizeTable: FieldResult<Record<string, Record<string, number>>>  // 사이즈 → 항목 → 값
  }
}
```

### 폴백은 전부 아니면 전무가 아니다

실제로는 *가격·이름은 되는데 사이즈표만 실패*하는 경우가 가장 흔하다. 그래서 필드별로 성공/실패를 따로 반환한다.

화면에서는 **성공한 필드는 채워진 채 읽기 전용으로 잠기고, 실패한 필드만 입력 폼으로 뜬다.** 이미지 파싱이 실패하면 직접 업로드로 대체한다. 사용자는 "실패했습니다"가 아니라 "이 두 칸만 채워주세요"를 본다.

`parse_mode`는 이 결과를 기록한다 — 전 필드 성공은 `auto`, 일부 수동 입력은 `partial`, 전부 수동은 `manual`. **`manual` 비율이 갑자기 치솟으면 무신사가 개편된 것이다.** 별도 모니터링 없이 이 컬럼으로 감지한다.

### 사이즈표 처리

파싱 시 사이즈×항목 매트릭스를 통째로 캐시에 저장하고, 사용자가 고른 사이즈의 행만 `garment_measurements`에 쓴다. 같은 상품을 다른 사이즈로 등록할 때 무신사 재요청이 없다.

### 카테고리 판정

무신사 카테고리를 우선 사용하고 표준 enum에 매핑한다. 파싱 실패 시 비전 태깅 결과의 `category`를 쓴다. 둘 다 실패하면 사용자가 선택한다.

### 예의

사용자가 붙여넣은 개별 상품 페이지의 단건 조회만 수행한다. 목록 크롤링이나 대량 수집은 하지 않는다. 캐시를 우선 조회하고, robots.txt를 확인해 금지 경로는 요청하지 않는다. 비상업적 개인 프로젝트지만 약관 리스크가 0은 아니라는 점을 인지한 상태로 진행한다.

## 9. 핏 판단 엔진

**원칙: 숫자 판단은 코드가, 문장 생성은 Gemini가.** LLM은 산수를 틀린다. "총장 72cm vs 평균 68cm"를 주고 판단까지 맡기면 호출마다 결론이 흔들린다. 편차 계산과 심각도 판정은 전부 결정론적 코드로 처리하고, Gemini에게는 계산이 끝난 리포트를 주고 한국어 문장으로 풀어쓰게만 한다.

### 선호 실측 범위 산출

같은 카테고리의 `status='owned'` 옷들을 두 집합으로 나눈다.

- **성공 집합**: `rating >= 4` 또는 `wear_frequency = 'often'`
- **실패 집합**: `rating <= 2` 또는 `wear_frequency = 'rarely'`

성공 집합의 항목별 최소·최대가 **선호 범위 `[lo, hi]`** 다. 단순 평균이 아니라 범위로 잡는다.

실패 집합은 회피 신호로 쓴다.

- `fit_tag = 'loose'` 인 실패 옷들의 항목 값 중 **최소값**이 상한 경고선. 그 이상은 과거에 커서 안 입은 치수다.
- `fit_tag = 'tight'` 인 실패 옷들의 항목 값 중 **최대값**이 하한 경고선.

### 데이터 부족 처리

- 같은 카테고리 `owned` 옷이 **3벌 미만**이면 핏 비교를 건너뛰고 *"옷장에 상의 데이터가 부족해 핏 판단은 어렵습니다"* 라고 명시한다.
- 3벌 이상이지만 성공 집합이 비어 있으면, 같은 카테고리 전체 `owned` 옷으로 선호 범위를 대체하고 리포트에 신뢰도 `low`를 표시한다.

**근거가 없으면 단언하지 않는다.** 없는 근거로 단정하는 순간 앱 신뢰가 무너진다.

### 허용 편차와 심각도

항목마다 편차의 의미가 다르다. 허리단면 2cm는 아예 못 입는 문제고 총장 2cm는 사실상 무의미하다. 이 차이를 코드가 알고 있어야 "총장이 좀 길지만 괜찮고, 허리가 안 맞습니다" 같은 우선순위 있는 피드백이 나온다.

| 카테고리 | 항목 | 허용 편차 | 심각도 | 가중치 |
|---|---|---|---|---|
| 상의 / 아우터 | 어깨너비 | ±1.5cm | 높음 | 3 |
| | 가슴단면 | ±2.0cm | 높음 | 3 |
| | 총장 | ±3.0cm | 보통 | 2 |
| | 소매길이 | ±2.5cm | 낮음 | 1 |
| 하의 | 허리단면 | ±1.5cm | **치명** | 5 |
| | 밑위 | ±1.5cm | 높음 | 3 |
| | 허벅지단면 | ±1.5cm | 높음 | 3 |
| | 엉덩이단면 | ±2.0cm | 보통 | 2 |
| | 밑단단면 | ±2.0cm | 보통 | 2 |
| | 총장 | ±3.0cm | 보통 | 2 |

아우터는 레이어링을 감안해 상의 편차에 +1.0cm를 더한다.

이 수치는 일반적인 기준으로 잡은 초안이며, 쓰면서 조정할 수 있도록 `lib/fit/rules.ts` 한 곳에 상수로 모은다.

### 편차 채점

후보 옷과 선호 범위에 **모두 존재하는 표준 항목**에 대해서만 계산한다.

```
허용 구간 = [lo - t, hi + t]        (t = 허용 편차)

v ∈ 허용 구간            → 위반 없음, 0점
v < lo - t               → excess = (lo - t) - v
v > hi + t               → excess = v - (hi + t)

excess <= t              → 경고,  점수 = 가중치 × 1
excess >  t              → 심각,  점수 = 가중치 × 2
```

회피 신호는 별도 항목으로 더한다. 후보 값이 상한 경고선 이상 또는 하한 경고선 이하면 `가중치 × 1`을 추가하고, 리포트에 *"과거에 이 치수에서 실패한 이력이 있습니다"* 를 남긴다.

`fit_score` = 전체 항목 점수 합계.

### 최종 판정

```
심각도 '치명' 항목에 위반이 하나라도 있으면      → skip
fit_score + match_penalty == 0                  → buy
fit_score + match_penalty  1 ~ 4                → caution
fit_score + match_penalty >= 5                  → skip
```

`match_penalty`는 Gemini가 반환한 매칭 심각도를 코드가 환산한 값이다: `ok` → 0, `warn` → 2, `bad` → 4.

색·스타일 조화는 규칙으로 판정하기 어려우므로 Gemini에게 맡기되, **자유 서술이 아닌 3단계 범주만 받아 코드가 산술을 수행한다.** 판정 임계값도 상수로 모아 조정 가능하게 한다.

가격은 옷장의 같은 카테고리 평균가와 비교한 결과를 코드가 계산해 리포트에 담고, 서술만 Gemini가 한다.

## 10. Gemini 연동

모델은 `gemini-2.5-flash`. 두 지점에서 호출한다.

### 10-1. 등록 시 비전 태깅

옷이 `garments`에 들어올 때(옷장 등록이든 장바구니 등록이든) **딱 한 번** 상품 이미지 1장을 보내 구조화된 태그를 받고 `ai_tags`에 저장한다.

```json
{
  "category": "top",
  "color_name": "차콜",
  "color_tone": "쿨",
  "brightness": "어두움",
  "pattern": "무지",
  "style_keywords": ["미니멀", "캐주얼"],
  "formality": 3,
  "season": ["봄", "가을"]
}
```

**구매 판단 시점에는 이미지를 추가로 보내지 않는다.** 후보 옷도 등록 파이프라인을 거치므로 자기 태그를 이미 갖고 있고, 옷장 옷들의 태그는 DB에 있다. 판단은 저장된 태그 텍스트만 비교한다. 옷장이 30벌이어도 판단 1회에 이미지 전송은 0장이다.

### 10-2. 판단 문장 생성

입력으로 후보 옷의 태그·가격, 옷장 옷들의 태그 요약, 그리고 **코드가 이미 계산해 둔 편차 리포트**를 넘긴다. `responseSchema`로 구조화 출력을 강제한다.

```json
{
  "match_severity": "ok | warn | bad",
  "size_feedback": "사용자님이 주로 입는 상의보다 총장이 4cm 길고 가슴단면도 넓습니다.",
  "match_feedback": "가지고 있는 옷들이 대부분 어두운 무지 계열이라 이 프린트와 매칭하기 어렵습니다.",
  "price_feedback": "옷장의 비슷한 상의 평균보다 3만원 비쌉니다.",
  "summary": "핏은 무난하지만 매칭이 까다로워 보입니다."
}
```

**Gemini는 `verdict`를 출력하지 않는다.** 최종 판정은 코드가 `fit_score`와 `match_severity`로 계산한다. 프롬프트에도 편차 수치를 재계산하거나 반박하지 말고 주어진 리포트를 서술하라고 명시한다.

## 11. 화면

| 경로 | 내용 |
|---|---|
| `/` | 비로그인은 서비스 소개 + 로그인 버튼, 로그인 상태면 옷장으로 리다이렉트 |
| `/login` | 구글 OAuth |
| `/wardrobe` | 옷장 그리드, 카테고리 필터, 상단 고정 링크 붙여넣기 바, 공유 토글 |
| `/wardrobe/[id]` | 실측 표, 선호도 편집(별점·핏 태그·착용빈도), AI 태그, 삭제 |
| `/cart` | 고민 중인 옷 목록 + 판정 요약 + "샀어요" 버튼 |
| `/analyze` | 링크 입력 → 옵션 선택 → 판정 배지 + 피드백 문장 + 근거 실측 비교 표 |
| `/u/[share_slug]` | 공유 옷장. 열람은 누구나, 로그인 시 추천 아이템 등록 및 룩 만들기 |
| `/looks` | 나를 위해 만들어진 룩 목록 (제작자 표시) |

**분석 결과에는 근거 실측 비교 표를 항상 함께 표시한다.** "총장이 깁니다" 옆에 `72cm / 내 선호 65–68cm`가 있어야 사용자가 판단을 검증할 수 있다. AI 말만 믿게 만들지 않는다.

## 12. 에러 처리

| 상황 | 처리 |
|---|---|
| 무신사 파싱 실패 | 필드별 폴백. 성공 필드는 잠그고 실패 필드만 입력 폼 |
| 이미지 파싱 실패 | 직접 업로드로 대체 |
| Gemini 호출 실패 / 타임아웃 | **실측 비교 표는 그대로 표시**하고 "AI 코멘트를 만들지 못했습니다" 안내. `match_penalty = 0`으로 두고 `fit_score`만으로 판정 |
| Gemini 응답 JSON 파싱 실패 | 1회 재시도 후 위와 같은 폴백 |
| 옷장 데이터 부족 | 핏 판단을 건너뛰고 명시적으로 안내 |
| 중복 등록 (동일 goods_no + 색상 + 사이즈) | 경고만 표시하고 등록은 허용 (같은 옷 두 벌 살 수 있다) |
| 비공개 옷장의 공유 링크 접근 | 404 |
| Vercel 함수 타임아웃 | Gemini 호출 Route Handler에 `maxDuration`을 상향하고 응답을 스트리밍한다 |

**Gemini가 죽어도 앱이 반쯤 살아 있다**는 점이 핵심이다. 핏 판단은 결정론적 계산이므로 AI 가용성과 무관하다.

## 13. 테스트

Vitest로 가치 높은 세 곳만 잡는다.

1. **핏 판단 엔진** (최우선). `lib/fit/engine.ts`와 `lib/verdict.ts`는 순수 함수다. 가상 옷장 데이터를 넣어 선호 범위 산출, 항목별 편차 점수, 회피 신호, 데이터 부족 분기, 최종 판정을 검증한다. 네트워크가 필요 없고 회귀가 가장 무서운 지점이다.
2. **파서**. 실제 무신사 상품 페이지 HTML을 fixture 파일로 저장해 단위 테스트한다. 네트워크 없이 테스트되고, 무신사가 구조를 바꿨을 때 fixture 갱신만으로 어디가 깨졌는지 잡힌다. 부분 실패 케이스(사이즈표 누락)도 fixture로 고정한다.
3. **RLS**. 로컬 Supabase에서 사용자 둘을 만들어 접근 시나리오를 검증한다. 남의 옷장 옷 수정 시도 → 거부, 공개 옷장에 `status='owned'` 삽입 시도 → 거부, 비공개 옷장 조회 → 빈 결과.

Gemini 호출은 모킹한다. E2E는 넣지 않는다.

## 14. 구현 순서

순서 자체가 리스크 관리다.

**Phase 0 — 무신사 파싱 타당성 확인**
실제 상품 페이지를 뜯어 어디까지 얻을 수 있는지 확인한다. 정적 HTML에 데이터가 있는가, 내부 JSON 엔드포인트가 있는가, 봇 차단이 있는가. **결과에 따라 Phase 2 설계가 바뀌므로 무조건 첫 번째다.** 산출물은 확인 노트와 fixture HTML 파일.

**Phase 1 — 기반**
Next.js 프로젝트 셋업, Supabase 프로젝트 생성, 스키마·RLS 마이그레이션, 구글 로그인, `profiles` 자동 생성 트리거. 로그인해서 빈 옷장을 보는 것까지.

**Phase 2 — 옷장 등록**
링크 파싱 → 옵션 선택박스 → 옷장 등록 + 필드별 수동 폴백 + 이미지 Storage 복사 + 실측 저장. AI 없음.

**Phase 3 — 옷장 상세와 선호도**
상세 화면, 실측 표, 별점·핏 태그·착용빈도 편집, 삭제.

**Phase 4 — 핏 판단 엔진**
`lib/fit/*`, `lib/verdict.ts`와 단위 테스트. **AI 없이 결정론적 리포트만 화면에 표시한다.** 이 시점에 이미 쓸 만한 제품이다.

**Phase 5 — Gemini 연동**
등록 시 비전 태깅, 판단 문장 생성, 장바구니 화면, 분석 결과 화면, "샀어요" 승격.

**Phase 6 — 공유 옷장**
공유 토글, `share_slug` 라우트, 읽기 전용 열람, 로그인 사용자의 추천 아이템 등록.

**Phase 7 — 룩**
룩 만들기, 룩 목록, 제작자 표시.

**Phase 8 — 마감**
공유 링크 OG 이미지, 빈 상태 UI, 로딩 상태, README.

**Phase 4에서 AI 없이 제품이 완성된다**는 것이 이 순서의 요점이다. Gemini는 나중에 서술 레이어로 얹히는 것이므로, API 키나 할당량 문제로 프로젝트가 멈추지 않는다.

## 15. 리스크

| 리스크 | 대응 |
|---|---|
| 무신사가 페이지 구조를 바꿔 파싱이 깨진다 | 파서를 어댑터로 격리, 필드별 폴백, `parse_mode`로 감지, fixture 테스트 |
| 무신사가 서버 요청을 차단한다 | Phase 0에서 조기 확인. 최악의 경우 전 항목 수동 입력으로도 제품이 성립하도록 설계됨 |
| 스크래핑의 약관 리스크 | 사용자 트리거 단건 조회만, 캐시 우선, 목록 크롤링 없음, 비상업적 개인 프로젝트 |
| 옷장이 비어 있어 판단할 근거가 없다 | 데이터 부족을 명시적으로 안내. 억지 판단 금지 |
| Gemini 무료 할당량 초과 | 등록 시 1회 태깅으로 호출 최소화. 실패 시 핏 리포트만으로 동작 |
| Vercel 함수 타임아웃 | `maxDuration` 상향 + 스트리밍 응답 |
| 허용 편차 수치가 현실과 안 맞는다 | 전부 상수 한 곳에 모아 사용하면서 조정 |
