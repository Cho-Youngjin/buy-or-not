import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { AnalyzeLinkBar } from '@/components/analyze/AnalyzeLinkBar'

export default async function AnalyzePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight text-ink">살까 말까</h1>
      <AnalyzeLinkBar />
    </main>
  )
}
