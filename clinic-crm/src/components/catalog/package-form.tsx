'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Checkbox, Field, FormError, FormSuccess, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button, buttonClass } from '@/components/ui/button'
import { formatMoney, parseMoney } from '@/lib/money'
import { emptyState, type ActionState } from '@/lib/forms'

export type PackageFormValues = {
  name?: string
  description?: string | null
  price?: string
  validityDays?: number
  isActive?: boolean
  items?: { serviceId: string; quantity: number }[]
}

export function PackageForm({
  action,
  values = {},
  services,
  submitLabel = 'Save package',
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  values?: PackageFormValues
  services: { id: string; name: string; priceMinor: number }[]
  submitLabel?: string
  cancelHref: string
}) {
  const [state, formAction] = useActionState(action, emptyState)
  const [rows, setRows] = useState<{ key: number; serviceId: string; quantity: string }[]>(
    (values.items ?? [{ serviceId: '', quantity: 1 }]).map((item, index) => ({
      key: index,
      serviceId: item.serviceId,
      quantity: String(item.quantity),
    })),
  )
  const [price, setPrice] = useState(values.price ?? '0,00')

  const listValue = rows.reduce((sum, row) => {
    const service = services.find((item) => item.id === row.serviceId)
    const quantity = Number.parseInt(row.quantity, 10)
    if (!service || !Number.isFinite(quantity)) return sum
    return sum + service.priceMinor * quantity
  }, 0)

  const packagePrice = parseMoney(price)
  const saving = listValue - packagePrice
  const savingPct = listValue > 0 ? Math.round((saving / listValue) * 100) : 0

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />

      <Card>
        <CardHeader title="Package" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" required error={state.fieldErrors?.name}>
            <Input id="name" name="name" defaultValue={values.name} required />
          </Field>
          <Field label="Price" htmlFor="price" required>
            <Input
              id="price"
              name="price"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
          </Field>
          <Field label="Valid for (days)" htmlFor="validityDays" hint="Counted from the purchase date.">
            <Input id="validityDays" name="validityDays" type="number" min={1} defaultValue={values.validityDays ?? 365} />
          </Field>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox name="isActive" defaultChecked={values.isActive ?? true} /> Available to sell
            </label>
          </div>
          <Field label="Description" htmlFor="description" className="sm:col-span-2">
            <Textarea id="description" name="description" rows={2} defaultValue={values.description ?? ''} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Sessions included"
          description="Each session is drawn down automatically at checkout."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows((current) => [...current, { key: Date.now(), serviceId: '', quantity: '1' }])}
            >
              <Plus className="h-4 w-4" /> Add service
            </Button>
          }
        />
        <CardBody className="space-y-3">
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.key} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    name="itemServiceId"
                    value={row.serviceId}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item) =>
                          item.key === row.key ? { ...item, serviceId: event.target.value } : item,
                        ),
                      )
                    }
                  >
                    <option value="">Choose a service…</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} — {formatMoney(service.priceMinor)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-24">
                  <Input
                    name="itemQuantity"
                    type="number"
                    min={1}
                    value={row.quantity}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item) =>
                          item.key === row.key ? { ...item, quantity: event.target.value } : item,
                        ),
                      )
                    }
                    aria-label="Sessions"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-muted px-4 py-3 text-sm">
            <span className="text-ink-muted">
              Sessions bought separately: <strong className="text-ink">{formatMoney(listValue)}</strong>
            </span>
            <span className={saving > 0 ? 'text-success' : saving < 0 ? 'text-danger' : 'text-ink-muted'}>
              {saving > 0
                ? `Client saves ${formatMoney(saving)} (${savingPct}%)`
                : saving < 0
                  ? `Priced ${formatMoney(-saving)} above list`
                  : 'Same as list price'}
            </span>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href={cancelHref} className={buttonClass('outline', 'md')}>Cancel</Link>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  )
}
