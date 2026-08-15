import { supabaseAdmin } from '@/lib/supabase/admin'

const BUCKET = 'garments'

/**
 * 무신사 이미지를 내려받아 Storage에 사본을 만든다.
 * CDN URL은 만료되거나 외부 참조가 차단될 수 있으므로 직접 링크하지 않는다.
 * 실패해도 등록 자체는 진행되어야 하므로 예외 대신 null을 돌려준다.
 */
export async function copyImageToStorage(
  imageUrl: string,
  goodsNo: string,
  colorOption: string,
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    const extension = contentType.includes('png') ? 'png'
      : contentType.includes('webp') ? 'webp' : 'jpg'
    const safeColor = colorOption.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) || 'default'
    const objectPath = `${goodsNo}/${safeColor}.${extension}`

    const buffer = Buffer.from(await response.arrayBuffer())
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(objectPath, buffer, { contentType, upsert: true })
    if (error) return null

    return supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl
  } catch {
    return null
  }
}
