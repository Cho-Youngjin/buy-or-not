'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
      <button type="button" onClick={() => setConfirming(true)} className="text-sm text-red-600 underline">
        삭제
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span>정말 삭제할까요?</span>
      <button type="button" onClick={handleDelete} disabled={deleting}
        className="rounded bg-red-600 px-2 py-1 text-white disabled:bg-gray-300">
        {deleting ? '삭제 중…' : '삭제'}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-gray-500">취소</button>
    </div>
  )
}
