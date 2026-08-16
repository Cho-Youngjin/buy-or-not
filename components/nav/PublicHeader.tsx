import Link from 'next/link'

/**
 * 공개 공유 옷장 전용 헤더.
 * (app) 그룹의 탭바를 쓰지 않는 이유: 방문자가 비로그인일 수 있고, 그 경우 "내 장바구니" 같은
 * 목적지는 전부 로그인 화면으로 튕겨 의미가 없다.
 * 로그인 여부는 페이지가 이미 조회한 값을 넘겨받는다 — 여기서 다시 getUser()를 부르지 않는다.
 */
export function PublicHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight text-ink">
          살까 말까
        </Link>
        <Link
          href={isLoggedIn ? '/wardrobe' : '/'}
          className="text-sm text-ink-muted transition hover:text-ink"
        >
          {isLoggedIn ? '내 옷장으로' : '로그인'}
        </Link>
      </div>
    </header>
  )
}
