'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Route-driven modal: rendering this component opens it, and dismissing it
 * navigates back. Used for create/edit screens that keep the list behind them.
 */
export function Modal({
  title,
  description,
  children,
  size = 'md',
  onClose,
}: {
  title: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  onClose?: () => void
}) {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  const close = onClose ?? (() => router.back())

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [close])

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 p-4 backdrop-blur-[2px] sm:p-8">
      <div
        className="absolute inset-0"
        onClick={close}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('relative z-10 w-full rounded-[var(--radius-card)] bg-surface shadow-xl', widths[size])}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-ink-subtle transition hover:bg-surface-muted hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
