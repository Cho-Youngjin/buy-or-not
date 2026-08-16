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
        <Link href="/wardrobe" className="text-base font-semibold tracking-tight text-ink">
          살까 말까
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
