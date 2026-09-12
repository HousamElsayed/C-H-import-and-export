'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorize } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { nextDocumentNumber } from '@/lib/numbering'
import { normalisePhone } from '@/lib/utils'
import { bool, date, fail, list, str, succeed, toActionState, zodFail, type ActionState } from '@/lib/forms'

const clientSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(60),
  lastName: z.string().trim().min(1, 'Last name is required.').max(60),
  phone: z.string().trim().min(6, 'A contact phone number is required.').max(30),
  email: z.email('Enter a valid email address.').optional(),
  birthDate: z.date().optional(),
  gender: z.enum(['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED']),
  status: z.enum(['LEAD', 'ACTIVE', 'DORMANT', 'BLOCKED']),
  source: z.enum(['WALK_IN', 'PHONE', 'WHATSAPP', 'INSTAGRAM', 'WEBSITE', 'REFERRAL', 'OTHER']),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(80).optional(),
  occupation: z.string().trim().max(80).optional(),
  skinType: z.string().trim().max(60).optional(),
  allergies: z.string().trim().max(1000).optional(),
  medications: z.string().trim().max(1000).optional(),
  medicalNotes: z.string().trim().max(2000).optional(),
  preferences: z.string().trim().max(1000).optional(),
  internalNotes: z.string().trim().max(2000).optional(),
  referredById: z.string().optional(),
  marketingSms: z.boolean(),
  marketingEmail: z.boolean(),
  marketingWhatsapp: z.boolean(),
  kvkkConsent: z.boolean(),
  tagIds: z.array(z.string()),
})

function readClientForm(formData: FormData) {
  return clientSchema.parse({
    firstName: str(formData, 'firstName'),
    lastName: str(formData, 'lastName'),
    phone: str(formData, 'phone'),
    email: str(formData, 'email'),
    birthDate: date(formData, 'birthDate'),
    gender: str(formData, 'gender') ?? 'UNDISCLOSED',
    status: str(formData, 'status') ?? 'ACTIVE',
    source: str(formData, 'source') ?? 'WALK_IN',
    address: str(formData, 'address'),
    city: str(formData, 'city'),
    occupation: str(formData, 'occupation'),
    skinType: str(formData, 'skinType'),
    allergies: str(formData, 'allergies'),
    medications: str(formData, 'medications'),
    medicalNotes: str(formData, 'medicalNotes'),
    preferences: str(formData, 'preferences'),
    internalNotes: str(formData, 'internalNotes'),
    referredById: str(formData, 'referredById'),
    marketingSms: bool(formData, 'marketingSms'),
    marketingEmail: bool(formData, 'marketingEmail'),
    marketingWhatsapp: bool(formData, 'marketingWhatsapp'),
    kvkkConsent: bool(formData, 'kvkkConsent'),
    tagIds: list(formData, 'tagIds'),
  })
}

export async function createClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let clientId: string
  try {
    const user = await authorize('clients:write')
    const input = readClientForm(formData)
    const phone = normalisePhone(input.phone)

    const duplicate = await prisma.client.findUnique({ where: { phone }, select: { id: true } })
    if (duplicate) {
      return fail('A client with this phone number already exists.', { phone: 'Already in use.' })
    }

    const client = await prisma.$transaction(async (tx) => {
      const code = await nextDocumentNumber(tx, 'C')
      return tx.client.create({
        data: {
          code,
          firstName: input.firstName,
          lastName: input.lastName,
          phone,
          email: input.email ?? null,
          birthDate: input.birthDate ?? null,
          gender: input.gender,
          status: input.status,
          source: input.source,
          address: input.address ?? null,
          city: input.city ?? null,
          occupation: input.occupation ?? null,
          skinType: input.skinType ?? null,
          allergies: input.allergies ?? null,
          medications: input.medications ?? null,
          medicalNotes: input.medicalNotes ?? null,
          preferences: input.preferences ?? null,
          internalNotes: input.internalNotes ?? null,
          referredById: input.referredById ?? null,
          marketingSms: input.marketingSms,
          marketingEmail: input.marketingEmail,
          marketingWhatsapp: input.marketingWhatsapp,
          kvkkConsentAt: input.kvkkConsent ? new Date() : null,
          tags: { create: input.tagIds.map((tagId) => ({ tagId })) },
        },
      })
    })

    await recordAudit({
      userId: user.id,
      action: 'client.create',
      entityType: 'Client',
      entityId: client.id,
      summary: `Created client ${client.firstName} ${client.lastName}`,
    })

    clientId = client.id
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/clients')
  redirect(`/clients/${clientId}`)
}

