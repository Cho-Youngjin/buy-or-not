import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { admin, createTestUser, deleteTestUser, type TestUser } from './helpers/supabase'

let alice: TestUser
let bob: TestUser
let aliceGarmentId: string

beforeAll(async () => {
  const stamp = Date.now()
  alice = await createTestUser(`alice-${stamp}@test.local`)
  bob = await createTestUser(`bob-${stamp}@test.local`)

  const { data, error } = await alice.client
    .from('garments')
    .insert({ owner_id: alice.id, name: '검정 후드', category: 'top', status: 'owned' })
    .select('id')
    .single()
  if (error) throw error
  aliceGarmentId = data.id
})

afterAll(async () => {
  await deleteTestUser(alice.id)
  await deleteTestUser(bob.id)
})

describe('profiles 트리거', () => {
  it('가입 시 프로필과 share_slug가 생성된다', async () => {
    const { data } = await admin.from('profiles').select('share_slug').eq('id', alice.id).single()
    expect(data?.share_slug).toBeTruthy()
    expect(data?.share_slug).not.toMatch(/[/+]/)
  })
})

describe('비공개 옷장', () => {
  it('남의 비공개 옷장은 조회되지 않는다', async () => {
    const { data } = await bob.client.from('garments').select('id').eq('owner_id', alice.id)
    expect(data).toEqual([])
  })
})

describe('공개 옷장', () => {
  beforeAll(async () => {
    await admin.from('profiles').update({ is_wardrobe_public: true }).eq('id', alice.id)
  })

  it('공개하면 남도 조회할 수 있다', async () => {
    const { data } = await bob.client.from('garments').select('id').eq('owner_id', alice.id)
    expect(data?.length).toBe(1)
  })

  it('남의 옷장에 owned 상태로는 넣을 수 없다', async () => {
    const { error } = await bob.client.from('garments').insert({
      owner_id: alice.id, name: '침입 시도', category: 'top',
      status: 'owned', recommended_by: bob.id,
    })
    expect(error).not.toBeNull()
  })

  it('남의 공개 옷장에 추천(considering)으로는 넣을 수 있다', async () => {
    const { error } = await bob.client.from('garments').insert({
      owner_id: alice.id, name: '추천 아이템', category: 'top',
      status: 'considering', recommended_by: bob.id,
    })
    expect(error).toBeNull()
  })

  it('recommended_by를 위조하면 거부된다', async () => {
    const { error } = await bob.client.from('garments').insert({
      owner_id: alice.id, name: '위조 추천', category: 'top',
      status: 'considering', recommended_by: alice.id,
    })
    expect(error).not.toBeNull()
  })

  it('남의 옷은 수정할 수 없다', async () => {
    const { data } = await bob.client
      .from('garments').update({ name: '변조됨' }).eq('id', aliceGarmentId).select()
    expect(data).toEqual([])
  })

  it('남의 옷은 삭제할 수 없다', async () => {
    const { data } = await bob.client
      .from('garments').delete().eq('id', aliceGarmentId).select()
    expect(data).toEqual([])
  })
})

describe('musinsa_cache', () => {
  it('일반 사용자는 캐시를 읽을 수 없다', async () => {
    const { data } = await alice.client.from('musinsa_cache').select('goods_no')
    expect(data).toEqual([])
  })
})

describe('analyses', () => {
  let aliceAnalysisId: string

  beforeAll(async () => {
    const { data, error } = await alice.client
      .from('analyses')
      .insert({
        garment_id: aliceGarmentId,
        requester_id: alice.id,
        verdict: 'buy',
        fit_score: 0,
        report: {},
      })
      .select('id')
      .single()
    if (error) throw error
    aliceAnalysisId = data.id
  })

  it('본인 분석 결과는 조회된다', async () => {
    const { data } = await alice.client.from('analyses').select('id').eq('id', aliceAnalysisId)
    expect(data?.length).toBe(1)
  })

  it('남의 분석 결과는 조회되지 않는다', async () => {
    const { data } = await bob.client.from('analyses').select('id').eq('id', aliceAnalysisId)
    expect(data).toEqual([])
  })

  it('requester_id를 위조해 남 이름으로 분석 결과를 남길 수 없다', async () => {
    const { error } = await bob.client.from('analyses').insert({
      garment_id: aliceGarmentId, requester_id: alice.id, verdict: 'buy', fit_score: 0, report: {},
    })
    expect(error).not.toBeNull()
  })
})

