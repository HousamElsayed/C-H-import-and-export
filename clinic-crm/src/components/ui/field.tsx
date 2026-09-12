import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('label', className)} {...props} />
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn('field', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn('field min-h-[84px] resize-y', className)} {...props} />
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn('field appearance-none bg-surface pr-8', className)} {...props} />
}

export function Checkbox({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 shrink-0 rounded border-line-strong text-brand accent-[var(--color-brand)]',
        className,
      )}
      {...props}
    />
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label?: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <Label htmlFor={htmlFor}>
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </Label>
      ) : null}
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs font-medium text-danger">{error}</p> : null}
    </div>
  )
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </div>
  )
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
      {message}
    </div>
  )
}
