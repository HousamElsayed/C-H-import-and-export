import type { Metadata } from 'next'
import { LoginForm } from './login-form'
import { getSettings } from '@/lib/settings'

export const metadata: Metadata = { title: 'Sign in' }
export const dynamic = 'force-dynamic'

export default async function LoginPage(props: PageProps<'/login'>) {
  const searchParams = await props.searchParams
  const next = typeof searchParams.next === 'string' ? searchParams.next : undefined
  const settings = await getSettings()

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-soft via-canvas to-accent-soft px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-lg font-semibold text-white">
            {settings.name.charAt(0)}
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{settings.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">Sign in to the clinic management system</p>
        </div>

        <div className="card p-6">
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-ink-subtle">
          Access is logged. Client records are confidential.
        </p>
      </div>
    </main>
  )
}
