import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, Printer } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { getSettings } from '@/lib/settings'
import { formatMoney, formatBps } from '@/lib/money'
import { formatDate, formatDateTime } from '@/lib/dates'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { buttonClass } from '@/components/ui/button'
import { InvoiceStatusBadge } from '@/components/domain/status'
import { PaymentForm, RefundForm, VoidForm } from '@/components/billing/invoice-forms'
import { addPayment, refund, voidInvoice } from '../actions'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: PageProps<'/invoices/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { number: true } })
  return { title: invoice?.number ?? 'Invoice' }
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank transfer',
  ONLINE: 'Online',
  GIFT_CARD: 'Gift card',
  PACKAGE_CREDIT: 'Package credit',
  LOYALTY_POINTS: 'Loyalty points',
}

export default async function InvoicePage(props: PageProps<'/invoices/[id]'>) {
  const user = await requirePermission('billing:read')
  const { id } = await props.params
  const settings = await getSettings()

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      cashier: { select: { firstName: true, lastName: true } },
      appointment: { select: { id: true, code: true, startAt: true } },
      items: { orderBy: { sortOrder: 'asc' } },
      payments: { orderBy: { createdAt: 'asc' }, include: { receivedBy: { select: { firstName: true } } } },
      commissions: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  })

  if (!invoice) notFound()

  const outstanding = invoice.totalMinor - invoice.paidMinor
  const canWrite = can(user.role, 'billing:write')

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          All invoices
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {invoice.appointment ? (
            <Link href={`/calendar/${invoice.appointment.id}`} className={buttonClass('outline', 'sm')}>
              {invoice.appointment.code}
            </Link>
          ) : null}
          <a href={`/invoices/${invoice.id}/print`} target="_blank" rel="noreferrer" className={buttonClass('outline', 'sm')}>
            <Printer className="h-4 w-4" />
            Print
          </a>
        </div>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h1 className="text-lg font-semibold text-ink">{invoice.number}</h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              {formatDate(invoice.issuedAt ?? invoice.createdAt)}
              {invoice.cashier ? ` · ${invoice.cashier.firstName} ${invoice.cashier.lastName}` : ''}
            </p>
          </div>
          <div className="text-right">
            <InvoiceStatusBadge status={invoice.status} />
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
              {formatMoney(invoice.totalMinor)}
            </p>
            {outstanding > 0 ? (
              <p className="text-sm text-warning">{formatMoney(outstanding)} outstanding</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 border-b border-line px-6 py-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">From</p>
            <p className="mt-1 text-sm font-medium text-ink">{settings.name}</p>
            {settings.address ? <p className="text-sm text-ink-muted">{settings.address}</p> : null}
            {settings.taxNumber ? <p className="text-sm text-ink-muted">Tax no. {settings.taxNumber}</p> : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Billed to</p>
            {invoice.client ? (
              <>
                <Link href={`/clients/${invoice.client.id}`} className="mt-1 block text-sm font-medium text-ink hover:text-brand">
                  {invoice.client.firstName} {invoice.client.lastName}
                </Link>
                <p className="text-sm text-ink-muted">{invoice.client.phone}</p>
                {invoice.client.email ? <p className="text-sm text-ink-muted">{invoice.client.email}</p> : null}
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">Walk-in customer</p>
            )}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-6 py-2.5 text-left font-semibold">Description</th>
              <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
              <th className="px-3 py-2.5 text-right font-semibold">Unit</th>
              <th className="px-6 py-2.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-line">
                <td className="px-6 py-3 text-ink">
                  {item.description}
                  {item.totalMinor === 0 ? (
                    <span className="ml-2 text-xs text-brand">prepaid package session</span>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-ink-muted">{item.quantity}</td>
                <td className="px-3 py-3 text-right tabular-nums text-ink-muted">
                  {formatMoney(item.unitPriceMinor)}
                </td>
                <td className="px-6 py-3 text-right tabular-nums text-ink">{formatMoney(item.totalMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end px-6 py-4">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatMoney(invoice.subtotalMinor)} />
            {invoice.discountMinor > 0 ? (
              <Row
                label={`Discount${invoice.discountType === 'PERCENT' ? ` (${formatBps(invoice.discountValue)})` : ''}`}
                value={`− ${formatMoney(invoice.discountMinor)}`}
              />
            ) : null}
            {invoice.taxMinor > 0 ? (
              <Row label={`Tax (${formatBps(invoice.taxBps)})`} value={formatMoney(invoice.taxMinor)} />
            ) : null}
            <div className="flex items-center justify-between border-t border-line pt-2 text-base font-semibold">
              <dt className="text-ink">Total</dt>
              <dd className="tabular-nums text-ink">{formatMoney(invoice.totalMinor)}</dd>
            </div>
            <Row label="Paid" value={formatMoney(invoice.paidMinor)} />
            {invoice.refundedMinor > 0 ? (
              <Row label="Refunded" value={`− ${formatMoney(invoice.refundedMinor)}`} />
            ) : null}
            {outstanding > 0 ? <Row label="Outstanding" value={formatMoney(outstanding)} /> : null}
          </dl>
        </div>

        {invoice.notes ? (
          <p className="border-t border-line px-6 py-4 text-sm text-ink-muted">{invoice.notes}</p>
        ) : null}
        {invoice.voidReason ? (
          <p className="border-t border-line bg-danger-soft px-6 py-4 text-sm text-danger">
            Voided: {invoice.voidReason}
          </p>
        ) : null}
      </Card>

      <div className="no-print grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Payments" />
          {invoice.payments.length === 0 ? (
            <CardBody className="text-sm text-ink-muted">Nothing received yet.</CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {invoice.payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="text-ink">
                      {payment.isRefund ? 'Refund · ' : ''}
                      {METHOD_LABELS[payment.method] ?? payment.method}
                    </p>
                    <p className="text-xs text-ink-subtle">
                      {formatDateTime(payment.createdAt)}
                      {payment.receivedBy ? ` · ${payment.receivedBy.firstName}` : ''}
                      {payment.reference ? ` · ${payment.reference}` : ''}
                      {payment.note ? ` · ${payment.note}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 font-medium tabular-nums ${payment.isRefund ? 'text-danger' : 'text-ink'}`}>
                    {formatMoney(payment.amountMinor)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {canWrite && outstanding > 0 && invoice.status !== 'VOID' ? (
            <CardBody className="border-t border-line">
              <PaymentForm action={addPayment.bind(null, invoice.id)} outstanding={outstanding} />
            </CardBody>
          ) : null}
        </Card>

        <div className="space-y-6">
          {invoice.commissions.length > 0 && can(user.role, 'reports:financial') ? (
            <Card>
              <CardHeader title="Commission" />
              <ul className="divide-y divide-line">
                {invoice.commissions.map((commission) => (
                  <li key={commission.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="text-ink">
                      {commission.user.firstName} {commission.user.lastName}
                      <span className="ml-2 text-xs text-ink-subtle">{formatBps(commission.rateBps)}</span>
                    </span>
                    <span className="tabular-nums text-ink">{formatMoney(commission.amountMinor)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {can(user.role, 'billing:refund') && invoice.paidMinor > invoice.refundedMinor ? (
            <Card>
              <CardHeader title="Refund" description="Reverses payment and adjusts the client's lifetime value." />
              <CardBody>
                <RefundForm
                  action={refund.bind(null, invoice.id)}
                  maxMinor={invoice.paidMinor - invoice.refundedMinor}
                />
              </CardBody>
            </Card>
          ) : null}

          {can(user.role, 'billing:void') && invoice.status !== 'VOID' && invoice.paidMinor === 0 ? (
            <Card>
              <CardHeader title="Void" description="Only possible while nothing has been paid." />
              <CardBody>
                <VoidForm action={voidInvoice.bind(null, invoice.id)} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  )
}
