'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

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
      <button type="button" onClick={() => setConfirming(true)} className="text-sm text-danger underline">
        삭제
      </button>
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
