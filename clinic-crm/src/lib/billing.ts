import { prisma } from '@/lib/prisma'
import { nextDocumentNumber } from '@/lib/numbering'
import { computeTotals } from '@/lib/money'
import { roundQty } from '@/lib/utils'
import type { InvoiceItemKind, PaymentMethod } from '@/generated/prisma/enums'

export type CheckoutLine = {
  kind: InvoiceItemKind
  refId?: string
  description: string
  quantity: number
  unitPriceMinor: number
  discountMinor: number
  staffId?: string
  appointmentServiceId?: string
  /** Draw this service from a prepaid package instead of charging for it. */
  usePackageItemId?: string
}

export type CheckoutPayment = {
  method: PaymentMethod
  amountMinor: number
  reference?: string
}

export class CheckoutError extends Error {}

/**
 * Creates an invoice and everything that must move with it: package
 * redemptions, retail stock, payments, loyalty points, commissions and the
 * client's lifetime totals. All or nothing.
 */
export async function createInvoice(params: {
  clientId?: string | null
  appointmentId?: string | null
  cashierId: string
  lines: CheckoutLine[]
  discountType: 'NONE' | 'PERCENT' | 'FIXED'
  discountValue: number
  taxBps: number
  payments: CheckoutPayment[]
  loyaltyPointsRedeemed: number
  notes?: string
}) {
  if (params.lines.length === 0) throw new CheckoutError('Add at least one line before taking payment.')

  const settings = await prisma.clinicSetting.findUnique({ where: { id: 1 } })
  const pointValueMinor = settings?.loyaltyPointValueMinor ?? 0
  const pointsPerUnit = settings?.loyaltyPointsPerUnit ?? 0
  const loyaltyUnitMinor = settings?.loyaltyUnitMinor ?? 0

  return prisma.$transaction(async (tx) => {
    // ---- validate package redemptions ----------------------------------
    const redemptionLines = params.lines.filter((line) => line.usePackageItemId)
    const packageItems = new Map<string, { id: string; clientPackageId: string; totalQty: number; usedQty: number; serviceId: string }>()

    for (const line of redemptionLines) {
      const item = await tx.clientPackageItem.findUnique({
        where: { id: line.usePackageItemId! },
        select: {
          id: true,
          clientPackageId: true,
          totalQty: true,
          usedQty: true,
          serviceId: true,
          clientPackage: { select: { clientId: true, status: true, expiresAt: true } },
        },
      })
      if (!item) throw new CheckoutError('That package session could not be found.')
      if (item.clientPackage.status !== 'ACTIVE') throw new CheckoutError('That package is no longer active.')
      if (item.clientPackage.expiresAt < new Date()) throw new CheckoutError('That package has expired.')
      if (params.clientId && item.clientPackage.clientId !== params.clientId) {
        throw new CheckoutError('That package belongs to a different client.')
      }
      const already = packageItems.get(item.id)?.usedQty ?? item.usedQty
      if (already + line.quantity > item.totalQty) {
        throw new CheckoutError('No sessions left on that package.')
      }
      packageItems.set(item.id, {
        id: item.id,
        clientPackageId: item.clientPackageId,
        totalQty: item.totalQty,
        usedQty: already + line.quantity,
        serviceId: item.serviceId,
      })
    }

    // ---- totals ---------------------------------------------------------
    const chargeable = params.lines.filter((line) => !line.usePackageItemId)
    const subtotalMinor = chargeable.reduce(
      (sum, line) => sum + Math.round(line.unitPriceMinor * line.quantity) - line.discountMinor,
      0,
    )
    const totals = computeTotals({
      subtotalMinor,
      discountType: params.discountType,
      discountValue: params.discountValue,
      taxBps: params.taxBps,
    })

    const loyaltyValueMinor = Math.min(
      totals.totalMinor,
      Math.max(0, params.loyaltyPointsRedeemed) * pointValueMinor,
    )
    const dueMinor = totals.totalMinor - loyaltyValueMinor

    const paidMinor =
      params.payments.reduce((sum, payment) => sum + payment.amountMinor, 0) + loyaltyValueMinor

    if (paidMinor > totals.totalMinor) {
      throw new CheckoutError('The payments add up to more than the invoice total.')
    }

    if (params.loyaltyPointsRedeemed > 0) {
      if (!params.clientId) throw new CheckoutError('Loyalty points need a client on the invoice.')
      const client = await tx.client.findUnique({
        where: { id: params.clientId },
        select: { loyaltyPoints: true },
      })
      if (!client || client.loyaltyPoints < params.loyaltyPointsRedeemed) {
        throw new CheckoutError('The client does not have that many loyalty points.')
      }
    }

    const status =
      paidMinor >= totals.totalMinor && totals.totalMinor > 0
        ? 'PAID'
        : paidMinor > 0
          ? 'PARTIALLY_PAID'
          : totals.totalMinor === 0
            ? 'PAID'
            : 'ISSUED'

    const number = await nextDocumentNumber(tx, 'INV')
    const now = new Date()

    const invoice = await tx.invoice.create({
      data: {
        number,
        clientId: params.clientId ?? null,
        appointmentId: params.appointmentId ?? null,
        cashierId: params.cashierId,
        status,
        issuedAt: now,
        subtotalMinor,
        discountType: params.discountType,
        discountValue: params.discountValue,
        discountMinor: totals.discountMinor,
        taxBps: params.taxBps,
        taxMinor: totals.taxMinor,
        totalMinor: totals.totalMinor,
        paidMinor,
        notes: params.notes ?? null,
        items: {
          create: params.lines.map((line, index) => ({
            kind: line.kind,
            description: line.description,
            serviceId: line.kind === 'SERVICE' ? (line.refId ?? null) : null,
            productId: line.kind === 'PRODUCT' ? (line.refId ?? null) : null,
            packageId: line.kind === 'PACKAGE' ? (line.refId ?? null) : null,
            giftCardId: line.kind === 'GIFT_CARD' ? (line.refId ?? null) : null,
            appointmentServiceId: line.appointmentServiceId ?? null,
            staffId: line.staffId ?? null,
            quantity: line.quantity,
            unitPriceMinor: line.usePackageItemId ? 0 : line.unitPriceMinor,
            discountMinor: line.discountMinor,
            totalMinor: line.usePackageItemId
              ? 0
              : Math.round(line.unitPriceMinor * line.quantity) - line.discountMinor,
            sortOrder: index,
          })),
        },
      },
      include: { items: true },
    })

    // ---- package redemptions -------------------------------------------
    for (const [index, line] of params.lines.entries()) {
      if (!line.usePackageItemId) continue
      const item = packageItems.get(line.usePackageItemId)!
      const invoiceItem = invoice.items.find((candidate) => candidate.sortOrder === index)

      await tx.clientPackageItem.update({
        where: { id: item.id },
        data: { usedQty: { increment: line.quantity } },
      })
      await tx.packageRedemption.create({
        data: {
          clientPackageId: item.clientPackageId,
          clientPackageItemId: item.id,
          appointmentServiceId: line.appointmentServiceId ?? null,
          invoiceItemId: invoiceItem?.id ?? null,
          quantity: line.quantity,
          valueMinor: Math.round(line.unitPriceMinor * line.quantity),
        },
      })

      const remaining = await tx.clientPackageItem.findMany({
        where: { clientPackageId: item.clientPackageId },
        select: { totalQty: true, usedQty: true },
      })
      if (remaining.every((entry) => entry.usedQty >= entry.totalQty)) {
        await tx.clientPackage.update({
          where: { id: item.clientPackageId },
          data: { status: 'COMPLETED' },
        })
      }
    }

    // ---- packages sold --------------------------------------------------
    for (const line of params.lines.filter((entry) => entry.kind === 'PACKAGE' && entry.refId)) {
      const template = await tx.package.findUnique({
        where: { id: line.refId! },
        include: { items: true },
      })
      if (!template) continue
      if (!params.clientId) throw new CheckoutError('A package sale needs a client on the invoice.')

      const expiresAt = new Date(now.getTime() + template.validityDays * 24 * 60 * 60 * 1000)
      await tx.clientPackage.create({
        data: {
          clientId: params.clientId,
          packageId: template.id,
          invoiceId: invoice.id,
          pricePaidMinor: Math.round(line.unitPriceMinor * line.quantity),
          expiresAt,
          items: {
            create: template.items.map((entry) => ({
              serviceId: entry.serviceId,
              totalQty: entry.quantity * line.quantity,
            })),
          },
        },
      })
    }

    // ---- retail stock ----------------------------------------------------
    for (const line of params.lines.filter((entry) => entry.kind === 'PRODUCT' && entry.refId)) {
      const product = await tx.product.findUnique({
        where: { id: line.refId! },
        select: { id: true, stockQty: true, costMinor: true, trackStock: true, name: true },
      })
      if (!product || !product.trackStock) continue

      const balanceAfter = roundQty(product.stockQty - line.quantity)
      await tx.product.update({ where: { id: product.id }, data: { stockQty: balanceAfter } })
      await tx.invoiceItem.updateMany({
        where: { invoiceId: invoice.id, productId: product.id },
        data: { costMinor: Math.round(product.costMinor * line.quantity) },
      })
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: 'RETAIL_SALE',
          quantity: -line.quantity,
          balanceAfter,
          unitCostMinor: product.costMinor,
          totalCostMinor: Math.round(product.costMinor * line.quantity),
          reference: invoice.number,
          invoiceId: invoice.id,
          userId: params.cashierId,
        },
      })
    }

    // ---- payments ---------------------------------------------------------
    for (const payment of params.payments) {
      if (payment.amountMinor <= 0) continue
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          method: payment.method,
          amountMinor: payment.amountMinor,
          reference: payment.reference ?? null,
          receivedById: params.cashierId,
        },
      })
    }

    if (loyaltyValueMinor > 0 && params.clientId) {
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          method: 'LOYALTY_POINTS',
          amountMinor: loyaltyValueMinor,
          reference: `${params.loyaltyPointsRedeemed} points`,
          receivedById: params.cashierId,
        },
      })
      await tx.loyaltyEntry.create({
        data: {
          clientId: params.clientId,
          invoiceId: invoice.id,
          points: -params.loyaltyPointsRedeemed,
          reason: 'REDEEMED',
        },
      })
      await tx.client.update({
        where: { id: params.clientId },
        data: { loyaltyPoints: { decrement: params.loyaltyPointsRedeemed } },
      })
    }

    // ---- loyalty earned ---------------------------------------------------
    let earned = 0
    if (params.clientId && loyaltyUnitMinor > 0 && pointsPerUnit > 0) {
      earned = Math.floor(totals.totalMinor / loyaltyUnitMinor) * pointsPerUnit
      if (earned > 0) {
        await tx.loyaltyEntry.create({
          data: {
            clientId: params.clientId,
            invoiceId: invoice.id,
            points: earned,
            reason: 'EARNED_PURCHASE',
          },
        })
      }
    }

    if (params.clientId) {
      await tx.client.update({
        where: { id: params.clientId },
        data: {
          totalSpentMinor: { increment: paidMinor },
          loyaltyPoints: { increment: earned },
        },
      })
    }

    // ---- commissions ------------------------------------------------------
    const serviceLines = invoice.items.filter((item) => item.kind === 'SERVICE' && item.staffId)
    const byStaff = new Map<string, number>()
    for (const item of serviceLines) {
      byStaff.set(item.staffId!, (byStaff.get(item.staffId!) ?? 0) + item.totalMinor)
    }

    for (const [staffId, baseMinor] of byStaff) {
      if (baseMinor <= 0) continue
      const staff = await tx.user.findUnique({ where: { id: staffId }, select: { commissionBps: true } })
      const rateBps = staff?.commissionBps ?? 0
      if (rateBps <= 0) continue
      await tx.commission.create({
        data: {
          userId: staffId,
          invoiceId: invoice.id,
          baseMinor,
          rateBps,
          amountMinor: Math.round((baseMinor * rateBps) / 10000),
        },
      })
    }

    return { invoice, dueMinor, earned }
  })
}

