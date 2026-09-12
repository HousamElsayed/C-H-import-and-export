'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorize } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { nextDocumentNumber } from '@/lib/numbering'
import { parseMoney } from '@/lib/money'
import { applyStockMovement, readQuantityRows, StockError } from '@/lib/inventory'
import { bool, date, fail, num, str, succeed, toActionState, type ActionState } from '@/lib/forms'
import type { StockMovementType } from '@/generated/prisma/enums'

const productSchema = z.object({
  sku: z.string().trim().min(1, 'An SKU is required.').max(40),
  name: z.string().trim().min(1, 'A name is required.').max(160),
  brand: z.string().trim().max(80).optional(),
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
  type: z.enum(['RETAIL', 'PROFESSIONAL', 'BOTH']),
  unit: z.string().trim().min(1).max(20),
  costMinor: z.number().int().min(0),
  retailMinor: z.number().int().min(0),
  reorderLevel: z.number().min(0),
  reorderQty: z.number().min(0),
  trackStock: z.boolean(),
  isActive: z.boolean(),
  location: z.string().trim().max(80).optional(),
  barcode: z.string().trim().max(60).optional(),
  expiresAt: z.date().optional(),
  notes: z.string().trim().max(1000).optional(),
})

function readProductForm(formData: FormData) {
  return productSchema.parse({
    sku: str(formData, 'sku'),
    name: str(formData, 'name'),
    brand: str(formData, 'brand'),
    categoryId: str(formData, 'categoryId'),
    supplierId: str(formData, 'supplierId'),
    type: str(formData, 'type') ?? 'PROFESSIONAL',
    unit: str(formData, 'unit') ?? 'pcs',
    costMinor: parseMoney(str(formData, 'cost')),
    retailMinor: parseMoney(str(formData, 'retail')),
    reorderLevel: num(formData, 'reorderLevel') ?? 0,
    reorderQty: num(formData, 'reorderQty') ?? 0,
    trackStock: bool(formData, 'trackStock'),
    isActive: bool(formData, 'isActive'),
    location: str(formData, 'location'),
    barcode: str(formData, 'barcode'),
    expiresAt: date(formData, 'expiresAt'),
    notes: str(formData, 'notes'),
  })
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let productId: string
  try {
    const user = await authorize('inventory:write')
    const input = readProductForm(formData)
    const openingQty = num(formData, 'openingQty') ?? 0

    const duplicate = await prisma.product.findUnique({ where: { sku: input.sku }, select: { id: true } })
    if (duplicate) return fail('That SKU is already in use.', { sku: 'Already in use.' })

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sku: input.sku,
          name: input.name,
          brand: input.brand ?? null,
          categoryId: input.categoryId ?? null,
          supplierId: input.supplierId ?? null,
          type: input.type,
          unit: input.unit,
          costMinor: input.costMinor,
          retailMinor: input.retailMinor,
          reorderLevel: input.reorderLevel,
          reorderQty: input.reorderQty,
          trackStock: input.trackStock,
          isActive: input.isActive,
          location: input.location ?? null,
          barcode: input.barcode ?? null,
          expiresAt: input.expiresAt ?? null,
          notes: input.notes ?? null,
          stockQty: 0,
        },
      })

      if (openingQty > 0) {
        await applyStockMovement(tx, {
          productId: created.id,
          type: 'PURCHASE',
          quantity: openingQty,
          unitCostMinor: input.costMinor,
          reference: 'Opening balance',
          userId: user.id,
        })
      }

      return created
    })

    await recordAudit({
      userId: user.id,
      action: 'product.create',
      entityType: 'Product',
      entityId: product.id,
      summary: `Added product ${product.name}`,
    })
    productId = product.id
  } catch (error) {
    if (error instanceof StockError) return fail(error.message)
    return toActionState(error)
  }

  revalidatePath('/inventory/products')
  redirect(`/inventory/products/${productId}`)
}

