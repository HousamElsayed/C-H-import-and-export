import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-ink-muted border-line',
  brand: 'bg-brand-soft text-brand-strong border-brand-ring/40',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
  info: 'bg-info-soft text-info border-info/20',
  accent: 'bg-accent-soft text-accent border-accent/20',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
}
