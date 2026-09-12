import { prisma } from '@/lib/prisma'
import { minutesFromMidnight } from '@/lib/dates'
import type { Prisma } from '@/generated/prisma/client'

export class BookingConflict extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BookingConflict'
  }
}

/** Statuses that still occupy a slot in the diary. */
export const ACTIVE_STATUSES = ['SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'] as const

type Tx = Prisma.TransactionClient | typeof prisma

/**
 * Rejects a booking that would double-book a therapist or room, fall outside
 * the therapist's shift, or land during booked time off. Run inside the same
 * transaction that writes the appointment so two concurrent bookings cannot
 * both pass the check.
 */
export async function assertSlotIsFree(
  tx: Tx,
  params: {
    staffId: string
    roomId?: string | null
    startAt: Date
    endAt: Date
    excludeAppointmentId?: string
  },
) {
  const { staffId, roomId, startAt, endAt, excludeAppointmentId } = params

  if (endAt <= startAt) throw new BookingConflict('The end time must be after the start time.')

  const staff = await tx.user.findUnique({
    where: { id: staffId },
    select: { firstName: true, lastName: true, isActive: true, isBookable: true },
  })
  if (!staff || !staff.isActive) throw new BookingConflict('That team member is no longer active.')
  if (!staff.isBookable) throw new BookingConflict(`${staff.firstName} does not take bookings.`)

  const overlapWhere = {
    startAt: { lt: endAt },
    endAt: { gt: startAt },
    status: { in: [...ACTIVE_STATUSES] },
    ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
  }

  const clash = await tx.appointment.findFirst({
    where: { ...overlapWhere, staffId },
    select: { startAt: true, code: true },
  })
  if (clash) {
    throw new BookingConflict(
      `${staff.firstName} already has appointment ${clash.code} at that time.`,
    )
  }

  if (roomId) {
    const roomClash = await tx.appointment.findFirst({
      where: { ...overlapWhere, roomId },
      select: { code: true, room: { select: { name: true } } },
    })
    if (roomClash) {
      throw new BookingConflict(
        `${roomClash.room?.name ?? 'That room'} is taken by appointment ${roomClash.code}.`,
      )
    }
  }

  const timeOff = await tx.timeOff.findFirst({
    where: { userId: staffId, startAt: { lt: endAt }, endAt: { gt: startAt } },
    select: { reason: true },
  })
  if (timeOff) {
    throw new BookingConflict(
      `${staff.firstName} is away${timeOff.reason ? ` (${timeOff.reason})` : ''} at that time.`,
    )
  }
}

/** Non-blocking warnings surfaced to the person taking the booking. */
export async function collectBookingWarnings(params: {
  staffId: string
  clientId: string
  serviceIds: string[]
  startAt: Date
  endAt: Date
}) {
  const warnings: string[] = []

  const [shifts, client, services] = await Promise.all([
    prisma.workingHour.findMany({
      where: { userId: params.staffId, weekday: params.startAt.getDay(), isActive: true },
    }),
    prisma.client.findUnique({
      where: { id: params.clientId },
      select: { allergies: true, noShowCount: true, kvkkConsentAt: true, firstName: true },
    }),
    prisma.service.findMany({
      where: { id: { in: params.serviceIds } },
      select: { id: true, name: true, requiresConsent: true, requiresPatchTest: true, consentTemplateId: true },
    }),
  ])

  const startMin = minutesFromMidnight(params.startAt)
  const endMin = minutesFromMidnight(params.endAt)
  const inShift = shifts.some((shift) => startMin >= shift.startMin && endMin <= shift.endMin)
  if (shifts.length === 0) {
    warnings.push('This is outside the therapist’s usual working days.')
  } else if (!inShift) {
    warnings.push('This runs outside the therapist’s usual hours.')
  }

  if (client?.allergies) warnings.push(`Allergies on file: ${client.allergies}`)
  if (client && client.noShowCount >= 2) {
    warnings.push(`${client.firstName} has ${client.noShowCount} no-shows — consider taking a deposit.`)
  }
  if (client && !client.kvkkConsentAt) warnings.push('No data-processing consent recorded for this client.')

  const needsConsent = services.filter((service) => service.requiresConsent)
  if (needsConsent.length > 0) {
    const signed = await prisma.consentRecord.findMany({
      where: {
        clientId: params.clientId,
        status: 'SIGNED',
        templateId: { in: needsConsent.map((service) => service.consentTemplateId ?? '') },
      },
      select: { templateId: true },
    })
    const signedIds = new Set(signed.map((record) => record.templateId))
    for (const service of needsConsent) {
      if (!service.consentTemplateId || !signedIds.has(service.consentTemplateId)) {
        warnings.push(`${service.name} needs a signed consent form before treatment.`)
      }
    }
  }

  for (const service of services.filter((item) => item.requiresPatchTest)) {
    warnings.push(`${service.name} requires a patch test beforehand.`)
  }

  return warnings
}

/** Free slots for a therapist on a given day, in clinic opening hours. */
export async function findFreeSlots(params: {
  staffId: string
  day: Date
  durationMin: number
  stepMin: number
  openMin: number
  closeMin: number
}) {
  const dayStart = new Date(params.day)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const [appointments, shifts, timeOff] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        staffId: params.staffId,
        startAt: { gte: dayStart, lt: dayEnd },
        status: { in: [...ACTIVE_STATUSES] },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.workingHour.findMany({
      where: { userId: params.staffId, weekday: dayStart.getDay(), isActive: true },
    }),
    prisma.timeOff.findMany({
      where: { userId: params.staffId, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
      select: { startAt: true, endAt: true },
    }),
  ])

  const windows = shifts.length > 0
    ? shifts.map((shift) => ({ start: shift.startMin, end: shift.endMin }))
    : [{ start: params.openMin, end: params.closeMin }]

  const busy = [
    ...appointments.map((item) => ({
      start: minutesFromMidnight(item.startAt),
      end: minutesFromMidnight(item.endAt),
    })),
    ...timeOff.map((item) => ({
      start: item.startAt < dayStart ? 0 : minutesFromMidnight(item.startAt),
      end: item.endAt > dayEnd ? 1440 : minutesFromMidnight(item.endAt),
    })),
  ]

  const slots: number[] = []
  for (const window of windows) {
    for (let start = window.start; start + params.durationMin <= window.end; start += params.stepMin) {
      const end = start + params.durationMin
      const clash = busy.some((period) => start < period.end && period.start < end)
      if (!clash) slots.push(start)
    }
  }

  return slots
}
