import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/card'
import { PackageForm } from '@/components/catalog/package-form'
import { createPackage } from '../actions'

export const metadata: Metadata = { title: 'New package' }
export const dynamic = 'force-dynamic'

export default async function NewPackagePage() {
  await requirePermission('catalog:write')
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, priceMinor: true },
  })

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New package" description="Bundle sessions and set a prepaid price." />
      <PackageForm action={createPackage} services={services} cancelHref="/packages" submitLabel="Create package" />
    </div>
  )
}
