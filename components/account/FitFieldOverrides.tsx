'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FIT_RULES } from '@/lib/fit/rules'
import { CATEGORY_LABELS, type Category } from '@/lib/types'
import { pillClass, INPUT } from '@/components/ui/styles'

type OverrideRow = { category: Category; fieldKey: string; tolerance: number }
type Props = { initialOverrides: OverrideRow[] }

// FIT_RULES에 실측 항목이 정의된 카테고리만(신발·액세서리는 핏 판단 대상이 아니다).
// Object.keys 순서는 lib/fit/rules.ts에 선언된 순서(top, outer, bottom) 그대로다.
const TOLERANCE_CATEGORIES = Object.keys(FIT_RULES) as Category[]

/**
 * 항목별 허용오차 직접 입력. 값을 비워두면(초기화) 마이페이지 위쪽의 전체 강도 배율을
 * 그대로 따르고, 값을 넣으면 그 항목만 고정된다(스펙 §2) — /api/analyze가 이 값을
 * fetchPreferenceProfile·scoreDeviation 양쪽에 같은 값으로 넘긴다.
 */
export function FitFieldOverrides({ initialOverrides }: Props) {
  const router = useRouter()
  const [category, setCategory] = useState<Category>(TOLERANCE_CATEGORIES[0])
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const row of initialOverrides) {
      map[`${row.category}:${row.fieldKey}`] = String(row.tolerance)
    }
    return map
  })
  const [savingKey, setSavingKey] = useState<string | null>(null)

  async function save(fieldKey: string, tolerance: number | null) {
    const mapKey = `${category}:${fieldKey}`
    setSavingKey(mapKey)
    await fetch('/api/profile/fit-overrides', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, fieldKey, tolerance }),
    })
    setSavingKey(null)
    setValues((prev) => {
      const next = { ...prev }
      if (tolerance === null) delete next[mapKey]
      else next[mapKey] = String(tolerance)
      return next
    })
    router.refresh()
  }

  const rules = FIT_RULES[category] ?? {}

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TOLERANCE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={pillClass(category === c ? 'active' : 'neutral')}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {Object.entries(rules).map(([fieldKey, rule]) => {
          const mapKey = `${category}:${fieldKey}`
          const value = values[mapKey] ?? ''
          return (
            <div key={fieldKey} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-sm text-ink">{fieldKey}</span>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="10"
                value={value}
                placeholder={`기본 ${rule.tolerance}cm`}
                onChange={(e) => setValues((prev) => ({ ...prev, [mapKey]: e.target.value }))}
                onBlur={() => {
                  const num = Number(value)
                  if (value.trim() !== '' && Number.isFinite(num) && num > 0) save(fieldKey, num)
                }}
                className={`${INPUT} w-24`}
              />
              <span className="text-xs text-ink-muted">cm</span>
              {values[mapKey] !== undefined && (
                <button
                  type="button"
                  onClick={() => save(fieldKey, null)}
                  disabled={savingKey === mapKey}
                  className="text-xs text-ink-muted underline"
                >
                  기본값으로
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
