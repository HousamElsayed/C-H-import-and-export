import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { formatBps, formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { PrintTrigger } from '@/components/billing/print-trigger'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: PageProps<'/invoices/[id]/print'>): Promise<Metadata> {
  const { id } = await props.params
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { number: true } })
  return { title: invoice?.number ?? 'Receipt' }
}

export default async function InvoicePrintPage(props: PageProps<'/invoices/[id]/print'>) {
  await requirePermission('billing:read')
  const { id } = await props.params
  const settings = await getSettings()

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      cashier: { select: { firstName: true, lastName: true } },
      items: { orderBy: { sortOrder: 'asc' } },
      payments: { where: { isRefund: false }, orderBy: { createdAt: 'asc' } },
    },
  })

  if (!invoice) notFound()

  return (
    <div className="mx-auto max-w-2xl bg-surface p-8 text-ink">
      <PrintTrigger />

      <header className="mb-8 flex items-start justify-between gap-6 border-b border-line pb-6">
        <div>
          <h1 className="text-xl font-semibold">{settings.name}</h1>
          {settings.address ? <p className="mt-1 text-sm text-ink-muted">{settings.address}</p> : null}
          {settings.phone ? <p className="text-sm text-ink-muted">{settings.phone}</p> : null}
          {settings.taxNumber ? <p className="text-sm text-ink-muted">Tax no. {settings.taxNumber}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Receipt</p>
          <p className="text-lg font-semibold">{invoice.number}</p>
          <p className="text-sm text-ink-muted">{formatDate(invoice.issuedAt ?? invoice.createdAt)}</p>
        </div>
      </header>

      {invoice.client ? (
        <section className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Client</p>
          <p className="mt-1 font-medium">
            {invoice.client.firstName} {invoice.client.lastName}
          </p>
          <p className="text-sm text-ink-muted">{invoice.client.phone}</p>
        </section>
      ) : null}

      <table className="mb-6 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
            <th className="py-2 text-left font-semibold">Description</th>
            <th className="py-2 text-right font-semibold">Qty</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.id} className="border-b border-line">
              <td className="py-2.5">{item.description}</td>
              <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
              <td className="py-2.5 text-right tabular-nums">{formatMoney(item.totalMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-8 flex justify-end">
        <dl className="w-56 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(invoice.subtotalMinor)}</dd>
          </div>
          {invoice.discountMinor > 0 ? (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Discount</dt>
              <dd className="tabular-nums">− {formatMoney(invoice.discountMinor)}</dd>
            </div>
          ) : null}
          {invoice.taxMinor > 0 ? (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Tax ({formatBps(invoice.taxBps)})</dt>
              <dd className="tabular-nums">{formatMoney(invoice.taxMinor)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(invoice.totalMinor)}</dd>
          </div>
          {invoice.payments.map((payment) => (
            <div key={payment.id} className="flex justify-between text-ink-muted">
              <dt>Paid · {payment.method.toLowerCase().replace('_', ' ')}</dt>
              <dd className="tabular-nums">{formatMoney(payment.amountMinor)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <footer className="border-t border-line pt-4 text-xs text-ink-subtle">
        <p>
          Served by {invoice.cashier ? `${invoice.cashier.firstName} ${invoice.cashier.lastName}` : 'the clinic'}.
          Thank you for visiting {settings.name}.
        </p>
      </footer>
    </div>
  )
}
