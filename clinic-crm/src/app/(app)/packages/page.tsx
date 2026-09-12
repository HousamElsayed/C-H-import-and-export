import Link from 'next/link'
import type { Metadata } from 'next'
import { Gift, Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { formatMoney } from '@/lib/money'
import { Card, EmptyState, PageHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, Tr } from '@/components/ui/table'
import { buttonClass } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Packages' }
export const dynamic = 'force-dynamic'

export default async function PackagesPage() {
  const user = await requirePermission('catalog:read')
  const editable = can(user.role, 'catalog:write')

  const packages = await prisma.package.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: {
      items: { include: { service: { select: { name: true, priceMinor: true } } } },
      _count: { select: { clientPackages: true } },
    },
  })

  return (
    <>
      <PageHeader
        title="Packages"
        description="Prepaid courses of treatments"
        action={
          editable ? (
            <Link href="/packages/new" className={buttonClass('primary', 'md')}>
              <Plus className="h-4 w-4" />
              New package
            </Link>
          ) : null
        }
      />

      <Card>
        {packages.length === 0 ? (
          <EmptyState
            title="No packages yet"
            description="Bundle sessions into a prepaid course to lift retention and cash flow."
            icon={<Gift className="h-6 w-6" />}
            action={editable ? <Link href="/packages/new" className={buttonClass('primary', 'sm')}>Add a package</Link> : null}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Package</th>
                <th>Includes</th>
                <th className="text-right">List value</th>
                <th className="text-right">Price</th>
                <th className="text-right">Saving</th>
                <th className="text-right">Sold</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((item) => {
                const listValue = item.items.reduce(
                  (sum, line) => sum + line.service.priceMinor * line.quantity,
                  0,
                )
                const saving = listValue - item.priceMinor
                return (
                  <Tr key={item.id} className={item.isActive ? '' : 'opacity-55'}>
                    <td>
                      {editable ? (
                        <Link href={`/packages/${item.id}`} className="font-medium text-ink hover:text-brand">
                          {item.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink">{item.name}</span>
                      )}
                      <span className="block text-xs text-ink-subtle">
                        Valid {item.validityDays} days
                        {!item.isActive ? ' · inactive' : ''}
                      </span>
                    </td>
                    <td className="max-w-sm text-ink-muted">
                      {item.items.map((line) => `${line.quantity}× ${line.service.name}`).join(', ')}
                    </td>
                    <td className="text-right tabular-nums text-ink-muted">{formatMoney(listValue)}</td>
                    <td className="text-right font-medium tabular-nums">{formatMoney(item.priceMinor)}</td>
                    <td className="text-right">
                      {saving > 0 ? (
                        <Badge tone="success">{Math.round((saving / listValue) * 100)}%</Badge>
                      ) : (
                        <span className="text-ink-subtle">—</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{item._count.clientPackages}</td>
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
