import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeftRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { formatMoney } from '@/lib/money'
import { formatDateTime } from '@/lib/dates'
import { formatQty } from '@/lib/utils'
import { Card, EmptyState, PageHeader } from '@/components/ui/card'
import { Table, Tr } from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { MOVEMENT_LABELS } from '@/components/domain/status'
import type { Prisma } from '@/generated/prisma/client'
import type { StockMovementType } from '@/generated/prisma/enums'

export const metadata: Metadata = { title: 'Stock movements' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const TYPES: StockMovementType[] = [
  'PURCHASE', 'TREATMENT_USE', 'INTERNAL_USE', 'RETAIL_SALE', 'ADJUSTMENT',
  'WASTAGE', 'EXPIRY', 'STOCK_TAKE', 'CUSTOMER_RETURN', 'RETURN_TO_SUPPLIER',
]

export default async function MovementsPage(props: PageProps<'/inventory/movements'>) {
  await requirePermission('inventory:read')
  const params = await props.searchParams

  const type = typeof params.type === 'string' ? params.type : ''
  const page = Math.max(1, Number.parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1)

  const where: Prisma.StockMovementWhereInput = {}
  if (type && TYPES.includes(type as StockMovementType)) where.type = type as StockMovementType

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true } },
        user: { select: { firstName: true } },
        consumptionBill: { select: { id: true, number: true } },
        invoice: { select: { id: true, number: true } },
        appointment: { select: { id: true, code: true } },
      },
    }),
    prisma.stockMovement.count({ where }),
  ])

  return (
    <>
      <PageHeader title="Stock movements" description="Every change to stock, with its source" />

      <Card>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-5 py-3">
          <FilterPill label="All" href="/inventory/movements" active={!type} />
          {TYPES.map((value) => (
            <FilterPill
              key={value}
              label={MOVEMENT_LABELS[value]}
              href={`/inventory/movements?type=${value}`}
              active={type === value}
            />
          ))}
        </div>

        {movements.length === 0 ? (
          <EmptyState title="No movements" icon={<ArrowLeftRight className="h-6 w-6" />} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th className="text-right">Change</th>
                  <th className="text-right">Balance</th>
                  <th className="text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <Tr key={movement.id}>
                    <td className="whitespace-nowrap text-ink-muted">{formatDateTime(movement.createdAt)}</td>
                    <td>
                      <Link href={`/inventory/products/${movement.product.id}`} className="text-ink hover:text-brand">
                        {movement.product.name}
                      </Link>
                      <span className="block text-xs text-ink-subtle">{movement.product.sku}</span>
                    </td>
                    <td className="text-ink-muted">{MOVEMENT_LABELS[movement.type]}</td>
                    <td className="text-ink-muted">
                      {movement.consumptionBill ? (
                        <Link href={`/inventory/consumption/${movement.consumptionBill.id}`} className="hover:text-brand">
                          {movement.consumptionBill.number}
                        </Link>
                      ) : movement.invoice ? (
                        <Link href={`/invoices/${movement.invoice.id}`} className="hover:text-brand">
                          {movement.invoice.number}
                        </Link>
                      ) : movement.appointment ? (
                        <Link href={`/calendar/${movement.appointment.id}`} className="hover:text-brand">
                          {movement.appointment.code}
                        </Link>
                      ) : (
                        (movement.reference ?? '—')
                      )}
                      {movement.user ? (
                        <span className="block text-xs text-ink-subtle">{movement.user.firstName}</span>
                      ) : null}
                    </td>
                    <td className={`text-right tabular-nums ${movement.quantity < 0 ? 'text-danger' : 'text-success'}`}>
                      {movement.quantity > 0 ? '+' : ''}{formatQty(movement.quantity, movement.product.unit)}
                    </td>
                    <td className="text-right tabular-nums text-ink-muted">{formatQty(movement.balanceAfter)}</td>
                    <td className="text-right tabular-nums text-ink-muted">
                      {formatMoney(movement.totalCostMinor)}
                    </td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              baseParams={{ type: type || undefined }}
            />
          </>
        )}
      </Card>
    </>
  )
}

function FilterPill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        active
          ? 'border-brand-ring bg-brand-soft text-brand-strong'
          : 'border-line bg-surface text-ink-muted hover:bg-surface-muted'
      }`}
    >
      {label}
    </Link>
  )
}
