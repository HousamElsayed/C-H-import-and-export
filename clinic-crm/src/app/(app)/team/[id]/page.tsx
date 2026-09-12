import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/card'
import { StaffForm } from '@/components/team/staff-form'
import { updateStaff } from '../actions'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: PageProps<'/team/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const member = await prisma.user.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  })
  return { title: member ? `${member.firstName} ${member.lastName}` : 'Team member' }
}

export default async function StaffEditPage(props: PageProps<'/team/[id]'>) {
  const user = await requirePermission('staff:write')
  const { id } = await props.params

  const member = await prisma.user.findUnique({
    where: { id },
    include: { workingHours: { orderBy: { weekday: 'asc' } } },
  })

  if (!member) notFound()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`${member.firstName} ${member.lastName}`}
        description={member.email}
      />
      <StaffForm
        action={updateStaff.bind(null, member.id)}
        isNew={false}
        canAssignOwner={user.role === 'OWNER'}
        cancelHref="/team"
        values={{
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          phone: member.phone,
          role: member.role,
          title: member.title,
          colorHex: member.colorHex,
          commission: String(member.commissionBps / 100),
          isBookable: member.isBookable,
          isActive: member.isActive,
          workingHours: member.workingHours,
        }}
      />
    </div>
  )
}
