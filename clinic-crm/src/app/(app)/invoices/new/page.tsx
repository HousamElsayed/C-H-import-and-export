import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { formatMoney } from '@/lib/money'
import { PageHeader } from '@/components/ui/card'
import { CheckoutForm } from '@/components/billing/checkout-form'
import { checkout } from '../actions'

export const metadata: Metadata = { title: 'Checkout' }
export const dynamic = 'force-dynamic'

export default async function CheckoutPage(props: PageProps<'/invoices/new'>) {
  await requirePermission('billing:write')
  const params = await props.searchParams
  const settings = await getSettings()

  const appointmentId = typeof params.appointmentId === 'string' ? params.appointmentId : undefined
  const clientIdParam = typeof params.clientId === 'string' ? params.clientId : undefined

  const appointment = appointmentId
    ? await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, loyaltyPoints: true } },
          services: {
            orderBy: { sortOrder: 'asc' },
            include: { service: { select: { id: true, name: true } } },
          },
          invoice: { select: { id: true } },
        },
      })
    : null

  if (appointmentId && !appointment) notFound()
  // Already billed — show the existing invoice rather than duplicating it.
  if (appointment?.invoice) redirect(`/invoices/${appointment.invoice.id}`)

  const clientId = appointment?.client.id ?? clientIdParam
  const client = appointment?.client
    ? appointment.client
    : clientId
      ? await prisma.client.findUnique({
          where: { id: clientId },
          select: { id: true, firstName: true, lastName: true, loyaltyPoints: true },
        })
      : null

  const [services, products, packages, staff, clientPackages] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, priceMinor: true },
    }),
    prisma.product.findMany({
      where: { isActive: true, type: { in: ['RETAIL', 'BOTH'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, sku: true, retailMinor: true, stockQty: true },
    }),
    prisma.package.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, priceMinor: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, isBookable: true },
      orderBy: { firstName: 'asc' },
      select: { id: true, firstName: true, lastName: true },
    }),
    clientId
      ? prisma.clientPackageItem.findMany({
          where: {
            clientPackage: { clientId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
          },
          include: {
            service: { select: { id: true, name: true } },
            clientPackage: { select: { package: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
  ])

  const packageItemsByService = new Map<string, { id: string; label: string }[]>()
  for (const item of clientPackages) {
    const remaining = item.totalQty - item.usedQty
    if (remaining <= 0) continue
    const list = packageItemsByService.get(item.serviceId) ?? []
    list.push({
      id: item.id,
      label: `${item.clientPackage.package.name}: ${remaining} left`,
    })
    packageItemsByService.set(item.serviceId, list)
  }

  const initialLines = (appointment?.services ?? []).map((item) => ({
    kind: 'SERVICE' as const,
    refId: item.serviceId,
    description: item.service.name,
    quantity: '1',
    unitPrice: formatMoney(item.priceMinor, { withSymbol: false }),
    discount: '0,00',
    staffId: item.staffId ?? appointment?.staffId ?? '',
    appointmentServiceId: item.id,
    packageItemId: '',
    packageOptions: packageItemsByService.get(item.serviceId) ?? [],
  }))

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Checkout"
        description={
          appointment
            ? `Appointment ${appointment.code}`
            : client
              ? `${client.firstName} ${client.lastName}`
              : 'Walk-in sale'
        }
      />
      <CheckoutForm
        action={checkout}
        catalog={{ services, products, packages, staff }}
        initialLines={initialLines}
        client={client ?? null}
        appointmentId={appointment?.id}
        defaultTaxBps={settings.defaultTaxBps}
        loyalty={{ pointValueMinor: settings.loyaltyPointValueMinor }}
      />
    </div>
  )
}
