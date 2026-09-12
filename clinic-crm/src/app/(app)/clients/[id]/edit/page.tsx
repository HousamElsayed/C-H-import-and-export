import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { toDateInput } from '@/lib/dates'
import { PageHeader } from '@/components/ui/card'
import { ClientForm } from '@/components/clients/client-form'
import { updateClient } from '../../actions'

export const metadata: Metadata = { title: 'Edit client' }
export const dynamic = 'force-dynamic'

export default async function EditClientPage(props: PageProps<'/clients/[id]/edit'>) {
  const user = await requirePermission('clients:write')
  const { id } = await props.params

  const [client, tags, referrers] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: { tags: { select: { tagId: true } } },
    }),
    prisma.tag.findMany({ orderBy: { name: 'asc' } }),
    prisma.client.findMany({
      where: { isDeleted: false, id: { not: id } },
      orderBy: [{ firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
      take: 500,
    }),
  ])

  if (!client) notFound()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Edit ${client.firstName} ${client.lastName}`}
        description={client.code}
      />
      <ClientForm
        action={updateClient.bind(null, client.id)}
        tags={tags}
        referrers={referrers}
        canEditClinical={can(user.role, 'clients:clinical')}
        cancelHref={`/clients/${client.id}`}
        values={{
          firstName: client.firstName,
          lastName: client.lastName,
          phone: client.phone,
          email: client.email,
          birthDate: client.birthDate ? toDateInput(client.birthDate) : '',
          gender: client.gender,
          status: client.status,
          source: client.source,
          address: client.address,
          city: client.city,
          occupation: client.occupation,
          skinType: client.skinType,
          allergies: client.allergies,
          medications: client.medications,
          medicalNotes: client.medicalNotes,
          preferences: client.preferences,
          internalNotes: client.internalNotes,
          referredById: client.referredById,
          marketingSms: client.marketingSms,
          marketingEmail: client.marketingEmail,
          marketingWhatsapp: client.marketingWhatsapp,
          kvkkConsent: Boolean(client.kvkkConsentAt),
          tagIds: client.tags.map((tag) => tag.tagId),
        }}
      />
    </div>
  )
}
