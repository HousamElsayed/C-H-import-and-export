import { roundQty } from '@/lib/utils'
import type { Prisma } from '@/generated/prisma/client'
import type { StockMovementType } from '@/generated/prisma/enums'

export class StockError extends Error {}

/**
 * Single writer for stock. Every change to Product.stockQty goes through here
 * so the movement ledger and the balance can never drift apart.
 *
 * `quantity` is signed: negative takes stock out.
 */
export async function applyStockMovement(
  tx: Prisma.TransactionClient,
  params: {
    productId: string
    type: StockMovementType
    quantity: number
    unitCostMinor?: number
    reference?: string
    note?: string
    userId?: string
    appointmentId?: string
    invoiceId?: string
    consumptionBillId?: string
    stockCountId?: string
    allowNegative?: boolean
  },
) {
  const product = await tx.product.findUnique({
    where: { id: params.productId },
    select: { id: true, name: true, stockQty: true, costMinor: true, trackStock: true },
  })
  if (!product) throw new StockError('That product no longer exists.')

  const balanceAfter = roundQty(product.stockQty + params.quantity)
  if (!params.allowNegative && product.trackStock && balanceAfter < 0) {
    throw new StockError(
      `${product.name} only has ${product.stockQty} in stock — not enough for this movement.`,
    )
  }

  const unitCostMinor = params.unitCostMinor ?? product.costMinor

  await tx.product.update({ where: { id: product.id }, data: { stockQty: balanceAfter } })

  return tx.stockMovement.create({
    data: {
      productId: product.id,
      type: params.type,
      quantity: roundQty(params.quantity),
      balanceAfter,
      unitCostMinor,
      totalCostMinor: Math.round(unitCostMinor * Math.abs(params.quantity)),
      reference: params.reference ?? null,
      note: params.note ?? null,
      userId: params.userId ?? null,
      appointmentId: params.appointmentId ?? null,
      invoiceId: params.invoiceId ?? null,
      consumptionBillId: params.consumptionBillId ?? null,
      stockCountId: params.stockCountId ?? null,
    },
  })
}

/** Parallel-array rows from the repeatable line editors. */
export function readQuantityRows(
  formData: FormData,
  productField: string,
  quantityField: string,
  noteField?: string,
) {
  const productIds = formData.getAll(productField).map(String)
  const quantities = formData.getAll(quantityField).map(String)
  const notes = noteField ? formData.getAll(noteField).map(String) : []

  const rows: { productId: string; quantity: number; note?: string }[] = []
  for (const [index, productId] of productIds.entries()) {
    if (!productId) continue
    const quantity = Number.parseFloat((quantities[index] ?? '').replace(',', '.'))
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    rows.push({ productId, quantity, note: notes[index] || undefined })
  }
  return rows
}
