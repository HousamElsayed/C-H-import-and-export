'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { authorize } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { parseBps, parseMoney } from '@/lib/money'
import {
  CheckoutError,
  createInvoice,
  recordPayment,
  refundInvoice,
  type CheckoutLine,
  type CheckoutPayment,
} from '@/lib/billing'
import { fail, str, succeed, toActionState, type ActionState } from '@/lib/forms'
import type { InvoiceItemKind, PaymentMethod } from '@/generated/prisma/enums'

const ITEM_KINDS: InvoiceItemKind[] = ['SERVICE', 'PRODUCT', 'PACKAGE', 'GIFT_CARD', 'ADJUSTMENT']
const METHODS: PaymentMethod[] = [
  'CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'GIFT_CARD', 'PACKAGE_CREDIT', 'LOYALTY_POINTS',
]

function readLines(formData: FormData): CheckoutLine[] {
  const kinds = formData.getAll('lineKind').map(String)
  const refIds = formData.getAll('lineRefId').map(String)
  const descriptions = formData.getAll('lineDescription').map(String)
  const quantities = formData.getAll('lineQuantity').map(String)
  const prices = formData.getAll('lineUnitPrice').map(String)
  const discounts = formData.getAll('lineDiscount').map(String)
  const staffIds = formData.getAll('lineStaffId').map(String)
  const appointmentServiceIds = formData.getAll('lineAppointmentServiceId').map(String)
  const packageItemIds = formData.getAll('linePackageItemId').map(String)

  const lines: CheckoutLine[] = []
  for (const [index, rawKind] of kinds.entries()) {
    const kind = ITEM_KINDS.find((candidate) => candidate === rawKind)
    if (!kind) continue

    const quantity = Number.parseFloat((quantities[index] ?? '1').replace(',', '.'))
    const description = (descriptions[index] ?? '').trim()
    if (!description || !Number.isFinite(quantity) || quantity <= 0) continue

    lines.push({
      kind,
      refId: refIds[index] || undefined,
      description,
      quantity,
      unitPriceMinor: parseMoney(prices[index]),
      discountMinor: parseMoney(discounts[index]),
      staffId: staffIds[index] || undefined,
      appointmentServiceId: appointmentServiceIds[index] || undefined,
      usePackageItemId: packageItemIds[index] || undefined,
    })
  }
  return lines
}

function readPayments(formData: FormData): CheckoutPayment[] {
  const methods = formData.getAll('paymentMethod').map(String)
  const amounts = formData.getAll('paymentAmount').map(String)
  const references = formData.getAll('paymentReference').map(String)

  const payments: CheckoutPayment[] = []
  for (const [index, rawMethod] of methods.entries()) {
    const method = METHODS.find((candidate) => candidate === rawMethod)
    if (!method) continue
    const amountMinor = parseMoney(amounts[index])
    if (amountMinor <= 0) continue
    payments.push({ method, amountMinor, reference: references[index] || undefined })
  }
  return payments
}

export async function checkout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let invoiceId: string
  try {
    const user = await authorize('billing:write')

    const lines = readLines(formData)
    if (lines.length === 0) return fail('Add at least one line before taking payment.')

    const loyaltyRaw = str(formData, 'loyaltyPoints')
    const loyaltyPointsRedeemed = loyaltyRaw ? Math.max(0, Number.parseInt(loyaltyRaw, 10) || 0) : 0

    const { invoice } = await createInvoice({
      clientId: str(formData, 'clientId') ?? null,
      appointmentId: str(formData, 'appointmentId') ?? null,
      cashierId: user.id,
      lines,
      discountType: (str(formData, 'discountType') as 'NONE' | 'PERCENT' | 'FIXED') ?? 'NONE',
      discountValue:
        str(formData, 'discountType') === 'PERCENT'
          ? parseBps(str(formData, 'discountValue'))
          : parseMoney(str(formData, 'discountValue')),
      taxBps: parseBps(str(formData, 'taxRate')),
      payments: readPayments(formData),
      loyaltyPointsRedeemed,
      notes: str(formData, 'notes'),
    })

    await recordAudit({
      userId: user.id,
      action: 'invoice.create',
      entityType: 'Invoice',
      entityId: invoice.id,
      summary: `Issued ${invoice.number}`,
    })
    invoiceId = invoice.id
  } catch (error) {
    if (error instanceof CheckoutError) return fail(error.message)
    return toActionState(error)
  }

  revalidatePath('/invoices')
  revalidatePath('/')
  redirect(`/invoices/${invoiceId}`)
}

export async function addPayment(
  invoiceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await authorize('billing:write')
    const method = METHODS.find((candidate) => candidate === str(formData, 'method'))
    if (!method) return fail('Choose a payment method.')

    const amountMinor = parseMoney(str(formData, 'amount'))
    if (amountMinor <= 0) return fail('Enter an amount greater than zero.')

    await recordPayment({
      invoiceId,
      method,
      amountMinor,
      reference: str(formData, 'reference'),
      userId: user.id,
    })

    await recordAudit({
      userId: user.id,
      action: 'invoice.payment',
      entityType: 'Invoice',
      entityId: invoiceId,
      summary: `Recorded a ${method.toLowerCase().replace('_', ' ')} payment`,
    })
  } catch (error) {
    if (error instanceof CheckoutError) return fail(error.message)
    return toActionState(error)
  }

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  return succeed('Payment recorded.')
}

export async function refund(
  invoiceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await authorize('billing:refund')
    const amountMinor = parseMoney(str(formData, 'amount'))
    const reason = str(formData, 'reason')
    if (!reason) return fail('Give a reason for the refund.')

    await refundInvoice({ invoiceId, amountMinor, reason, userId: user.id })

    await recordAudit({
      userId: user.id,
      action: 'invoice.refund',
      entityType: 'Invoice',
      entityId: invoiceId,
      summary: `Refunded: ${reason}`,
    })
  } catch (error) {
    if (error instanceof CheckoutError) return fail(error.message)
    return toActionState(error)
  }

  revalidatePath(`/invoices/${invoiceId}`)
  return succeed('Refund recorded.')
}

export async function voidInvoice(
  invoiceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await authorize('billing:void')
    const reason = str(formData, 'reason')
    if (!reason) return fail('Give a reason for voiding this invoice.')

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { paidMinor: true, number: true },
    })
    if (!invoice) return fail('Invoice not found.')
    if (invoice.paidMinor > 0) {
      return fail('Refund the payments before voiding this invoice.')
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'VOID', voidReason: reason },
    })

    await recordAudit({
      userId: user.id,
      action: 'invoice.void',
      entityType: 'Invoice',
      entityId: invoiceId,
      summary: `Voided ${invoice.number}: ${reason}`,
    })
  } catch (error) {
    return toActionState(error)
  }

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  return succeed('Invoice voided.')
}
