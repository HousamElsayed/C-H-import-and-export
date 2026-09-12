import Link from 'next/link'
import type { Metadata } from 'next'
import { UserPlus, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { Card, EmptyState, PageHeader } from '@/components/ui/card'
import { Table, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import { buttonClass } from '@/components/ui/button'
import type { Prisma } from '@/generated/prisma/client'
import type { ClientStatus } from '@/generated/prisma/enums'

export const metadata: Metadata = { title: 'Clients' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

const STATUS_TONES: Record<ClientStatus, 'success' | 'neutral' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  LEAD: 'neutral',
  DORMANT: 'warning',
  BLOCKED: 'danger',
}

export default async function ClientsPage(props: PageProps<'/clients'>) {
  const user = await requirePermission('clients:read')
  const params = await props.searchParams

  const query = typeof params.q === 'string' ? params.q.trim() : ''
  const status = typeof params.status === 'string' ? params.status : ''
  const tagId = typeof params.tag === 'string' ? params.tag : ''
  const page = Math.max(1, Number.parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1)

  const where: Prisma.ClientWhereInput = { isDeleted: false }
  if (query) {
    where.OR = [
      { firstName: { contains: query, mode: 'insensitive' } },
      { lastName: { contains: query, mode: 'insensitive' } },
      { phone: { contains: query } },
      { email: { contains: query, mode: 'insensitive' } },
      { code: { contains: query, mode: 'insensitive' } },
    ]
  }
  if (status) where.status = status as ClientStatus
  if (tagId) where.tags = { some: { tagId } }

  const [clients, total, tags] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: [{ lastVisitAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { tags: { include: { tag: true } } },
    }),
    prisma.client.count({ where }),
    prisma.tag.findMany({ orderBy: { name: 'asc' } }),
  ])

  const showMoney = can(user.role, 'billing:read')
  const baseParams = { q: query || undefined, status: status || undefined, tag: tagId || undefined }

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${total} ${total === 1 ? 'record' : 'records'}`}
        action={
          can(user.role, 'clients:write') ? (
            <Link href="/clients/new" className={buttonClass('primary', 'md')}>
              <UserPlus className="h-4 w-4" />
              New client
            </Link>
          ) : null
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <SearchInput placeholder="Name, phone, email or code…" />
          <div className="flex flex-wrap gap-1.5">
            <FilterPill label="All" href={buildHref({ ...baseParams, status: undefined })} active={!status} />
            {(['ACTIVE', 'LEAD', 'DORMANT', 'BLOCKED'] as const).map((value) => (
              <FilterPill
                key={value}
                label={value.charAt(0) + value.slice(1).toLowerCase()}
                href={buildHref({ ...baseParams, status: value })}
                active={status === value}
              />
            ))}
          </div>
          {tags.length > 0 ? (
            <div className="ml-auto flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <FilterPill
                  key={tag.id}
                  label={tag.name}
                  href={buildHref({ ...baseParams, tag: tagId === tag.id ? undefined : tag.id })}
                  active={tagId === tag.id}
                  color={tag.colorHex}
                />
              ))}
            </div>
          ) : null}
        </div>

        {clients.length === 0 ? (
          <EmptyState
            title="No clients match"
            description={query ? 'Try a different search term.' : 'Add your first client to get started.'}
            icon={<Users className="h-6 w-6" />}
            action={
              can(user.role, 'clients:write') ? (
                <Link href="/clients/new" className={buttonClass('primary', 'sm')}>
                  New client
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact</th>
                  <th>Tags</th>
                  <th>Last visit</th>
                  <th className="text-right">Visits</th>
                  {showMoney ? <th className="text-right">Lifetime value</th> : null}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <Tr key={client.id}>
                    <td>
                      <Link href={`/clients/${client.id}`} className="block">
                        <span className="font-medium text-ink hover:text-brand">
                          {client.firstName} {client.lastName}
                        </span>
                        <span className="block text-xs text-ink-subtle">{client.code}</span>
                      </Link>
                    </td>
                    <td>
                      <span className="block text-ink">{client.phone}</span>
                      {client.email ? (
                        <span className="block text-xs text-ink-subtle">{client.email}</span>
                      ) : null}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {client.tags.map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: `${tag.colorHex}1a`, color: tag.colorHex }}
                          >
                            {tag.name}
                          </span>
                        ))}
                        {client.allergies ? <Badge tone="danger">Allergy</Badge> : null}
                      </div>
                    </td>
                    <td className="text-ink-muted">
                      {client.lastVisitAt ? formatDate(client.lastVisitAt) : '—'}
                    </td>
                    <td className="text-right tabular-nums">{client.visitCount}</td>
                    {showMoney ? (
                      <td className="text-right font-medium tabular-nums">
                        {formatMoney(client.totalSpentMinor)}
                      </td>
                    ) : null}
                    <td>
                      <Badge tone={STATUS_TONES[client.status]}>
                        {client.status.charAt(0) + client.status.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} baseParams={baseParams} />
          </>
        )}
      </Card>
    </>
  )
}

function buildHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const query = search.toString()
  return query ? `/clients?${query}` : '/clients'
}

function FilterPill({
  label,
  href,
  active,
  color,
}: {
  label: string
  href: string
  active: boolean
  color?: string
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        active
          ? 'border-brand-ring bg-brand-soft text-brand-strong'
          : 'border-line bg-surface text-ink-muted hover:bg-surface-muted'
      }`}
    >
      {color ? (
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: color }} />
      ) : null}
      {label}
    </Link>
  )
}
