'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GarmentForm } from '@/components/garment/GarmentForm'
import { useMusinsaParse } from '@/components/garment/useMusinsaParse'
import { MusinsaLinkInput } from '@/components/garment/MusinsaLinkInput'
import { createManualParseResult } from '@/lib/musinsa/manualParseResult'
import type { ParseResult } from '@/lib/musinsa/types'

/**
 * 옷장 등록의 진입점.
 * 링크 파싱은 useMusinsaParse가, 입력 UI는 MusinsaLinkInput이 맡는다 —
 * 여기 남은 건 "어디로 저장할지"와 "저장 후 무엇을 할지"뿐이다.
 * 무신사 링크가 없는 옷(보세 등)은 "직접 등록하기"를 누르면 합성 ParseResult로
 * 같은 GarmentForm을 그대로 띄운다 — 파싱이 전부 실패했을 때와 동일한 화면이다.
 */
export function LinkInputBar() {
  const router = useRouter()
  const parse = useMusinsaParse()
  const [manualParsed, setManualParsed] = useState<ParseResult | null>(null)

  return (
    <div className="space-y-4">
      {!manualParsed && (
        <>
          <MusinsaLinkInput {...parse} placeholder="무신사 상품 링크를 붙여넣으세요" />

          <button
            type="button"
            onClick={() => setManualParsed(createManualParseResult())}
            className="text-sm text-ink-muted underline"
          >
            무신사 링크가 없나요? 직접 등록하기
          </button>
        </>
      )}

      {parse.parsed && !manualParsed && (
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

      {manualParsed && (
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
      )}
    </div>
  )
}
