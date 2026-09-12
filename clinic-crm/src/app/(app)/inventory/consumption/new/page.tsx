import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { toDateInput } from '@/lib/dates'
import { PageHeader } from '@/components/ui/card'
import { ConsumptionForm } from '@/components/inventory/consumption-form'
import { createConsumptionBill } from '../../actions'

export const metadata: Metadata = { title: 'New usage bill' }
export const dynamic = 'force-dynamic'

export default async function NewConsumptionBillPage() {
  await requirePermission('inventory:consume')

  const [products, staff, rooms] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, trackStock: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, sku: true, unit: true, stockQty: true, costMinor: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { firstName: 'asc' },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.room.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="New usage bill"
        description="Products consumed inside the clinic — back bar, training, testers or wastage."
      />
      <ConsumptionForm
        action={createConsumptionBill}
        products={products}
        staff={staff}
        rooms={rooms}
        defaultDate={toDateInput(new Date())}
      />
    </div>
  )
}
