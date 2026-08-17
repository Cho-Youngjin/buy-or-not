import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { createServerSupabase } from "@/lib/supabase/server";
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
  // 로그인 사용자의 테마를 서버에서 미리 읽어 <html>에 반영한다 — 첫 페인트부터 맞는
  // 테마가 적용되어 깜빡임(FOUC)이 없다. 'system'이거나 비로그인 방문자면 data-theme을
  // 아예 안 붙여, globals.css의 media query가 OS 설정을 그대로 따르게 둔다.
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  let dataTheme: "light" | "dark" | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("theme")
      .eq("id", user.id)
      .single();
    if (profile?.theme === "light" || profile?.theme === "dark") {
      dataTheme = profile.theme;
    }
  }

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
