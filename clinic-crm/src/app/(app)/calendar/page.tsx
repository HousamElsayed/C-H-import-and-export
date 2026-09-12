import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { getSettings } from '@/lib/settings'
import { addDays, dayRange, endOfDay, startOfDay, toDateInput, weekRange } from '@/lib/dates'
import { Card, PageHeader } from '@/components/ui/card'
import { buttonClass } from '@/components/ui/button'
import { CalendarGrid, type CalendarAppointment, type CalendarColumn } from '@/components/calendar/calendar-grid'
import { ACTIVE_STATUSES } from '@/lib/booking'

export const metadata: Metadata = { title: 'Calendar' }
export const dynamic = 'force-dynamic'

export default async function CalendarPage(props: PageProps<'/calendar'>) {
  const user = await requirePermission('appointments:read')
  const params = await props.searchParams
  const settings = await getSettings()

  const dateParam = typeof params.date === 'string' ? params.date : ''
  const parsed = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date()
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  const view = params.view === 'week' ? 'week' : 'day'
  const staffFilter = typeof params.staff === 'string' ? params.staff : ''

  const staff = await prisma.user.findMany({
    where: { isActive: true, isBookable: true },
    orderBy: { firstName: 'asc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      title: true,
      colorHex: true,
      workingHours: { where: { isActive: true }, select: { weekday: true, startMin: true, endMin: true } },
    },
  })

  const range = view === 'week' ? weekRange(date) : dayRange(date)

  const appointments = await prisma.appointment.findMany({
    where: {
      startAt: { gte: range.from, lte: range.to },
      ...(staffFilter ? { staffId: staffFilter } : {}),
      status: { in: [...ACTIVE_STATUSES, 'NO_SHOW'] },
    },
    orderBy: { startAt: 'asc' },
    select: {
      id: true,
      code: true,
      startAt: true,
      endAt: true,
      status: true,
      staffId: true,
      totalMinor: true,
      client: { select: { firstName: true, lastName: true } },
      room: { select: { name: true } },
      services: { select: { service: { select: { name: true, colorHex: true } } }, orderBy: { sortOrder: 'asc' } },
    },
  })

  const visibleStaff = staffFilter ? staff.filter((member) => member.id === staffFilter) : staff

  const columns: CalendarColumn[] =
    view === 'day'
      ? visibleStaff.map((member) => ({
          key: member.id,
          label: `${member.firstName} ${member.lastName}`,
          sublabel: member.title ?? undefined,
          color: member.colorHex,
          bookParams: { staffId: member.id },
          appointments: appointments.filter(
            (appointment) => appointment.staffId === member.id,
          ) as CalendarAppointment[],
          shifts: member.workingHours
            .filter((hour) => hour.weekday === date.getDay())
            .map((hour) => ({ startMin: hour.startMin, endMin: hour.endMin })),
        }))
      : Array.from({ length: 7 }, (_, index) => {
          const day = addDays(range.from, index)
          const from = startOfDay(day)
          const to = endOfDay(day)
          const isToday = toDateInput(day) === toDateInput(new Date())
          return {
            key: toDateInput(day),
            label: new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(day),
            sublabel: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(day),
            color: isToday ? '#8b5b9e' : undefined,
            bookParams: (staffFilter ? { staffId: staffFilter } : {}) as Record<string, string>,
            appointments: appointments.filter(
              (appointment) => appointment.startAt >= from && appointment.startAt <= to,
            ) as CalendarAppointment[],
            shifts: staffFilter
              ? visibleStaff[0]?.workingHours
                  .filter((hour) => hour.weekday === day.getDay())
                  .map((hour) => ({ startMin: hour.startMin, endMin: hour.endMin }))
              : undefined,
          }
        })

  const prevDate = toDateInput(addDays(date, view === 'week' ? -7 : -1))
  const nextDate = toDateInput(addDays(date, view === 'week' ? 7 : 1))
  const heading =
    view === 'week'
      ? `${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(range.from)} – ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(range.to)}`
      : new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(date)

  function href(next: Record<string, string | undefined>) {
    const search = new URLSearchParams()
    const merged = { date: toDateInput(date), view, staff: staffFilter || undefined, ...next }
    for (const [key, value] of Object.entries(merged)) {
      if (value) search.set(key, value)
    }
    return `/calendar?${search.toString()}`
  }

  const showNow = view === 'day' && toDateInput(date) === toDateInput(new Date())

  return (
    <>
      <PageHeader
        title="Calendar"
        description={`${appointments.length} appointments · ${heading}`}
        action={
          can(user.role, 'appointments:write') ? (
            <Link href={`/calendar/new?date=${toDateInput(date)}`} className={buttonClass('primary', 'md')}>
              <Plus className="h-4 w-4" />
              New appointment
            </Link>
          ) : null
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-1">
            <Link href={href({ date: prevDate })} className={buttonClass('outline', 'icon')} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link href={href({ date: toDateInput(new Date()) })} className={buttonClass('outline', 'sm')}>
              Today
            </Link>
            <Link href={href({ date: nextDate })} className={buttonClass('outline', 'icon')} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex rounded-lg border border-line p-0.5">
            {(['day', 'week'] as const).map((value) => (
              <Link
                key={value}
                href={href({ view: value })}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                  view === value ? 'bg-brand-soft text-brand-strong' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {value}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex flex-wrap gap-1.5">
            <Link
              href={href({ staff: undefined })}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                staffFilter
                  ? 'border-line bg-surface text-ink-muted hover:bg-surface-muted'
                  : 'border-brand-ring bg-brand-soft text-brand-strong'
              }`}
            >
              Everyone
            </Link>
            {staff.map((member) => (
              <Link
                key={member.id}
                href={href({ staff: staffFilter === member.id ? undefined : member.id })}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  staffFilter === member.id
                    ? 'border-brand-ring bg-brand-soft text-brand-strong'
                    : 'border-line bg-surface text-ink-muted hover:bg-surface-muted'
                }`}
              >
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ backgroundColor: member.colorHex }}
                />
                {member.firstName}
              </Link>
            ))}
          </div>
        </div>

        <CalendarGrid
          columns={columns}
          openMin={settings.openMin}
          closeMin={settings.closeMin}
          slotMinutes={settings.slotMinutes}
          date={date}
          showNow={showNow}
        />
      </Card>
    </>
  )
}
