import { ImageResponse } from 'next/og'
import { createServerSupabase } from '@/lib/supabase/server'

export const alt = '살까 말까 - 공유 옷장'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ share_slug: string }> }) {
  const { share_slug } = await params
  const supabase = await createServerSupabase()
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('share_slug', share_slug)
    .single()

  const nickname = profile?.nickname ?? '누군가'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#f7f5f0',
        }}
      >
        {/* Satori는 {표현식}과 리터럴 텍스트가 섞이면 자식 노드가 둘로 나뉜 것으로 보고
            "명시적 display가 필요하다"는 오류를 낸다 — 템플릿 리터럴로 합쳐 텍스트 노드 하나로 만든다. */}
        <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, color: '#28261f', letterSpacing: -2 }}>
          {`${nickname}님의 옷장`}
        </div>
        <div
          style={{
            display: 'flex', color: '#ffffff', background: '#c1502e',
            fontSize: 28, fontWeight: 600, padding: '12px 24px', borderRadius: 999, marginTop: 32,
          }}
        >
          살까 말까
        </div>
      </div>
    ),
    { ...size },
  )
}
