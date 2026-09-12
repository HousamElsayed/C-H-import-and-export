import Link from 'next/link'
import type { Metadata } from 'next'
import { MessageSquare, RefreshCw } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { formatDateTime } from '@/lib/dates'
import { Card, EmptyState, PageHeader } from '@/components/ui/card'
import { StatTile } from '@/components/ui/stat'
import { Table, Tr } from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { Button } from '@/components/ui/button'
import { MessageStatusBadge } from '@/components/domain/status'
import { runQueue } from '../marketing/actions'
import type { Prisma } from '@/generated/prisma/client'
import type { MessageStatus } from '@/generated/prisma/enums'

export const metadata: Metadata = { title: 'Message log' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const STATUSES: MessageStatus[] = ['QUEUED', 'SENT', 'DELIVERED', 'FAILED']

export default async function MessagesPage(props: PageProps<'/messages'>) {
  const user = await requirePermission('marketing:read')
  const params = await props.searchParams

  const status = typeof params.status === 'string' ? params.status : ''
  const page = Math.max(1, Number.parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1)

  const where: Prisma.MessageLogWhereInput = {}
  if (status && STATUSES.includes(status as MessageStatus)) where.status = status as MessageStatus

  const [messages, total, queued, failed] = await Promise.all([
    prisma.messageLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        campaign: { select: { id: true, name: true } },
      },
    }),
    prisma.messageLog.count({ where }),
    prisma.messageLog.count({ where: { status: 'QUEUED' } }),
    prisma.messageLog.count({ where: { status: 'FAILED' } }),
  ])

  return (
    <>
      <PageHeader
        title="Message log"
        description="Every reminder, confirmation and campaign message"
        action={
          can(user.role, 'marketing:write') ? (
            <form action={runQueue}>
              <Button type="submit" variant="outline" size="md">
                <RefreshCw className="h-4 w-4" />
                Send queued
              </Button>
            </form>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Queued" value={queued} tone={queued > 0 ? 'warning' : 'neutral'} />
        <StatTile label="Failed" value={failed} tone={failed > 0 ? 'danger' : 'neutral'} />
        <StatTile label="Total" value={total} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-5 py-3">
          <Pill label="All" href="/messages" active={!status} />
          {STATUSES.map((value) => (
            <Pill
              key={value}
              label={value.toLowerCase()}
              href={`/messages?status=${value}`}
              active={status === value}
            />
          ))}
        </div>

        {messages.length === 0 ? (
          <EmptyState
            title="No messages"
            description="Reminders appear here once the scheduler runs."
            icon={<MessageSquare className="h-6 w-6" />}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>To</th>
                  <th>Channel</th>
                  <th>Purpose</th>
                  <th>Message</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <Tr key={message.id}>
                    <td className="whitespace-nowrap text-ink-muted">{formatDateTime(message.createdAt)}</td>
                    <td>
                      {message.client ? (
                        <Link href={`/clients/${message.client.id}`} className="text-ink hover:text-brand">
                          {message.client.firstName} {message.client.lastName}
                        </Link>
                      ) : (
                        <span className="text-ink">{message.toAddress}</span>
                      )}
                      <span className="block text-xs text-ink-subtle">{message.toAddress}</span>
                    </td>
                    <td className="text-ink-muted">{message.channel.toLowerCase()}</td>
                    <td className="text-ink-muted">
                      {message.campaign ? (
                        <Link href={`/marketing/${message.campaign.id}`} className="hover:text-brand">
                          {message.campaign.name}
                        </Link>
                      ) : (
                        message.purpose.toLowerCase().replace(/_/g, ' ')
                      )}
                    </td>
                    <td className="max-w-sm truncate text-ink-muted">{message.body}</td>
                    <td>
                      <MessageStatusBadge status={message.status} />
                      {message.error ? (
                        <span className="block max-w-[180px] truncate text-xs text-danger">{message.error}</span>
                      ) : null}
                    </td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              baseParams={{ status: status || undefined }}
            />
          </>
        )}
      </Card>
    </>
  )
}

function Pill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition ${
        active
          ? 'border-brand-ring bg-brand-soft text-brand-strong'
          : 'border-line bg-surface text-ink-muted hover:bg-surface-muted'
      }`}
    >
      {label}
    </Link>
  )
}
