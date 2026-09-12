import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('table-base', className)} {...props} />
    </div>
  )
}

export function Th({ className, ...props }: ComponentProps<'th'>) {
  return <th className={className} {...props} />
}

export function Td({ className, ...props }: ComponentProps<'td'>) {
  return <td className={className} {...props} />
}

export function Tr({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('transition hover:bg-surface-muted/60', className)} {...props} />
}

export function Num({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('text-right tabular-nums', className)} {...props} />
}
