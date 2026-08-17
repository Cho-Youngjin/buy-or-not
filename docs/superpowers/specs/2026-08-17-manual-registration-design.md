# 수동 등록 설계 문서

작성일: 2026-08-17

## 1. 배경

합의한 A~F 중 **C: 수동 등록**. 무신사 링크가 없는 보세 옷도 등록할 수 있게 한다. "사진 업로드부터" 시작하는 새 화면을 만드는 대신, **기존 `GarmentForm`을 그대로 재사용**하고 진입 경로와 이미지 업로드만 더한다 — 파싱이 전부 실패했을 때 뜨는 화면이 이미 상품명·브랜드·가격·카테고리·색상·사이즈·실측 9칸을 모두 직접 입력하게 돼 있어, 필요한 건 "링크 없이 그 화면으로 바로 들어가는 방법"과 "이미지 URL 대신 사진 파일을 올리는 방법" 둘뿐이다.

## 2. 범위

- **대상 화면**: `/wardrobe`(옷장 등록)·`/analyze`(구매 판단) 둘 다. 친구 추천(`RecommendLinkBar`)은 이번 범위 밖이다.
- **`GarmentForm`을 새로 만들지 않는다.** `LinkInputBar`·`AnalyzeLinkBar`에 "직접 등록" 진입점만 추가하고, `GarmentForm`에 파일 업로드 칸만 더한다.

## 3. "직접 등록" 진입점

`LinkInputBar`·`AnalyzeLinkBar` 각각에 상태 하나를 추가한다: `manualParsed: ParseResult | null`. 무신사 링크 입력창 아래 "무신사 링크가 없나요? 직접 등록하기" 텍스트 버튼을 두고, 누르면 링크 파싱을 건너뛰고 **모든 필드가 실패로 채워진 합성 `ParseResult`**를 만들어 바로 `GarmentForm`을 띄운다.

```ts
// lib/musinsa/manualParseResult.ts (신규, 순수 함수 — lib/에는 React 의존 없음 원칙 유지)
import { fail } from '@/lib/musinsa/types'
import type { ParseResult } from '@/lib/musinsa/types'

/**
 * 무신사 링크 없이 "직접 등록"할 때 쓰는 합성 ParseResult.
 * goodsNo는 실제 상품번호가 없으므로 crypto.randomUUID()로 대신한다 —
 * registerGarment의 이미지 저장 경로·중복 검사 로직이 goodsNo를 전제하므로,
 * null로 두고 그 로직들을 전부 예외 처리하는 대신 값 하나를 만들어 그대로 태운다.
 */
export function createManualParseResult(): ParseResult {
  return {
    goodsNo: crypto.randomUUID(),
    fields: {
      name: fail('직접 입력'),
      brand: fail('직접 입력'),
      price: fail('직접 입력'),
      imageUrl: fail('직접 입력'),
      category: fail('직접 입력'),
      options: fail('직접 입력'),
      sizeTable: fail('직접 입력'),
    },
  }
}
```

버튼을 누르는 시점에 **한 번만** 호출해 `manualParsed` state에 저장한다(렌더마다 새로 만들면 매번 다른 `goodsNo`가 생겨 제출 시점에 어떤 값이 쓰일지 예측할 수 없다). `GarmentForm`의 기존 `onCancel`(계획 7에서 만든 "접기" 버튼)이 여기서는 `() => setManualParsed(null)`을 받아 취소 동작을 한다.

`LinkInputBar` 예시:

