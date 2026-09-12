import Link from 'next/link'
import { formatMinutes, minutesFromMidnight, toDateInput } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { AppointmentStatus } from '@/generated/prisma/enums'

export type CalendarAppointment = {
  id: string
  code: string
  startAt: Date
  endAt: Date
  status: AppointmentStatus
  staffId: string
  totalMinor: number
  client: { firstName: string; lastName: string }
  room: { name: string } | null
  services: { service: { name: string; colorHex: string } }[]
}

export type CalendarColumn = {
  key: string
  label: string
  sublabel?: string
  color?: string
  /** Query params applied when booking into an empty slot in this column. */
  bookParams: Record<string, string>
  appointments: CalendarAppointment[]
  shifts?: { startMin: number; endMin: number }[]
}

const PX_PER_MIN = 1.5

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  SCHEDULED: 'border-l-4 bg-surface',
  CONFIRMED: 'border-l-4 bg-info-soft',
  ARRIVED: 'border-l-4 bg-brand-soft',
  IN_PROGRESS: 'border-l-4 bg-accent-soft',
  COMPLETED: 'border-l-4 bg-success-soft',
  CANCELLED: 'border-l-4 bg-surface-muted opacity-60 line-through',
  NO_SHOW: 'border-l-4 bg-danger-soft',
}