describe('outfits', () => {
  let bobGarmentId: string
  let outfitId: string

  beforeAll(async () => {
    const { data, error } = await bob.client
      .from('garments')
      .insert({ owner_id: bob.id, name: '밥의 셔츠', category: 'top', status: 'owned' })
      .select('id')
      .single()
    if (error) throw error
    bobGarmentId = data.id
  })

  it('공개 옷장이면 옷장 주인이 아닌 사람도 룩을 만들 수 있다', async () => {
    // alice는 앞선 '공개 옷장' describe에서 이미 is_wardrobe_public=true로 바뀌어 있다.
    const { data, error } = await bob.client
      .from('outfits')
      .insert({ wardrobe_owner_id: alice.id, author_id: bob.id, title: '가을 코디' })
      .select('id')
      .single()
    expect(error).toBeNull()
    outfitId = data!.id
  })

  it('룩에는 그 옷장 소유가 아닌 옷을 넣을 수 없다', async () => {
    const { error } = await bob.client
      .from('outfit_items')
      .insert({ outfit_id: outfitId, garment_id: bobGarmentId })
    expect(error).not.toBeNull()
  })

  it('그 옷장 소유의 옷은 넣을 수 있다', async () => {
    const { error } = await bob.client
      .from('outfit_items')
      .insert({ outfit_id: outfitId, garment_id: aliceGarmentId })
    expect(error).toBeNull()
  })

  it('비공개 옷장으로는(자기 자신이 대상이어도) 룩을 만들 수 없다', async () => {
    // bob 본인은 공개로 전환한 적이 없으므로 is_wardrobe_public=false다.
    const { error } = await bob.client
      .from('outfits')
      .insert({ wardrobe_owner_id: bob.id, author_id: bob.id, title: '내 룩' })
    expect(error).not.toBeNull()
  })

  it('옷장 주인은 남이 만들어 준 룩을 삭제할 수 있다', async () => {
    const { data } = await alice.client.from('outfits').delete().eq('id', outfitId).select()
    expect(data?.length).toBe(1)
  })
})

describe('fit_field_overrides', () => {
  it('본인은 자기 항목별 허용오차를 저장할 수 있다', async () => {
    const { error } = await alice.client
      .from('fit_field_overrides')
      .insert({ owner_id: alice.id, category: 'bottom', field_key: '허리단면', tolerance: 1.0 })
    expect(error).toBeNull()
  })

  it('본인 값은 조회된다', async () => {
    const { data } = await alice.client
      .from('fit_field_overrides')
      .select('tolerance')
      .eq('owner_id', alice.id)
      .eq('category', 'bottom')
      .eq('field_key', '허리단면')
      .single()
    expect(Number(data?.tolerance)).toBe(1.0)
  })

  it('남의 항목별 허용오차는 조회되지 않는다', async () => {
    const { data } = await bob.client.from('fit_field_overrides').select('tolerance').eq('owner_id', alice.id)
    expect(data).toEqual([])
  })

  it('남의 이름으로는 저장할 수 없다', async () => {
    const { error } = await bob.client
      .from('fit_field_overrides')
      .insert({ owner_id: alice.id, category: 'top', field_key: '총장', tolerance: 2.0 })
    expect(error).not.toBeNull()
  })

  it('본인은 자기 값을 지울 수 있다', async () => {
    const { data } = await alice.client
      .from('fit_field_overrides')
      .delete()
      .eq('owner_id', alice.id)
      .eq('category', 'bottom')
      .eq('field_key', '허리단면')
      .select()
    expect(data?.length).toBe(1)
  })
})
