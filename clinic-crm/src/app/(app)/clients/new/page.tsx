import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { PageHeader } from '@/components/ui/card'
import { ClientForm } from '@/components/clients/client-form'
import { createClient } from '../actions'

export const metadata: Metadata = { title: 'New client' }
export const dynamic = 'force-dynamic'

export default async function NewClientPage() {
  const user = await requirePermission('clients:write')

  const [tags, referrers] = await Promise.all([
    prisma.tag.findMany({ orderBy: { name: 'asc' } }),
    prisma.client.findMany({
      where: { isDeleted: false },
      orderBy: [{ firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
      take: 500,
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New client" description="Create a client record before booking their first appointment." />
      <ClientForm
        action={createClient}
        tags={tags}
        referrers={referrers}
        canEditClinical={can(user.role, 'clients:clinical')}
        submitLabel="Create client"
        cancelHref="/clients"
        values={{ marketingSms: true, marketingWhatsapp: true, kvkkConsent: true }}
      />
    </div>
  )
}
