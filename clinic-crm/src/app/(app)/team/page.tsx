import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can, ROLE_LABELS } from '@/lib/rbac'
import { formatBps, formatMoney } from '@/lib/money'
import { formatMinutes } from '@/lib/dates'
import { initials } from '@/lib/utils'
import { Card, PageHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, Tr } from '@/components/ui/table'
import { buttonClass } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Team' }
export const dynamic = 'force-dynamic'

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default async function TeamPage() {
  const user = await requirePermission('staff:read')
  const editable = can(user.role, 'staff:write')
  const showMoney = can(user.role, 'reports:financial')

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [staff, commissions] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
      include: {
        workingHours: { orderBy: { weekday: 'asc' } },
        _count: { select: { serviceSkills: true } },
      },
    }),
    prisma.commission.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: monthStart } },
      _sum: { amountMinor: true },
    }),
  ])

  const commissionByUser = new Map(commissions.map((row) => [row.userId, row._sum.amountMinor ?? 0]))

  return (
    <>
      <PageHeader
        title="Team"
        description={`${staff.filter((member) => member.isActive).length} active members`}
        action={
          editable ? (
            <Link href="/team/new" className={buttonClass('primary', 'md')}>
              <Plus className="h-4 w-4" />
              Add team member
            </Link>
          ) : null
        }
      />

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Works</th>
              <th>Services</th>
              {showMoney ? <th className="text-right">Commission rate</th> : null}
              {showMoney ? <th className="text-right">Earned this month</th> : null}
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <Tr key={member.id} className={member.isActive ? '' : 'opacity-55'}>
                <td>
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: member.colorHex }}
                    >
                      {initials(member.firstName, member.lastName)}
                    </span>
                    <div className="min-w-0">
                      {editable ? (
                        <Link href={`/team/${member.id}`} className="font-medium text-ink hover:text-brand">
                          {member.firstName} {member.lastName}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink">{member.firstName} {member.lastName}</span>
                      )}
                      <span className="block text-xs text-ink-subtle">{member.title ?? member.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={member.role === 'OWNER' ? 'brand' : 'neutral'}>{ROLE_LABELS[member.role]}</Badge>
                    {member.isBookable ? <Badge tone="info">bookable</Badge> : null}
                    {!member.isActive ? <Badge tone="danger">disabled</Badge> : null}
                  </div>
                </td>
                <td className="text-xs text-ink-muted">
                  {member.workingHours.length === 0 ? (
                    '—'
                  ) : (
                    <span>
                      {member.workingHours.map((hour) => WEEKDAY_SHORT[hour.weekday]).join(', ')}
                      <span className="block text-ink-subtle">
                        {formatMinutes(member.workingHours[0]!.startMin)}–
                        {formatMinutes(member.workingHours[0]!.endMin)}
                      </span>
                    </span>
                  )}
                </td>
                <td className="tabular-nums text-ink-muted">{member._count.serviceSkills}</td>
                {showMoney ? (
                  <td className="text-right tabular-nums text-ink-muted">{formatBps(member.commissionBps)}</td>
                ) : null}
                {showMoney ? (
                  <td className="text-right font-medium tabular-nums">
                    {formatMoney(commissionByUser.get(member.id) ?? 0)}
                  </td>
                ) : null}
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  )
}
