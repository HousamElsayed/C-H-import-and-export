import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus, ReceiptText } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { Card, EmptyState, PageHeader } from '@/components/ui/card'
import { StatTile } from '@/components/ui/stat'
import { Table, Tr } from '@/components/ui/table'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import { buttonClass } from '@/components/ui/button'
import { InvoiceStatusBadge } from '@/components/domain/status'
import type { Prisma } from '@/generated/prisma/client'
import type { InvoiceStatus } from '@/generated/prisma/enums'

export const metadata: Metadata = { title: 'Invoices' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30
const STATUSES: InvoiceStatus[] = ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'VOID']

export default async function InvoicesPage(props: PageProps<'/invoices'>) {
  const user = await requirePermission('billing:read')
  const params = await props.searchParams

  const query = typeof params.q === 'string' ? params.q.trim() : ''
  const status = typeof params.status === 'string' ? params.status : ''
  const page = Math.max(1, Number.parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1)

  const where: Prisma.InvoiceWhereInput = {}
  if (status) where.status = status as InvoiceStatus
  if (query) {
    where.OR = [
      { number: { contains: query, mode: 'insensitive' } },
      { client: { firstName: { contains: query, mode: 'insensitive' } } },
      { client: { lastName: { contains: query, mode: 'insensitive' } } },
      { client: { phone: { contains: query } } },
    ]
  }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [invoices, total, monthTotals, outstanding] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        cashier: { select: { firstName: true } },
        items: { select: { description: true } },
      },
    }),
    prisma.invoice.count({ where }),
    prisma.payment.aggregate({
      where: { createdAt: { gte: monthStart }, isRefund: false },
      _sum: { amountMinor: true },
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
      _sum: { totalMinor: true, paidMinor: true },
      _count: true,
    }),
  ])

  const outstandingMinor = (outstanding._sum.totalMinor ?? 0) - (outstanding._sum.paidMinor ?? 0)
  const baseParams = { q: query || undefined, status: status || undefined }

  return (
    <>
      <PageHeader
        title="Invoices"
        description={`${total} ${total === 1 ? 'invoice' : 'invoices'}`}
        action={
          can(user.role, 'billing:write') ? (
            <Link href="/invoices/new" className={buttonClass('primary', 'md')}>
              <Plus className="h-4 w-4" />
              New sale
            </Link>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Taken this month" value={formatMoney(monthTotals._sum.amountMinor ?? 0)} tone="brand" />
        <StatTile
          label="Outstanding"
          value={formatMoney(outstandingMinor)}
          hint={`${outstanding._count} open`}
          tone={outstandingMinor > 0 ? 'warning' : 'neutral'}
        />
        <StatTile label="Invoices" value={total} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <SearchInput placeholder="Invoice number or client…" />
          <div className="flex flex-wrap gap-1.5">
            <FilterPill label="All" href={hrefFor({ ...baseParams, status: undefined })} active={!status} />
            {STATUSES.map((value) => (
              <FilterPill
                key={value}
                label={value.replace('_', ' ').toLowerCase()}
                href={hrefFor({ ...baseParams, status: value })}
                active={status === value}
              />
            ))}
          </div>
        </div>

        {invoices.length === 0 ? (
          <EmptyState
            title="No invoices"
            description="Sales appear here once you take a payment."
            icon={<ReceiptText className="h-6 w-6" />}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Items</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <Tr key={invoice.id}>
                    <td>
                      <Link href={`/invoices/${invoice.id}`} className="font-medium text-ink hover:text-brand">
                        {invoice.number}
                      </Link>
                      {invoice.cashier ? (
                        <span className="block text-xs text-ink-subtle">by {invoice.cashier.firstName}</span>
                      ) : null}
                    </td>
                    <td className="text-ink-muted">{formatDate(invoice.issuedAt ?? invoice.createdAt)}</td>
                    <td>
                      {invoice.client ? (
                        <Link href={`/clients/${invoice.client.id}`} className="text-ink hover:text-brand">
                          {invoice.client.firstName} {invoice.client.lastName}
                        </Link>
                      ) : (
                        <span className="text-ink-subtle">Walk-in</span>
                      )}
                    </td>
                    <td className="max-w-xs truncate text-ink-muted">
                      {invoice.items.map((item) => item.description).join(', ')}
                    </td>
                    <td className="text-right font-medium tabular-nums">{formatMoney(invoice.totalMinor)}</td>
                    <td className="text-right tabular-nums text-ink-muted">{formatMoney(invoice.paidMinor)}</td>
                    <td><InvoiceStatusBadge status={invoice.status} /></td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} baseParams={baseParams} />
          </>
        )}
      </Card>
    </>
  )
}

function hrefFor(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const query = search.toString()
  return query ? `/invoices?${query}` : '/invoices'
}

function FilterPill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition ${
        active
          ? 'border-brand-ring bg-brand-soft text-brand-strong'
          : 'border-line bg-surface text-ink-muted hover:bg-surface-muted'
      }`}
    >
      {label}
    </Link>
  )
}
