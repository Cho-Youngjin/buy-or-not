import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { CATEGORY_LABELS, type Category, type FitTag, type WearFrequency } from '@/lib/types'
import { MeasurementsTable } from '@/components/MeasurementsTable'
import { PreferenceForm } from '@/components/PreferenceForm'
import { DeleteGarmentButton } from '@/components/DeleteGarmentButton'

type Props = { params: Promise<{ id: string }> }

type GarmentDetail = {
  id: string
  name: string
  brand: string | null
  price: number | null
  image_url: string | null
  category: Category
  color_option: string | null
  size_option: string | null
  rating: number | null
  fit_tag: FitTag | null
  wear_frequency: WearFrequency | null
  garment_measurements: { key: string; value: number }[] | null
}

export default async function GarmentDetailPage({ params }: Props) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { id } = await params
  const { data: garment } = await supabase
    .from('garments')
    .select('id, name, brand, price, image_url, category, color_option, size_option, rating, fit_tag, wear_frequency, garment_measurements(key, value)')
    .eq('id', id)
    .single<GarmentDetail>()

  // RLS가 남의 옷이면 이 시점에 이미 null을 돌려준다 — 별도 소유자 검사가 필요 없다.
  if (!garment) notFound()

  const measurements = (garment.garment_measurements ?? [])
    .map((m) => ({ key: m.key, value: Number(m.value) }))
    .sort((a, b) => a.key.localeCompare(b.key))

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl bg-gray-100">
        {garment.image_url && (
          <Image src={garment.image_url} alt={garment.name} fill className="object-cover" sizes="400px" />
        )}
      </div>

      <div>
        <p className="text-sm text-gray-500">{garment.brand ?? CATEGORY_LABELS[garment.category]}</p>
        <h1 className="text-xl font-bold">{garment.name}</h1>
        <p className="text-sm text-gray-600">
          {[garment.color_option, garment.size_option].filter(Boolean).join(' · ')}
          {garment.price ? ` · ${garment.price.toLocaleString()}원` : ''}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">실측</h2>
        <MeasurementsTable measurements={measurements} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">선호도</h2>
        <PreferenceForm
          garmentId={garment.id}
          initialRating={garment.rating}
          initialFitTag={garment.fit_tag}
          initialWearFrequency={garment.wear_frequency}
        />
      </section>

      <DeleteGarmentButton garmentId={garment.id} />
    </main>
  )
}
