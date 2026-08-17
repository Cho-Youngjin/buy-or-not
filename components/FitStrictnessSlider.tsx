'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 핏 판단 허용오차 배율 슬라이더.
 * 저장을 onChange가 아니라 onPointerUp·onKeyUp에서 하는 이유: range 입력의 onChange는 드래그하는
 * 내내 값마다 발생해서, 그대로 저장하면 슬라이더 한 번 움직일 때 PATCH가 수십 번 날아간다.
 * 화면 표시는 onChange로 즉시 갱신하고(끊김 없는 피드백), 저장은 사용자가 손을 뗄 때 한 번만 한다.
 * 키보드(화살표) 조작도 지원해야 하므로 onKeyUp도 같이 건다.
 */
export function FitStrictnessSlider({ initialValue }: { initialValue: number }) {
  const router = useRouter()
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fitStrictness: value }),
    })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-sm text-ink">{value.toFixed(1)}배</span>
        <span className="text-xs text-ink-muted">{saving ? '저장 중…' : ''}</span>
      </div>

      <input
        type="range"
        min={0.5}
        max={2}
        step={0.1}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        onPointerUp={save}
        onKeyUp={save}
        className="w-full accent-accent"
        aria-label="핏 판단 허용오차 배율"
      />

      <div className="flex justify-between text-xs text-ink-muted">
        <span>엄격하게 (0.5배)</span>
        <span>너그럽게 (2.0배)</span>
      </div>
    </div>
  )
}
