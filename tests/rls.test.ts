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
