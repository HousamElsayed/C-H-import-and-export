'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorize } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { parseBps, parseMoney } from '@/lib/money'
import { bool, fail, int, list, str, succeed, toActionState, type ActionState } from '@/lib/forms'

const serviceSchema = z.object({
  name: z.string().trim().min(1, 'Give the service a name.').max(120),
  categoryId: z.string().min(1, 'Choose a category.'),
  description: z.string().trim().max(1000).optional(),
  durationMin: z.number().int().min(5, 'Minimum duration is 5 minutes.').max(600),
  bufferMin: z.number().int().min(0).max(120),
  priceMinor: z.number().int().min(0),
  costMinor: z.number().int().min(0),
  commissionBps: z.number().int().min(0).max(10000).nullable(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid colour.'),
  requiresPatchTest: z.boolean(),
  patchTestDays: z.number().int().min(0).max(60),
  requiresConsent: z.boolean(),
  consentTemplateId: z.string().optional(),
  aftercareNote: z.string().trim().max(2000).optional(),
  isOnlineBookable: z.boolean(),
  isActive: z.boolean(),
  staffIds: z.array(z.string()),
  roomIds: z.array(z.string()),
})

function readServiceForm(formData: FormData) {
  const commissionRaw = str(formData, 'commissionBps')
  return serviceSchema.parse({
    name: str(formData, 'name'),
    categoryId: str(formData, 'categoryId') ?? '',
    description: str(formData, 'description'),
    durationMin: int(formData, 'durationMin') ?? 0,
    bufferMin: int(formData, 'bufferMin') ?? 0,
    priceMinor: parseMoney(str(formData, 'price')),
    costMinor: parseMoney(str(formData, 'cost')),
    commissionBps: commissionRaw ? parseBps(commissionRaw) : null,
    colorHex: str(formData, 'colorHex') ?? '#0ea5e9',
    requiresPatchTest: bool(formData, 'requiresPatchTest'),
    patchTestDays: int(formData, 'patchTestDays') ?? 0,
    requiresConsent: bool(formData, 'requiresConsent'),
    consentTemplateId: str(formData, 'consentTemplateId'),
    aftercareNote: str(formData, 'aftercareNote'),
    isOnlineBookable: bool(formData, 'isOnlineBookable'),
    isActive: bool(formData, 'isActive'),
    staffIds: list(formData, 'staffIds'),
    roomIds: list(formData, 'roomIds'),
  })
}

/** Product usage rows arrive as parallel arrays from the repeatable row editor. */
function readUsageRows(formData: FormData) {
  const productIds = formData.getAll('usageProductId').map(String)
  const quantities = formData.getAll('usageQuantity').map(String)
  const rows: { productId: string; quantity: number }[] = []
  const seen = new Set<string>()

  for (const [index, productId] of productIds.entries()) {
    if (!productId || seen.has(productId)) continue
    const quantity = Number.parseFloat((quantities[index] ?? '').replace(',', '.'))
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    seen.add(productId)
    rows.push({ productId, quantity })
  }
  return rows
}

export async function createService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let serviceId: string
  try {
    const user = await authorize('catalog:write')
    const input = readServiceForm(formData)
    const usages = readUsageRows(formData)

    const service = await prisma.service.create({
      data: {
        name: input.name,
        categoryId: input.categoryId,
        description: input.description ?? null,
        durationMin: input.durationMin,
        bufferMin: input.bufferMin,
        priceMinor: input.priceMinor,
        costMinor: input.costMinor,
        commissionBps: input.commissionBps,
        colorHex: input.colorHex,
        requiresPatchTest: input.requiresPatchTest,
        patchTestDays: input.requiresPatchTest ? input.patchTestDays : 0,
        requiresConsent: input.requiresConsent,
        consentTemplateId: input.requiresConsent ? (input.consentTemplateId ?? null) : null,
        aftercareNote: input.aftercareNote ?? null,
        isOnlineBookable: input.isOnlineBookable,
        isActive: input.isActive,
        staff: { create: input.staffIds.map((userId) => ({ userId })) },
        rooms: { create: input.roomIds.map((roomId) => ({ roomId })) },
        productUsages: { create: usages },
      },
    })

    await recordAudit({
      userId: user.id,
      action: 'service.create',
      entityType: 'Service',
      entityId: service.id,
      summary: `Created service ${service.name}`,
    })
    serviceId = service.id
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/services')
  redirect(`/services/${serviceId}`)
}

export async function updateService(
  serviceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await authorize('catalog:write')
    const input = readServiceForm(formData)
    const usages = readUsageRows(formData)

    await prisma.$transaction(async (tx) => {
      await tx.serviceStaff.deleteMany({ where: { serviceId } })
      await tx.serviceRoom.deleteMany({ where: { serviceId } })
      await tx.serviceProductUsage.deleteMany({ where: { serviceId } })
      await tx.service.update({
        where: { id: serviceId },
        data: {
          name: input.name,
          categoryId: input.categoryId,
          description: input.description ?? null,
          durationMin: input.durationMin,
          bufferMin: input.bufferMin,
          priceMinor: input.priceMinor,
          costMinor: input.costMinor,
          commissionBps: input.commissionBps,
          colorHex: input.colorHex,
          requiresPatchTest: input.requiresPatchTest,
          patchTestDays: input.requiresPatchTest ? input.patchTestDays : 0,
          requiresConsent: input.requiresConsent,
          consentTemplateId: input.requiresConsent ? (input.consentTemplateId ?? null) : null,
          aftercareNote: input.aftercareNote ?? null,
          isOnlineBookable: input.isOnlineBookable,
          isActive: input.isActive,
          staff: { create: input.staffIds.map((userId) => ({ userId })) },
          rooms: { create: input.roomIds.map((roomId) => ({ roomId })) },
          productUsages: { create: usages },
        },
      })
    })

    await recordAudit({
      userId: user.id,
      action: 'service.update',
      entityType: 'Service',
      entityId: serviceId,
      summary: `Updated service ${input.name}`,
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/services')
  revalidatePath(`/services/${serviceId}`)
  return succeed('Service saved.')
}

export async function toggleServiceActive(serviceId: string, isActive: boolean) {
  await authorize('catalog:write')
  await prisma.service.update({ where: { id: serviceId }, data: { isActive } })
  revalidatePath('/services')
}

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await authorize('catalog:write')
    const name = str(formData, 'name')
    if (!name) return fail('Give the category a name.')

    await prisma.serviceCategory.create({
      data: { name, colorHex: str(formData, 'colorHex') ?? '#0ea5e9' },
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/services')
  return succeed('Category added.')
}
