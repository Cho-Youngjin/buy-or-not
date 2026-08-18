'use client'

import { useEffect, useState } from 'react'
import { pillClass } from '@/components/ui/styles'

type Theme = 'system' | 'light' | 'dark'

const THEME_LABELS: Record<Theme, string> = { system: '시스템', light: '라이트', dark: '다크' }
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1년

type Props = { initialValue: Theme }

// 루트 레이아웃(app/layout.tsx)이 매 페이지 이동마다 DB 왕복 없이 테마를 읽으려고 이 쿠키를 쓴다.
// DB(profiles.theme)가 원본이고, 쿠키는 그걸 미러링한 빠른 경로일 뿐이다.
function applyThemeCookie(theme: Theme) {
  if (theme === 'system') {
    document.cookie = 'theme=; path=/; max-age=0'
  } else {
    document.cookie = `theme=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`
  }
}

/**
 * 3단 테마 선택. 누르면 <html data-theme>을 직접 바꿔 새로고침 없이 그 자리에서 반영하고,
 * 동시에 서버(DB)와 theme 쿠키에도 저장해 다른 기기에서 로그인해도 같은 테마가 적용되게 한다.
 * 'system'을 고르면 속성을 아예 지워 globals.css의 media query가 OS 설정을 따르게 둔다.
 * 마운트 시점에도 DB 값(initialValue)으로 쿠키를 한 번 맞춰둔다 — 다른 기기에서 바꾼 값이거나,
 * 쿠키를 도입하기 전에 DB에만 저장돼 있던 값이 이 브라우저엔 아직 없을 수 있어서다.
 */
export function ThemeToggle({ initialValue }: Props) {
  const [theme, setTheme] = useState<Theme>(initialValue)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    applyThemeCookie(initialValue)
  }, [initialValue])

  async function select(next: Theme) {
    setTheme(next)
    if (next === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', next)
    }
    applyThemeCookie(next)
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
