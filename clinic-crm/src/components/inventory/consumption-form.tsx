'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Checkbox, Field, FormError, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button, buttonClass } from '@/components/ui/button'
import { formatMoney } from '@/lib/money'
import { formatQty } from '@/lib/utils'
import { emptyState, type ActionState } from '@/lib/forms'

type ProductOption = {
  id: string
  name: string
  sku: string
  unit: string
  stockQty: number
  costMinor: number
}

const COST_CENTRES = [
  'Treatment rooms',
  'Back bar',
  'Training',
  'Wastage',
  'Testers and samples',
  'Reception',
]

export function ConsumptionForm({
  action,
  products,
  staff,
  rooms,
  defaultDate,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  products: ProductOption[]
  staff: { id: string; firstName: string; lastName: string }[]
  rooms: { id: string; name: string }[]
  defaultDate: string
}) {
  const [state, formAction] = useActionState(action, emptyState)
  const [rows, setRows] = useState([{ key: 1, productId: '', quantity: '1', note: '' }])

  const total = rows.reduce((sum, row) => {
    const product = products.find((item) => item.id === row.productId)
    const quantity = Number.parseFloat(row.quantity.replace(',', '.')) || 0
    if (!product) return sum
    return sum + Math.round(product.costMinor * quantity)
  }, 0)

  const shortages = rows.filter((row) => {
    const product = products.find((item) => item.id === row.productId)
    const quantity = Number.parseFloat(row.quantity.replace(',', '.')) || 0
    return product && quantity > product.stockQty
  })

  function patch(key: number, value: Partial<{ productId: string; quantity: string; note: string }>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...value } : row)))
  }

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />

      <Card>
        <CardHeader title="What was used" description="Priced at cost — this is not a sale." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="billDate" required>
            <Input id="billDate" name="billDate" type="date" defaultValue={defaultDate} required />
          </Field>
          <Field label="Cost centre" htmlFor="costCenter" hint="Where the cost belongs.">
            <Select id="costCenter" name="costCenter" defaultValue="Treatment rooms">
              {COST_CENTRES.map((centre) => (
                <option key={centre} value={centre}>{centre}</option>
              ))}
            </Select>
          </Field>
          <Field label="Used by" htmlFor="staffId">
            <Select id="staffId" name="staffId" defaultValue="">
              <option value="">Not attributed</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Room" htmlFor="roomId">
            <Select id="roomId" name="roomId" defaultValue="">
              <option value="">Not attributed</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Reason" htmlFor="reason" className="sm:col-span-2" required>
            <Input
              id="reason"
              name="reason"
              required
              placeholder="Monthly back-bar restock, training session, breakage…"
            />
          </Field>
          <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" rows={2} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Products"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows((current) => [...current, { key: Date.now(), productId: '', quantity: '1', note: '' }])}
            >
              <Plus className="h-4 w-4" /> Add line
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {rows.map((row) => {
            const product = products.find((item) => item.id === row.productId)
            const quantity = Number.parseFloat(row.quantity.replace(',', '.')) || 0
            const lineCost = product ? Math.round(product.costMinor * quantity) : 0
            const short = product && quantity > product.stockQty

            return (
              <div key={row.key} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[220px] flex-1">
                    <Select
                      name="itemProductId"
                      value={row.productId}
                      onChange={(event) => patch(row.key, { productId: event.target.value })}
                      aria-label="Product"
                    >
                      <option value="">Choose a product…</option>
                      {products.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} — {formatQty(item.stockQty, item.unit)} in stock
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input
                      name="itemQuantity"
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(event) => patch(row.key, { quantity: event.target.value })}
                      aria-label="Quantity"
                    />
                  </div>
                  <span className="w-12 pb-2.5 text-xs text-ink-subtle">{product?.unit ?? ''}</span>
                  <div className="min-w-[140px] flex-1">
                    <Input
                      name="itemNote"
                      value={row.note}
                      onChange={(event) => patch(row.key, { note: event.target.value })}
                      placeholder="Note (optional)"
                      aria-label="Line note"
                    />
                  </div>
                  <span className="w-24 pb-2.5 text-right text-sm font-medium tabular-nums text-ink">
                    {formatMoney(lineCost)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {short ? (
                  <p className="mt-2 text-xs text-danger">
                    Only {formatQty(product!.stockQty, product!.unit)} in stock.
                  </p>
                ) : null}
              </div>
            )
          })}

          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm text-ink-muted">Total cost</span>
            <span className="text-lg font-semibold tabular-nums text-ink">{formatMoney(total)}</span>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <Checkbox name="issueNow" defaultChecked />
          Issue now and take the stock out
        </label>
        <div className="flex items-center gap-2">
          <Link href="/inventory/consumption" className={buttonClass('outline', 'md')}>Cancel</Link>
          <SubmitButton disabled={shortages.length > 0 || total === 0} pendingLabel="Saving…">
            Save usage bill
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}
