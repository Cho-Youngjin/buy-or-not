'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash } from '@phosphor-icons/react'
import { CartItemCard, type CartItem } from '@/components/garment/CartItemCard'
import { Button } from '@/components/ui/Button'

type Props = { items: CartItem[] }

/**
 * 장바구니 목록 + 선택/전체 삭제.
 *
 * /cart 페이지는 서버 컴포넌트라 상태를 들 수 없어서, 선택 상태가 필요한 이 부분만
 * 클라이언트 컴포넌트로 떼어냈다. 페이지는 데이터를 가져와 넘기기만 한다.
 *
 * 삭제에 벌크 API를 새로 만들지 않고 기존 단건 DELETE를 병렬로 부른다:
 * RLS가 이미 요청마다 소유자를 확인하고, 개인 옷장 규모(많아야 수십 개)에서
 * 요청 수가 문제 될 일이 없어 서버 코드를 늘릴 이유가 없다.
 *
 * 이 컴포넌트는 items가 1개 이상일 때만 렌더링된다(빈 장바구니는 페이지가 직접 안내 문구를
 * 그린다) — 그래서 "전체 삭제" 버튼을 조건 없이 그려도 된다.
 */
export function CartList({ items }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState<'selected' | 'all' | null>(null)
  const [deleting, setDeleting] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      // Set을 그대로 수정하면 참조가 같아 React가 리렌더를 건너뛴다 — 항상 새 Set을 만든다.
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const targetIds = confirming === 'all' ? items.map((item) => item.id) : [...selected]

  async function handleDelete() {
    setDeleting(true)
    await Promise.all(targetIds.map((id) => fetch(`/api/garments/${id}`, { method: 'DELETE' })))
    setDeleting(false)
    setConfirming(null)
    setSelected(new Set())
    // 일부가 실패해도 따로 알리지 않는다 — refresh가 실제 DB 상태를 다시 가져오므로
    // 안 지워진 항목은 목록에 그대로 남아 그 자체로 신호가 된다.
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
          <span>
            {confirming === 'all' ? `전체 ${items.length}개를` : `선택한 ${selected.size}개를`} 삭제할까요?
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
            {selected.size > 0 ? `${selected.size}개 선택됨` : `${items.length}개`}
          </span>
          {/* gap-1.5는 BASE에 없는 속성이라 안전하게 더해진다. 패딩은 넘기지 않는다(계획 서두 참고). */}
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

      <div className="space-y-2">
        {items.map((item) => (
          <CartItemCard key={item.id} item={item} checked={selected.has(item.id)} onToggle={toggle} />
        ))}
      </div>
    </div>
  )
}
