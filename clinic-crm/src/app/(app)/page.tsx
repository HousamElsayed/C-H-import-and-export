import Link from 'next/link'
import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  Clock,
  PackageX,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { formatMoney } from '@/lib/money'
import { dayRange, formatTime } from '@/lib/dates'
import { formatQty } from '@/lib/utils'
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/card'
import { StatTile } from '@/components/ui/stat'
import { Badge } from '@/components/ui/badge'
import { buttonClass } from '@/components/ui/button'
import { AppointmentStatusBadge } from '@/components/domain/status'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const user = await requireUser()
  const now = new Date()
  const today = dayRange(now)

  const yesterday = dayRange(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const showMoney = can(user.role, 'billing:read')

  const [
    appointments,
    todayRevenue,
    yesterdayRevenue,
    monthRevenue,
    unconfirmed,
    lowStock,
    unpaid,
    newClients,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { startAt: { gte: today.from, lte: today.to }, status: { not: 'CANCELLED' } },
      orderBy: { startAt: 'asc' },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, phone: true, noShowCount: true } },
        staff: { select: { firstName: true, lastName: true, colorHex: true } },
        room: { select: { name: true } },
        services: { include: { service: { select: { name: true } } } },
        invoice: { select: { id: true, status: true } },
      },
    }),
    prisma.payment.aggregate({
      where: { createdAt: { gte: today.from, lte: today.to }, isRefund: false },
      _sum: { amountMinor: true },
    }),
    prisma.payment.aggregate({
      where: { createdAt: { gte: yesterday.from, lte: yesterday.to }, isRefund: false },
      _sum: { amountMinor: true },
    }),
    prisma.payment.aggregate({
      where: { createdAt: { gte: monthStart }, isRefund: false },
      _sum: { amountMinor: true },
    }),
    prisma.appointment.count({
      where: { startAt: { gt: now }, status: 'SCHEDULED' },
    }),
    prisma.$queryRaw<{ id: string; name: string; sku: string; stockQty: number; reorderLevel: number; unit: string }[]>`
      SELECT id, name, sku, "stockQty", "reorderLevel", unit
      FROM "Product"
      WHERE "isActive" = true AND "trackStock" = true AND "stockQty" <= "reorderLevel"
      ORDER BY ("stockQty" - "reorderLevel") ASC
      LIMIT 6
    `,
    prisma.invoice.aggregate({
      where: { status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
      _sum: { totalMinor: true, paidMinor: true },
      _count: true,
    }),
    prisma.client.count({ where: { createdAt: { gte: monthStart }, isDeleted: false } }),
  ])

  const todayTotal = todayRevenue._sum.amountMinor ?? 0
  const yesterdayTotal = yesterdayRevenue._sum.amountMinor ?? 0
  const trend =
    yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : todayTotal > 0 ? 100 : 0

  const outstanding = (unpaid._sum.totalMinor ?? 0) - (unpaid._sum.paidMinor ?? 0)
  const completed = appointments.filter((item) => item.status === 'COMPLETED').length
  const remaining = appointments.filter(
    (item) => item.status !== 'COMPLETED' && item.status !== 'NO_SHOW',
  ).length

  return (
    <>
      <PageHeader
        title={`Good ${now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening'}, ${user.firstName}`}
        description={new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(now)}
        action={
          can(user.role, 'appointments:write') ? (
            <Link href="/calendar" className={buttonClass('outline', 'md')}>
              <CalendarDays className="h-4 w-4" />
              Open calendar
            </Link>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Booked today"
          value={appointments.length}
          hint={`${completed} done · ${remaining} to go`}
          icon={<CalendarCheck className="h-4 w-4" />}
        />
        {showMoney ? (
          <StatTile
            label="Taken today"
            value={formatMoney(todayTotal)}
            trend={{ value: trend, label: 'vs yesterday' }}
            tone="brand"
            icon={<Wallet className="h-4 w-4" />}
          />
        ) : (
          <StatTile label="Awaiting confirmation" value={unconfirmed} icon={<Clock className="h-4 w-4" />} />
        )}
        {showMoney ? (
          <StatTile
            label="This month"
            value={formatMoney(monthRevenue._sum.amountMinor ?? 0)}
            hint={`${newClients} new clients`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
        ) : (
          <StatTile label="New clients this month" value={newClients} icon={<UserPlus className="h-4 w-4" />} />
        )}
        <StatTile
          label={showMoney ? 'Outstanding' : 'Low stock lines'}
          value={showMoney ? formatMoney(outstanding) : lowStock.length}
          hint={showMoney ? `${unpaid._count} open ${unpaid._count === 1 ? 'invoice' : 'invoices'}` : 'At or below reorder level'}
          tone={showMoney ? (outstanding > 0 ? 'warning' : 'neutral') : lowStock.length > 0 ? 'danger' : 'neutral'}
          icon={showMoney ? <AlertTriangle className="h-4 w-4" /> : <PackageX className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Today's schedule"
            description={`${appointments.length} appointments`}
            action={
              <Link href="/calendar" className={buttonClass('ghost', 'sm')}>
                View calendar
              </Link>
            }
          />
          {appointments.length === 0 ? (
            <EmptyState
              title="Nothing booked today"
              description="The diary is clear. Use the calendar to add a booking."
              icon={<CalendarDays className="h-6 w-6" />}
            />
          ) : (
            <ul className="divide-y divide-line">
              {appointments.map((appointment) => (
                <li key={appointment.id}>
                  <Link
                    href={`/calendar/${appointment.id}`}
                    className="flex items-center gap-4 px-5 py-3 transition hover:bg-surface-muted"
                  >
                    <div className="w-14 shrink-0 text-sm font-semibold tabular-nums text-ink">
                      {formatTime(appointment.startAt)}
                    </div>
                    <span
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: appointment.staff.colorHex }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {appointment.client.firstName} {appointment.client.lastName}
                        {appointment.client.noShowCount >= 2 ? (
                          <span className="ml-2 align-middle">
                            <Badge tone="danger">{appointment.client.noShowCount} no-shows</Badge>
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {appointment.services.map((item) => item.service.name).join(', ')} ·{' '}
                        {appointment.staff.firstName}
                        {appointment.room ? ` · ${appointment.room.name}` : ''}
                      </p>
                    </div>
                    <AppointmentStatusBadge status={appointment.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          {can(user.role, 'inventory:read') ? (
            <Card>
              <CardHeader
                title="Stock needing attention"
                description="At or below reorder level"
                action={
                  <Link href="/inventory" className={buttonClass('ghost', 'sm')}>
                    Stock
                  </Link>
                }
              />
              {lowStock.length === 0 ? (
                <EmptyState title="Stock levels are healthy" />
              ) : (
                <ul className="divide-y divide-line">
                  {lowStock.map((product) => (
                    <li key={product.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{product.name}</p>
                        <p className="text-xs text-ink-subtle">{product.sku}</p>
                      </div>
                      <Badge tone={product.stockQty <= 0 ? 'danger' : 'warning'} className="shrink-0">
                        {formatQty(product.stockQty, product.unit)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Quick actions" />
            <div className="grid grid-cols-2 gap-2 p-4">
              {can(user.role, 'appointments:write') ? (
                <Link href="/calendar/new" className={buttonClass('outline', 'sm', 'justify-start')}>
                  <CalendarDays className="h-4 w-4" /> Book
                </Link>
              ) : null}
              {can(user.role, 'clients:write') ? (
                <Link href="/clients/new" className={buttonClass('outline', 'sm', 'justify-start')}>
                  <UserPlus className="h-4 w-4" /> New client
                </Link>
              ) : null}
              {can(user.role, 'billing:read') ? (
                <Link href="/invoices" className={buttonClass('outline', 'sm', 'justify-start')}>
                  <Wallet className="h-4 w-4" /> Invoices
                </Link>
              ) : null}
              {can(user.role, 'inventory:consume') ? (
                <Link href="/inventory/consumption/new" className={buttonClass('outline', 'sm', 'justify-start')}>
                  <PackageX className="h-4 w-4" /> Usage bill
                </Link>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
