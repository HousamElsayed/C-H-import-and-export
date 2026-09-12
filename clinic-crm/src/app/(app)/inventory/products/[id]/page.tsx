import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { formatMoney } from '@/lib/money'
import { formatDateTime, toDateInput } from '@/lib/dates'
import { formatQty } from '@/lib/utils'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { StatTile } from '@/components/ui/stat'
import { ProductForm, StockAdjustForm } from '@/components/inventory/product-form'
import { MOVEMENT_LABELS } from '@/components/domain/status'
import { adjustStock, updateProduct } from '../../actions'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: PageProps<'/inventory/products/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const product = await prisma.product.findUnique({ where: { id }, select: { name: true } })
  return { title: product?.name ?? 'Product' }
}

export default async function ProductPage(props: PageProps<'/inventory/products/[id]'>) {
  await requirePermission('inventory:write')
  const { id } = await props.params

  const [product, categories, suppliers, movements, usedIn] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.productCategory.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.stockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { user: { select: { firstName: true } } },
    }),
    prisma.serviceProductUsage.findMany({
      where: { productId: id },
      include: { service: { select: { id: true, name: true } } },
    }),
  ])

  if (!product) notFound()

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/inventory/products" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        All products
      </Link>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="In stock"
          value={formatQty(product.stockQty, product.unit)}
          tone={product.stockQty <= product.reorderLevel ? 'warning' : 'neutral'}
          hint={`Reorder at ${formatQty(product.reorderLevel)}`}
        />
        <StatTile label="Stock value" value={formatMoney(Math.round(product.stockQty * product.costMinor))} />
        <StatTile
          label="Margin"
          value={
            product.retailMinor > 0
              ? `${Math.round(((product.retailMinor - product.costMinor) / product.retailMinor) * 100)}%`
              : '—'
          }
          hint={product.retailMinor > 0 ? `${formatMoney(product.retailMinor - product.costMinor)} per unit` : 'Not sold'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ProductForm
          action={updateProduct.bind(null, product.id)}
          categories={categories}
          suppliers={suppliers}
          isNew={false}
          cancelHref="/inventory/products"
          values={{
            sku: product.sku,
            name: product.name,
            brand: product.brand,
            categoryId: product.categoryId,
            supplierId: product.supplierId,
            type: product.type,
            unit: product.unit,
            cost: formatMoney(product.costMinor, { withSymbol: false }),
            retail: formatMoney(product.retailMinor, { withSymbol: false }),
            reorderLevel: product.reorderLevel,
            reorderQty: product.reorderQty,
            trackStock: product.trackStock,
            isActive: product.isActive,
            location: product.location,
            barcode: product.barcode,
            expiresAt: product.expiresAt ? toDateInput(product.expiresAt) : '',
            notes: product.notes,
          }}
        />

        <div className="space-y-6">
          <Card>
            <CardHeader title="Move stock" />
            <CardBody>
              <StockAdjustForm action={adjustStock.bind(null, product.id)} unit={product.unit} />
            </CardBody>
          </Card>

          {usedIn.length > 0 ? (
            <Card>
              <CardHeader title="Used by services" description="Deducted automatically on completion" />
              <ul className="divide-y divide-line text-sm">
                {usedIn.map((usage) => (
                  <li key={usage.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <Link href={`/services/${usage.service.id}`} className="min-w-0 truncate text-ink hover:text-brand">
                      {usage.service.name}
                    </Link>
                    <span className="shrink-0 tabular-nums text-ink-muted">
                      {formatQty(usage.quantity, product.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Recent movements" />
            {movements.length === 0 ? (
              <CardBody className="text-sm text-ink-muted">No movements recorded.</CardBody>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {movements.map((movement) => (
                  <li key={movement.id} className="px-5 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-ink">{MOVEMENT_LABELS[movement.type]}</span>
                      <span className={`shrink-0 tabular-nums ${movement.quantity < 0 ? 'text-danger' : 'text-success'}`}>
                        {movement.quantity > 0 ? '+' : ''}{formatQty(movement.quantity)}
                      </span>
                    </div>
                    <p className="text-xs text-ink-subtle">
                      {formatDateTime(movement.createdAt)}
                      {movement.user ? ` · ${movement.user.firstName}` : ''}
                      {movement.reference ? ` · ${movement.reference}` : ''}
                      {` · balance ${formatQty(movement.balanceAfter)}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
