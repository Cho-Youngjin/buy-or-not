import Link from 'next/link'
import Image from 'next/image'
import { CATEGORY_LABELS, type Category } from '@/lib/types'

export type GarmentCardData = {
  id: string
  name: string
  brand: string | null
  price: number | null
  image_url: string | null
  category: Category
  color_option: string | null
  size_option: string | null
}

export function GarmentCard({ garment }: { garment: GarmentCardData }) {
  return (
    <Link href={`/wardrobe/${garment.id}`} className="block overflow-hidden rounded-xl border">
      <div className="relative aspect-[3/4] bg-gray-100">
        {garment.image_url ? (
          <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="200px" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            이미지 없음
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="text-xs text-gray-500">{garment.brand ?? CATEGORY_LABELS[garment.category]}</p>
        <h3 className="line-clamp-2 text-sm font-medium">{garment.name}</h3>
        <p className="text-xs text-gray-600">
          {[garment.color_option, garment.size_option].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Link>
  )
}
