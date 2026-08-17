import Link from 'next/link'
import Image from 'next/image'
import { CATEGORY_LABELS, type Category } from '@/lib/types'
import { CARD_SURFACE, pillClass } from '@/components/ui/styles'

export type GarmentCardData = {
  id: string
  name: string
  brand: string | null
  price: number | null
  image_url: string | null
  category: Category
  color_option: string | null
  size_option: string | null
  rating: number | null
}

export function GarmentCard({ garment }: { garment: GarmentCardData }) {
  return (
    <div className={`${CARD_SURFACE} relative overflow-hidden transition hover:border-accent`}>
      <Link href={`/wardrobe/${garment.id}`} className="block">
        <div className="relative aspect-[3/4] bg-canvas">
          {garment.image_url ? (
            <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="200px" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-muted">
              이미지 없음
            </div>
          )}
        </div>
        <div className="space-y-1 p-3">
          <p className="text-xs text-ink-muted">{garment.brand ?? CATEGORY_LABELS[garment.category]}</p>
          <h3 className="line-clamp-2 text-sm font-medium text-ink">{garment.name}</h3>
          <p className="text-xs text-ink-muted">
            {[garment.color_option, garment.size_option].filter(Boolean).join(' · ')}
          </p>
        </div>
      </Link>

      {/* 별점(선호도)을 아직 안 매긴 옷. 위 Link 안에 중첩하면 <a> 안에 <a>가 되어 HTML
          규격을 어기므로, 형제 요소로 이미지 우상단에 오버레이한다. outer div가 position:relative라
          top-2/right-2는 카드 맨 위(=이미지 상단)를 기준으로 놓인다 — outer div에 padding이 없어서다. */}
      {garment.rating == null && (
        <Link
          href={`/wardrobe/${garment.id}#선호도`}
          className={`${pillClass('caution')} absolute right-2 top-2 px-2 py-0.5 text-xs`}
        >
          선호도 미설정
        </Link>
      )}
    </div>
  )
}
