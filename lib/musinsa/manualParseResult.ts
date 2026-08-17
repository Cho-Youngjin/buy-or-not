import { fail } from '@/lib/musinsa/types'
import type { ParseResult } from '@/lib/musinsa/types'

/**
 * 무신사 링크 없이 "직접 등록"할 때 쓰는 합성 ParseResult.
 * GarmentForm은 ParseResult.fields의 각 필드가 ok:false면 그 칸을 직접 입력 칸으로 그린다
 * (스펙의 "필드 단위 파싱 실패" 원칙) — 전부 실패로 채우면 자동으로 완전 수동 입력 폼이 된다.
 *
 * goodsNo는 실제 상품번호가 없으므로 crypto.randomUUID()로 대신한다. registerGarment의
 * 이미지 저장 경로·중복 검사가 goodsNo를 전제하므로, null로 두고 그 로직들을 전부 예외
 * 처리하는 대신 값 하나를 만들어 기존 파이프라인에 그대로 태운다.
 */
export function createManualParseResult(): ParseResult {
  return {
    goodsNo: crypto.randomUUID(),
    fields: {
      name: fail('직접 입력'),
      brand: fail('직접 입력'),
      price: fail('직접 입력'),
      imageUrl: fail('직접 입력'),
      category: fail('직접 입력'),
      options: fail('직접 입력'),
      sizeTable: fail('직접 입력'),
    },
  }
}
