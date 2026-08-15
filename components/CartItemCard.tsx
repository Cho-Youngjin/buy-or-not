'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export type CartItem = {
  id: string
  name: string
  brand: string | null
  image_url: string | null
  latestVerdict: 'buy' | 'caution' | 'skip' | null
}

const VERDICT_LABELS = { buy: '살만함', caution: '주의', skip: '비추천' } as const

export function CartItemCard({ item }: { item: CartItem }) {
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

  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-gray-100">
        {item.image_url && <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="48px" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="text-xs text-gray-500">
          {item.brand} {item.latestVerdict && `· ${VERDICT_LABELS[item.latestVerdict]}`}
        </p>
      </div>
      <button type="button" onClick={markAsBought} disabled={saving}
        className="shrink-0 rounded-lg bg-black px-3 py-2 text-xs text-white disabled:bg-gray-300">
        {saving ? '처리 중…' : '샀어요'}
      </button>
    </div>
  )
}
