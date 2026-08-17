'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { CARD_SURFACE, pillClass } from '@/components/ui/styles'

export type CartItem = {
  id: string
  name: string
  brand: string | null
  image_url: string | null
  latestVerdict: 'buy' | 'caution' | 'skip' | null
  /** 등록 당시 가격. */
  price: number | null
  /** 가장 최근에 다시 확인한 가격. 아직 한 번도 재확인 안 했으면 null(= price와 같다고 본다). */
  lastKnownPrice: number | null
}

const VERDICT_LABELS = { buy: '살만함', caution: '주의', skip: '비추천' } as const

type Props = {
  item: CartItem
  checked: boolean
  onToggle: (id: string) => void
}

/**
 * 장바구니 카드 한 장.
 * 선택 상태를 자기가 들지 않고 부모(CartList)에게서 받는 이유: "선택 삭제"는 여러 카드에
 * 걸친 동작이라, 어느 카드가 선택됐는지는 카드 하나가 알 수 있는 정보가 아니다.
 */
export function CartItemCard({ item, checked, onToggle }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function markAsBought() {
    setSaving(true)
    await fetch(`/api/garments/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'owned' }),
    })
    router.refresh()
  }

  // latestVerdict가 없으면 analyses 행이 없다는 뜻이다(친구 추천으로 들어온 아이템 등,
  // app/(app)/cart/page.tsx의 analyses 조인 참고) — 보여줄 리포트가 없으니 링크를 안 씌운다.
  const cardBody = (
    <>
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-btn bg-canvas">
        {item.image_url && <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="48px" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="truncate text-xs text-ink-muted">{item.brand}</span>
          {item.latestVerdict && (
            <span className={`${pillClass(item.latestVerdict)} px-2 py-0.5 text-xs`}>
              {VERDICT_LABELS[item.latestVerdict]}
            </span>
          )}
        </div>
        {item.price != null && (
          <p className="mt-1 text-xs">
            {item.lastKnownPrice != null && item.lastKnownPrice < item.price ? (
              <>
                <span className="text-ink-muted line-through">{item.price.toLocaleString()}원</span>
                {' → '}
                <span className="font-medium text-ink">{item.lastKnownPrice.toLocaleString()}원</span>
                <span className={`${pillClass('buy')} ml-1 px-1.5 py-0.5 text-[10px]`}>인하</span>
              </>
            ) : (
              <span className="text-ink-muted">{(item.lastKnownPrice ?? item.price).toLocaleString()}원</span>
            )}
          </p>
        )}
      </div>
    </>
  )

  return (
    <div className={`${CARD_SURFACE} flex items-center gap-3 p-3`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(item.id)}
        aria-label={`${item.name} 선택`}
        className="h-4 w-4 shrink-0 accent-accent"
      />
      {item.latestVerdict ? (
        <Link href={`/cart/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          {cardBody}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{cardBody}</div>
      )}
      <Button onClick={markAsBought} disabled={saving} className="shrink-0 px-3 py-2 text-xs">
        {saving ? '처리 중…' : '샀어요'}
      </Button>
    </div>
  )
}
