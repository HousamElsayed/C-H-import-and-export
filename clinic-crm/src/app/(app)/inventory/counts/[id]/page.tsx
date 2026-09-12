import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { formatMoney } from '@/lib/money'
import { formatDateTime } from '@/lib/dates'
import { formatQty } from '@/lib/utils'
import { Card, CardHeader, PageHeader } from '@/components/ui/card'
import { Table, Tr } from '@/components/ui/table'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: PageProps<'/inventory/counts/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const count = await prisma.stockCount.findUnique({ where: { id }, select: { number: true } })
  return { title: count?.number ?? 'Stock take' }
}

export default async function StockCountPage(props: PageProps<'/inventory/counts/[id]'>) {
  await requirePermission('inventory:write')
  const { id } = await props.params

  const count = await prisma.stockCount.findUnique({
    where: { id },
    include: {
      countedBy: { select: { firstName: true, lastName: true } },
      items: { include: { product: { select: { name: true, sku: true, unit: true, costMinor: true } } } },
    },
  })

  if (!count) notFound()

  const varianceValue = count.items.reduce(
    (sum, item) => sum + Math.round(item.varianceQty * item.product.costMinor),
    0,
  )

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/inventory/counts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        All stock takes
      </Link>

      <PageHeader
        title={count.number}
        description={`${formatDateTime(count.countedAt)}${count.countedBy ? ` · ${count.countedBy.firstName} ${count.countedBy.lastName}` : ''}`}
      />

      <Card>
        <CardHeader
          title="Counted lines"
          description={`Net variance ${formatMoney(varianceValue)} at cost`}
        />
        <Table>
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-right">Expected</th>
              <th className="text-right">Counted</th>
              <th className="text-right">Difference</th>
              <th className="text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {count.items.map((item) => (
              <Tr key={item.id}>
                <td>
                  <span className="text-ink">{item.product.name}</span>
                  <span className="block text-xs text-ink-subtle">{item.product.sku}</span>
                </td>
                <td className="text-right tabular-nums text-ink-muted">
                  {formatQty(item.expectedQty, item.product.unit)}
                </td>
                <td className="text-right tabular-nums text-ink">
                  {formatQty(item.countedQty, item.product.unit)}
                </td>
                <td
                  className={`text-right tabular-nums ${
                    item.varianceQty === 0 ? 'text-ink-muted' : item.varianceQty > 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {item.varianceQty > 0 ? '+' : ''}{formatQty(item.varianceQty)}
                </td>
                <td className="text-right tabular-nums text-ink-muted">
                  {item.varianceQty === 0 ? '—' : formatMoney(Math.round(item.varianceQty * item.product.costMinor))}
                </td>
              </Tr>
            ))}
          </tbody>
        </Table>
        {count.notes ? (
          <p className="border-t border-line px-5 py-3 text-sm text-ink-muted">{count.notes}</p>
        ) : null}
      </Card>
    </div>
  )
}
