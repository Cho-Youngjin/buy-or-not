'use client'

import { useState } from 'react'
import { GarmentForm } from '@/components/garment/GarmentForm'
import { useMusinsaParse } from '@/components/garment/useMusinsaParse'
import { MusinsaLinkInput } from '@/components/garment/MusinsaLinkInput'
import type { BuilderGarment } from '@/components/share/OutfitBuilder'

type Props = {
  wardrobeOwnerId: string
  /** 추천에 성공하면 방금 등록된 아이템을 넘겨준다 — RecommendAndBuild가 룩 재료 목록에 바로 더하는 데 쓴다. */
  onRecommended?: (garment: BuilderGarment) => void
}

export function RecommendLinkBar({ wardrobeOwnerId, onRecommended }: Props) {
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
          onCancel={parse.reset}
          onSubmitted={(data) => {
            parse.reset()
            setDone(true)
            // 서버 응답이 예상 형식이 아니면(id가 없는 등) 조용히 건너뛴다 — "추천했습니다!"
            // 문구는 그대로 뜨므로 추천 자체가 실패한 것처럼 보이지 않는다(스펙 §8).
            if (typeof data.id === 'string') {
              onRecommended?.({
                id: data.id,
                name: typeof data.name === 'string' ? data.name : '',
                image_url: typeof data.imageUrl === 'string' ? data.imageUrl : null,
                justRecommended: true,
              })
            }
          }}
        />
      )}

      {done && <p className="text-sm text-ink">추천했습니다! 상대방의 장바구니에 담겼습니다.</p>}
    </div>
  )
}
