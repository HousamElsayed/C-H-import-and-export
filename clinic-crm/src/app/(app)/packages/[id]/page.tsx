import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { formatMoney } from '@/lib/money'
import { PageHeader } from '@/components/ui/card'
import { PackageForm } from '@/components/catalog/package-form'
import { updatePackage } from '../actions'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: PageProps<'/packages/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const found = await prisma.package.findUnique({ where: { id }, select: { name: true } })
  return { title: found?.name ?? 'Package' }
}

export default async function PackageEditPage(props: PageProps<'/packages/[id]'>) {
  await requirePermission('catalog:write')
  const { id } = await props.params

  const [found, services] = await Promise.all([
    prisma.package.findUnique({
      where: { id },
      include: { items: { select: { serviceId: true, quantity: true } } },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, priceMinor: true },
    }),
  ])

  if (!found) notFound()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={found.name} description="Edit this package" />
      <PackageForm
        action={updatePackage.bind(null, found.id)}
        services={services}
        cancelHref="/packages"
        values={{
          name: found.name,
          description: found.description,
          price: formatMoney(found.priceMinor, { withSymbol: false }),
          validityDays: found.validityDays,
          isActive: found.isActive,
          items: found.items,
        }}
      />
    </div>
  )
}
