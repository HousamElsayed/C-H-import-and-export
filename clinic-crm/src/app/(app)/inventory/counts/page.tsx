import Link from 'next/link'
import type { Metadata } from 'next'
import { ListChecks, Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { formatDateTime } from '@/lib/dates'
import { Card, EmptyState, PageHeader } from '@/components/ui/card'
import { Table, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { buttonClass } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Stock takes' }
export const dynamic = 'force-dynamic'

export default async function StockCountsPage() {
  await requirePermission('inventory:write')

  const counts = await prisma.stockCount.findMany({
    orderBy: { countedAt: 'desc' },
    take: 50,
    include: {
      countedBy: { select: { firstName: true, lastName: true } },
      items: { select: { varianceQty: true } },
    },
  })

  return (
    <>
      <PageHeader
        title="Stock takes"
        description="Physical counts and the corrections they posted"
        action={
          <Link href="/inventory/counts/new" className={buttonClass('primary', 'md')}>
            <Plus className="h-4 w-4" />
            New stock take
          </Link>
        }
      />

      <Card>
        {counts.length === 0 ? (
          <EmptyState
            title="No stock takes yet"
            description="Count what is on the shelf and let the system correct the difference."
            icon={<ListChecks className="h-6 w-6" />}
            action={<Link href="/inventory/counts/new" className={buttonClass('primary', 'sm')}>Start one</Link>}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Counted</th>
                <th>By</th>
                <th className="text-right">Lines</th>
                <th className="text-right">Discrepancies</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((count) => {
                const discrepancies = count.items.filter((item) => item.varianceQty !== 0).length
                return (
                  <Tr key={count.id}>
                    <td>
                      <Link href={`/inventory/counts/${count.id}`} className="font-medium text-ink hover:text-brand">
                        {count.number}
                      </Link>
                    </td>
                    <td className="text-ink-muted">{formatDateTime(count.countedAt)}</td>
                    <td className="text-ink-muted">
                      {count.countedBy ? `${count.countedBy.firstName} ${count.countedBy.lastName}` : '—'}
                    </td>
                    <td className="text-right tabular-nums">{count.items.length}</td>
                    <td className="text-right">
                      {discrepancies > 0 ? (
                        <Badge tone="warning">{discrepancies}</Badge>
                      ) : (
                        <Badge tone="success">none</Badge>
                      )}
                    </td>
                    <td className="max-w-xs truncate text-ink-muted">{count.notes ?? '—'}</td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
