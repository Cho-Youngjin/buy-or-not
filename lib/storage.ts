import { createHash } from 'node:crypto'
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
    // Supabase Storage 오브젝트 키는 비-ASCII 문자(한글 포함)를 거부한다(실제 등록 테스트에서
    // "블랙" 같은 색상명으로 업로드가 매번 InvalidKey로 실패하는 걸 확인했다). 무신사 색상 옵션은
    // 거의 항상 한국어라 원문을 그대로 못 쓰므로, 색상 문자열을 짧은 해시로 바꿔 키를 만든다.
    // 이 경로는 사용자에게 노출되지 않고(공개 URL만 노출) 같은 색상이면 같은 해시라 upsert로 재사용된다.
    const colorSlug = createHash('sha1').update(colorOption || 'default').digest('hex').slice(0, 10)
    const objectPath = `${goodsNo}/${colorSlug}.${extension}`

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
