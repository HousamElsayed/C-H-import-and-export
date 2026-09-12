import type { Prisma } from '@/generated/prisma/client'

type Tx = Prisma.TransactionClient

/**
 * Allocates the next document number for a prefix within the current year.
 * Must run inside a transaction so concurrent checkouts cannot collide.
 */
export async function nextDocumentNumber(tx: Tx, prefix: string, date = new Date()) {
  const year = date.getFullYear()
  const sequence = await tx.documentSequence.upsert({
    where: { prefix_year: { prefix, year } },
    create: { prefix, year, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  })
  return `${prefix}-${year}-${String(sequence.value).padStart(6, '0')}`
}
