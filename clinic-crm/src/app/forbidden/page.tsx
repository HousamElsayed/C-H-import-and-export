import { LinkButton } from '@/components/ui/button'

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-ink">No access to this area</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Your role does not include this permission. Ask the clinic owner or a manager if you need it.
        </p>
        <LinkButton href="/" className="mt-6">
          Back to today
        </LinkButton>
      </div>
    </main>
  )
}
