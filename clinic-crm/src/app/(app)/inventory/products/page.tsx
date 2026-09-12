import Link from 'next/link'
import type { Metadata } from 'next'
import { Package, PackagePlus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { formatMoney } from '@/lib/money'
import { formatQty } from '@/lib/utils'
import { Card, EmptyState, PageHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, Tr } from '@/components/ui/table'
import { SearchInput } from '@/components/ui/search-input'
import { buttonClass } from '@/components/ui/button'
import type { Prisma } from '@/generated/prisma/client'

export const metadata: Metadata = { title: 'Products' }
export const dynamic = 'force-dynamic'

export default async function ProductsPage(props: PageProps<'/inventory/products'>) {
  const user = await requirePermission('inventory:read')
  const params = await props.searchParams
  const editable = can(user.role, 'inventory:write')

  const query = typeof params.q === 'string' ? params.q.trim() : ''
  const filter = typeof params.filter === 'string' ? params.filter : ''

  const where: Prisma.ProductWhereInput = {}
  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { sku: { contains: query, mode: 'insensitive' } },
      { brand: { contains: query, mode: 'insensitive' } },
    ]
  }
  if (filter === 'retail') where.type = { in: ['RETAIL', 'BOTH'] }
  if (filter === 'professional') where.type = { in: ['PROFESSIONAL', 'BOTH'] }
  if (filter === 'inactive') where.isActive = false
  else if (!filter || filter !== 'inactive') where.isActive = true

  const products = await prisma.product.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { category: { select: { name: true } }, supplier: { select: { name: true } } },
  })

  const visible = filter === 'low'
    ? products.filter((product) => product.trackStock && product.stockQty <= product.reorderLevel)
    : products

  const totalValue = visible.reduce(
    (sum, product) => sum + Math.round(product.stockQty * product.costMinor),
    0,
  )

  const filters = [
    ['', 'All'],
    ['low', 'Needs reorder'],
    ['retail', 'Retail'],
    ['professional', 'Professional'],
    ['inactive', 'Inactive'],
  ]

  return (
    <>
      <PageHeader
        title="Products"
        description={`${visible.length} lines · ${formatMoney(totalValue)} at cost`}
        action={
          editable ? (
            <Link href="/inventory/products/new" className={buttonClass('primary', 'md')}>
              <PackagePlus className="h-4 w-4" />
              New product
            </Link>
          ) : null
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <SearchInput placeholder="Name, SKU or brand…" />
          <div className="flex flex-wrap gap-1.5">
            {filters.map(([value, label]) => {
              const search = new URLSearchParams()
              if (query) search.set('q', query)
              if (value) search.set('filter', value)
              const href = search.toString() ? `/inventory/products?${search}` : '/inventory/products'
              const active = filter === value
              return (
                <Link
                  key={label}
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
            })}
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="No products match"
            description="Add the products you use in treatments and sell at reception."
            icon={<Package className="h-6 w-6" />}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Supplier</th>
                <th className="text-right">In stock</th>
                <th className="text-right">Cost</th>
                <th className="text-right">Retail</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => {
                const low = product.trackStock && product.stockQty <= product.reorderLevel
                return (
                  <Tr key={product.id} className={product.isActive ? '' : 'opacity-55'}>
                    <td>
                      {editable ? (
                        <Link href={`/inventory/products/${product.id}`} className="font-medium text-ink hover:text-brand">
                          {product.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink">{product.name}</span>
                      )}
                      <span className="block text-xs text-ink-subtle">
                        {product.sku}
                        {product.brand ? ` · ${product.brand}` : ''}
                      </span>
                    </td>
                    <td className="text-ink-muted">{product.category?.name ?? '—'}</td>
                    <td className="text-ink-muted">{product.supplier?.name ?? '—'}</td>
                    <td className="text-right">
                      {product.trackStock ? (
                        low ? (
                          <Badge tone={product.stockQty <= 0 ? 'danger' : 'warning'}>
                            {formatQty(product.stockQty, product.unit)}
                          </Badge>
                        ) : (
                          <span className="tabular-nums text-ink">
                            {formatQty(product.stockQty, product.unit)}
                          </span>
                        )
                      ) : (
                        <span className="text-ink-subtle">not tracked</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums text-ink-muted">{formatMoney(product.costMinor)}</td>
                    <td className="text-right tabular-nums text-ink-muted">
                      {product.retailMinor > 0 ? formatMoney(product.retailMinor) : '—'}
                    </td>
                    <td className="text-right font-medium tabular-nums">
                      {formatMoney(Math.round(product.stockQty * product.costMinor))}
                    </td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
