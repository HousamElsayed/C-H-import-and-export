import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  ArrowLeft,
  CalendarClock,
  CircleDollarSign,
  DoorOpen,
  MapPin,
  Play,
  TriangleAlert,
  UserX,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { formatMoney } from '@/lib/money'
import { formatDateTime, formatTime, toDateInput } from '@/lib/dates'
import { collectBookingWarnings } from '@/lib/booking'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClass } from '@/components/ui/button'
import { AppointmentStatusBadge } from '@/components/domain/status'
import { AppointmentNotes } from '@/components/calendar/appointment-notes'
import { RescheduleForm } from '@/components/calendar/reschedule-form'
import { advanceStatus, cancelAppointment, rescheduleAppointment, updateAppointmentNotes } from '../actions'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: PageProps<'/calendar/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const appointment = await prisma.appointment.findUnique({ where: { id }, select: { code: true } })
  return { title: appointment ? `Appointment ${appointment.code}` : 'Appointment' }
}

export default async function AppointmentPage(props: PageProps<'/calendar/[id]'>) {
  const user = await requirePermission('appointments:read')
  const { id } = await props.params

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      client: true,
      staff: { select: { id: true, firstName: true, lastName: true, colorHex: true } },
      room: { select: { id: true, name: true } },
      services: {
        orderBy: { sortOrder: 'asc' },
        include: { service: { select: { name: true, aftercareNote: true, colorHex: true } } },
      },
      invoice: { select: { id: true, number: true, status: true, totalMinor: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  })

  if (!appointment) notFound()

  const [staff, rooms, warnings] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, isBookable: true },
      orderBy: { firstName: 'asc' },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.room.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    collectBookingWarnings({
      staffId: appointment.staffId,
      clientId: appointment.clientId,
      serviceIds: appointment.services.map((item) => item.serviceId),
      startAt: appointment.startAt,
      endAt: appointment.endAt,
    }),
  ])

  const canWrite = can(user.role, 'appointments:write')
  const canBill = can(user.role, 'billing:write')
  const status = appointment.status
  const isOpen = !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/calendar?date=${toDateInput(appointment.startAt)}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Back to calendar
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              {appointment.client.firstName} {appointment.client.lastName}
            </h1>
            <AppointmentStatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {formatDateTime(appointment.startAt)} – {formatTime(appointment.endAt)} · {appointment.code}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/clients/${appointment.clientId}`} className={buttonClass('outline', 'md')}>
            Client record
          </Link>
          {canBill && status === 'COMPLETED' && !appointment.invoice ? (
            <Link href={`/invoices/new?appointmentId=${appointment.id}`} className={buttonClass('primary', 'md')}>
              <CircleDollarSign className="h-4 w-4" />
              Take payment
            </Link>
          ) : null}
          {appointment.invoice ? (
            <Link href={`/invoices/${appointment.invoice.id}`} className={buttonClass('secondary', 'md')}>
              {appointment.invoice.number}
            </Link>
          ) : null}
        </div>
      </div>

      {warnings.length > 0 && isOpen ? (
        <div className="mb-5 space-y-1.5 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3">
          {warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-2 text-sm text-warning">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Treatment" />
            <ul className="divide-y divide-line">
              {appointment.services.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: item.service.colorHex }} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{item.service.name}</p>
                      <p className="text-xs text-ink-muted">{item.durationMin} min</p>
                    </div>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums text-ink">
                    {formatMoney(item.priceMinor)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-4 bg-surface-muted px-5 py-3 text-sm">
                <span className="font-medium text-ink">Total</span>
                <span className="font-semibold tabular-nums text-ink">{formatMoney(appointment.totalMinor)}</span>
              </li>
              {appointment.depositMinor > 0 ? (
                <li className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm">
                  <span className="text-ink-muted">Deposit taken</span>
                  <span className="tabular-nums text-ink">{formatMoney(appointment.depositMinor)}</span>
                </li>
              ) : null}
            </ul>
          </Card>

          {canWrite ? (
            <Card>
              <CardHeader title="Notes" />
              <CardBody>
                <AppointmentNotes
                  action={updateAppointmentNotes.bind(null, appointment.id)}
                  notes={appointment.notes}
                  internalNotes={appointment.internalNotes}
                />
              </CardBody>
            </Card>
          ) : null}

          {canWrite && isOpen ? (
            <Card>
              <CardHeader title="Reschedule" description="Conflicts are re-checked before the move is saved." />
              <CardBody>
                <RescheduleForm
                  action={rescheduleAppointment.bind(null, appointment.id)}
                  staff={staff}
                  rooms={rooms}
                  defaults={{
                    date: toDateInput(appointment.startAt),
                    time: formatTime(appointment.startAt, 'en-GB'),
                    staffId: appointment.staffId,
                    roomId: appointment.roomId ?? '',
                  }}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {canWrite ? (
            <Card>
              <CardHeader title="Progress" />
              <CardBody className="space-y-2">
                {status === 'SCHEDULED' ? (
                  <StatusButton id={appointment.id} status="CONFIRMED" label="Mark confirmed" icon={<CalendarClock className="h-4 w-4" />} />
                ) : null}
                {(status === 'SCHEDULED' || status === 'CONFIRMED') ? (
                  <StatusButton id={appointment.id} status="ARRIVED" label="Client arrived" variant="primary" icon={<DoorOpen className="h-4 w-4" />} />
                ) : null}
                {status === 'ARRIVED' ? (
                  <StatusButton id={appointment.id} status="IN_PROGRESS" label="Start treatment" variant="primary" icon={<Play className="h-4 w-4" />} />
                ) : null}
                {(status === 'ARRIVED' || status === 'IN_PROGRESS') ? (
                  <StatusButton id={appointment.id} status="COMPLETED" label="Complete" variant="success" />
                ) : null}
                {isOpen ? (
                  <StatusButton id={appointment.id} status="NO_SHOW" label="No-show" variant="outline" icon={<UserX className="h-4 w-4" />} />
                ) : null}
                {isOpen ? (
                  <form action={cancelAppointment.bind(null, appointment.id)} className="space-y-2 pt-2">
                    <input
                      name="reason"
                      placeholder="Cancellation reason"
                      className="field text-xs"
                    />
                    <Button type="submit" variant="danger" size="sm" className="w-full">
                      Cancel appointment
                    </Button>
                  </form>
                ) : null}
                {status === 'COMPLETED' ? (
                  <p className="text-sm text-ink-muted">
                    Treatment completed. Products used were deducted from stock.
                  </p>
                ) : null}
                {status === 'CANCELLED' && appointment.cancelReason ? (
                  <p className="text-sm text-ink-muted">Reason: {appointment.cancelReason}</p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Details" />
            <CardBody className="space-y-2.5 text-sm">
              <Row label="Therapist">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: appointment.staff.colorHex }} />
                  {appointment.staff.firstName} {appointment.staff.lastName}
                </span>
              </Row>
              {appointment.room ? (
                <Row label="Room">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-ink-subtle" />
                    {appointment.room.name}
                  </span>
                </Row>
              ) : null}
              <Row label="Booked via">{appointment.source.toLowerCase().replace('_', ' ')}</Row>
              {appointment.createdBy ? (
                <Row label="Booked by">
                  {appointment.createdBy.firstName} {appointment.createdBy.lastName}
                </Row>
              ) : null}
              {appointment.arrivedAt ? <Row label="Arrived">{formatTime(appointment.arrivedAt)}</Row> : null}
              {appointment.completedAt ? <Row label="Finished">{formatTime(appointment.completedAt)}</Row> : null}
            </CardBody>
          </Card>

          {appointment.client.allergies ? (
            <Card>
              <CardHeader title="Client alerts" />
              <CardBody>
                <Badge tone="danger">Allergies</Badge>
                <p className="mt-2 text-sm text-danger">{appointment.client.allergies}</p>
              </CardBody>
            </Card>
          ) : null}

          {status === 'COMPLETED' && appointment.services.some((item) => item.service.aftercareNote) ? (
            <Card>
              <CardHeader title="Aftercare" />
              <CardBody className="space-y-2 text-sm text-ink-muted">
                {appointment.services
                  .filter((item) => item.service.aftercareNote)
                  .map((item) => (
                    <p key={item.id}>{item.service.aftercareNote}</p>
                  ))}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right capitalize text-ink">{children}</span>
    </div>
  )
}

function StatusButton({
  id,
  status,
  label,
  variant = 'outline',
  icon,
}: {
  id: string
  status: 'CONFIRMED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'NO_SHOW'
  label: string
  variant?: 'primary' | 'outline' | 'success'
  icon?: React.ReactNode
}) {
  return (
    <form action={advanceStatus.bind(null, id, status)}>
      <Button type="submit" variant={variant} size="sm" className="w-full">
        {icon}
        {label}
      </Button>
    </form>
  )
}
