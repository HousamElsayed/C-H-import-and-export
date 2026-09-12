import { prisma } from '@/lib/prisma'
import { formatDate, formatTime } from '@/lib/dates'
import { renderTemplate, type TemplateTokens } from '@/lib/template-tokens'
import type { MessageChannel, MessagePurpose } from '@/generated/prisma/enums'

export { renderTemplate, TEMPLATE_TOKENS, type TemplateTokens } from '@/lib/template-tokens'

type SendResult = { ok: true; providerId: string } | { ok: false; error: string }

/**
 * Provider adapters. With no credentials configured the clinic runs in
 * simulated mode: messages are logged and marked sent, so the whole flow is
 * exercised without contacting a gateway or charging anyone.
 */
async function deliver(channel: MessageChannel, to: string, body: string, subject?: string): Promise<SendResult> {
  const provider =
    channel === 'EMAIL'
      ? process.env.EMAIL_PROVIDER
      : channel === 'WHATSAPP'
        ? process.env.WHATSAPP_PROVIDER
        : process.env.SMS_PROVIDER

  if (!provider) {
    console.info(`[messaging:simulated] ${channel} → ${to}${subject ? ` · ${subject}` : ''}\n${body}`)
    return { ok: true, providerId: `simulated-${Date.now()}` }
  }

  // Real gateways plug in here. Each returns the provider's message id.
  return { ok: false, error: `No adapter is implemented for provider "${provider}".` }
}

export async function queueMessage(params: {
  channel: MessageChannel
  purpose: MessagePurpose
  to: string
  body: string
  subject?: string
  clientId?: string
  appointmentId?: string
  campaignId?: string
  templateId?: string
  scheduledFor?: Date
}) {
  return prisma.messageLog.create({
    data: {
      channel: params.channel,
      purpose: params.purpose,
      toAddress: params.to,
      body: params.body,
      subject: params.subject ?? null,
      clientId: params.clientId ?? null,
      appointmentId: params.appointmentId ?? null,
      campaignId: params.campaignId ?? null,
      templateId: params.templateId ?? null,
      scheduledFor: params.scheduledFor ?? null,
      status: 'QUEUED',
    },
  })
}

/** Sends everything queued and due. Safe to call repeatedly. */
export async function flushQueue(limit = 100) {
  const due = await prisma.messageLog.findMany({
    where: {
      status: 'QUEUED',
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  let sent = 0
  let failed = 0

  for (const message of due) {
    await prisma.messageLog.update({ where: { id: message.id }, data: { status: 'SENDING' } })
    const result = await deliver(message.channel, message.toAddress, message.body, message.subject ?? undefined)

    if (result.ok) {
      sent += 1
      await prisma.messageLog.update({
        where: { id: message.id },
        data: { status: 'SENT', sentAt: new Date(), providerId: result.providerId },
      })
    } else {
      failed += 1
      await prisma.messageLog.update({
        where: { id: message.id },
        data: { status: 'FAILED', error: result.error },
      })
    }
  }

  return { sent, failed, considered: due.length }
}

function channelAddress(
  channel: MessageChannel,
  client: { phone: string; email: string | null },
) {
  return channel === 'EMAIL' ? client.email : client.phone
}

/**
 * Queues appointment reminders for bookings inside the reminder window.
 * Reminders are transactional, so they ignore marketing opt-in — but they
 * still need a usable address for the channel.
 */
export async function queueAppointmentReminders() {
  const settings = await prisma.clinicSetting.findUnique({ where: { id: 1 } })
  if (!settings) return { queued: 0 }

  const now = new Date()
  const windowEnd = new Date(now.getTime() + settings.reminderHoursBefore * 60 * 60 * 1000)

  const template = await prisma.messageTemplate.findFirst({
    where: { purpose: 'APPOINTMENT_REMINDER', isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  const appointments = await prisma.appointment.findMany({
    where: {
      startAt: { gt: now, lte: windowEnd },
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      reminderSentAt: null,
    },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      staff: { select: { firstName: true, lastName: true } },
      services: { include: { service: { select: { name: true } } }, orderBy: { sortOrder: 'asc' } },
    },
    take: 200,
  })

  let queued = 0

  for (const appointment of appointments) {
    const channel: MessageChannel = template?.channel ?? 'SMS'
    const to = channelAddress(channel, appointment.client)
    if (!to) continue

    const tokens: TemplateTokens = {
      client_first_name: appointment.client.firstName,
      client_last_name: appointment.client.lastName,
      clinic_name: settings.name,
      clinic_phone: settings.phone ?? '',
      service_name: appointment.services.map((item) => item.service.name).join(', '),
      staff_name: `${appointment.staff.firstName} ${appointment.staff.lastName}`,
      date: formatDate(appointment.startAt, settings.locale),
      time: formatTime(appointment.startAt, settings.locale),
    }

    const body = template
      ? renderTemplate(template.body, tokens)
      : `Reminder: ${tokens.service_name} at ${settings.name} on ${tokens.date} at ${tokens.time}.`

    await queueMessage({
      channel,
      purpose: 'APPOINTMENT_REMINDER',
      to,
      body,
      subject: template?.subject ?? undefined,
      clientId: appointment.client.id,
      appointmentId: appointment.id,
      templateId: template?.id,
    })

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { reminderSentAt: new Date() },
    })
    queued += 1
  }

  return { queued }
}

export type AudienceFilter = {
  tagIds?: string[]
  notVisitedForDays?: number
  minSpendMinor?: number
  birthdayMonth?: number
  status?: string
}

/** Resolves a campaign's audience, respecting marketing consent per channel. */
export async function resolveAudience(filter: AudienceFilter, channel: MessageChannel) {
  const where: Record<string, unknown> = { isDeleted: false }

  if (filter.status) where.status = filter.status
  if (filter.tagIds && filter.tagIds.length > 0) {
    where.tags = { some: { tagId: { in: filter.tagIds } } }
  }
  if (filter.notVisitedForDays) {
    const cutoff = new Date(Date.now() - filter.notVisitedForDays * 24 * 60 * 60 * 1000)
    where.OR = [{ lastVisitAt: { lt: cutoff } }, { lastVisitAt: null }]
  }
  if (filter.minSpendMinor) where.totalSpentMinor = { gte: filter.minSpendMinor }

  if (channel === 'EMAIL') {
    where.marketingEmail = true
    where.email = { not: null }
  } else if (channel === 'WHATSAPP') {
    where.marketingWhatsapp = true
  } else {
    where.marketingSms = true
  }

  const clients = await prisma.client.findMany({
    where: where as never,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      birthDate: true,
    },
  })

  if (filter.birthdayMonth) {
    return clients.filter(
      (client) => client.birthDate && client.birthDate.getMonth() + 1 === filter.birthdayMonth,
    )
  }

  return clients
}
