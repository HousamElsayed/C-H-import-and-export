import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, Printer } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { getSettings } from '@/lib/settings'
import { formatMoney } from '@/lib/money'
import { formatDate, formatDateTime } from '@/lib/dates'
import { formatQty } from '@/lib/utils'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button, buttonClass } from '@/components/ui/button'
import { ConsumptionStatusBadge, MOVEMENT_LABELS } from '@/components/domain/status'
import { PrintTrigger } from '@/components/billing/print-trigger'
import { cancelConsumptionBill, issueConsumptionBill } from '../../actions'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: PageProps<'/inventory/consumption/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const bill = await prisma.consumptionBill.findUnique({ where: { id }, select: { number: true } })
  return { title: bill?.number ?? 'Usage bill' }
}

export default async function ConsumptionBillPage(props: PageProps<'/inventory/consumption/[id]'>) {
  const user = await requirePermission('inventory:read')
  const { id } = await props.params
  const params = await props.searchParams
  const isPrint = params.print === '1'
  const settings = await getSettings()

  const bill = await prisma.consumptionBill.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
      staff: { select: { firstName: true, lastName: true } },
      room: { select: { name: true } },
      appointment: { select: { id: true, code: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      movements: { orderBy: { createdAt: 'asc' }, include: { product: { select: { name: true } } } },
    },
  })

  if (!bill) notFound()
  const canManage = can(user.role, 'inventory:consume')

  return (
    <div className="mx-auto max-w-3xl">
      {isPrint ? <PrintTrigger /> : null}

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/inventory/consumption" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          All usage bills
        </Link>
        <a
          href={`/inventory/consumption/${bill.id}?print=1`}
          target="_blank"
          rel="noreferrer"
          className={buttonClass('outline', 'sm')}
        >
          <Printer className="h-4 w-4" />
          Print
        </a>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Internal consumption · not a sale
            </p>
            <h1 className="mt-1 text-lg font-semibold text-ink">{bill.number}</h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              {settings.name} · {formatDate(bill.billDate)}
            </p>
          </div>
          <div className="text-right">
            <ConsumptionStatusBadge status={bill.status} />
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
              {formatMoney(bill.totalCostMinor)}
            </p>
            <p className="text-xs text-ink-subtle">at cost</p>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-3 border-b border-line px-6 py-4 text-sm sm:grid-cols-2">
          <Detail label="Cost centre" value={bill.costCenter} />
          <Detail
            label="Used by"
            value={bill.staff ? `${bill.staff.firstName} ${bill.staff.lastName}` : null}
          />
          <Detail label="Room" value={bill.room?.name} />
          <Detail label="Reason" value={bill.reason} />
          {bill.appointment ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Appointment</p>
              <Link href={`/calendar/${bill.appointment.id}`} className="text-ink hover:text-brand">
                {bill.appointment.code}
              </Link>
            </div>
          ) : null}
          <Detail
            label="Raised by"
            value={bill.createdBy ? `${bill.createdBy.firstName} ${bill.createdBy.lastName}` : null}
          />
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-6 py-2.5 text-left font-semibold">Product</th>
              <th className="px-3 py-2.5 text-right font-semibold">Quantity</th>
              <th className="px-3 py-2.5 text-right font-semibold">Unit cost</th>
              <th className="px-6 py-2.5 text-right font-semibold">Cost</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item) => (
              <tr key={item.id} className="border-b border-line">
                <td className="px-6 py-3">
                  <span className="text-ink">{item.product.name}</span>
                  <span className="block text-xs text-ink-subtle">
                    {item.product.sku}
                    {item.note ? ` · ${item.note}` : ''}
                  </span>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-ink-muted">
                  {formatQty(item.quantity, item.product.unit)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-ink-muted">
                  {formatMoney(item.unitCostMinor)}
                </td>
                <td className="px-6 py-3 text-right tabular-nums text-ink">
                  {formatMoney(item.totalCostMinor)}
                </td>
              </tr>
            ))}
            <tr className="bg-surface-muted">
              <td className="px-6 py-3 font-medium text-ink" colSpan={3}>Total cost</td>
              <td className="px-6 py-3 text-right font-semibold tabular-nums text-ink">
                {formatMoney(bill.totalCostMinor)}
              </td>
            </tr>
          </tbody>
        </table>

        {bill.notes ? (
          <p className="border-t border-line px-6 py-4 text-sm text-ink-muted">{bill.notes}</p>
        ) : null}
      </Card>

      {canManage && !isPrint ? (
        <div className="no-print mb-6 flex flex-wrap items-center gap-2">
          {bill.status === 'DRAFT' ? (
            <form action={issueConsumptionBill.bind(null, bill.id)}>
              <Button type="submit" variant="primary" size="md">
                Issue and take stock out
              </Button>
            </form>
          ) : null}
          {bill.status !== 'CANCELLED' ? (
            <form action={cancelConsumptionBill.bind(null, bill.id)}>
              <Button type="submit" variant="outline" size="md">
                {bill.status === 'ISSUED' ? 'Cancel and put stock back' : 'Cancel'}
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}

      {bill.movements.length > 0 && !isPrint ? (
        <Card className="no-print">
          <CardHeader title="Stock movements" description="Posted by this bill" />
          <CardBody className="space-y-2 text-sm">
            {bill.movements.map((movement) => (
              <div key={movement.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-ink">
                  {movement.product.name}
                  <span className="ml-2 text-xs text-ink-subtle">
                    {MOVEMENT_LABELS[movement.type]} · {formatDateTime(movement.createdAt)}
                  </span>
                </span>
                <span className={`shrink-0 tabular-nums ${movement.quantity < 0 ? 'text-danger' : 'text-success'}`}>
                  {movement.quantity > 0 ? '+' : ''}{formatQty(movement.quantity)}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="text-ink">{value}</p>
    </div>
  )
}
