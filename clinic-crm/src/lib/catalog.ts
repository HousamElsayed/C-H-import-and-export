import { prisma } from '@/lib/prisma'

/** Option lists shared by the service create and edit forms. */
export async function loadServiceFormOptions() {
  const [categories, staff, rooms, products, consentTemplates] = await Promise.all([
    prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, colorHex: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, isBookable: true },
      orderBy: [{ firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, title: true },
    }),
    prisma.room.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, sku: true, unit: true },
    }),
    prisma.consentTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  return { categories, staff, rooms, products, consentTemplates }
}
