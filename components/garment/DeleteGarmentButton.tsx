'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'

/**
 * 옷 삭제 버튼. 실수로 지우는 걸 막기 위해 한 번 누르면 확인 문구가 뜨는 2단계다.
 * window.confirm을 쓰지 않는 이유: 브라우저 모달은 스타일을 맞출 수 없고 페이지 전체를 막는다.
 *
 * 첫 버튼은 글자 없이 아이콘만 있으므로 aria-label로 이름을 준다 — 스크린리더에서
 * "버튼"으로만 읽히면 무슨 버튼인지 알 수 없기 때문이다.
 *
 * Button에 패딩 클래스를 넘겨 정사각형으로 만들지 않는다: 이 프로젝트엔 tailwind-merge가 없어
 * className이 Button 내부의 px-4 py-2를 이기지 못한다(계획 서두 "사전 확인된 사실" 참고).
 * 기본 패딩 그대로도 아이콘이 가운데 오는 작은 버튼이라 보기에 문제없다.
 */
export function DeleteGarmentButton({ garmentId }: { garmentId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const response = await fetch(`/api/garments/${garmentId}`, { method: 'DELETE' })
    if (response.ok) {
      router.push('/wardrobe')
      router.refresh()
      return
    }
    setDeleting(false)
  }

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)} aria-label="삭제">
        <Trash size={16} weight="bold" />
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm text-ink">
      <span>정말 삭제할까요?</span>
      <Button variant="danger" onClick={handleDelete} disabled={deleting}>
        {deleting ? '삭제 중…' : '삭제'}
      </Button>
      <Button variant="secondary" onClick={() => setConfirming(false)}>
        취소
      </Button>
    </div>
  )
}
