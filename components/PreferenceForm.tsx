'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FitTag, WearFrequency } from '@/lib/types'

const FIT_TAG_LABELS: Record<FitTag, string> = { tight: '작음', just: '딱맞음', loose: '큼' }
const WEAR_FREQUENCY_LABELS: Record<WearFrequency, string> = {
  often: '자주', sometimes: '가끔', rarely: '거의 안 입음',
}

type Props = {
  garmentId: string
  initialRating: number | null
  initialFitTag: FitTag | null
  initialWearFrequency: WearFrequency | null
}

// 핏 판단 엔진(계획 2 Task 4)이 rating>=4 또는 wear_frequency='often'을 "성공 집합",
// rating<=2 또는 wear_frequency='rarely'를 "실패 집합" 신호로 쓴다(스펙 §9) —
// 이 폼에서 남기는 값이 곧 그 사용자의 선호 실측 범위를 만드는 원재료다.
export function PreferenceForm({ garmentId, initialRating, initialFitTag, initialWearFrequency }: Props) {
  const router = useRouter()
  const [rating, setRating] = useState(initialRating)
  const [fitTag, setFitTag] = useState(initialFitTag)
  const [wearFrequency, setWearFrequency] = useState(initialWearFrequency)
  const [saving, setSaving] = useState(false)

  async function save(next: { rating?: number | null; fitTag?: FitTag | null; wearFrequency?: WearFrequency | null }) {
    setSaving(true)
    await fetch(`/api/garments/${garmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-sm font-medium">별점</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={saving}
              onClick={() => { setRating(n); save({ rating: n }) }}
              className={`text-2xl ${rating != null && n <= rating ? 'text-amber-400' : 'text-gray-300'}`}
              aria-label={`${n}점`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">핏</p>
        <div className="flex gap-2">
          {(Object.keys(FIT_TAG_LABELS) as FitTag[]).map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={saving}
              onClick={() => { setFitTag(tag); save({ fitTag: tag }) }}
              className={`rounded-full border px-3 py-1 text-sm ${fitTag === tag ? 'bg-black text-white' : 'bg-white'}`}
            >
              {FIT_TAG_LABELS[tag]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">착용 빈도</p>
        <div className="flex gap-2">
          {(Object.keys(WEAR_FREQUENCY_LABELS) as WearFrequency[]).map((freq) => (
            <button
              key={freq}
              type="button"
              disabled={saving}
              onClick={() => { setWearFrequency(freq); save({ wearFrequency: freq }) }}
              className={`rounded-full border px-3 py-1 text-sm ${wearFrequency === freq ? 'bg-black text-white' : 'bg-white'}`}
            >
              {WEAR_FREQUENCY_LABELS[freq]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
