import Link from 'next/link'
import type { Metadata } from 'next'
import { Download } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card'
import { StatTile } from '@/components/ui/stat'
import { Table, Tr } from '@/components/ui/table'
import { buttonClass } from '@/components/ui/button'
import { StackedBars } from '@/components/charts/stacked-bars'
import { RankedBars } from '@/components/charts/ranked-bars'

export const metadata: Metadata = { title: 'Reports' }
export const dynamic = 'force-dynamic'

const RANGES = [
  ['30', 'Last 30 days'],
  ['90', 'Last 90 days'],
  ['mtd', 'This month'],
  ['365', 'Last 12 months'],
]

// Validated for colour-vision deficiency: ΔE 22.6 normal, 22.2 deutan.
const REVENUE_SERIES = [
  { key: 'services', label: 'Treatments', color: '#8b5b9e' },
  { key: 'products', label: 'Products and packages', color: '#b5811f' },
]

export default async function ReportsPage(props: PageProps<'/reports'>) {
  const user = await requirePermission('reports:read')
  const params = await props.searchParams
  const range = typeof params.range === 'string' ? params.range : '30'

  const now = new Date()
  const from = new Date(now)
  if (range === 'mtd') {
    from.setDate(1)
  } else {
    from.setDate(from.getDate() - (Number.parseInt(range, 10) || 30))
  }
  from.setHours(0, 0, 0, 0)

  const showFinancial = can(user.role, 'reports:financial')

  const [
    payments,
    revenueByBucket,
    topServices,
    staffPerformance,
    methodSplit,
    appointmentStats,
    newClients,
    returningClients,
    invoiceCount,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { createdAt: { gte: from }, isRefund: false },
      _sum: { amountMinor: true },
      _count: true,
    }),
    prisma.$queryRaw<{ bucket: Date; kind: string; total: bigint }[]>`
      SELECT date_trunc(${range === '365' ? 'month' : 'week'}, i."issuedAt") AS bucket,
             CASE WHEN it."kind" = 'SERVICE' THEN 'services' ELSE 'products' END AS kind,
             SUM(it."totalMinor")::bigint AS total
      FROM "InvoiceItem" it
      JOIN "Invoice" i ON i."id" = it."invoiceId"
      WHERE i."issuedAt" >= ${from} AND i."status" <> 'VOID'
      GROUP BY 1, 2
      ORDER BY 1
    `,
    prisma.$queryRaw<{ name: string; count: bigint; total: bigint }[]>`
      SELECT COALESCE(s."name", it."description") AS name,
             COUNT(*)::bigint AS count,
             SUM(it."totalMinor")::bigint AS total
      FROM "InvoiceItem" it
      JOIN "Invoice" i ON i."id" = it."invoiceId"
      LEFT JOIN "Service" s ON s."id" = it."serviceId"
      WHERE i."issuedAt" >= ${from} AND i."status" <> 'VOID' AND it."kind" = 'SERVICE'
      GROUP BY 1
      ORDER BY total DESC
      LIMIT 8
    `,
    prisma.$queryRaw<{
      id: string
      first: string
      last: string
      treatments: bigint
      revenue: bigint
      commission: bigint
    }[]>`
      SELECT u."id", u."firstName" AS first, u."lastName" AS last,
             COUNT(it."id")::bigint AS treatments,
             COALESCE(SUM(it."totalMinor"), 0)::bigint AS revenue,
             COALESCE((
               SELECT SUM(c."amountMinor") FROM "Commission" c
               WHERE c."userId" = u."id" AND c."createdAt" >= ${from}
             ), 0)::bigint AS commission
      FROM "User" u
      LEFT JOIN "InvoiceItem" it ON it."staffId" = u."id" AND it."kind" = 'SERVICE'
      LEFT JOIN "Invoice" i ON i."id" = it."invoiceId" AND i."issuedAt" >= ${from} AND i."status" <> 'VOID'
      WHERE u."isBookable" = true AND (i."id" IS NOT NULL OR it."id" IS NULL)
      GROUP BY u."id", u."firstName", u."lastName"
      ORDER BY revenue DESC
    `,
    prisma.payment.groupBy({
      by: ['method'],
      where: { createdAt: { gte: from }, isRefund: false },
      _sum: { amountMinor: true },
    }),
    prisma.appointment.groupBy({
      by: ['status'],
      where: { startAt: { gte: from, lte: now } },
      _count: true,
    }),
    prisma.client.count({ where: { createdAt: { gte: from }, isDeleted: false } }),
    prisma.client.count({ where: { visitCount: { gt: 1 }, lastVisitAt: { gte: from } } }),
    prisma.invoice.count({ where: { issuedAt: { gte: from }, status: { not: 'VOID' } } }),
  ])

  const revenueMinor = payments._sum.amountMinor ?? 0
  const totalAppointments = appointmentStats.reduce((sum, row) => sum + row._count, 0)
  const noShows = appointmentStats.find((row) => row.status === 'NO_SHOW')?._count ?? 0
  const completed = appointmentStats.find((row) => row.status === 'COMPLETED')?._count ?? 0
  const cancelled = appointmentStats.find((row) => row.status === 'CANCELLED')?._count ?? 0
  const noShowRate = totalAppointments > 0 ? (noShows / totalAppointments) * 100 : 0
  const averageSale = invoiceCount > 0 ? Math.round(revenueMinor / invoiceCount) : 0

  const buckets = new Map<string, { services: number; products: number }>()
  for (const row of revenueByBucket) {
    const key = new Date(row.bucket).toISOString().slice(0, 10)
    const entry = buckets.get(key) ?? { services: 0, products: 0 }
    if (row.kind === 'services') entry.services += Number(row.total)
    else entry.products += Number(row.total)
    buckets.set(key, entry)
  }

  const points = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => ({
      label: new Intl.DateTimeFormat('en-GB',
        range === '365' ? { month: 'short' } : { day: 'numeric', month: 'short' },
      ).format(new Date(key)),
      values,
    }))

  const methodTotal = methodSplit.reduce((sum, row) => sum + (row._sum.amountMinor ?? 0), 0)

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${formatDate(from)} to ${formatDate(now)}`}
        action={
          showFinancial ? (
            <a href={`/reports/export?range=${range}`} className={buttonClass('outline', 'md')}>
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {RANGES.map(([value, label]) => (
          <Link
            key={value}
            href={`/reports?range=${value}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              range === value
                ? 'border-brand-ring bg-brand-soft text-brand-strong'
                : 'border-line bg-surface text-ink-muted hover:bg-surface-muted'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {showFinancial ? (
          <StatTile label="Revenue" value={formatMoney(revenueMinor)} hint={`${payments._count} payments`} tone="brand" />
        ) : null}
        {showFinancial ? (
          <StatTile label="Average sale" value={formatMoney(averageSale)} hint={`${invoiceCount} invoices`} />
        ) : null}
        <StatTile
          label="Appointments"
          value={totalAppointments}
          hint={`${completed} completed · ${cancelled} cancelled`}
        />
        <StatTile
          label="No-show rate"
          value={`${noShowRate.toFixed(1)}%`}
          hint={`${noShows} missed`}
          tone={noShowRate > 10 ? 'danger' : noShowRate > 5 ? 'warning' : 'success'}
        />
      </div>

      {showFinancial ? (
        <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card>
            <CardHeader
              title="Revenue"
              description={range === '365' ? 'By month' : 'By week'}
            />
            <CardBody>
              {points.length === 0 ? (
                <p className="text-sm text-ink-muted">No invoices in this period.</p>
              ) : (
                <StackedBars points={points} series={REVENUE_SERIES} height={220} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Top treatments" description="By revenue" />
            <CardBody>
              {topServices.length === 0 ? (
                <p className="text-sm text-ink-muted">Nothing sold in this period.</p>
              ) : (
                <RankedBars
                  rows={topServices.map((row) => ({
                    label: row.name,
                    sublabel: `${Number(row.count)}×`,
                    value: Number(row.total),
                  }))}
                  formatValue={(value) => formatMoney(value)}
                />
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title="Team performance" description="Treatments delivered in this period" />
          <Table>
            <thead>
              <tr>
                <th>Team member</th>
                <th className="text-right">Treatments</th>
                {showFinancial ? <th className="text-right">Revenue</th> : null}
                {showFinancial ? <th className="text-right">Average</th> : null}
                {showFinancial ? <th className="text-right">Commission</th> : null}
              </tr>
            </thead>
            <tbody>
              {staffPerformance.map((row) => {
                const treatments = Number(row.treatments)
                const revenue = Number(row.revenue)
                return (
                  <Tr key={row.id}>
                    <td className="font-medium text-ink">{row.first} {row.last}</td>
                    <td className="text-right tabular-nums">{treatments}</td>
                    {showFinancial ? (
                      <td className="text-right font-medium tabular-nums">{formatMoney(revenue)}</td>
                    ) : null}
                    {showFinancial ? (
                      <td className="text-right tabular-nums text-ink-muted">
                        {treatments > 0 ? formatMoney(Math.round(revenue / treatments)) : '—'}
                      </td>
                    ) : null}
                    {showFinancial ? (
                      <td className="text-right tabular-nums text-ink-muted">
                        {formatMoney(Number(row.commission))}
                      </td>
                    ) : null}
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Clients" />
            <CardBody className="space-y-3 text-sm">
              <Row label="New in this period" value={String(newClients)} />
              <Row label="Returning clients seen" value={String(returningClients)} />
              <Row
                label="Completion rate"
                value={`${totalAppointments > 0 ? Math.round((completed / totalAppointments) * 100) : 0}%`}
              />
            </CardBody>
          </Card>

          {showFinancial && methodTotal > 0 ? (
            <Card>
              <CardHeader title="How clients paid" />
              <CardBody className="space-y-2.5">
                {methodSplit
                  .sort((a, b) => (b._sum.amountMinor ?? 0) - (a._sum.amountMinor ?? 0))
                  .map((row) => {
                    const amount = row._sum.amountMinor ?? 0
                    const share = Math.round((amount / methodTotal) * 100)
                    return (
                      <div key={row.method}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="capitalize text-ink">
                            {row.method.toLowerCase().replace(/_/g, ' ')}
                          </span>
                          <span className="tabular-nums text-ink">
                            {formatMoney(amount)}
                            <span className="ml-2 text-xs text-ink-subtle">{share}%</span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                        </div>
                      </div>
                    )
                  })}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </div>
  )
}
