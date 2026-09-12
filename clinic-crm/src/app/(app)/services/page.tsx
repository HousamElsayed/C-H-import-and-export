import Link from 'next/link'
import type { Metadata } from 'next'
import { Clock, Plus, Sparkles } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { formatMoney } from '@/lib/money'
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, Tr } from '@/components/ui/table'
import { buttonClass } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Services' }
export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  const user = await requirePermission('catalog:read')
  const editable = can(user.role, 'catalog:write')
  const showMoney = can(user.role, 'billing:read')

  const categories = await prisma.serviceCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      services: {
        orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: { select: { staff: true, productUsages: true } },
        },
      },
    },
  })

  const total = categories.reduce((sum, category) => sum + category.services.length, 0)

  return (
    <>
      <PageHeader
        title="Services"
        description={`${total} services across ${categories.length} categories`}
        action={
          editable ? (
            <Link href="/services/new" className={buttonClass('primary', 'md')}>
              <Plus className="h-4 w-4" />
              New service
            </Link>
          ) : null
        }
      />

      {total === 0 ? (
        <Card>
          <EmptyState
            title="No services yet"
            description="Add the treatments your clinic offers so they can be booked and billed."
            icon={<Sparkles className="h-6 w-6" />}
            action={
              editable ? (
                <Link href="/services/new" className={buttonClass('primary', 'sm')}>Add a service</Link>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {categories
            .filter((category) => category.services.length > 0)
            .map((category) => (
              <Card key={category.id}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.colorHex }} />
                      {category.name}
                    </span>
                  }
                  description={`${category.services.length} services`}
                />
                <Table>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Duration</th>
                      {showMoney ? <th className="text-right">Price</th> : null}
                      {showMoney ? <th className="text-right">Cost</th> : null}
                      {showMoney ? <th className="text-right">Margin</th> : null}
                      <th>Rules</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {category.services.map((service) => {
                      const margin = service.priceMinor - service.costMinor
                      const marginPct =
                        service.priceMinor > 0 ? Math.round((margin / service.priceMinor) * 100) : 0
                      return (
                        <Tr key={service.id} className={service.isActive ? '' : 'opacity-55'}>
                          <td>
                            {editable ? (
                              <Link href={`/services/${service.id}`} className="font-medium text-ink hover:text-brand">
                                {service.name}
                              </Link>
                            ) : (
                              <span className="font-medium text-ink">{service.name}</span>
                            )}
                            <span className="block text-xs text-ink-subtle">
                              {service._count.staff} staff · {service._count.productUsages} products
                            </span>
                          </td>
                          <td className="text-ink-muted">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {service.durationMin} min
                              {service.bufferMin > 0 ? (
                                <span className="text-ink-subtle">+{service.bufferMin}</span>
                              ) : null}
                            </span>
                          </td>
                          {showMoney ? (
                            <td className="text-right font-medium tabular-nums">
                              {formatMoney(service.priceMinor)}
                            </td>
                          ) : null}
                          {showMoney ? (
                            <td className="text-right tabular-nums text-ink-muted">
                              {formatMoney(service.costMinor)}
                            </td>
                          ) : null}
                          {showMoney ? (
                            <td className="text-right tabular-nums">
                              <span className={marginPct < 40 ? 'text-warning' : 'text-success'}>
                                {marginPct}%
                              </span>
                            </td>
                          ) : null}
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {service.requiresConsent ? <Badge tone="info">consent</Badge> : null}
                              {service.requiresPatchTest ? <Badge tone="warning">patch test</Badge> : null}
                              {!service.isActive ? <Badge tone="neutral">inactive</Badge> : null}
                            </div>
                          </td>
                          <td className="text-right">
                            {editable ? (
                              <Link href={`/services/${service.id}`} className={buttonClass('ghost', 'sm')}>
                                Edit
                              </Link>
                            ) : null}
                          </td>
                        </Tr>
                      )
                    })}
                  </tbody>
                </Table>
              </Card>
            ))}
        </div>
      )}
    </>
  )
}
