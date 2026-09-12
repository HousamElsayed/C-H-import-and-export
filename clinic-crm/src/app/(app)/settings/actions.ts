'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorize } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { parseBps, parseMoney } from '@/lib/money'
import { parseTimeToMinutes } from '@/lib/dates'
import { fail, int, str, succeed, toActionState, type ActionState } from '@/lib/forms'

const settingsSchema = z.object({
  name: z.string().trim().min(1, 'The clinic needs a name.').max(120),
  legalName: z.string().trim().max(160).optional(),
  taxNumber: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  currency: z.string().trim().length(3, 'Use a three-letter currency code.'),
  currencySymbol: z.string().trim().max(4),
  locale: z.string().trim().max(12),
  timeZone: z.string().trim().max(60),
  defaultTaxBps: z.number().int().min(0).max(10000),
  slotMinutes: z.number().int().min(5).max(60),
  openMin: z.number().int().min(0).max(1440),
  closeMin: z.number().int().min(0).max(1440),
  reminderHoursBefore: z.number().int().min(1).max(168),
  cancellationWindowH: z.number().int().min(0).max(168),
  loyaltyPointsPerUnit: z.number().int().min(0).max(1000),
  loyaltyUnitMinor: z.number().int().min(1),
  loyaltyPointValueMinor: z.number().int().min(0),
})

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await authorize('settings:write')

    const input = settingsSchema.parse({
      name: str(formData, 'name'),
      legalName: str(formData, 'legalName'),
      taxNumber: str(formData, 'taxNumber'),
      phone: str(formData, 'phone'),
      email: str(formData, 'email'),
      address: str(formData, 'address'),
      currency: str(formData, 'currency') ?? 'TRY',
      currencySymbol: str(formData, 'currencySymbol') ?? '₺',
      locale: str(formData, 'locale') ?? 'tr-TR',
      timeZone: str(formData, 'timeZone') ?? 'Europe/Istanbul',
      defaultTaxBps: parseBps(str(formData, 'defaultTax')),
      slotMinutes: int(formData, 'slotMinutes') ?? 15,
      openMin: parseTimeToMinutes(str(formData, 'openTime') ?? '09:00'),
      closeMin: parseTimeToMinutes(str(formData, 'closeTime') ?? '20:00'),
      reminderHoursBefore: int(formData, 'reminderHoursBefore') ?? 24,
      cancellationWindowH: int(formData, 'cancellationWindowH') ?? 24,
      loyaltyPointsPerUnit: int(formData, 'loyaltyPointsPerUnit') ?? 1,
      loyaltyUnitMinor: parseMoney(str(formData, 'loyaltyUnit')) || 1,
      loyaltyPointValueMinor: parseMoney(str(formData, 'loyaltyPointValue')),
    })

    if (input.closeMin <= input.openMin) {
      return fail('Closing time must be after opening time.')
    }

    await prisma.clinicSetting.upsert({
      where: { id: 1 },
      update: input,
      create: { id: 1, ...input },
    })

    await recordAudit({
      userId: user.id,
      action: 'settings.update',
      entityType: 'ClinicSetting',
      entityId: '1',
      summary: 'Updated clinic settings',
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/settings')
  revalidatePath('/', 'layout')
  return succeed('Settings saved.')
}

export async function addRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await authorize('settings:write')
    const name = str(formData, 'name')
    if (!name) return fail('Give the room a name.')
    await prisma.room.create({ data: { name, capacity: int(formData, 'capacity') ?? 1 } })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/settings')
  return succeed('Room added.')
}

export async function toggleRoom(roomId: string, isActive: boolean): Promise<void> {
  await authorize('settings:write')
  await prisma.room.update({ where: { id: roomId }, data: { isActive } })
  revalidatePath('/settings')
}

export async function addTag(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await authorize('settings:write')
    const name = str(formData, 'name')
    if (!name) return fail('Give the tag a name.')
    await prisma.tag.create({
      data: { name, colorHex: str(formData, 'colorHex') ?? '#64748b' },
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/settings')
  return succeed('Tag added.')
}

export async function addServiceCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await authorize('settings:write')
    const name = str(formData, 'name')
    if (!name) return fail('Give the category a name.')
    await prisma.serviceCategory.create({
      data: { name, colorHex: str(formData, 'colorHex') ?? '#0ea5e9' },
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/settings')
  revalidatePath('/services')
  return succeed('Category added.')
}

export async function addSupplier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await authorize('settings:write')
    const name = str(formData, 'name')
    if (!name) return fail('Give the supplier a name.')
    await prisma.supplier.create({
      data: {
        name,
        contact: str(formData, 'contact') ?? null,
        phone: str(formData, 'phone') ?? null,
        email: str(formData, 'email') ?? null,
      },
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/settings')
  return succeed('Supplier added.')
}
