'use client'

import { useState } from 'react'
import { GarmentForm } from '@/components/GarmentForm'
import { useMusinsaParse } from '@/components/garment/useMusinsaParse'
import { MusinsaLinkInput } from '@/components/garment/MusinsaLinkInput'

type Props = { wardrobeOwnerId: string }

export function RecommendLinkBar({ wardrobeOwnerId }: Props) {
  const [done, setDone] = useState(false)
  // 새 링크를 파싱하기 시작하면 이전 완료 메시지를 지운다 — 기존 handleSubmit의 setDone(false)와 같은 역할.
  const parse = useMusinsaParse({ onStart: () => setDone(false) })

  return (
    <div className="space-y-4">
      <MusinsaLinkInput {...parse} placeholder="추천하고 싶은 무신사 상품 링크를 붙여넣으세요" />

      {parse.parsed && !done && (
        <GarmentForm
          parsed={parse.parsed}
          sourceUrl={parse.url}
          submitEndpoint="/api/recommend"
          submitLabel="추천하기"
          noteField
          extraBody={{ wardrobeOwnerId }}
          onSubmitted={() => {
            parse.reset()
            setDone(true)
          }}
        />
      )}

      {done && <p className="text-sm text-ink">추천했습니다! 상대방의 장바구니에 담겼습니다.</p>}
    </div>
  )
}
