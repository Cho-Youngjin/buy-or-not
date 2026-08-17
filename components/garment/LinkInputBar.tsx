'use client'

import { useRouter } from 'next/navigation'
import { GarmentForm } from '@/components/garment/GarmentForm'
import { useMusinsaParse } from '@/components/garment/useMusinsaParse'
import { MusinsaLinkInput } from '@/components/garment/MusinsaLinkInput'

/**
 * 옷장 등록의 진입점.
 * 링크 파싱은 useMusinsaParse가, 입력 UI는 MusinsaLinkInput이 맡는다 —
 * 여기 남은 건 "어디로 저장할지"와 "저장 후 무엇을 할지"뿐이다.
 */
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