export async function updateClient(
  clientId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await authorize('clients:write')
    const input = readClientForm(formData)
    const phone = normalisePhone(input.phone)

    const duplicate = await prisma.client.findFirst({
      where: { phone, id: { not: clientId } },
      select: { id: true },
    })
    if (duplicate) {
      return fail('Another client already uses this phone number.', { phone: 'Already in use.' })
    }

    const existing = await prisma.client.findUnique({
      where: { id: clientId },
      select: { kvkkConsentAt: true },
    })

    await prisma.$transaction(async (tx) => {
      await tx.clientTag.deleteMany({ where: { clientId } })
      await tx.client.update({
        where: { id: clientId },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone,
          email: input.email ?? null,
          birthDate: input.birthDate ?? null,
          gender: input.gender,
          status: input.status,
          source: input.source,
          address: input.address ?? null,
          city: input.city ?? null,
          occupation: input.occupation ?? null,
          skinType: input.skinType ?? null,
          allergies: input.allergies ?? null,
          medications: input.medications ?? null,
          medicalNotes: input.medicalNotes ?? null,
          preferences: input.preferences ?? null,
          internalNotes: input.internalNotes ?? null,
          referredById: input.referredById ?? null,
          marketingSms: input.marketingSms,
          marketingEmail: input.marketingEmail,
          marketingWhatsapp: input.marketingWhatsapp,
          kvkkConsentAt: input.kvkkConsent ? (existing?.kvkkConsentAt ?? new Date()) : null,
          tags: { create: input.tagIds.map((tagId) => ({ tagId })) },
        },
      })
    })

    await recordAudit({
      userId: user.id,
      action: 'client.update',
      entityType: 'Client',
      entityId: clientId,
      summary: `Updated client ${input.firstName} ${input.lastName}`,
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${clientId}`)
  return succeed('Client details saved.')
}

export async function addClientNote(
  clientId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await authorize('clients:write')
    const body = str(formData, 'body')
    if (!body) return fail('Write something before saving the note.')

    const isClinical = bool(formData, 'isClinical')
    if (isClinical) await authorize('clients:clinical')

    await prisma.clientNote.create({
      data: {
        clientId,
        authorId: user.id,
        body,
        isClinical,
        isPinned: bool(formData, 'isPinned'),
      },
    })

    await recordAudit({
      userId: user.id,
      action: 'client.note_added',
      entityType: 'Client',
      entityId: clientId,
      summary: isClinical ? 'Added clinical note' : 'Added note',
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath(`/clients/${clientId}`)
  return succeed('Note added.')
}

export async function deleteClientNote(noteId: string, clientId: string) {
  await authorize('clients:write')
  await prisma.clientNote.delete({ where: { id: noteId } })
  revalidatePath(`/clients/${clientId}`)
}

export async function archiveClient(clientId: string): Promise<void> {
  const user = await authorize('clients:delete')
  await prisma.client.update({ where: { id: clientId }, data: { isDeleted: true, status: 'BLOCKED' } })
  await recordAudit({
    userId: user.id,
    action: 'client.archive',
    entityType: 'Client',
    entityId: clientId,
    summary: 'Archived client record',
  })
  revalidatePath('/clients')
  redirect('/clients')
}

export async function adjustLoyaltyPoints(
  clientId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await authorize('clients:write')
    const raw = str(formData, 'points')
    const points = raw ? Number.parseInt(raw, 10) : Number.NaN
    if (Number.isNaN(points) || points === 0) return fail('Enter a non-zero number of points.')

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { loyaltyPoints: true },
    })
    if (!client) return fail('Client not found.')
    if (client.loyaltyPoints + points < 0) return fail('That would take the balance below zero.')

    await prisma.$transaction([
      prisma.loyaltyEntry.create({
        data: {
          clientId,
          points,
          reason: 'MANUAL_ADJUSTMENT',
          note: str(formData, 'note') ?? null,
        },
      }),
      prisma.client.update({
        where: { id: clientId },
        data: { loyaltyPoints: { increment: points } },
      }),
    ])

    await recordAudit({
      userId: user.id,
      action: 'client.loyalty_adjust',
      entityType: 'Client',
      entityId: clientId,
      summary: `Adjusted loyalty points by ${points}`,
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath(`/clients/${clientId}`)
  return succeed('Loyalty balance updated.')
}
