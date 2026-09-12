import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/card'
import { StockCountForm } from '@/components/inventory/stock-count-form'
import { createStockCount } from '../../actions'

export const metadata: Metadata = { title: 'New stock take' }
export const dynamic = 'force-dynamic'

export default async function NewStockCountPage() {
  await requirePermission('inventory:write')

  const products = await prisma.product.findMany({
    where: { isActive: true, trackStock: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, sku: true, unit: true, stockQty: true, costMinor: true },
  })

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New stock take" description="Enter what you actually counted; differences post automatically." />
      <StockCountForm action={createStockCount} products={products} />
    </div>
  )
}
