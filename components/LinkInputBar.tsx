'use client'

import { useState } from 'react'
import type { ParseResult } from '@/lib/musinsa/types'
import { GarmentForm } from '@/components/GarmentForm'

/**
 * 옷장 등록의 진입점. 링크를 붙여넣고 `/api/musinsa/parse`를 호출해 결과를 받은 뒤,
 * 그 결과를 <GarmentForm />에 넘겨 필드별 성공/실패에 따라 읽기전용/입력 폼을 나눠 그리게 한다.
 * 여기서는 상태(로딩·에러·파싱 결과)만 들고 있고, 실제 저장(POST /api/garments)은 GarmentForm이 맡는다.
 */
export function LinkInputBar() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setParsed(null)

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
          placeholder="무신사 상품 링크를 붙여넣으세요"
          className="flex-1 rounded-lg border px-4 py-2"
        />
        <button
          type="submit"
          disabled={loading || url.trim().length === 0}
          className="rounded-lg bg-black px-5 py-2 text-white disabled:bg-gray-300"
        >
          {loading ? '불러오는 중…' : '불러오기'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {parsed && (
        <GarmentForm
          parsed={parsed}
          sourceUrl={url}
          onDone={() => {
            setParsed(null)
            setUrl('')
          }}
        />
      )}
    </div>
  )
}
