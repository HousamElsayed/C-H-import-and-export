import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

export async function recordAudit(params: {
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  summary?: string
  metadata?: Prisma.InputJsonValue
}) {
  let ipAddress: string | undefined
  try {
    const h = await headers()
    ipAddress = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
  } catch {
    ipAddress = undefined
  }

  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      summary: params.summary,
      metadata: params.metadata,
      ipAddress,
    },
  })
}
