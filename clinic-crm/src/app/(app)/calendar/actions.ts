'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorize } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { assertSlotIsFree, BookingConflict } from '@/lib/booking'
import { nextDocumentNumber } from '@/lib/numbering'
import { parseMoney } from '@/lib/money'
import { roundQty } from '@/lib/utils'
import { fail, list, str, succeed, toActionState, type ActionState } from '@/lib/forms'
import type { AppointmentStatus } from '@/generated/prisma/enums'

const bookingSchema = z.object({
  clientId: z.string().min(1, 'Choose a client.'),
  staffId: z.string().min(1, 'Choose a team member.'),
  roomId: z.string().optional(),
  serviceIds: z.array(z.string()).min(1, 'Choose at least one service.'),
  startAt: z.date(),
  source: z.enum(['WALK_IN', 'PHONE', 'WHATSAPP', 'INSTAGRAM', 'WEBSITE', 'REFERRAL', 'OTHER']),
  notes: z.string().trim().max(1000).optional(),
  depositMinor: z.number().int().min(0),
})

function readBookingForm(formData: FormData) {
  const day = str(formData, 'date')
  const time = str(formData, 'time')
  const startAt = day && time ? new Date(`${day}T${time}:00`) : undefined

  return bookingSchema.parse({
    clientId: str(formData, 'clientId') ?? '',
    staffId: str(formData, 'staffId') ?? '',
    roomId: str(formData, 'roomId'),
    serviceIds: list(formData, 'serviceIds'),
    startAt: startAt && !Number.isNaN(startAt.getTime()) ? startAt : undefined,
    source: str(formData, 'source') ?? 'PHONE',
    notes: str(formData, 'notes'),
    depositMinor: parseMoney(str(formData, 'deposit')),
  })
}

export async function createAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let appointmentId: string
  try {
    const user = await authorize('appointments:write')
    const input = readBookingForm(formData)

    const services = await prisma.service.findMany({
      where: { id: { in: input.serviceIds } },
      select: { id: true, name: true, durationMin: true, bufferMin: true, priceMinor: true },
    })
    if (services.length === 0) return fail('Those services could not be found.')

    // Preserve the order the user picked them in.
    const ordered = input.serviceIds
      .map((id) => services.find((service) => service.id === id))
      .filter((service): service is (typeof services)[number] => Boolean(service))

    const treatmentMin = ordered.reduce((sum, service) => sum + service.durationMin, 0)
    const bufferMin = Math.max(...ordered.map((service) => service.bufferMin), 0)
    const endAt = new Date(input.startAt.getTime() + (treatmentMin + bufferMin) * 60_000)
    const totalMinor = ordered.reduce((sum, service) => sum + service.priceMinor, 0)

    const appointment = await prisma.$transaction(async (tx) => {
      await assertSlotIsFree(tx, {
        staffId: input.staffId,
        roomId: input.roomId ?? null,
        startAt: input.startAt,
        endAt,
      })

      const code = await nextDocumentNumber(tx, 'A', input.startAt)

      return tx.appointment.create({
        data: {
          code,
          clientId: input.clientId,
          staffId: input.staffId,
          roomId: input.roomId ?? null,
          startAt: input.startAt,
          endAt,
          source: input.source,
          notes: input.notes ?? null,
          depositMinor: input.depositMinor,
          totalMinor,
          createdById: user.id,
          services: {
            create: ordered.map((service, index) => ({
              serviceId: service.id,
              staffId: input.staffId,
              durationMin: service.durationMin,
              priceMinor: service.priceMinor,
              sortOrder: index,
            })),
          },
        },
      })
    })

    await recordAudit({
      userId: user.id,
      action: 'appointment.create',
      entityType: 'Appointment',
      entityId: appointment.id,
      summary: `Booked ${appointment.code}`,
    })

    appointmentId = appointment.id
  } catch (error) {
    if (error instanceof BookingConflict) return fail(error.message)
    return toActionState(error)
  }

  revalidatePath('/calendar')
  redirect(`/calendar/${appointmentId}`)
}

