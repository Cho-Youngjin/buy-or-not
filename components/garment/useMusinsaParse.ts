'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ParseResult } from '@/lib/musinsa/types'

type Options = {
  /**
   * 새 파싱이 시작될 때 호출된다. 링크 입력 바가 각자 갖고 있는 추가 결과 상태
   * (판단 결과·추천 완료 메시지)를 지우는 데 쓴다 — 새 링크를 넣었는데 이전 결과가
   * 그대로 남아 있으면 안 되기 때문이다. LinkInputBar는 그런 상태가 없어 쓰지 않는다.
   */
  onStart?: () => void
}

/**
 * 무신사 링크를 받아 /api/musinsa/parse를 호출하는 상태 묶음.
 * 옷장 등록·구매 판단·친구 추천 세 화면이 이 로직(상태 4개 + fetch + 에러 처리)을
 * 글자 단위로 똑같이 복사해 갖고 있었다 — 이제 여기 한 곳에만 있다.
 *
 * useCallback으로 감싸지 않는다: 기존 세 컴포넌트가 본문에 평범한 async 함수를 두던 방식이고,
 * 이 규모에서 메모이제이션은 이득 없이 코드만 복잡해진다.
 */
export function useMusinsaParse(options?: Options) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    options?.onStart?.()
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

  /** 제출 성공 후 입력 상태를 되돌린다(입력창 비우기 + 폼 감추기). */
  function reset() {
    setParsed(null)
    setUrl('')
  }

  return { url, setUrl, loading, error, parsed, submit, reset }
}
