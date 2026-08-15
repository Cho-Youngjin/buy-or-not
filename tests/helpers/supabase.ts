import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export type TestUser = {
  id: string
  client: SupabaseClient
}

/** service_role로 사용자를 만들고, 그 사용자 세션으로 로그인한 클라이언트를 돌려준다. */
export async function createTestUser(email: string, password = 'test-password-1234'): Promise<TestUser> {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) throw createError

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  return { id: created.user.id, client }
}

export async function deleteTestUser(id: string): Promise<void> {
  await admin.auth.admin.deleteUser(id)
}
