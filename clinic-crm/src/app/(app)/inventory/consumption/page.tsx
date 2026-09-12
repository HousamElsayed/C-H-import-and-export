import Link from 'next/link'
import type { Metadata } from 'next'
import { ClipboardList, Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { Card, EmptyState, PageHeader } from '@/components/ui/card'
import { StatTile } from '@/components/ui/stat'
import { Table, Tr } from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { buttonClass } from '@/components/ui/button'
import { ConsumptionStatusBadge } from '@/components/domain/status'

export const metadata: Metadata = { title: 'Usage bills' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function ConsumptionListPage(props: PageProps<'/inventory/consumption'>) {
  const user = await requirePermission('inventory:read')
  const params = await props.searchParams
  const page = Math.max(1, Number.parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1)

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [bills, total, monthTotal, drafts] = await Promise.all([
    prisma.consumptionBill.findMany({
      orderBy: { billDate: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        staff: { select: { firstName: true, lastName: true } },
        room: { select: { name: true } },
        createdBy: { select: { firstName: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.consumptionBill.count(),
    prisma.consumptionBill.aggregate({
      where: { status: 'ISSUED', billDate: { gte: monthStart } },
      _sum: { totalCostMinor: true },
    }),
    prisma.consumptionBill.count({ where: { status: 'DRAFT' } }),
  ])

  return (
    <>
      <PageHeader
        title="Usage bills"
        description="Itemised, costed records of products used inside the clinic"
        action={
          can(user.role, 'inventory:consume') ? (
            <Link href="/inventory/consumption/new" className={buttonClass('primary', 'md')}>
              <Plus className="h-4 w-4" />
              New usage bill
            </Link>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Issued this month" value={formatMoney(monthTotal._sum.totalCostMinor ?? 0)} tone="brand" />
        <StatTile label="Drafts" value={drafts} tone={drafts > 0 ? 'warning' : 'neutral'} />
        <StatTile label="Total bills" value={total} />
      </div>

      <Card>
        {bills.length === 0 ? (
          <EmptyState
            title="No usage bills yet"
            description="Record back-bar restocks, training use, testers and breakages so stock levels and treatment costs stay accurate."
            icon={<ClipboardList className="h-6 w-6" />}
            action={
              can(user.role, 'inventory:consume') ? (
                <Link href="/inventory/consumption/new" className={buttonClass('primary', 'sm')}>
                  Create the first one
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Date</th>
                  <th>Cost centre</th>
                  <th>Reason</th>
                  <th>Attributed to</th>
                  <th className="text-right">Lines</th>
                  <th className="text-right">Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <Tr key={bill.id}>
                    <td>
                      <Link href={`/inventory/consumption/${bill.id}`} className="font-medium text-ink hover:text-brand">
                        {bill.number}
                      </Link>
                    </td>
                    <td className="text-ink-muted">{formatDate(bill.billDate)}</td>
                    <td className="text-ink-muted">{bill.costCenter ?? '—'}</td>
                    <td className="max-w-xs truncate text-ink-muted">{bill.reason ?? '—'}</td>
                    <td className="text-ink-muted">
                      {bill.staff ? `${bill.staff.firstName} ${bill.staff.lastName}` : bill.room?.name ?? '—'}
                    </td>
                    <td className="text-right tabular-nums">{bill._count.items}</td>
                    <td className="text-right font-medium tabular-nums">{formatMoney(bill.totalCostMinor)}</td>
                    <td><ConsumptionStatusBadge status={bill.status} /></td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} baseParams={{}} />
          </>
        )}
      </Card>
    </>
  )
}