export async function updateProduct(
  productId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await authorize('inventory:write')
    const input = readProductForm(formData)

    const duplicate = await prisma.product.findFirst({
      where: { sku: input.sku, id: { not: productId } },
      select: { id: true },
    })
    if (duplicate) return fail('That SKU is already in use.', { sku: 'Already in use.' })

    await prisma.product.update({
      where: { id: productId },
      data: {
        sku: input.sku,
        name: input.name,
        brand: input.brand ?? null,
        categoryId: input.categoryId ?? null,
        supplierId: input.supplierId ?? null,
        type: input.type,
        unit: input.unit,
        costMinor: input.costMinor,
        retailMinor: input.retailMinor,
        reorderLevel: input.reorderLevel,
        reorderQty: input.reorderQty,
        trackStock: input.trackStock,
        isActive: input.isActive,
        location: input.location ?? null,
        barcode: input.barcode ?? null,
        expiresAt: input.expiresAt ?? null,
        notes: input.notes ?? null,
      },
    })

    await recordAudit({
      userId: user.id,
      action: 'product.update',
      entityType: 'Product',
      entityId: productId,
      summary: `Updated product ${input.name}`,
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath('/inventory/products')
  revalidatePath(`/inventory/products/${productId}`)
  return succeed('Product saved.')
}

const MOVEMENT_TYPES: StockMovementType[] = [
  'PURCHASE', 'ADJUSTMENT', 'WASTAGE', 'EXPIRY', 'RETURN_TO_SUPPLIER', 'CUSTOMER_RETURN',
]

export async function adjustStock(
  productId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await authorize('inventory:write')
    const type = MOVEMENT_TYPES.find((candidate) => candidate === str(formData, 'type'))
    if (!type) return fail('Choose a movement type.')

    const quantity = num(formData, 'quantity')
    if (quantity === undefined || quantity === 0) return fail('Enter a quantity.')

    // Stock-in types add; everything else takes stock out.
    const adds = type === 'PURCHASE' || type === 'CUSTOMER_RETURN'
    const signed = adds ? Math.abs(quantity) : -Math.abs(quantity)

    await prisma.$transaction(async (tx) => {
      await applyStockMovement(tx, {
        productId,
        type,
        quantity: type === 'ADJUSTMENT' ? quantity : signed,
        unitCostMinor: str(formData, 'unitCost') ? parseMoney(str(formData, 'unitCost')) : undefined,
        reference: str(formData, 'reference'),
        note: str(formData, 'note'),
        userId: user.id,
        allowNegative: type === 'ADJUSTMENT',
      })

      if (type === 'PURCHASE' && str(formData, 'unitCost')) {
        await tx.product.update({
          where: { id: productId },
          data: { costMinor: parseMoney(str(formData, 'unitCost')) },
        })
      }
    })

    await recordAudit({
      userId: user.id,
      action: 'stock.movement',
      entityType: 'Product',
      entityId: productId,
      summary: `${type.toLowerCase().replace(/_/g, ' ')} of ${quantity}`,
    })
  } catch (error) {
    if (error instanceof StockError) return fail(error.message)
    return toActionState(error)
  }

  revalidatePath('/inventory')
  revalidatePath(`/inventory/products/${productId}`)
  revalidatePath('/inventory/movements')
  return succeed('Stock updated.')
}

/**
 * Internal consumption bill: an itemised, costed document for products used
 * inside the clinic. Issuing it posts the stock out; it is never revenue.
 */
export async function createConsumptionBill(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let billId: string
  try {
    const user = await authorize('inventory:consume')
    const rows = readQuantityRows(formData, 'itemProductId', 'itemQuantity', 'itemNote')
    if (rows.length === 0) return fail('Add at least one product.')

    const issue = bool(formData, 'issueNow')
    const billDate = date(formData, 'billDate') ?? new Date()

    const products = await prisma.product.findMany({
      where: { id: { in: rows.map((row) => row.productId) } },
      select: { id: true, costMinor: true },
    })
    const costById = new Map(products.map((product) => [product.id, product.costMinor]))

    const items = rows.map((row) => {
      const unitCostMinor = costById.get(row.productId) ?? 0
      return {
        productId: row.productId,
        quantity: row.quantity,
        unitCostMinor,
        totalCostMinor: Math.round(unitCostMinor * row.quantity),
        note: row.note ?? null,
      }
    })
    const totalCostMinor = items.reduce((sum, item) => sum + item.totalCostMinor, 0)

    const bill = await prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, 'USE', billDate)
      const created = await tx.consumptionBill.create({
        data: {
          number,
          status: issue ? 'ISSUED' : 'DRAFT',
          billDate,
          issuedAt: issue ? new Date() : null,
          costCenter: str(formData, 'costCenter') ?? null,
          staffId: str(formData, 'staffId') ?? null,
          roomId: str(formData, 'roomId') ?? null,
          appointmentId: str(formData, 'appointmentId') ?? null,
          reason: str(formData, 'reason') ?? null,
          notes: str(formData, 'notes') ?? null,
          totalCostMinor,
          createdById: user.id,
          items: { create: items },
        },
      })

      if (issue) {
        for (const item of items) {
          await applyStockMovement(tx, {
            productId: item.productId,
            type: 'INTERNAL_USE',
            quantity: -item.quantity,
            unitCostMinor: item.unitCostMinor,
            reference: created.number,
            consumptionBillId: created.id,
            userId: user.id,
          })
        }
      }

      return created
    })

    await recordAudit({
      userId: user.id,
      action: issue ? 'consumption.issue' : 'consumption.draft',
      entityType: 'ConsumptionBill',
      entityId: bill.id,
      summary: `${issue ? 'Issued' : 'Drafted'} usage bill ${bill.number}`,
    })
    billId = bill.id
  } catch (error) {
    if (error instanceof StockError) return fail(error.message)
    return toActionState(error)
  }

  revalidatePath('/inventory/consumption')
  revalidatePath('/inventory')
  redirect(`/inventory/consumption/${billId}`)
}