```tsx
export function LinkInputBar() {
  const router = useRouter()
  const parse = useMusinsaParse()
  const [manualParsed, setManualParsed] = useState<ParseResult | null>(null)

  if (manualParsed) {
    return (
      <GarmentForm
        parsed={manualParsed}
        sourceUrl={null}
        submitEndpoint="/api/garments"
        submitLabel="옷장에 넣기"
        onCancel={() => setManualParsed(null)}
        onSubmitted={() => {
          setManualParsed(null)
          router.refresh()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <MusinsaLinkInput {...parse} placeholder="무신사 상품 링크를 붙여넣으세요" />

      <button type="button" onClick={() => setManualParsed(createManualParseResult())}
        className="text-sm text-ink-muted underline">
        무신사 링크가 없나요? 직접 등록하기
      </button>

      {parse.parsed && (
        <GarmentForm
          parsed={parse.parsed}
          sourceUrl={parse.url}
          submitEndpoint="/api/garments"
          submitLabel="옷장에 넣기"
          onCancel={parse.reset}
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

`AnalyzeLinkBar`도 같은 패턴이다(제출 후 동작만 다름 — 계획 7에서 이미 확립된 "각 파일은 자기만의 제출 후 동작만 다르다" 원칙 그대로).

## 4. `source_url`을 null로 허용

직접 등록은 원본 링크가 없다. `garments.source_url`은 원래 nullable이지만, 지금 타입·검증 스키마는 필수 문자열을 강제한다. 아래를 `string`에서 `string | null`로 완화한다:

- `RegisterGarmentInput.sourceUrl`(`lib/garments/register.ts`)
- `GarmentForm`의 `Props.sourceUrl`과 `GarmentSubmitPayload.sourceUrl`(`components/garment/GarmentForm.tsx`)
- `Body` 스키마의 `sourceUrl: z.string()` → `z.string().nullable()` (`app/api/garments/route.ts`, `app/api/analyze/route.ts`)

화면 어디에도 `source_url`을 표시하는 곳이 없어(코드베이스 전체 검색으로 확인함) 영향은 타입과 검증뿐이다. `/api/recommend/route.ts`도 같은 스키마를 쓰지만 이번 범위(`RecommendLinkBar` 제외) 밖이라 손대지 않는다.

## 5. 사진 업로드

### 5.1 `GarmentForm`에 파일 입력 추가

기존 "이미지 주소" 칸(`{!f.imageUrl.ok && <Field label="이미지 주소">...</Field>}`)에 URL 텍스트 입력과 나란히 파일 선택 입력을 추가한다. 파일을 고르면 URL 입력보다 우선한다 — 완전 수동 등록에서는 URL이 애초에 없고, 무신사 링크를 썼는데 이미지만 파싱 실패한 경우에도 사진을 직접 찍어 올리는 쪽이 URL을 찾아 붙여넣는 것보다 쉽다.

```ts
// 컴포넌트 함수 바깥, 모듈 최상단에 둔다 — 렌더마다 새로 만들 이유가 없는 고정값이다.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4MB — Vercel 서버리스 함수 요청 본문 기본 한도(4.5MB) 아래로 여유를 둔다
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// 컴포넌트 내부
const [imageFile, setImageFile] = useState<File | null>(null)
const [imageError, setImageError] = useState<string | null>(null)

function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0] ?? null
  if (file && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
    setImageError('JPG·PNG·WEBP 파일만 올릴 수 있습니다.')
    setImageFile(null)
    return
  }
  if (file && file.size > MAX_IMAGE_BYTES) {
    setImageError('4MB 이하 파일만 올릴 수 있습니다.')
    setImageFile(null)
    return
  }
  setImageError(null)
  setImageFile(file)
}
```

### 5.2 제출 시점에 업로드

`handleSubmit`이 페이로드를 만들기 **전에**, `imageFile`이 있으면 먼저 업로드해 URL을 받는다:

```ts
async function handleSubmit(event: React.FormEvent) {
  event.preventDefault()
  setSubmitting(true)
  setError(null)

  let uploadedImageUrl: string | null = null
  if (imageFile) {
    const formData = new FormData()
    formData.append('file', imageFile)
    const uploadResponse = await fetch('/api/garments/upload-image', { method: 'POST', body: formData })
    if (!uploadResponse.ok) {
      setSubmitting(false)
      setError('사진을 올리지 못했습니다.')
      return
    }
    uploadedImageUrl = (await uploadResponse.json()).url
  }

  const payload: GarmentSubmitPayload = {
    // ...
    imageUrl: uploadedImageUrl ?? imageUrl.trim() || null,
    // ...
  }
  // ...
}
```

파일을 고르지 않았으면 지금처럼 URL 텍스트 입력값을 쓴다 — 기존 동작(무신사 링크 흐름에서 이미지 URL을 직접 입력하는 경우)은 그대로 유지된다.

### 5.3 새 업로드 API

```
POST /api/garments/upload-image
```

- 인증: 세션 클라이언트로 로그인 여부만 확인(RLS를 타는 테이블 쓰기가 아니라 Storage 업로드라 `supabaseAdmin`을 쓰지만, 로그인 안 한 사용자가 업로드하는 걸 막기 위해 인증 체크는 그대로 한다).
- `multipart/form-data`로 `file` 하나를 받는다.
- 서버에서도 타입(`image/jpeg`·`image/png`·`image/webp`)과 크기(4MB)를 다시 검증한다 — 클라이언트 검증은 우회 가능하다.
- 객체 경로: `manual/{user.id}/{crypto.randomUUID()}.{ext}` — 무신사 이미지 사본(`{goodsNo}/{colorHash}.ext`)과 겹치지 않게 `manual/` 아래 사용자별로 둔다.
- `supabaseAdmin.storage.from('garments').upload(...)` 후 `getPublicUrl(...)`로 공개 URL을 돌려준다. 기존 `garments` 버킷(공개 읽기, service_role만 쓰기)을 그대로 쓴다 — 새 버킷을 만들지 않는다.

```ts
// app/api/garments/upload-image/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const MAX_BYTES = 4 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'JPG·PNG·WEBP 파일만 올릴 수 있습니다.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: '4MB 이하 파일만 올릴 수 있습니다.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const objectPath = `manual/${user.id}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`
  const { error } = await supabaseAdmin.storage
    .from('garments')
    .upload(objectPath, buffer, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: '사진을 올리지 못했습니다.' }, { status: 500 })

  const url = supabaseAdmin.storage.from('garments').getPublicUrl(objectPath).data.publicUrl
  return NextResponse.json({ url })
}
```

### 5.4 이중 업로드 방지

`registerGarment`는 `input.imageUrl`이 있으면 무조건 `copyImageToStorage`(URL을 내려받아 다시 업로드)를 부른다. 방금 우리 버킷에 올린 사진을 또 내려받아 다시 올리면 같은 사진이 두 번 저장되고, 5.3에서 만든 원본은 아무 데서도 참조되지 않는 채로 버킷에 남는다. `copyImageToStorage` 맨 앞에 조건을 하나 추가해 피한다:

```ts
// lib/storage.ts, copyImageToStorage 맨 앞
// URL을 직접 조립하지 않고 SDK가 실제로 만드는 형식을 그대로 얻어 비교한다 —
// NEXT_PUBLIC_SUPABASE_URL의 트레일링 슬래시 유무 등으로 문자열을 손으로 맞추면 어긋날 수 있다.
const BUCKET_PUBLIC_PREFIX = supabaseAdmin.storage.from(BUCKET).getPublicUrl('').data.publicUrl

