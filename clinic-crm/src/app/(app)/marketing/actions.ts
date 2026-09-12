'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { authorize } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { getSettings } from '@/lib/settings'
import { parseMoney } from '@/lib/money'
import { flushQueue, queueMessage, renderTemplate, resolveAudience, type AudienceFilter } from '@/lib/messaging'
import { bool, fail, int, list, str, succeed, toActionState, type ActionState } from '@/lib/forms'
import type { MessageChannel } from '@/generated/prisma/enums'

const CHANNELS: MessageChannel[] = ['SMS', 'EMAIL', 'WHATSAPP']

export async function previewAudience(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await authorize('marketing:read')
    const channel = CHANNELS.find((candidate) => candidate === str(formData, 'channel')) ?? 'SMS'
    const audience = await resolveAudience(readFilter(formData), channel)
    return succeed(`${audience.length} clients match and have opted in to ${channel.toLowerCase()}.`)
  } catch (error) {
    return toActionState(error)
  }
}

function readFilter(formData: FormData): AudienceFilter {
  return {
    tagIds: list(formData, 'tagIds'),
    notVisitedForDays: int(formData, 'notVisitedForDays'),
    minSpendMinor: str(formData, 'minSpend') ? parseMoney(str(formData, 'minSpend')) : undefined,
    birthdayMonth: int(formData, 'birthdayMonth'),
    status: str(formData, 'status'),
  }
}

export async function createCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let campaignId: string
  try {
    const user = await authorize('marketing:write')
    const settings = await getSettings()

    const name = str(formData, 'name')
    if (!name) return fail('Give the campaign a name.')

    const channel = CHANNELS.find((candidate) => candidate === str(formData, 'channel')) ?? 'SMS'
    const templateId = str(formData, 'templateId')
    const customBody = str(formData, 'body')

    const template = templateId
      ? await prisma.messageTemplate.findUnique({ where: { id: templateId } })
      : null
    const bodyTemplate = customBody ?? template?.body
    if (!bodyTemplate) return fail('Choose a template or write a message.')

    const filter = readFilter(formData)
    const audience = await resolveAudience(filter, channel)
    if (audience.length === 0) return fail('No clients match that audience.')

    const sendNow = bool(formData, 'sendNow')

    const campaign = await prisma.campaign.create({
      data: {
        name,
        channel,
        templateId: template?.id ?? null,
        status: sendNow ? 'RUNNING' : 'DRAFT',
        filter: filter as never,
        startedAt: sendNow ? new Date() : null,
        recipients: {
          create: audience.map((client) => ({ clientId: client.id })),
        },
      },
    })

    if (sendNow) {
      for (const client of audience) {
        const to = channel === 'EMAIL' ? client.email : client.phone
        if (!to) continue
        await queueMessage({
          channel,
          purpose: 'CAMPAIGN',
          to,
          subject: template?.subject ?? str(formData, 'subject'),
          body: renderTemplate(bodyTemplate, {
            client_first_name: client.firstName,
            client_last_name: client.lastName,
            clinic_name: settings.name,
            clinic_phone: settings.phone ?? '',
          }),
          clientId: client.id,
          campaignId: campaign.id,
          templateId: template?.id,
        })
      }

      await prisma.campaignRecipient.updateMany({
        where: { campaignId: campaign.id },
        data: { isSent: true },
      })
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
      await flushQueue(500)
    }

    await recordAudit({
      userId: user.id,
      action: 'campaign.create',
      entityType: 'Campaign',
      entityId: campaign.id,
      summary: `${sendNow ? 'Sent' : 'Drafted'} campaign "${name}" to ${audience.length} clients`,
    })
    campaignId = campaign.id
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/marketing')
  revalidatePath('/messages')
  redirect(`/marketing/${campaignId}`)
}

export async function saveTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await authorize('marketing:write')
    const id = str(formData, 'id')
    const name = str(formData, 'name')
    const body = str(formData, 'body')
    if (!name || !body) return fail('A name and a message body are required.')

    const channel = CHANNELS.find((candidate) => candidate === str(formData, 'channel')) ?? 'SMS'
    const purpose = str(formData, 'purpose') ?? 'CAMPAIGN'

    const data = {
      name,
      body,
      channel,
      purpose: purpose as never,
      subject: str(formData, 'subject') ?? null,
      isActive: bool(formData, 'isActive'),
    }

    if (id) await prisma.messageTemplate.update({ where: { id }, data })
    else await prisma.messageTemplate.create({ data })

    await recordAudit({
      userId: user.id,
      action: id ? 'template.update' : 'template.create',
      entityType: 'MessageTemplate',
      entityId: id ?? null,
      summary: `Saved template "${name}"`,
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/marketing/templates')
  return succeed('Template saved.')
}

export async function runQueue(): Promise<void> {
  await authorize('marketing:write')
  await flushQueue(200)
  revalidatePath('/messages')
}
