'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { pillClass } from '@/components/ui/styles'

type Props = {
  shareSlug: string
  initialIsPublic: boolean
}

export function ShareToggle({ shareSlug, initialIsPublic }: Props) {
  const router = useRouter()
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  async function toggle() {
    const next = !isPublic
    setSaving(true)
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isWardrobePublic: next }),
    })
    setSaving(false)
    if (response.ok) {
      setIsPublic(next)
      router.refresh()
    }
  }

  async function copyLink() {
    // 서버에서 origin을 추측하지 않고, 지금 접속한 브라우저의 origin을 그대로 쓴다.
    const url = `${window.location.origin}/u/${shareSlug}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={toggle} disabled={saving}
        className={`${pillClass(isPublic ? 'active' : 'neutral')} disabled:opacity-40`}>
        {isPublic ? '옷장 공개 중' : '옷장 비공개'}
      </button>
      {isPublic && (
        <Button variant="secondary" onClick={copyLink}>
          {copied ? '복사됨' : '공유 링크 복사'}
        </Button>
      )}
    </div>
  )
}
