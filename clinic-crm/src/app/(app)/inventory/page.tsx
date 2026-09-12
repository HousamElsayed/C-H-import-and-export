import Link from 'next/link'
import type { Metadata } from 'next'
import { AlertTriangle, ClipboardList, Clock, Package, PackagePlus, TrendingDown } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { formatQty } from '@/lib/utils'
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui/card'
import { StatTile } from '@/components/ui/stat'
import { Badge } from '@/components/ui/badge'
import { Table, Tr } from '@/components/ui/table'
import { buttonClass } from '@/components/ui/button'
import { StackedBars } from '@/components/charts/stacked-bars'
import { RankedBars } from '@/components/charts/ranked-bars'

export const metadata: Metadata = { title: 'Stock dashboard' }
export const dynamic = 'force-dynamic'

// Validated for colour-vision deficiency: ΔE 22.6 normal, 22.2 deutan.
const SERIES = [
  { key: 'treatment', label: 'Used in treatments', color: '#8b5b9e' },
  { key: 'internal', label: 'Internal use and waste', color: '#b5811f' },
]

const WEEKS = 8

export default async function StockDashboardPage() {
  const user = await requirePermission('inventory:read')
  const canWrite = can(user.role, 'inventory:write')

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - (WEEKS * 7 - 1))

  const soonThreshold = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [products, weeklyUsage, topConsumed, recentBills, monthOut, openDrafts] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        stockQty: true,
        reorderLevel: true,
        reorderQty: true,
        costMinor: true,
        trackStock: true,
        expiresAt: true,
        supplier: { select: { name: true } },
      },
    }),
    prisma.$queryRaw<{ week: Date; type: string; cost: bigint }[]>`
      SELECT date_trunc('week', "createdAt") AS week,
             CASE WHEN "type" = 'TREATMENT_USE' THEN 'treatment' ELSE 'internal' END AS type,
             SUM("totalCostMinor")::bigint AS cost
      FROM "StockMovement"
      WHERE "createdAt" >= ${weekStart}
        AND "type" IN ('TREATMENT_USE', 'INTERNAL_USE', 'WASTAGE', 'EXPIRY')
      GROUP BY 1, 2
      ORDER BY 1
    `,
    prisma.$queryRaw<{ name: string; unit: string; qty: number; cost: bigint }[]>`
      SELECT p."name", p."unit",
             SUM(ABS(m."quantity"))::float8 AS qty,
             SUM(m."totalCostMinor")::bigint AS cost
      FROM "StockMovement" m
      JOIN "Product" p ON p."id" = m."productId"
      WHERE m."createdAt" >= ${monthStart}
        AND m."type" IN ('TREATMENT_USE', 'INTERNAL_USE', 'WASTAGE', 'EXPIRY')
      GROUP BY p."id", p."name", p."unit"
      ORDER BY cost DESC
      LIMIT 7
    `,
    prisma.consumptionBill.findMany({
      orderBy: { billDate: 'desc' },
      take: 5,
      include: { staff: { select: { firstName: true } }, _count: { select: { items: true } } },
    }),
    prisma.stockMovement.aggregate({
      where: {
        createdAt: { gte: monthStart },
        type: { in: ['TREATMENT_USE', 'INTERNAL_USE', 'WASTAGE', 'EXPIRY'] },
      },
      _sum: { totalCostMinor: true },
    }),
    prisma.consumptionBill.count({ where: { status: 'DRAFT' } }),
  ])

  const stockValueMinor = products.reduce(
    (sum, product) => sum + Math.round(product.stockQty * product.costMinor),
    0,
  )
  const lowStock = products.filter(
    (product) => product.trackStock && product.stockQty <= product.reorderLevel,
  )
  const outOfStock = lowStock.filter((product) => product.stockQty <= 0)
  const expiringSoon = products.filter(
    (product) => product.expiresAt && product.expiresAt <= soonThreshold,
  )

  // Bucket the weekly rows into a dense 8-week series so gaps render as zero.
  const weekBuckets = new Map<string, { treatment: number; internal: number }>()
  for (let index = 0; index < WEEKS; index += 1) {
    const day = new Date(weekStart)
    day.setDate(day.getDate() + index * 7)
    weekBuckets.set(startOfIsoWeek(day).toISOString().slice(0, 10), { treatment: 0, internal: 0 })
  }
  for (const row of weeklyUsage) {
    const key = new Date(row.week).toISOString().slice(0, 10)
    const bucket = weekBuckets.get(key)
    if (!bucket) continue
    if (row.type === 'treatment') bucket.treatment += Number(row.cost)
    else bucket.internal += Number(row.cost)
  }

  const points = [...weekBuckets.entries()].map(([key, values]) => ({
    label: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(key)),
    values: { treatment: values.treatment, internal: values.internal },
  }))

  return (
    <>
      <PageHeader
        title="Stock dashboard"
        description="What you hold, what it is worth and where it goes"
        action={
          <div className="flex flex-wrap gap-2">
            {can(user.role, 'inventory:consume') ? (
              <Link href="/inventory/consumption/new" className={buttonClass('primary', 'md')}>
                <ClipboardList className="h-4 w-4" />
                New usage bill
              </Link>
            ) : null}
            {canWrite ? (
              <Link href="/inventory/products/new" className={buttonClass('outline', 'md')}>
                <PackagePlus className="h-4 w-4" />
                New product
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Stock on hand"
          value={formatMoney(stockValueMinor)}
          hint={`${products.length} active lines`}
          tone="brand"
          icon={<Package className="h-4 w-4" />}
        />
        <StatTile
          label="Consumed this month"
          value={formatMoney(monthOut._sum.totalCostMinor ?? 0)}
          hint="At cost"
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <StatTile
          label="Need reordering"
          value={lowStock.length}
          hint={outOfStock.length > 0 ? `${outOfStock.length} out of stock` : 'At or below reorder level'}
          tone={outOfStock.length > 0 ? 'danger' : lowStock.length > 0 ? 'warning' : 'neutral'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatTile
          label="Expiring within 60 days"
          value={expiringSoon.length}
          hint={openDrafts > 0 ? `${openDrafts} draft usage bills` : undefined}
          tone={expiringSoon.length > 0 ? 'warning' : 'neutral'}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader
            title="Where stock goes"
            description={`Cost consumed per week over the last ${WEEKS} weeks`}
          />
          <CardBody>
            <StackedBars points={points} series={SERIES} height={220} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Biggest consumers" description="This month, by cost" />
          <CardBody>
            {topConsumed.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing consumed yet this month.</p>
            ) : (
              <RankedBars
                rows={topConsumed.map((row) => ({
                  label: row.name,
                  sublabel: formatQty(Number(row.qty), row.unit),
                  value: Number(row.cost),
                }))}
                formatValue={(value) => formatMoney(value)}
              />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader
            title="Reorder queue"
            description="At or below reorder level"
            action={
              <Link href="/inventory/products" className={buttonClass('ghost', 'sm')}>
                All products
              </Link>
            }
          />
          {lowStock.length === 0 ? (
            <EmptyState title="Everything is above its reorder level" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Supplier</th>
                  <th className="text-right">In stock</th>
                  <th className="text-right">Reorder at</th>
                  <th className="text-right">Suggested order</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((product) => (
                  <Tr key={product.id}>
                    <td>
                      <Link href={`/inventory/products/${product.id}`} className="font-medium text-ink hover:text-brand">
                        {product.name}
                      </Link>
                      <span className="block text-xs text-ink-subtle">{product.sku}</span>
                    </td>
                    <td className="text-ink-muted">{product.supplier?.name ?? '—'}</td>
                    <td className="text-right">
                      <Badge tone={product.stockQty <= 0 ? 'danger' : 'warning'}>
                        {formatQty(product.stockQty, product.unit)}
                      </Badge>
                    </td>
                    <td className="text-right tabular-nums text-ink-muted">
                      {formatQty(product.reorderLevel)}
                    </td>
                    <td className="text-right font-medium tabular-nums">
                      {formatQty(product.reorderQty || product.reorderLevel, product.unit)}
                    </td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Recent usage bills"
              description="Products consumed inside the clinic"
              action={
                <Link href="/inventory/consumption" className={buttonClass('ghost', 'sm')}>
                  All
                </Link>
              }
            />
            {recentBills.length === 0 ? (
              <EmptyState
                title="No usage bills yet"
                description="Record back-bar use, training or wastage so stock and cost stay honest."
              />
            ) : (
              <ul className="divide-y divide-line">
                {recentBills.map((bill) => (
                  <li key={bill.id}>
                    <Link
                      href={`/inventory/consumption/${bill.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-surface-muted"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{bill.number}</p>
                        <p className="truncate text-xs text-ink-muted">
                          {formatDate(bill.billDate)} · {bill._count.items} lines
                          {bill.costCenter ? ` · ${bill.costCenter}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
                        {formatMoney(bill.totalCostMinor)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {expiringSoon.length > 0 ? (
            <Card>
              <CardHeader title="Expiring soon" description="Within 60 days" />
              <ul className="divide-y divide-line">
                {expiringSoon.slice(0, 6).map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="min-w-0 truncate text-sm text-ink">{product.name}</span>
                    <Badge tone={product.expiresAt! <= new Date() ? 'danger' : 'warning'}>
                      {formatDate(product.expiresAt!)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  )
}

function startOfIsoWeek(date: Date) {
  const result = new Date(date)
  const day = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - day)
  result.setHours(0, 0, 0, 0)
  return result
}