export async function issueConsumptionBill(billId: string, _formData: FormData): Promise<void> {
  const user = await authorize('inventory:consume')

  const bill = await prisma.consumptionBill.findUnique({
    where: { id: billId },
    include: { items: true },
  })
  if (!bill) throw new Error('Usage bill not found.')
  if (bill.status !== 'DRAFT') throw new Error('Only a draft can be issued.')

  await prisma.$transaction(async (tx) => {
    for (const item of bill.items) {
      await applyStockMovement(tx, {
        productId: item.productId,
        type: 'INTERNAL_USE',
        quantity: -item.quantity,
        unitCostMinor: item.unitCostMinor,
        reference: bill.number,
        consumptionBillId: bill.id,
        userId: user.id,
      })
    }
    await tx.consumptionBill.update({
      where: { id: bill.id },
      data: { status: 'ISSUED', issuedAt: new Date() },
    })
  })

  await recordAudit({
    userId: user.id,
    action: 'consumption.issue',
    entityType: 'ConsumptionBill',
    entityId: bill.id,
    summary: `Issued usage bill ${bill.number}`,
  })

  revalidatePath('/inventory/consumption')
  revalidatePath(`/inventory/consumption/${bill.id}`)
  revalidatePath('/inventory')
}

export async function cancelConsumptionBill(billId: string, _formData: FormData): Promise<void> {
  const user = await authorize('inventory:consume')

  const bill = await prisma.consumptionBill.findUnique({
    where: { id: billId },
    include: { items: true },
  })
  if (!bill) throw new Error('Usage bill not found.')
  if (bill.status === 'CANCELLED') return

  await prisma.$transaction(async (tx) => {
    // An issued bill already took stock out, so cancelling must put it back.
    if (bill.status === 'ISSUED') {
      for (const item of bill.items) {
        await applyStockMovement(tx, {
          productId: item.productId,
          type: 'ADJUSTMENT',
          quantity: item.quantity,
          unitCostMinor: item.unitCostMinor,
          reference: bill.number,
          note: 'Usage bill cancelled',
          consumptionBillId: bill.id,
          userId: user.id,
        })
      }
    }
    await tx.consumptionBill.update({ where: { id: bill.id }, data: { status: 'CANCELLED' } })
  })

  await recordAudit({
    userId: user.id,
    action: 'consumption.cancel',
    entityType: 'ConsumptionBill',
    entityId: bill.id,
    summary: `Cancelled usage bill ${bill.number}`,
  })

  revalidatePath('/inventory/consumption')
  revalidatePath(`/inventory/consumption/${bill.id}`)
  revalidatePath('/inventory')
}

export async function createStockCount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let countId: string
  try {
    const user = await authorize('inventory:write')
    const productIds = formData.getAll('countProductId').map(String)
    const counted = formData.getAll('countedQty').map(String)

    const products = await prisma.product.findMany({
      where: { id: { in: productIds.filter(Boolean) } },
      select: { id: true, stockQty: true, costMinor: true },
    })
    const expectedById = new Map(products.map((product) => [product.id, product.stockQty]))

    const items = productIds
      .map((productId, index) => {
        if (!productId) return null
        const raw = counted[index]
        if (raw === undefined || raw === '') return null
        const countedQty = Number.parseFloat(raw.replace(',', '.'))
        if (!Number.isFinite(countedQty)) return null
        const expectedQty = expectedById.get(productId) ?? 0
        return {
          productId,
          expectedQty,
          countedQty,
          varianceQty: Math.round((countedQty - expectedQty) * 1000) / 1000,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    if (items.length === 0) return fail('Count at least one product.')

    const count = await prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, 'SC')
      const created = await tx.stockCount.create({
        data: {
          number,
          countedById: user.id,
          notes: str(formData, 'notes') ?? null,
          isPosted: true,
          postedAt: new Date(),
          items: { create: items },
        },
      })

      for (const item of items) {
        if (item.varianceQty === 0) continue
        await applyStockMovement(tx, {
          productId: item.productId,
          type: 'STOCK_TAKE',
          quantity: item.varianceQty,
          reference: number,
          note: 'Stock take correction',
          stockCountId: created.id,
          userId: user.id,
          allowNegative: true,
        })
      }

      return created
    })

    await recordAudit({
      userId: user.id,
      action: 'stock.count',
      entityType: 'StockCount',
      entityId: count.id,
      summary: `Posted stock take ${count.number}`,
    })
    countId = count.id
  } catch (error) {
    if (error instanceof StockError) return fail(error.message)
    return toActionState(error)
  }

  revalidatePath('/inventory')
  revalidatePath('/inventory/counts')
  redirect(`/inventory/counts/${countId}`)
}
