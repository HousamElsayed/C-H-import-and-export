import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('card', className)} {...props} />
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-line px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function CardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 border-t border-line bg-surface-muted px-5 py-3', className)}
      {...props}
    />
  )
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon ? <div className="mb-1 text-ink-subtle">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