export function CalendarGrid({
  columns,
  openMin,
  closeMin,
  slotMinutes,
  date,
  showNow,
}: {
  columns: CalendarColumn[]
  openMin: number
  closeMin: number
  slotMinutes: number
  date: Date
  showNow: boolean
}) {
  const totalMinutes = closeMin - openMin
  const height = totalMinutes * PX_PER_MIN
  const hourMarks: number[] = []
  for (let minute = Math.ceil(openMin / 60) * 60; minute <= closeMin; minute += 60) {
    hourMarks.push(minute)
  }

  const slotCount = Math.floor(totalMinutes / slotMinutes)
  const nowMin = minutesFromMidnight(new Date())
  const showNowLine = showNow && nowMin >= openMin && nowMin <= closeMin

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[720px]">
        <div className="w-16 shrink-0 border-r border-line">
          <div className="h-11 border-b border-line" />
          <div className="relative" style={{ height }}>
            {hourMarks.map((minute) => (
              <span
                key={minute}
                className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-ink-subtle"
                style={{ top: (minute - openMin) * PX_PER_MIN }}
              >
                {formatMinutes(minute)}
              </span>
            ))}
          </div>
        </div>

        {columns.map((column) => (
          <div key={column.key} className="min-w-0 flex-1 border-r border-line last:border-r-0">
            <div className="flex h-11 items-center gap-2 border-b border-line px-3">
              {column.color ? (
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: column.color }} />
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{column.label}</p>
                {column.sublabel ? (
                  <p className="truncate text-xs text-ink-subtle">{column.sublabel}</p>
                ) : null}
              </div>
            </div>

            <div className="relative" style={{ height }}>
              {/* Shaded outside-shift areas */}
              {column.shifts && column.shifts.length > 0
                ? buildOutsideBands(column.shifts, openMin, closeMin).map((band, index) => (
                    <div
                      key={`band-${index}`}
                      className="absolute inset-x-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--color-surface-muted)_6px,var(--color-surface-muted)_12px)]"
                      style={{
                        top: (band.start - openMin) * PX_PER_MIN,
                        height: (band.end - band.start) * PX_PER_MIN,
                      }}
                    />
                  ))
                : null}

              {/* Clickable empty slots */}
              {Array.from({ length: slotCount }, (_, index) => {
                const minute = openMin + index * slotMinutes
                const params = new URLSearchParams({
                  ...column.bookParams,
                  date: toDateInput(date),
                  time: formatMinutes(minute),
                })
                return (
                  <Link
                    key={minute}
                    href={`/calendar/new?${params.toString()}`}
                    aria-label={`Book at ${formatMinutes(minute)}`}
                    className={cn(
                      'absolute inset-x-0 border-b transition hover:bg-brand-soft/60',
                      minute % 60 === 0 ? 'border-line' : 'border-line/40',
                    )}
                    style={{ top: (minute - openMin) * PX_PER_MIN, height: slotMinutes * PX_PER_MIN }}
                  />
                )
              })}

              {/* Appointments */}
              {layoutColumn(column.appointments).map(({ appointment, lane, lanes }) => {
                const start = minutesFromMidnight(appointment.startAt)
                const end = minutesFromMidnight(appointment.endAt)
                const top = (Math.max(start, openMin) - openMin) * PX_PER_MIN
                const blockHeight = Math.max(22, (Math.min(end, closeMin) - Math.max(start, openMin)) * PX_PER_MIN)
                const width = 100 / lanes
                const accent = appointment.services[0]?.service.colorHex ?? '#8b5b9e'

                return (
                  <Link
                    key={appointment.id}
                    href={`/calendar/${appointment.id}`}
                    className={cn(
                      'absolute overflow-hidden rounded-md px-2 py-1 text-xs shadow-sm ring-1 ring-line transition hover:z-10 hover:shadow-md',
                      STATUS_STYLES[appointment.status],
                    )}
                    style={{
                      top,
                      height: blockHeight,
                      left: `calc(${lane * width}% + 2px)`,
                      width: `calc(${width}% - 4px)`,
                      borderLeftColor: accent,
                    }}
                  >
                    <p className="truncate font-medium text-ink">
                      {appointment.client.firstName} {appointment.client.lastName}
                    </p>
                    {blockHeight > 34 ? (
                      <p className="truncate text-ink-muted">
                        {appointment.services.map((item) => item.service.name).join(', ')}
                      </p>
                    ) : null}
                    {blockHeight > 58 ? (
                      <p className="truncate text-ink-subtle">
                        {formatMinutes(start)}–{formatMinutes(end)}
                        {appointment.room ? ` · ${appointment.room.name}` : ''}
                        {appointment.totalMinor > 0 ? ` · ${formatMoney(appointment.totalMinor)}` : ''}
                      </p>
                    ) : null}
                  </Link>
                )
              })}

              {showNowLine ? (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-danger"
                  style={{ top: (nowMin - openMin) * PX_PER_MIN }}
                >
                  <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-danger" />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Side-by-side lanes so overlapping bookings stay readable. */
function layoutColumn(appointments: CalendarAppointment[]) {
  const sorted = [...appointments].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
  const result: { appointment: CalendarAppointment; lane: number; lanes: number }[] = []
  let cluster: CalendarAppointment[] = []
  let clusterEnd = 0

  function flush() {
    if (cluster.length === 0) return
    const laneEnds: number[] = []
    const assignments = cluster.map((appointment) => {
      let lane = laneEnds.findIndex((end) => end <= appointment.startAt.getTime())
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(0)
      }
      laneEnds[lane] = appointment.endAt.getTime()
      return { appointment, lane }
    })
    for (const entry of assignments) {
      result.push({ ...entry, lanes: laneEnds.length })
    }
    cluster = []
  }

  for (const appointment of sorted) {
    if (cluster.length > 0 && appointment.startAt.getTime() >= clusterEnd) {
      flush()
      clusterEnd = 0
    }
    cluster.push(appointment)
    clusterEnd = Math.max(clusterEnd, appointment.endAt.getTime())
  }
  flush()

  return result
}

/** Inverts shift windows into the bands that fall outside them. */
function buildOutsideBands(
  shifts: { startMin: number; endMin: number }[],
  openMin: number,
  closeMin: number,
) {
  const sorted = [...shifts].sort((a, b) => a.startMin - b.startMin)
  const bands: { start: number; end: number }[] = []
  let cursor = openMin

  for (const shift of sorted) {
    if (shift.startMin > cursor) bands.push({ start: cursor, end: Math.min(shift.startMin, closeMin) })
    cursor = Math.max(cursor, shift.endMin)
  }
  if (cursor < closeMin) bands.push({ start: cursor, end: closeMin })

  return bands.filter((band) => band.end > band.start)
}
