'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { INPUT, CARD_SURFACE } from '@/components/ui/styles'

type BuilderGarment = { id: string; name: string; image_url: string | null }

type Props = {
  wardrobeOwnerId: string
  garments: BuilderGarment[]
}

export function OutfitBuilder({ wardrobeOwnerId, garments }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const response = await fetch('/api/outfits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wardrobeOwnerId,
        title: title.trim(),
        description: description.trim() || null,
        garmentIds: selected,
      }),
    })
    setSubmitting(false)

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? '룩을 만들지 못했습니다.')
      return
    }
    setDone(true)
    setTitle('')
    setDescription('')
    setSelected([])
    router.refresh()
  }

  if (garments.length === 0) {
    return <p className="text-sm text-ink-muted">옷장에 옷이 없어 룩을 만들 수 없습니다.</p>
  }

  return (
    <form onSubmit={handleSubmit} className={`${CARD_SURFACE} space-y-3 p-5`}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} required
        placeholder="룩 제목" className={INPUT} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="설명 (선택)" rows={2} className={INPUT} />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {garments.map((garment) => (
          <label
            key={garment.id}
            className={`relative aspect-[3/4] cursor-pointer overflow-hidden rounded-btn border-2 transition ${
              selected.includes(garment.id) ? 'border-accent' : 'border-transparent'
            }`}
          >
            <input type="checkbox" checked={selected.includes(garment.id)} onChange={() => toggle(garment.id)}
              className="sr-only" />
            <div className="relative h-full w-full bg-canvas">
              {garment.image_url && (
                <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="150px" />
              )}
            </div>
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {done && <p className="text-sm text-ink">룩을 만들었습니다!</p>}

      <Button type="submit" disabled={submitting || selected.length === 0} className="w-full py-3">
        {submitting ? '만드는 중…' : `룩 만들기 (${selected.length}벌 선택)`}
      </Button>
    </form>
  )
}
