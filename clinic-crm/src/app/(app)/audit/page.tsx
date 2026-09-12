import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { formatDateTime } from '@/lib/dates'
import { Card, EmptyState, PageHeader } from '@/components/ui/card'
import { Table, Tr } from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'

export const metadata: Metadata = { title: 'Audit log' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export default async function AuditPage(props: PageProps<'/audit'>) {
  await requirePermission('audit:read')
  const params = await props.searchParams
  const page = Math.max(1, Number.parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1)

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
    }),
    prisma.auditLog.count(),
  ])

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who did what, and when. Client records are confidential — access is recorded."
      />

      <Card>
        {entries.length === 0 ? (
          <EmptyState title="Nothing logged yet" icon={<ShieldCheck className="h-6 w-6" />} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>Detail</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <Tr key={entry.id}>
                    <td className="whitespace-nowrap text-ink-muted">{formatDateTime(entry.createdAt)}</td>
                    <td className="text-ink">
                      {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'System'}
                      {entry.user ? (
                        <span className="block text-xs text-ink-subtle">{entry.user.role.toLowerCase()}</span>
                      ) : null}
                    </td>
                    <td className="font-mono text-xs text-ink-muted">{entry.action}</td>
                    <td className="text-ink-muted">{entry.entityType}</td>
                    <td className="max-w-sm truncate text-ink-muted">{entry.summary ?? '—'}</td>
                    <td className="text-xs text-ink-subtle">{entry.ipAddress ?? '—'}</td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} baseParams={{}} />
          </>
        )}
      </Card>
    </>
  )
}
