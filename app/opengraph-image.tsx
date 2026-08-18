import { ImageResponse } from 'next/og'

export const alt = '살까 말까'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// app/globals.css의 라이트 팔레트 hex를 그대로 옮겼다. Satori(next/og)는 Tailwind 클래스나
// CSS 커스텀 프로퍼티(var(--color-x))를 못 읽어서 리터럴 hex로 하드코딩할 수밖에 없다.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'flex-start', justifyContent: 'center',
          background: '#f7f5f0', padding: '80px 100px',
        }}
      >
        <div
          style={{
            display: 'flex', color: '#ffffff', background: '#c1502e',
            fontSize: 24, fontWeight: 600, padding: '10px 24px', borderRadius: 999, marginBottom: 32,
          }}
        >
          무신사 링크 하나로 시작하는 옷장
        </div>
        <div style={{ display: 'flex', fontSize: 120, fontWeight: 700, color: '#28261f', letterSpacing: -4 }}>
          살까 말까
        </div>
        <div style={{ display: 'flex', fontSize: 32, color: '#8a8677', marginTop: 28, maxWidth: 820 }}>
          가진 옷을 옷장에 모아두면, 새로 사려는 옷이 내 사이즈와 스타일에 맞는지 알려드립니다.
        </div>
      </div>
    ),
    { ...size },
  )
}
