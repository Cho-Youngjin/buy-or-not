import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "살까 말까",
  description: "가진 옷을 옷장에 모아두면, 새로 사려는 옷이 내 사이즈와 스타일에 맞는지 알려드립니다.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 테마를 DB가 아니라 쿠키에서 읽는다. 예전엔 여기서 auth.getUser() + profiles 조회를 했는데,
  // 이 앱의 모든 라우트가 완전히 동적이라 페이지를 이동할 때마다 루트 레이아웃이 매번 새로
  // 실행되면서 그 Supabase 왕복이 매 네비게이션마다 추가로 발생했다 — app/(app)/layout.tsx가
  // "레이아웃에서 getUser()를 부르면 화면마다 Auth 서버 왕복이 두 번씩 생긴다"며 일부러 피해온
  // 바로 그 문제를 루트 레이아웃에서 다시 만든 것이었다. 쿠키 읽기는 네트워크 호출이 없다 —
  // ThemeToggle이 선택할 때마다 DB와 쿠키를 함께 갱신해 기기 간 동기화는 그대로 유지한다.
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value;
  const dataTheme = theme === "light" || theme === "dark" ? theme : undefined;

  return (
    <html
      lang="ko"
      data-theme={dataTheme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
