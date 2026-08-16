/**
 * 네비게이션 목적지 정의.
 * 아이콘 컴포넌트를 여기 두지 않는 이유: 이 파일은 node 환경 Vitest에서 그대로 import되는데
 * React 아이콘을 끌고 오면 테스트가 렌더러를 필요로 하게 된다. 아이콘 매핑은 탭바 컴포넌트가 갖는다.
 */
export const NAV_ITEMS = [
  { href: '/wardrobe', label: '옷장' },
  { href: '/analyze', label: '살까말까' },
  { href: '/cart', label: '장바구니' },
  { href: '/looks', label: '룩' },
  { href: '/mypage', label: '마이페이지' },
] as const satisfies readonly { href: string; label: string }[]

/**
 * 현재 경로가 해당 탭에 속하는지 판정한다.
 * 하위 경로(/wardrobe/[id])에서도 부모 탭이 켜져 있어야 하므로 startsWith를 쓰되,
 * '/looksomething'이 '/looks'를 켜 버리지 않도록 반드시 '/'까지 붙여 비교한다.
 */
export function isActiveNav(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
