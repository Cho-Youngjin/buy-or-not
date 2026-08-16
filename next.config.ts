import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 무신사 CDN 이미지(등록 전 미리보기)와 Storage에 복사한 사본(lib/storage.ts) 둘 다 <Image />로 표시한다.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "image.msscdn.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
