'use client'

import { useState } from 'react'
import type { ParseResult } from '@/lib/musinsa/types'
import { GarmentForm } from '@/components/GarmentForm'
import { Button } from '@/components/ui/Button'
import { INPUT } from '@/components/ui/styles'

type Props = { wardrobeOwnerId: string }

export function RecommendLinkBar({ wardrobeOwnerId }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setParsed(null)
    setDone(false)

    const response = await fetch('/api/musinsa/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(data.error ?? '상품 정보를 가져오지 못했습니다.')
      return
    }
    setParsed(data as ParseResult)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="추천하고 싶은 무신사 상품 링크를 붙여넣으세요"
          className={`${INPUT} flex-1`}
        />
        <Button type="submit" disabled={loading || url.trim().length === 0}>
          {loading ? '불러오는 중…' : '불러오기'}
        </Button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {parsed && !done && (
        <GarmentForm
          parsed={parsed}
          sourceUrl={url}
          submitEndpoint="/api/recommend"
          submitLabel="추천하기"
          noteField
          extraBody={{ wardrobeOwnerId }}
          onSubmitted={() => {
            setParsed(null)
            setUrl('')
            setDone(true)
          }}
        />
      )}

      {done && <p className="text-sm text-ink">추천했습니다! 상대방의 장바구니에 담겼습니다.</p>}
    </div>
  )
}
