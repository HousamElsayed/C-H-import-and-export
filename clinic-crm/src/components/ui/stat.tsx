import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function StatTile({
  label,
  value,
  hint,
  trend,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  trend?: { value: number; label?: string }
  icon?: ReactNode
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
}) {
  const accents = {
    neutral: 'text-ink',
    brand: 'text-brand-strong',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        {icon ? <span className="text-ink-subtle">{icon}</span> : null}
      </div>
      <p className={cn('mt-2 text-2xl font-semibold tabular-nums tracking-tight', accents[tone])}>{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {trend ? (
          <span
            className={cn(
              'text-xs font-medium tabular-nums',
              trend.value > 0 ? 'text-success' : trend.value < 0 ? 'text-danger' : 'text-ink-muted',
            )}
          >
            {trend.value > 0 ? '▲' : trend.value < 0 ? '▼' : '–'} {Math.abs(trend.value).toFixed(1)}%
            {trend.label ? <span className="ml-1 font-normal text-ink-subtle">{trend.label}</span> : null}
          </span>
        ) : null}
        {hint ? <span className="text-xs text-ink-subtle">{hint}</span> : null}
      </div>
    </div>
  )
}
