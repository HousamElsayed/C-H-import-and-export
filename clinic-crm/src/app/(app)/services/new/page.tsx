import type { Metadata } from 'next'
import { requirePermission } from '@/lib/auth'
import { loadServiceFormOptions } from '@/lib/catalog'
import { PageHeader } from '@/components/ui/card'
import { ServiceForm } from '@/components/catalog/service-form'
import { createService } from '../actions'

export const metadata: Metadata = { title: 'New service' }
export const dynamic = 'force-dynamic'

export default async function NewServicePage() {
  await requirePermission('catalog:write')
  const options = await loadServiceFormOptions()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New service" description="Define duration, price and the products it consumes." />
      <ServiceForm
        action={createService}
        cancelHref="/services"
        submitLabel="Create service"
        {...options}
      />
    </div>
  )
}
