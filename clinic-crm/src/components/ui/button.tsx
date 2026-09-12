import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/60 ' +
  'disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong shadow-sm',
  secondary: 'bg-brand-soft text-brand-strong hover:bg-brand-ring/30',
  outline: 'border border-line-strong bg-surface text-ink hover:bg-surface-muted',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-95 shadow-sm',
  success: 'bg-success text-white hover:brightness-95 shadow-sm',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-9 w-9',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: Variant
  size?: Size
  children?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...props} />
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: Variant
  size?: Size
}

export function LinkButton({ variant = 'primary', size = 'md', className, ...props }: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}
