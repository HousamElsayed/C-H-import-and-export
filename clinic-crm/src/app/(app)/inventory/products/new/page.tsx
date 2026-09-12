import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/card'
import { ProductForm } from '@/components/inventory/product-form'
import { createProduct } from '../../actions'

export const metadata: Metadata = { title: 'New product' }
export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  await requirePermission('inventory:write')

  const [categories, suppliers] = await Promise.all([
    prisma.productCategory.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New product" description="Anything you consume in treatments or sell at reception." />
      <ProductForm
        action={createProduct}
        categories={categories}
        suppliers={suppliers}
        isNew
        cancelHref="/inventory/products"
        submitLabel="Create product"
      />
    </div>
  )
}
