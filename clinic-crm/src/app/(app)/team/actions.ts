'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorize, hashPassword } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { parseBps } from '@/lib/money'
import { parseTimeToMinutes } from '@/lib/dates'
import { bool, fail, str, succeed, toActionState, type ActionState } from '@/lib/forms'

const staffSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(60),
  lastName: z.string().trim().min(1, 'Last name is required.').max(60),
  email: z.email('Enter a valid email address.'),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(['OWNER', 'MANAGER', 'RECEPTIONIST', 'THERAPIST', 'ACCOUNTANT']),
  title: z.string().trim().max(80).optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid colour.'),
  commissionBps: z.number().int().min(0).max(10000),
  isBookable: z.boolean(),
  isActive: z.boolean(),
})

function readStaffForm(formData: FormData) {
  return staffSchema.parse({
    firstName: str(formData, 'firstName'),
    lastName: str(formData, 'lastName'),
    email: str(formData, 'email')?.toLowerCase(),
    phone: str(formData, 'phone'),
    role: str(formData, 'role') ?? 'RECEPTIONIST',
    title: str(formData, 'title'),
    colorHex: str(formData, 'colorHex') ?? '#8b5cf6',
    commissionBps: parseBps(str(formData, 'commission')),
    isBookable: bool(formData, 'isBookable'),
    isActive: bool(formData, 'isActive'),
  })
}

/** Weekday rows arrive as day-<n>-enabled / day-<n>-start / day-<n>-end. */
function readWorkingHours(formData: FormData) {
  const hours: { weekday: number; startMin: number; endMin: number }[] = []
  for (let weekday = 0; weekday < 7; weekday += 1) {
    if (!bool(formData, `day-${weekday}-enabled`)) continue
    const start = parseTimeToMinutes(str(formData, `day-${weekday}-start`) ?? '09:00')
    const end = parseTimeToMinutes(str(formData, `day-${weekday}-end`) ?? '18:00')
    if (end <= start) continue
    hours.push({ weekday, startMin: start, endMin: end })
  }
  return hours
}

export async function createStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let userId: string
  try {
    const actor = await authorize('staff:write')
    const input = readStaffForm(formData)
    const password = str(formData, 'password')

    if (!password || password.length < 10) {
      return fail('Set a password of at least 10 characters.', { password: 'Too short.' })
    }
    if (input.role === 'OWNER' && actor.role !== 'OWNER') {
      return fail('Only an owner can create another owner account.')
    }

    const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })
    if (existing) return fail('That email address is already in use.', { email: 'Already in use.' })

    const created = await prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone ?? null,
        role: input.role,
        title: input.title ?? null,
        colorHex: input.colorHex,
        commissionBps: input.commissionBps,
        isBookable: input.isBookable,
        isActive: input.isActive,
        passwordHash: await hashPassword(password),
        workingHours: { create: readWorkingHours(formData) },
      },
    })

    await recordAudit({
      userId: actor.id,
      action: 'staff.create',
      entityType: 'User',
      entityId: created.id,
      summary: `Created ${input.role.toLowerCase()} account for ${input.firstName} ${input.lastName}`,
    })
    userId = created.id
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/team')
  redirect(`/team/${userId}`)
}

export async function updateStaff(
  staffId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await authorize('staff:write')
    const input = readStaffForm(formData)
    const password = str(formData, 'password')

    const target = await prisma.user.findUnique({ where: { id: staffId }, select: { role: true } })
    if (!target) return fail('Staff member not found.')
    if ((target.role === 'OWNER' || input.role === 'OWNER') && actor.role !== 'OWNER') {
      return fail('Only an owner can change owner accounts.')
    }
    if (password && password.length < 10) {
      return fail('A new password must be at least 10 characters.', { password: 'Too short.' })
    }

    const duplicate = await prisma.user.findFirst({
      where: { email: input.email, id: { not: staffId } },
      select: { id: true },
    })
    if (duplicate) return fail('That email address is already in use.', { email: 'Already in use.' })

    await prisma.$transaction(async (tx) => {
      await tx.workingHour.deleteMany({ where: { userId: staffId } })
      await tx.user.update({
        where: { id: staffId },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone ?? null,
          role: input.role,
          title: input.title ?? null,
          colorHex: input.colorHex,
          commissionBps: input.commissionBps,
          isBookable: input.isBookable,
          isActive: input.isActive,
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
          workingHours: { create: readWorkingHours(formData) },
        },
      })

      // Signing out everywhere is the only safe response to a password change.
      if (password) {
        await tx.session.updateMany({
          where: { userId: staffId, revokedAt: null },
          data: { revokedAt: new Date() },
        })
      }
    })

    await recordAudit({
      userId: actor.id,
      action: password ? 'staff.password_reset' : 'staff.update',
      entityType: 'User',
      entityId: staffId,
      summary: `Updated ${input.firstName} ${input.lastName}`,
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/team')
  revalidatePath(`/team/${staffId}`)
  return succeed('Team member saved.')
}

export async function createRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await authorize('settings:write')
    const name = str(formData, 'name')
    if (!name) return fail('Give the room a name.')
    await prisma.room.create({ data: { name, notes: str(formData, 'notes') ?? null } })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/settings')
  return succeed('Room added.')
}
