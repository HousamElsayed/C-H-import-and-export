import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { toDateInput } from '@/lib/dates'
import { PageHeader } from '@/components/ui/card'
import { BookingForm } from '@/components/calendar/booking-form'
import { createAppointment } from '../actions'

export const metadata: Metadata = { title: 'New appointment' }
export const dynamic = 'force-dynamic'

export default async function NewAppointmentPage(props: PageProps<'/calendar/new'>) {
  await requirePermission('appointments:write')
  const params = await props.searchParams

  const [clients, services, staff, rooms] = await Promise.all([
    prisma.client.findMany({
      where: { isDeleted: false, status: { not: 'BLOCKED' } },
      orderBy: [{ lastVisitAt: { sort: 'desc', nulls: 'last' } }],
      take: 1000,
      select: { id: true, firstName: true, lastName: true, phone: true, allergies: true, noShowCount: true },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        durationMin: true,
        bufferMin: true,
        priceMinor: true,
        colorHex: true,
        requiresConsent: true,
        requiresPatchTest: true,
        category: { select: { name: true } },
        staff: { select: { userId: true } },
        rooms: { select: { roomId: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true, isBookable: true },
      orderBy: { firstName: 'asc' },
      select: { id: true, firstName: true, lastName: true, colorHex: true },
    }),
    prisma.room.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  const date = typeof params.date === 'string' ? params.date : toDateInput(new Date())
  const time = typeof params.time === 'string' ? params.time : '10:00'
  const clientId = typeof params.clientId === 'string' ? params.clientId : undefined
  const staffId = typeof params.staffId === 'string' ? params.staffId : undefined

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New appointment" description="Conflicts with shifts, rooms and other bookings are checked on save." />
      <BookingForm
        action={createAppointment}
        clients={clients}
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          categoryName: service.category.name,
          durationMin: service.durationMin,
          bufferMin: service.bufferMin,
          priceMinor: service.priceMinor,
          colorHex: service.colorHex,
          requiresConsent: service.requiresConsent,
          requiresPatchTest: service.requiresPatchTest,
          staffIds: service.staff.map((entry) => entry.userId),
          roomIds: service.rooms.map((entry) => entry.roomId),
        }))}
        staff={staff}
        rooms={rooms}
        defaults={{ clientId, staffId, date, time }}
      />
    </div>
  )
}
