'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { CARD_SURFACE } from '@/components/ui/styles'

type LookGarment = { id: string; name: string; image_url: string | null }

export type Look = {
  id: string
  title: string
  description: string | null
  authorNickname: string | null
  garments: LookGarment[]
}

type Props = { looks: Look[] }

/**
 * 룩 목록 + 선택/전체 삭제. /cart의 CartList(계획 7)와 정확히 같은 패턴이다(계획 16) —
 * RLS(outfits_delete)가 이미 소유자를 검증하므로 벌크 삭제 API 없이 단건 DELETE를 병렬로 부른다.
 * 친구가 만들어준 룩도 옷장 주인이면 지울 수 있다(outfits_delete: author든 wardrobe_owner든 허용).
 */
export function LooksList({ looks }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState<'selected' | 'all' | null>(null)
  const [deleting, setDeleting] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const targetIds = confirming === 'all' ? looks.map((look) => look.id) : [...selected]

  async function handleDelete() {
    setDeleting(true)
    await Promise.all(targetIds.map((id) => fetch(`/api/outfits/${id}`, { method: 'DELETE' })))
    setDeleting(false)
    setConfirming(null)
    setSelected(new Set())
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
          <span>
            {confirming === 'all' ? `전체 ${looks.length}개를` : `선택한 ${selected.size}개를`} 삭제할까요?
          </span>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? '삭제 중…' : '삭제'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(null)} disabled={deleting}>
            취소
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-ink-muted">
            {selected.size > 0 ? `${selected.size}개 선택됨` : `${looks.length}개`}
          </span>
          <div className="flex gap-2">
            {selected.size > 0 && (
              <Button variant="danger" onClick={() => setConfirming('selected')} className="gap-1.5">
                <Trash size={16} weight="bold" />
                선택 삭제
              </Button>
            )}
            <Button variant="secondary" onClick={() => setConfirming('all')} className="gap-1.5">
              <Trash size={16} weight="bold" />
              전체 삭제
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {looks.map((look) => (
          <article key={look.id} className={`${CARD_SURFACE} flex gap-3 p-4`}>
            <input
              type="checkbox"
              checked={selected.has(look.id)}
              onChange={() => toggle(look.id)}
              aria-label={`${look.title} 선택`}
              className="mt-1 h-4 w-4 shrink-0 accent-accent"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-muted">{look.authorNickname ?? '알 수 없음'}님이 만듦</p>
              <h2 className="text-lg font-medium text-ink">{look.title}</h2>
              {look.description && <p className="text-sm text-ink-muted">{look.description}</p>}
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {look.garments.map((garment) => (
                  <div key={garment.id} className="relative h-24 w-20 shrink-0 overflow-hidden rounded-btn bg-canvas">
                    {garment.image_url && (
                      <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="80px" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
