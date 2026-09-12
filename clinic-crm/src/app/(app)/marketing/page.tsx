import Link from 'next/link'
import type { Metadata } from 'next'
import { Megaphone, Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { formatDateTime } from '@/lib/dates'
import { Card, EmptyState, PageHeader } from '@/components/ui/card'
import { StatTile } from '@/components/ui/stat'
import { Badge } from '@/components/ui/badge'
import { Table, Tr } from '@/components/ui/table'
import { buttonClass } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Campaigns' }
export const dynamic = 'force-dynamic'

export default async function MarketingPage() {
  const user = await requirePermission('marketing:read')
  const editable = can(user.role, 'marketing:write')

  const [campaigns, optIns, reachable] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        template: { select: { name: true } },
        _count: { select: { recipients: true, messages: true } },
      },
    }),
    prisma.client.count({ where: { isDeleted: false, marketingSms: true } }),
    prisma.client.count({ where: { isDeleted: false } }),
  ])

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Reach the right clients on channels they agreed to"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/marketing/templates" className={buttonClass('outline', 'md')}>
              Templates
            </Link>
            {editable ? (
              <Link href="/marketing/new" className={buttonClass('primary', 'md')}>
                <Plus className="h-4 w-4" />
                New campaign
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Campaigns" value={campaigns.length} />
        <StatTile
          label="SMS opt-in"
          value={`${reachable > 0 ? Math.round((optIns / reachable) * 100) : 0}%`}
          hint={`${optIns} of ${reachable} clients`}
          tone="brand"
        />
        <StatTile
          label="Messages sent"
          value={campaigns.reduce((sum, campaign) => sum + campaign._count.messages, 0)}
        />
      </div>

      <Card>
        {campaigns.length === 0 ? (
          <EmptyState
            title="No campaigns yet"
            description="Win back lapsed clients, fill quiet days, or wish someone a happy birthday."
            icon={<Megaphone className="h-6 w-6" />}
            action={
              editable ? (
                <Link href="/marketing/new" className={buttonClass('primary', 'sm')}>
                  Create one
                </Link>
              ) : null
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Channel</th>
                <th>Created</th>
                <th className="text-right">Audience</th>
                <th className="text-right">Sent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <Tr key={campaign.id}>
                  <td>
                    <Link href={`/marketing/${campaign.id}`} className="font-medium text-ink hover:text-brand">
                      {campaign.name}
                    </Link>
                    {campaign.template ? (
                      <span className="block text-xs text-ink-subtle">{campaign.template.name}</span>
                    ) : null}
                  </td>
                  <td className="text-ink-muted">{campaign.channel.toLowerCase()}</td>
                  <td className="text-ink-muted">{formatDateTime(campaign.createdAt)}</td>
                  <td className="text-right tabular-nums">{campaign._count.recipients}</td>
                  <td className="text-right tabular-nums">{campaign._count.messages}</td>
                  <td>
                    <Badge
                      tone={
                        campaign.status === 'COMPLETED'
                          ? 'success'
                          : campaign.status === 'RUNNING'
                            ? 'info'
                            : campaign.status === 'CANCELLED'
                              ? 'danger'
                              : 'neutral'
                      }
                    >
                      {campaign.status.toLowerCase()}
                    </Badge>
                  </td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
