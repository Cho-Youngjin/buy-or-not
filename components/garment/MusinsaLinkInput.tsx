'use client'

import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { INPUT } from '@/components/ui/styles'

type Props = {
  url: string
  setUrl: (url: string) => void
  loading: boolean
  error: string | null
  /** 훅의 submit은 Promise<void>를 돌려주지만 여기서는 기다리지 않으므로 void로 받는다. */
  submit: (event: FormEvent) => void
  placeholder: string
}

/**
 * 무신사 링크 입력창 + 불러오기 버튼 + 에러 문구.
 *
 * useMusinsaParse의 반환값을 그대로 펼쳐 넘기는 걸 전제로 한다:
 *   <MusinsaLinkInput {...parse} placeholder="…" />
 * 훅이 추가로 돌려주는 parsed·reset도 같이 펼쳐지지만, JSX 스프레드는 TypeScript의
 * 초과 속성 검사 대상이 아니고 컴포넌트는 모르는 prop을 무시하므로 문제없다.
 *
 * div가 아니라 프래그먼트로 감싸는 것이 중요하다: 부모의 space-y-4가 form·에러 문구·
 * GarmentForm을 각각 직접 자식으로 보고 간격을 주고 있어서, div로 묶으면 셋이 한 덩어리가
 * 되어 지금과 간격이 달라진다. 이 리팩터링은 화면이 바뀌면 안 된다.
 */
export function MusinsaLinkInput({ url, setUrl, loading, error, submit, placeholder }: Props) {
  return (
    <>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={placeholder}
          className={`${INPUT} flex-1`}
        />
        <Button type="submit" disabled={loading || url.trim().length === 0}>
          {loading ? '불러오는 중…' : '불러오기'}
        </Button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}
    </>
  )
}
