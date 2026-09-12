import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buttonClass } from '@/components/ui/button'

export function Pagination({
  page,
  pageSize,
  total,
  baseParams,
}: {
  page: number
  pageSize: number
  total: number
  baseParams: Record<string, string | undefined>
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null

  function href(target: number) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(baseParams)) {
      if (value) params.set(key, value)
    }
    params.set('page', String(target))
    return `?${params.toString()}`
  }

  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-3">
      <p className="text-xs text-ink-muted">
        Showing <span className="font-medium text-ink">{from}</span>–
        <span className="font-medium text-ink">{to}</span> of{' '}
        <span className="font-medium text-ink">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonClass('outline', 'sm')}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Link>
        ) : null}
        <span className="text-xs text-ink-muted">
          Page {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={buttonClass('outline', 'sm')}>
            Next <ChevronRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  )
}
