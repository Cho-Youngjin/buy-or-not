'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isActiveNav } from '@/lib/nav'

/**
 * PC(md 이상) 전용 상단 헤더. 현재 경로를 알아야 활성 탭을 칠할 수 있어 클라이언트 컴포넌트다.
 * 모바일에서는 hidden이고, 대신 MobileTabBar가 화면 하단에 뜬다.
 */
export function AppHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-canvas/90 backdrop-blur md:block">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        {/* 파비콘(app/icon.svg)과 같은 옷걸이 아이콘을 로고로 쓴다 — 텍스트 로고 "살까 말까"를
            대체하되, 스크린리더 접근성을 위해 sr-only로 텍스트는 남겨둔다. */}
        <Link href="/wardrobe" className="flex items-center text-accent">
          <svg
            width="28"
            height="28"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="16" cy="7" r="2.3" stroke="currentColor" strokeWidth="2" />
            <path d="M16 9.3V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path
              d="M16 13L4 24"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 13L28 24"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="sr-only">살까 말까</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-btn px-3 py-1.5 text-sm transition ${
                isActiveNav(pathname, item.href)
                  ? 'font-medium text-accent'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
