import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { loadServiceFormOptions } from '@/lib/catalog'
import { formatMoney } from '@/lib/money'
import { PageHeader } from '@/components/ui/card'
import { ServiceForm } from '@/components/catalog/service-form'
import { updateService } from '../actions'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: PageProps<'/services/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const service = await prisma.service.findUnique({ where: { id }, select: { name: true } })
  return { title: service?.name ?? 'Service' }
}

export default async function ServiceEditPage(props: PageProps<'/services/[id]'>) {
  await requirePermission('catalog:write')
  const { id } = await props.params

  const [service, options] = await Promise.all([
    prisma.service.findUnique({
      where: { id },
      include: {
        staff: { select: { userId: true } },
        rooms: { select: { roomId: true } },
        productUsages: { select: { productId: true, quantity: true } },
      },
    }),
    loadServiceFormOptions(),
  ])

  if (!service) notFound()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={service.name} description="Edit this service" />
      <ServiceForm
        action={updateService.bind(null, service.id)}
        cancelHref="/services"
        {...options}
        values={{
          name: service.name,
          categoryId: service.categoryId,
          description: service.description,
          durationMin: service.durationMin,
          bufferMin: service.bufferMin,
          price: formatMoney(service.priceMinor, { withSymbol: false }),
          cost: formatMoney(service.costMinor, { withSymbol: false }),
          commissionBps: service.commissionBps === null ? '' : String(service.commissionBps / 100),
          colorHex: service.colorHex,
          requiresPatchTest: service.requiresPatchTest,
          patchTestDays: service.patchTestDays,
          requiresConsent: service.requiresConsent,
          consentTemplateId: service.consentTemplateId,
          aftercareNote: service.aftercareNote,
          isOnlineBookable: service.isOnlineBookable,
          isActive: service.isActive,
          staffIds: service.staff.map((entry) => entry.userId),
          roomIds: service.rooms.map((entry) => entry.roomId),
          usages: service.productUsages,
        }}
      />
    </div>
  )
}
