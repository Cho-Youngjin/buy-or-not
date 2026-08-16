import { describe, it, expect } from 'vitest'
import { NAV_ITEMS, isActiveNav } from '@/lib/nav'

describe('NAV_ITEMS', () => {
  it('스펙이 정한 5개 목적지를 순서대로 가진다', () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      '/wardrobe', '/analyze', '/cart', '/looks', '/mypage',
    ])
  })
})

describe('isActiveNav', () => {
  it('경로가 정확히 같으면 활성이다', () => {
    expect(isActiveNav('/wardrobe', '/wardrobe')).toBe(true)
  })

  it('하위 경로에서도 부모 탭이 활성이다 — 옷 상세에서 "옷장" 탭이 켜져 있어야 한다', () => {
    expect(isActiveNav('/wardrobe/abc-123', '/wardrobe')).toBe(true)
  })

  it('다른 목적지는 활성이 아니다', () => {
    expect(isActiveNav('/wardrobe', '/analyze')).toBe(false)
  })

  it('앞부분만 겹치는 다른 경로를 활성으로 오인하지 않는다', () => {
    // '/looksomething'.startsWith('/looks')는 true이므로 구분자 검사가 없으면 틀린다.
    expect(isActiveNav('/looksomething', '/looks')).toBe(false)
  })
})
