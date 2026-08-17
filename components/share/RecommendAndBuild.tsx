'use client'

import { useEffect, useState } from 'react'
import { RecommendLinkBar } from '@/components/share/RecommendLinkBar'
import { OutfitBuilder, type BuilderGarment } from '@/components/share/OutfitBuilder'

type Props = {
  wardrobeOwnerId: string
  /** 옷장 주인의 실제 소유 옷(status='owned'). 서버 컴포넌트인 page.tsx가 가져와 넘긴다. */
  garments: BuilderGarment[]
}

/**
 * "추천하기"와 "룩 만들기"를 한 화면에서 잇는다. 두 컴포넌트는 원래 페이지의 형제 섹션이라
 * 상태를 공유할 수 없었는데, 방금 추천한 아이템을 룩 재료로 바로 쓰려면 상태 하나(추천 목록)를
 * 공유해야 해서 이 클라이언트 컴포넌트로 둘을 묶었다.
 *
 * 방금 추천한 아이템은 sessionStorage에 wardrobeOwnerId로 스코프해 저장한다: 새로고침해도
 * 남아야 하고, 이 페이지를 벗어나거나 룩을 제출하면 사라져야 하기 때문이다(사용자 요구,
 * 스펙 §3) — sessionStorage는 새로고침엔 살아남고, 언마운트 시 직접 지우면 페이지 이탈에서도
 * 정리된다. 서버 쿼리를 전혀 넓히지 않으므로 다른 방문자의 추천은 애초에 이 브라우저에도,
 * 서버 어디에도 남지 않는다.
 */
export function RecommendAndBuild({ wardrobeOwnerId, garments }: Props) {
  const storageKey = `recommended-look-material:${wardrobeOwnerId}`
  const [recommended, setRecommended] = useState<BuilderGarment[]>([])
  const [preselectId, setPreselectId] = useState<string | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(storageKey)
    if (raw) {
      try {
        setRecommended(JSON.parse(raw) as BuilderGarment[])
      } catch {
        // 손상된 값은 무시하고 빈 목록으로 시작한다.
      }
    }
    return () => sessionStorage.removeItem(storageKey)
  }, [storageKey])

  function handleRecommended(garment: BuilderGarment) {
    setRecommended((prev) => {
      const next = [garment, ...prev]
      sessionStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
    setPreselectId(garment.id)
  }

  function handleOutfitSubmitted() {
    setRecommended([])
    sessionStorage.removeItem(storageKey)
  }

  return (
    <>
      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-lg font-medium text-ink">추천하기</h2>
        <RecommendLinkBar wardrobeOwnerId={wardrobeOwnerId} onRecommended={handleRecommended} />
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-lg font-medium text-ink">룩 만들기</h2>
        <OutfitBuilder
          wardrobeOwnerId={wardrobeOwnerId}
          garments={[...recommended, ...garments]}
          preselectId={preselectId}
          onSubmitted={handleOutfitSubmitted}
        />
      </section>
    </>
  )
}
