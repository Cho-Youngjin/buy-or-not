import { AppHeader } from '@/components/nav/AppHeader'
import { MobileTabBar } from '@/components/nav/MobileTabBar'

/**
 * 로그인한 사용자가 쓰는 화면들의 공통 껍데기.
 * 인증 검사는 여기서 하지 않는다 — 각 페이지가 이미 user를 직접 가져와 쿼리에 쓰고 리다이렉트하므로,
 * 레이아웃에서 한 번 더 getUser()를 부르면 화면마다 Auth 서버 왕복이 두 번씩 생긴다.
 *
 * props 타입에 Next가 생성하는 LayoutProps를 쓰지 않고 직접 적는다 — 라우트 그룹은 URL 세그먼트가
 * 없어 LayoutRoutes에 대응하는 키가 없기 때문이다.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {/* pb-20: 모바일에서 하단 탭바가 콘텐츠 마지막 줄을 가리지 않도록 띄운다. */}
      <div className="flex-1 pb-20 md:pb-0">{children}</div>
      <MobileTabBar />
    </>
  )
}
