'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Checkbox, Field, FormError, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button, buttonClass } from '@/components/ui/button'
import { formatMoney, parseMoney, parseBps, computeTotals } from '@/lib/money'
import { emptyState, type ActionState } from '@/lib/forms'
import type { InvoiceItemKind } from '@/generated/prisma/enums'

type Line = {
  key: number
  kind: InvoiceItemKind
  refId: string
  description: string
  quantity: string
  unitPrice: string
  discount: string
  staffId: string
  appointmentServiceId: string
  packageItemId: string
  /** Package sessions available for this service, if any. */
  packageOptions: { id: string; label: string }[]
}

type Catalog = {
  services: { id: string; name: string; priceMinor: number }[]
  products: { id: string; name: string; sku: string; retailMinor: number; stockQty: number }[]
  packages: { id: string; name: string; priceMinor: number }[]
  staff: { id: string; firstName: string; lastName: string }[]
}

const METHODS = [
  ['CARD', 'Card'],
  ['CASH', 'Cash'],
  ['BANK_TRANSFER', 'Bank transfer'],
  ['ONLINE', 'Online'],
  ['GIFT_CARD', 'Gift card'],
]

let keyCounter = 1000

export function CheckoutForm({
  action,
  catalog,
  initialLines,
  client,
  appointmentId,
  defaultTaxBps,
  loyalty,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  catalog: Catalog
  initialLines: Omit<Line, 'key'>[]
  client: { id: string; firstName: string; lastName: string; loyaltyPoints: number } | null
  appointmentId?: string
  defaultTaxBps: number
  loyalty: { pointValueMinor: number }
}) {
  const [state, formAction] = useActionState(action, emptyState)
  const [lines, setLines] = useState<Line[]>(
    initialLines.map((line, index) => ({ ...line, key: index })),
  )
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENT' | 'FIXED'>('NONE')
  const [discountValue, setDiscountValue] = useState('0')
  const [taxRate, setTaxRate] = useState(String(defaultTaxBps / 100))
  const [loyaltyPoints, setLoyaltyPoints] = useState('0')
  const [payments, setPayments] = useState<{ key: number; method: string; amount: string; reference: string }[]>([
    { key: 1, method: 'CARD', amount: '', reference: '' },
  ])

  const subtotalMinor = lines.reduce((sum, line) => {
    if (line.packageItemId) return sum
    const quantity = Number.parseFloat(line.quantity.replace(',', '.')) || 0
    return sum + Math.round(parseMoney(line.unitPrice) * quantity) - parseMoney(line.discount)
  }, 0)

  const totals = computeTotals({
    subtotalMinor,
    discountType,
    discountValue: discountType === 'PERCENT' ? parseBps(discountValue) : parseMoney(discountValue),
    taxBps: parseBps(taxRate),
  })

  const pointsToRedeem = Math.max(0, Number.parseInt(loyaltyPoints, 10) || 0)
  const loyaltyValueMinor = Math.min(totals.totalMinor, pointsToRedeem * loyalty.pointValueMinor)
  const paidMinor =
    payments.reduce((sum, payment) => sum + parseMoney(payment.amount), 0) + loyaltyValueMinor
  const dueMinor = totals.totalMinor - paidMinor

  function addLine(kind: InvoiceItemKind) {
    keyCounter += 1
    setLines((current) => [
      ...current,
      {
        key: keyCounter,
        kind,
        refId: '',
        description: kind === 'ADJUSTMENT' ? 'Adjustment' : '',
        quantity: '1',
        unitPrice: '0,00',
        discount: '0,00',
        staffId: '',
        appointmentServiceId: '',
        packageItemId: '',
        packageOptions: [],
      },
    ])
  }

  function patchLine(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function pickReference(line: Line, refId: string) {
    if (line.kind === 'SERVICE') {
      const service = catalog.services.find((item) => item.id === refId)
      patchLine(line.key, {
        refId,
        description: service?.name ?? '',
        unitPrice: service ? formatMoney(service.priceMinor, { withSymbol: false }) : '0,00',
      })
    } else if (line.kind === 'PRODUCT') {
      const product = catalog.products.find((item) => item.id === refId)
      patchLine(line.key, {
        refId,
        description: product?.name ?? '',
        unitPrice: product ? formatMoney(product.retailMinor, { withSymbol: false }) : '0,00',
      })
    } else if (line.kind === 'PACKAGE') {
      const pack = catalog.packages.find((item) => item.id === refId)
      patchLine(line.key, {
        refId,
        description: pack?.name ?? '',
        unitPrice: pack ? formatMoney(pack.priceMinor, { withSymbol: false }) : '0,00',
      })
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />

      {client ? <input type="hidden" name="clientId" value={client.id} /> : null}
      {appointmentId ? <input type="hidden" name="appointmentId" value={appointmentId} /> : null}

      <Card>
        <CardHeader
          title="Items"
          description={client ? `Billing ${client.firstName} ${client.lastName}` : 'Walk-in sale'}
          action={
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => addLine('SERVICE')}>
                <Plus className="h-3.5 w-3.5" /> Service
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addLine('PRODUCT')}>
                <Plus className="h-3.5 w-3.5" /> Product
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addLine('PACKAGE')}>
                <Plus className="h-3.5 w-3.5" /> Package
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addLine('ADJUSTMENT')}>
                <Plus className="h-3.5 w-3.5" /> Other
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-3">
          {lines.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-muted">
              Nothing on this sale yet. Add a service, product or package.
            </p>
          ) : null}

          {lines.map((line) => {
            const quantity = Number.parseFloat(line.quantity.replace(',', '.')) || 0
            const lineTotal = line.packageItemId
              ? 0
              : Math.round(parseMoney(line.unitPrice) * quantity) - parseMoney(line.discount)

            return (
              <div key={line.key} className="rounded-lg border border-line p-3">
                <input type="hidden" name="lineKind" value={line.kind} />
                <input type="hidden" name="lineRefId" value={line.refId} />
                <input type="hidden" name="lineStaffId" value={line.staffId} />
                <input type="hidden" name="lineAppointmentServiceId" value={line.appointmentServiceId} />
                <input type="hidden" name="linePackageItemId" value={line.packageItemId} />

                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1">
                    {line.kind === 'ADJUSTMENT' ? (
                      <Input
                        name="lineDescription"
                        value={line.description}
                        onChange={(event) => patchLine(line.key, { description: event.target.value })}
                        placeholder="Description"
                      />
                    ) : (
                      <>
                        <input type="hidden" name="lineDescription" value={line.description} />
                        <Select
                          value={line.refId}
                          onChange={(event) => pickReference(line, event.target.value)}
                        >
                          <option value="">Choose…</option>
                          {line.kind === 'SERVICE'
                            ? catalog.services.map((service) => (
                                <option key={service.id} value={service.id}>{service.name}</option>
                              ))
                            : null}
                          {line.kind === 'PRODUCT'
                            ? catalog.products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name} ({product.stockQty} in stock)
                                </option>
                              ))
                            : null}
                          {line.kind === 'PACKAGE'
                            ? catalog.packages.map((pack) => (
                                <option key={pack.id} value={pack.id}>{pack.name}</option>
                              ))
                            : null}
                        </Select>
                      </>
                    )}
                  </div>

                  <div className="w-20">
                    <Input
                      name="lineQuantity"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(event) => patchLine(line.key, { quantity: event.target.value })}
                      aria-label="Quantity"
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      name="lineUnitPrice"
                      inputMode="decimal"
                      value={line.unitPrice}
                      onChange={(event) => patchLine(line.key, { unitPrice: event.target.value })}
                      aria-label="Unit price"
                      disabled={Boolean(line.packageItemId)}
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      name="lineDiscount"
                      inputMode="decimal"
                      value={line.discount}
                      onChange={(event) => patchLine(line.key, { discount: event.target.value })}
                      aria-label="Line discount"
                      disabled={Boolean(line.packageItemId)}
                    />
                  </div>
                  <span className="w-24 pb-2.5 text-right text-sm font-medium tabular-nums text-ink">
                    {formatMoney(lineTotal)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {line.kind === 'SERVICE' && line.packageOptions.length > 0 ? (
                  <label className="mt-2 flex items-center gap-2 text-xs text-brand-strong">
                    <Checkbox
                      checked={Boolean(line.packageItemId)}
                      onChange={(event) =>
                        patchLine(line.key, {
                          packageItemId: event.target.checked ? line.packageOptions[0]!.id : '',
                        })
                      }
                    />
                    Use a prepaid session — {line.packageOptions[0]!.label}
                  </label>
                ) : null}

                {line.kind === 'SERVICE' ? (
                  <div className="mt-2">
                    <Select
                      value={line.staffId}
                      onChange={(event) => patchLine(line.key, { staffId: event.target.value })}
                      className="max-w-xs text-xs"
                      aria-label="Performed by"
                    >
                      <option value="">Commission: unassigned</option>
                      {catalog.staff.map((member) => (
                        <option key={member.id} value={member.id}>
                          Performed by {member.firstName} {member.lastName}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
              </div>
            )
          })}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Adjustments" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Discount type" htmlFor="discountType">
              <Select
                id="discountType"
                name="discountType"
                value={discountType}
                onChange={(event) => setDiscountType(event.target.value as typeof discountType)}
              >
                <option value="NONE">No discount</option>
                <option value="PERCENT">Percentage</option>
                <option value="FIXED">Fixed amount</option>
              </Select>
            </Field>
            <Field label={discountType === 'PERCENT' ? 'Discount (%)' : 'Discount amount'} htmlFor="discountValue">
              <Input
                id="discountValue"
                name="discountValue"
                inputMode="decimal"
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
                disabled={discountType === 'NONE'}
              />
            </Field>
            <Field label="Tax rate (%)" htmlFor="taxRate">
              <Input
                id="taxRate"
                name="taxRate"
                inputMode="decimal"
                value={taxRate}
                onChange={(event) => setTaxRate(event.target.value)}
              />
            </Field>
            {client && client.loyaltyPoints > 0 ? (
              <Field
                label="Redeem points"
                htmlFor="loyaltyPoints"
                hint={`${client.loyaltyPoints} available · worth ${formatMoney(client.loyaltyPoints * loyalty.pointValueMinor)}`}
              >
                <Input
                  id="loyaltyPoints"
                  name="loyaltyPoints"
                  type="number"
                  min={0}
                  max={client.loyaltyPoints}
                  value={loyaltyPoints}
                  onChange={(event) => setLoyaltyPoints(event.target.value)}
                />
              </Field>
            ) : null}
            <Field label="Invoice note" htmlFor="notes" className="sm:col-span-2">
              <Textarea id="notes" name="notes" rows={2} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Payment"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  keyCounter += 1
                  setPayments((current) => [
                    ...current,
                    { key: keyCounter, method: 'CASH', amount: '', reference: '' },
                  ])
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Split
              </Button>
            }
          />
          <CardBody className="space-y-3">
            {payments.map((payment, index) => (
              <div key={payment.key} className="flex items-end gap-2">
                <div className="w-40">
                  <Select
                    name="paymentMethod"
                    value={payment.method}
                    onChange={(event) =>
                      setPayments((current) =>
                        current.map((item) =>
                          item.key === payment.key ? { ...item, method: event.target.value } : item,
                        ),
                      )
                    }
                    aria-label="Payment method"
                  >
                    {METHODS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    name="paymentAmount"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={payment.amount}
                    onChange={(event) =>
                      setPayments((current) =>
                        current.map((item) =>
                          item.key === payment.key ? { ...item, amount: event.target.value } : item,
                        ),
                      )
                    }
                    aria-label="Payment amount"
                  />
                </div>
                <input type="hidden" name="paymentReference" value={payment.reference} />
                {index > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setPayments((current) => current.filter((item) => item.key !== payment.key))}
                    aria-label="Remove payment"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setPayments((current) =>
                  current.map((item, index) =>
                    index === 0
                      ? {
                          ...item,
                          amount: formatMoney(
                            Math.max(0, totals.totalMinor - loyaltyValueMinor),
                            { withSymbol: false },
                          ),
                        }
                      : { ...item, amount: '' },
                  ),
                )
              }
            >
              Pay the full amount
            </Button>

            <dl className="space-y-1.5 border-t border-line pt-3 text-sm">
              <Row label="Subtotal" value={formatMoney(subtotalMinor)} />
              {totals.discountMinor > 0 ? (
                <Row label="Discount" value={`− ${formatMoney(totals.discountMinor)}`} />
              ) : null}
              {totals.taxMinor > 0 ? <Row label="Tax" value={formatMoney(totals.taxMinor)} /> : null}
              {loyaltyValueMinor > 0 ? (
                <Row label={`Points (${pointsToRedeem})`} value={`− ${formatMoney(loyaltyValueMinor)}`} />
              ) : null}
              <div className="flex items-center justify-between border-t border-line pt-2 text-base">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="font-semibold tabular-nums text-ink">{formatMoney(totals.totalMinor)}</dd>
              </div>
              <Row
                label={dueMinor > 0 ? 'Still to pay' : dueMinor < 0 ? 'Overpaid' : 'Settled'}
                value={formatMoney(Math.abs(dueMinor))}
                tone={dueMinor > 0 ? 'warning' : dueMinor < 0 ? 'danger' : 'success'}
              />
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link href="/invoices" className={buttonClass('outline', 'md')}>Cancel</Link>
        <SubmitButton disabled={lines.length === 0 || dueMinor < 0} pendingLabel="Saving…">
          {dueMinor <= 0 ? 'Complete sale' : 'Save invoice'}
        </SubmitButton>
      </div>
    </form>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'warning' | 'danger' | 'success'
}) {
  const tones = {
    warning: 'text-warning',
    danger: 'text-danger',
    success: 'text-success',
    undefined: 'text-ink',
  }
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`tabular-nums ${tone ? tones[tone] : 'text-ink'}`}>{value}</dd>
    </div>
  )
}
