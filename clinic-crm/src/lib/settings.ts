import { cache } from 'react'
import { prisma } from '@/lib/prisma'

export const getSettings = cache(async () => {
  const existing = await prisma.clinicSetting.findUnique({ where: { id: 1 } })
  if (existing) return existing
  return prisma.clinicSetting.create({ data: { id: 1 } })
})

export type ClinicSettings = Awaited<ReturnType<typeof getSettings>>
