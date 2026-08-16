'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CoatHanger, Scales, ShoppingBag, Sparkle, UserCircle } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { NAV_ITEMS, isActiveNav } from '@/lib/nav'

/**
 * 아이콘 매핑을 lib/nav.ts가 아니라 여기 두는 이유는 lib/nav.ts의 주석 참고 —
 * 그 파일은 node 환경 테스트가 그대로 import하므로 React 의존을 넣지 않는다.
 */
const ICONS: Record<string, Icon> = {
  '/wardrobe': CoatHanger,
  '/analyze': Scales,
  '/cart': ShoppingBag,
  '/looks': Sparkle,
  '/mypage': UserCircle,
}

/** 모바일(md 미만) 전용 하단 고정 탭바. PC에서는 hidden이고 AppHeader가 대신 뜬다. */
export function MobileTabBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-canvas/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg">
        {NAV_ITEMS.map((item) => {
          const active = isActiveNav(pathname, item.href)
          const IconComponent = ICONS[item.href]
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition ${
                active ? 'text-accent' : 'text-ink-muted'
              }`}
            >
              <IconComponent size={22} weight={active ? 'fill' : 'regular'} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
