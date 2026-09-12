'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorize } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { parseMoney } from '@/lib/money'
import { bool, int, str, succeed, toActionState, type ActionState } from '@/lib/forms'

const packageSchema = z.object({
  name: z.string().trim().min(1, 'Give the package a name.').max(120),
  description: z.string().trim().max(1000).optional(),
  priceMinor: z.number().int().min(0),
  validityDays: z.number().int().min(1).max(3650),
  isActive: z.boolean(),
  items: z
    .array(z.object({ serviceId: z.string().min(1), quantity: z.number().int().min(1) }))
    .min(1, 'Add at least one service to the package.'),
})

function readPackageForm(formData: FormData) {
  const serviceIds = formData.getAll('itemServiceId').map(String)
  const quantities = formData.getAll('itemQuantity').map(String)
  const items: { serviceId: string; quantity: number }[] = []
  const seen = new Set<string>()

  for (const [index, serviceId] of serviceIds.entries()) {
    if (!serviceId || seen.has(serviceId)) continue
    const quantity = Number.parseInt(quantities[index] ?? '', 10)
    if (!Number.isFinite(quantity) || quantity < 1) continue
    seen.add(serviceId)
    items.push({ serviceId, quantity })
  }

  return packageSchema.parse({
    name: str(formData, 'name'),
    description: str(formData, 'description'),
    priceMinor: parseMoney(str(formData, 'price')),
    validityDays: int(formData, 'validityDays') ?? 365,
    isActive: bool(formData, 'isActive'),
    items,
  })
}

export async function createPackage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let packageId: string
  try {
    const user = await authorize('catalog:write')
    const input = readPackageForm(formData)

    const created = await prisma.package.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        priceMinor: input.priceMinor,
        validityDays: input.validityDays,
        isActive: input.isActive,
        items: { create: input.items },
      },
    })

    await recordAudit({
      userId: user.id,
      action: 'package.create',
      entityType: 'Package',
      entityId: created.id,
      summary: `Created package ${created.name}`,
    })
    packageId = created.id
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/packages')
  redirect(`/packages/${packageId}`)
}

export async function updatePackage(
  packageId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await authorize('catalog:write')
    const input = readPackageForm(formData)

    await prisma.$transaction(async (tx) => {
      await tx.packageItem.deleteMany({ where: { packageId } })
      await tx.package.update({
        where: { id: packageId },
        data: {
          name: input.name,
          description: input.description ?? null,
          priceMinor: input.priceMinor,
          validityDays: input.validityDays,
          isActive: input.isActive,
          items: { create: input.items },
        },
      })
    })

    await recordAudit({
      userId: user.id,
      action: 'package.update',
      entityType: 'Package',
      entityId: packageId,
      summary: `Updated package ${input.name}`,
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/packages')
  revalidatePath(`/packages/${packageId}`)
  return succeed('Package saved.')
}
