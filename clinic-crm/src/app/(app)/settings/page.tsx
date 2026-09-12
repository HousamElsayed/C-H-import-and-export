import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { formatMoney } from '@/lib/money'
import { formatMinutes } from '@/lib/dates'
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClinicSettingsForm, QuickAddForm } from '@/components/settings/settings-forms'
import { addRoom, addServiceCategory, addSupplier, addTag, updateSettings } from './actions'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await requirePermission('settings:write')
  const settings = await getSettings()

  const [rooms, tags, categories, suppliers] = await Promise.all([
    prisma.room.findMany({ orderBy: { name: 'asc' } }),
    prisma.tag.findMany({ orderBy: { name: 'asc' } }),
    prisma.serviceCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
  ])

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" description="How the clinic runs, prices and communicates" />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Clinic" />
          <CardBody>
            <ClinicSettingsForm
              action={updateSettings}
              values={{
                name: settings.name,
                legalName: settings.legalName,
                taxNumber: settings.taxNumber,
                phone: settings.phone,
                email: settings.email,
                address: settings.address,
                currency: settings.currency,
                currencySymbol: settings.currencySymbol,
                locale: settings.locale,
                timeZone: settings.timeZone,
                defaultTax: String(settings.defaultTaxBps / 100),
                slotMinutes: settings.slotMinutes,
                openTime: formatMinutes(settings.openMin),
                closeTime: formatMinutes(settings.closeMin),
                reminderHoursBefore: settings.reminderHoursBefore,
                cancellationWindowH: settings.cancellationWindowH,
                loyaltyPointsPerUnit: settings.loyaltyPointsPerUnit,
                loyaltyUnit: formatMoney(settings.loyaltyUnitMinor, { withSymbol: false }),
                loyaltyPointValue: formatMoney(settings.loyaltyPointValueMinor, { withSymbol: false }),
              }}
            />
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Treatment rooms" description={`${rooms.filter((room) => room.isActive).length} active`} />
            <CardBody className="space-y-4">
              <ul className="space-y-1.5">
                {rooms.map((room) => (
                  <li key={room.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink">{room.name}</span>
                    {room.isActive ? <Badge tone="success">active</Badge> : <Badge>off</Badge>}
                  </li>
                ))}
              </ul>
              <QuickAddForm action={addRoom} label="Room" placeholder="Treatment Room 3" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Client tags" description="Used for filtering and campaign audiences" />
            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ backgroundColor: `${tag.colorHex}1a`, color: tag.colorHex }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
              <QuickAddForm action={addTag} label="Tag" placeholder="Bride" withColor />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Service categories" />
            <CardBody className="space-y-4">
              <ul className="space-y-1.5">
                {categories.map((category) => (
                  <li key={category.id} className="flex items-center gap-2 text-sm text-ink">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.colorHex }} />
                    {category.name}
                  </li>
                ))}
              </ul>
              <QuickAddForm action={addServiceCategory} label="Category" placeholder="Peels" withColor />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Suppliers" />
            <CardBody className="space-y-4">
              <ul className="space-y-1.5">
                {suppliers.map((supplier) => (
                  <li key={supplier.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink">{supplier.name}</span>
                    <span className="text-xs text-ink-subtle">{supplier.phone ?? ''}</span>
                  </li>
                ))}
              </ul>
              <QuickAddForm
                action={addSupplier}
                label="Supplier"
                placeholder="Supplier name"
                extraFields={[
                  { name: 'contact', placeholder: 'Contact person' },
                  { name: 'phone', placeholder: 'Phone' },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
