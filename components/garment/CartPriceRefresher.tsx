'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 아무것도 그리지 않는다 — 마운트되자마자 가격 재확인 API를 백그라운드로 부르기만 한다.
 * /cart 페이지의 첫 로딩을 막지 않기 위해 서버 컴포넌트가 아니라 여기서 fire-and-forget으로 부른다.
 */
export function CartPriceRefresher() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    fetch('/api/cart/refresh-prices', { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { updated?: number } | null) => {
        if (!cancelled && data?.updated) router.refresh()
      })
      .catch(() => {
        // 무시 — 가격 갱신은 부가 기능이라 실패해도 사용자를 막지 않는다.
      })
    return () => {
      cancelled = true
    }
  }, [router])

  return null
}
