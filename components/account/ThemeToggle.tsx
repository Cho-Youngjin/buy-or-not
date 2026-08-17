'use client'

import { useState } from 'react'
import { pillClass } from '@/components/ui/styles'

type Theme = 'system' | 'light' | 'dark'

const THEME_LABELS: Record<Theme, string> = { system: '시스템', light: '라이트', dark: '다크' }

type Props = { initialValue: Theme }

/**
 * 3단 테마 선택. 누르면 <html data-theme>을 직접 바꿔 새로고침 없이 그 자리에서 반영하고,
 * 동시에 서버에도 저장해 다른 기기에서 로그인해도 같은 테마가 적용되게 한다.
 * 'system'을 고르면 속성을 아예 지워 globals.css의 media query가 OS 설정을 따르게 둔다.
 */
export function ThemeToggle({ initialValue }: Props) {
  const [theme, setTheme] = useState<Theme>(initialValue)
  const [saving, setSaving] = useState(false)

  async function select(next: Theme) {
    setTheme(next)
    if (next === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', next)
    }
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    })
    setSaving(false)
  }

  return (
    <div className="flex gap-2">
      {(Object.keys(THEME_LABELS) as Theme[]).map((value) => (
        <button
          key={value}
          type="button"
          disabled={saving}
          onClick={() => select(value)}
          className={`${pillClass(theme === value ? 'active' : 'neutral')} disabled:opacity-40`}
        >
          {THEME_LABELS[value]}
        </button>
      ))}
    </div>
  )
}