export async function recordPayment(params: {
  invoiceId: string
  method: PaymentMethod
  amountMinor: number
  reference?: string
  userId: string
}) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: params.invoiceId },
      select: { totalMinor: true, paidMinor: true, status: true, clientId: true },
    })
    if (!invoice) throw new CheckoutError('Invoice not found.')
    if (invoice.status === 'VOID') throw new CheckoutError('This invoice has been voided.')

    const outstanding = invoice.totalMinor - invoice.paidMinor
    if (params.amountMinor > outstanding) {
      throw new CheckoutError('That is more than the amount outstanding.')
    }

    await tx.payment.create({
      data: {
        invoiceId: params.invoiceId,
        method: params.method,
        amountMinor: params.amountMinor,
        reference: params.reference ?? null,
        receivedById: params.userId,
      },
    })

    const paidMinor = invoice.paidMinor + params.amountMinor
    await tx.invoice.update({
      where: { id: params.invoiceId },
      data: {
        paidMinor,
        status: paidMinor >= invoice.totalMinor ? 'PAID' : 'PARTIALLY_PAID',
      },
    })

    if (invoice.clientId) {
      await tx.client.update({
        where: { id: invoice.clientId },
        data: { totalSpentMinor: { increment: params.amountMinor } },
      })
    }
  })
}

export async function refundInvoice(params: {
  invoiceId: string
  amountMinor: number
  reason: string
  userId: string
}) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: params.invoiceId },
      select: { paidMinor: true, refundedMinor: true, clientId: true, status: true },
    })
    if (!invoice) throw new CheckoutError('Invoice not found.')

    const refundable = invoice.paidMinor - invoice.refundedMinor
    if (params.amountMinor <= 0 || params.amountMinor > refundable) {
      throw new CheckoutError('That is more than can be refunded on this invoice.')
    }

    await tx.payment.create({
      data: {
        invoiceId: params.invoiceId,
        method: 'CASH',
        amountMinor: -params.amountMinor,
        isRefund: true,
        note: params.reason,
        receivedById: params.userId,
      },
    })

    const refundedMinor = invoice.refundedMinor + params.amountMinor
    await tx.invoice.update({
      where: { id: params.invoiceId },
      data: {
        refundedMinor,
        status: refundedMinor >= invoice.paidMinor ? 'REFUNDED' : invoice.status,
      },
    })

    if (invoice.clientId) {
      await tx.client.update({
        where: { id: invoice.clientId },
        data: { totalSpentMinor: { decrement: params.amountMinor } },
      })
    }
  })
}