export async function copyImageToStorage(imageUrl: string, goodsNo: string, colorOption: string): Promise<string | null> {
  if (imageUrl.startsWith(BUCKET_PUBLIC_PREFIX)) return imageUrl // 이미 우리 버킷에 있으면 그대로 쓴다(직접 등록 업로드 경로).
  try {
    // ... 기존 로직
```

## 6. 검증

- **`sizeMatch.ts`류의 순수 함수 단위 테스트**: `createManualParseResult`는 랜덤 UUID를 만드는 게 전부라 의미 있는 단위 테스트가 거의 없다(모든 필드가 `fail`인지, `goodsNo`가 매번 다른지 정도) — 짧게라도 추가한다.
- **`npm run build`/`npm test`**: 타입 변경(nullable) 여파를 빌드가 잡아준다.
- **브라우저 수동 검증**:
  1. `/wardrobe`에서 "직접 등록하기" 클릭 → 링크 입력 없이 바로 빈 폼이 뜨는지, 모든 칸이 비어 직접 입력 상태인지
  2. 사진을 골라 업로드 → 미리보기는 없지만(범위 밖, §7 참고) 제출 후 옷장 카드에 그 사진이 뜨는지
  3. 4MB 넘는 파일·jpg/png/webp가 아닌 파일을 골랐을 때 에러 문구가 뜨고 제출이 안 되는지
  4. "접기"를 누르면 폼이 사라지고 원래 링크 입력 화면으로 돌아가는지
  5. `/analyze`에서도 같은 흐름으로 등록 후 판정까지 나오는지(측정값을 최소 하나 이상 입력해 "정보 부족"이 아닌 실제 판정이 나오는 케이스로 확인)
  6. Storage 대시보드 또는 쿼리로 `manual/{내 uid}/...` 경로에 사진이 한 번만 저장됐는지(이중 업로드 방지 확인)

## 7. 범위 밖

- **업로드 전 이미지 미리보기**: `URL.createObjectURL(file)`로 만들 수 있지만 이번엔 뺀다 — 핵심은 "저장이 되는가"이고, 미리보기는 별도 개선으로 남긴다.
- **이미지 편집(자르기·회전)**: 스펙 범위 밖.
- **여러 장 업로드**: "대표 이미지 1장"으로 명시적으로 제한한다(사용자 확인).
- **`RecommendLinkBar`(친구 추천) 지원**: 이번 범위 밖. 필요해지면 같은 패턴(`createManualParseResult` + 파일 업로드)을 그대로 적용할 수 있다.
