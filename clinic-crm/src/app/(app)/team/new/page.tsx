import type { Metadata } from 'next'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/card'
import { StaffForm } from '@/components/team/staff-form'
import { createStaff } from '../actions'

export const metadata: Metadata = { title: 'Add team member' }
export const dynamic = 'force-dynamic'

export default async function NewStaffPage() {
  const user = await requirePermission('staff:write')

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add team member" description="Create a login and set what they can access." />
      <StaffForm
        action={createStaff}
        isNew
        canAssignOwner={user.role === 'OWNER'}
        cancelHref="/team"
        submitLabel="Create account"
        values={{ isActive: true, isBookable: true }}
      />
    </div>
  )
}