export async function rescheduleAppointment(
  appointmentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await authorize('appointments:write')
    const day = str(formData, 'date')
    const time = str(formData, 'time')
    const staffId = str(formData, 'staffId')
    const roomId = str(formData, 'roomId')

    if (!day || !time || !staffId) return fail('Pick a date, time and team member.')
    const startAt = new Date(`${day}T${time}:00`)
    if (Number.isNaN(startAt.getTime())) return fail('That date and time could not be read.')

    const existing = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { startAt: true, endAt: true, code: true },
    })
    if (!existing) return fail('Appointment not found.')

    const durationMs = existing.endAt.getTime() - existing.startAt.getTime()
    const endAt = new Date(startAt.getTime() + durationMs)

    await prisma.$transaction(async (tx) => {
      await assertSlotIsFree(tx, { staffId, roomId: roomId ?? null, startAt, endAt, excludeAppointmentId: appointmentId })
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { startAt, endAt, staffId, roomId: roomId ?? null },
      })
      await tx.appointmentService.updateMany({ where: { appointmentId }, data: { staffId } })
    })

    await recordAudit({
      userId: user.id,
      action: 'appointment.reschedule',
      entityType: 'Appointment',
      entityId: appointmentId,
      summary: `Moved ${existing.code} to ${startAt.toISOString()}`,
    })
  } catch (error) {
    if (error instanceof BookingConflict) return fail(error.message)
    return toActionState(error)
  }

  revalidatePath('/calendar')
  revalidatePath(`/calendar/${appointmentId}`)
  return succeed('Appointment moved.')
}

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['CONFIRMED', 'ARRIVED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
  ARRIVED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: ['SCHEDULED'],
  NO_SHOW: ['SCHEDULED'],
}

export async function setAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
  reason?: string,
): Promise<void> {
  const user = await authorize('appointments:write')

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      status: true,
      code: true,
      clientId: true,
      endAt: true,
      services: { select: { serviceId: true } },
    },
  })
  if (!appointment) throw new Error('Appointment not found.')

  if (!TRANSITIONS[appointment.status].includes(status)) {
    throw new Error(`An appointment that is ${appointment.status.toLowerCase()} cannot become ${status.toLowerCase()}.`)
  }

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status,
        confirmedAt: status === 'CONFIRMED' ? now : undefined,
        arrivedAt: status === 'ARRIVED' ? now : undefined,
        startedAt: status === 'IN_PROGRESS' ? now : undefined,
        completedAt: status === 'COMPLETED' ? now : undefined,
        cancelledAt: status === 'CANCELLED' ? now : undefined,
        cancelReason: status === 'CANCELLED' ? (reason ?? null) : undefined,
      },
    })

    if (status === 'NO_SHOW') {
      await tx.client.update({
        where: { id: appointment.clientId },
        data: { noShowCount: { increment: 1 } },
      })
    }

    if (status === 'COMPLETED') {
      await tx.client.update({
        where: { id: appointment.clientId },
        data: {
          visitCount: { increment: 1 },
          lastVisitAt: now,
        },
      })

      // Treatment stock leaves when the treatment happens, not when it is paid.
      const usages = await tx.serviceProductUsage.findMany({
        where: { serviceId: { in: appointment.services.map((service) => service.serviceId) } },
        include: { product: { select: { id: true, stockQty: true, costMinor: true, trackStock: true } } },
      })

      for (const usage of usages) {
        if (!usage.product.trackStock) continue
        const balanceAfter = roundQty(usage.product.stockQty - usage.quantity)
        await tx.product.update({
          where: { id: usage.productId },
          data: { stockQty: balanceAfter },
        })
        await tx.stockMovement.create({
          data: {
            productId: usage.productId,
            type: 'TREATMENT_USE',
            quantity: -usage.quantity,
            balanceAfter,
            unitCostMinor: usage.product.costMinor,
            totalCostMinor: Math.round(usage.product.costMinor * usage.quantity),
            reference: appointment.code,
            appointmentId,
            userId: user.id,
          },
        })
      }
    }
  })

  if (status === 'COMPLETED') {
    await prisma.client.updateMany({
      where: { id: appointment.clientId, firstVisitAt: null },
      data: { firstVisitAt: now },
    })
  }

  await recordAudit({
    userId: user.id,
    action: `appointment.${status.toLowerCase()}`,
    entityType: 'Appointment',
    entityId: appointmentId,
    summary: `${appointment.code} marked ${status.toLowerCase().replace('_', ' ')}`,
  })

  revalidatePath('/calendar')
  revalidatePath(`/calendar/${appointmentId}`)
  revalidatePath('/')
}

/** Form-action wrapper so status buttons can be plain forms. */
export async function advanceStatus(
  appointmentId: string,
  status: AppointmentStatus,
  _formData: FormData,
): Promise<void> {
  await setAppointmentStatus(appointmentId, status)
}

export async function cancelAppointment(appointmentId: string, formData: FormData): Promise<void> {
  const reason = str(formData, 'reason')
  await setAppointmentStatus(appointmentId, 'CANCELLED', reason)
}

export async function updateAppointmentNotes(
  appointmentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await authorize('appointments:write')
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        notes: str(formData, 'notes') ?? null,
        internalNotes: str(formData, 'internalNotes') ?? null,
      },
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath(`/calendar/${appointmentId}`)
  return succeed('Notes saved.')
}
