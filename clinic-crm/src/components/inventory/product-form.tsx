'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Checkbox, Field, FormError, FormSuccess, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { buttonClass } from '@/components/ui/button'
import { emptyState, type ActionState } from '@/lib/forms'

export type ProductFormValues = {
  sku?: string
  name?: string
  brand?: string | null
  categoryId?: string | null
  supplierId?: string | null
  type?: string
  unit?: string
  cost?: string
  retail?: string
  reorderLevel?: number
  reorderQty?: number
  trackStock?: boolean
  isActive?: boolean
  location?: string | null
  barcode?: string | null
  expiresAt?: string | null
  notes?: string | null
}

export function ProductForm({
  action,
  values = {},
  categories,
  suppliers,
  isNew,
  cancelHref,
  submitLabel = 'Save product',
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  values?: ProductFormValues
  categories: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  isNew: boolean
  cancelHref: string
  submitLabel?: string
}) {
  const [state, formAction] = useActionState(action, emptyState)

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />

      <Card>
        <CardHeader title="Product" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" required error={state.fieldErrors?.name}>
            <Input id="name" name="name" defaultValue={values.name} required />
          </Field>
          <Field label="SKU" htmlFor="sku" required error={state.fieldErrors?.sku}>
            <Input id="sku" name="sku" defaultValue={values.sku} required />
          </Field>
          <Field label="Brand" htmlFor="brand">
            <Input id="brand" name="brand" defaultValue={values.brand ?? ''} />
          </Field>
          <Field label="Barcode" htmlFor="barcode">
            <Input id="barcode" name="barcode" defaultValue={values.barcode ?? ''} />
          </Field>
          <Field label="Category" htmlFor="categoryId">
            <Select id="categoryId" name="categoryId" defaultValue={values.categoryId ?? ''}>
              <option value="">Uncategorised</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Supplier" htmlFor="supplierId">
            <Select id="supplierId" name="supplierId" defaultValue={values.supplierId ?? ''}>
              <option value="">No supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Used for" htmlFor="type">
            <Select id="type" name="type" defaultValue={values.type ?? 'PROFESSIONAL'}>
              <option value="PROFESSIONAL">Professional use only</option>
              <option value="RETAIL">Retail only</option>
              <option value="BOTH">Both</option>
            </Select>
          </Field>
          <Field label="Unit" htmlFor="unit" hint="pcs, ml, g, box…">
            <Input id="unit" name="unit" defaultValue={values.unit ?? 'pcs'} required />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Cost and stock" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Cost price" htmlFor="cost" hint="What you pay per unit.">
            <Input id="cost" name="cost" inputMode="decimal" defaultValue={values.cost ?? '0,00'} />
          </Field>
          <Field label="Retail price" htmlFor="retail" hint="Leave at zero for professional-only stock.">
            <Input id="retail" name="retail" inputMode="decimal" defaultValue={values.retail ?? '0,00'} />
          </Field>
          <Field label="Reorder level" htmlFor="reorderLevel" hint="Flagged when stock reaches this.">
            <Input id="reorderLevel" name="reorderLevel" inputMode="decimal" defaultValue={values.reorderLevel ?? 0} />
          </Field>
          <Field label="Reorder quantity" htmlFor="reorderQty" hint="Suggested order size.">
            <Input id="reorderQty" name="reorderQty" inputMode="decimal" defaultValue={values.reorderQty ?? 0} />
          </Field>
          {isNew ? (
            <Field label="Opening stock" htmlFor="openingQty" hint="Recorded as a purchase movement.">
              <Input id="openingQty" name="openingQty" inputMode="decimal" defaultValue="0" />
            </Field>
          ) : null}
          <Field label="Expiry date" htmlFor="expiresAt">
            <Input id="expiresAt" name="expiresAt" type="date" defaultValue={values.expiresAt ?? ''} />
          </Field>
          <Field label="Storage location" htmlFor="location">
            <Input id="location" name="location" defaultValue={values.location ?? ''} placeholder="Shelf A, fridge…" />
          </Field>
          <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" rows={2} defaultValue={values.notes ?? ''} />
          </Field>
          <div className="flex flex-wrap gap-5 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox name="trackStock" defaultChecked={values.trackStock ?? true} /> Track stock levels
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox name="isActive" defaultChecked={values.isActive ?? true} /> Active
            </label>
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

export function StockAdjustForm({
  action,
  unit,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  unit: string
}) {
  const [state, formAction] = useActionState(action, emptyState)

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Movement" htmlFor="type">
          <Select id="type" name="type" defaultValue="PURCHASE">
            <option value="PURCHASE">Stock received</option>
            <option value="ADJUSTMENT">Correction (signed)</option>
            <option value="WASTAGE">Wastage / breakage</option>
            <option value="EXPIRY">Expiry write-off</option>
            <option value="RETURN_TO_SUPPLIER">Returned to supplier</option>
            <option value="CUSTOMER_RETURN">Customer return</option>
          </Select>
        </Field>
        <Field label={`Quantity (${unit})`} htmlFor="quantity" required>
          <Input id="quantity" name="quantity" inputMode="decimal" required />
        </Field>
        <Field label="Unit cost" htmlFor="unitCost" hint="On a purchase this updates the product's cost.">
          <Input id="unitCost" name="unitCost" inputMode="decimal" />
        </Field>
        <Field label="Reference" htmlFor="reference">
          <Input id="reference" name="reference" placeholder="Invoice or delivery note" />
        </Field>
      </div>
      <Field label="Note" htmlFor="note">
        <Input id="note" name="note" />
      </Field>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      <div className="flex justify-end">
        <SubmitButton size="sm">Record movement</SubmitButton>
      </div>
    </form>
  )
}
