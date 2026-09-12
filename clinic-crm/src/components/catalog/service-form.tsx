'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Checkbox, Field, FormError, FormSuccess, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button, buttonClass } from '@/components/ui/button'
import { emptyState, type ActionState } from '@/lib/forms'

export type ServiceFormValues = {
  name?: string
  categoryId?: string
  description?: string | null
  durationMin?: number
  bufferMin?: number
  price?: string
  cost?: string
  commissionBps?: string
  colorHex?: string
  requiresPatchTest?: boolean
  patchTestDays?: number
  requiresConsent?: boolean
  consentTemplateId?: string | null
  aftercareNote?: string | null
  isOnlineBookable?: boolean
  isActive?: boolean
  staffIds?: string[]
  roomIds?: string[]
  usages?: { productId: string; quantity: number }[]
}

type Option = { id: string; name: string }

export function ServiceForm({
  action,
  values = {},
  categories,
  staff,
  rooms,
  products,
  consentTemplates,
  submitLabel = 'Save service',
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  values?: ServiceFormValues
  categories: (Option & { colorHex: string })[]
  staff: { id: string; firstName: string; lastName: string; title: string | null }[]
  rooms: Option[]
  products: { id: string; name: string; sku: string; unit: string }[]
  consentTemplates: Option[]
  submitLabel?: string
  cancelHref: string
}) {
  const [state, formAction] = useActionState(action, emptyState)
  const [usageRows, setUsageRows] = useState<{ key: number; productId: string; quantity: string }[]>(
    (values.usages ?? []).map((usage, index) => ({
      key: index,
      productId: usage.productId,
      quantity: String(usage.quantity),
    })),
  )
  const [requiresConsent, setRequiresConsent] = useState(values.requiresConsent ?? false)
  const [requiresPatchTest, setRequiresPatchTest] = useState(values.requiresPatchTest ?? false)

  const selectedStaff = new Set(values.staffIds ?? [])
  const selectedRooms = new Set(values.roomIds ?? [])

  function addRow() {
    setUsageRows((rows) => [...rows, { key: Date.now(), productId: '', quantity: '1' }])
  }

  function removeRow(key: number) {
    setUsageRows((rows) => rows.filter((row) => row.key !== key))
  }

  function updateRow(key: number, patch: Partial<{ productId: string; quantity: string }>) {
    setUsageRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />

      <Card>
        <CardHeader title="Service" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" required error={state.fieldErrors?.name}>
            <Input id="name" name="name" defaultValue={values.name} required />
          </Field>
          <Field label="Category" htmlFor="categoryId" required>
            <Select id="categoryId" name="categoryId" defaultValue={values.categoryId} required>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Duration (minutes)" htmlFor="durationMin" required error={state.fieldErrors?.durationMin}>
            <Input id="durationMin" name="durationMin" type="number" min={5} step={5} defaultValue={values.durationMin ?? 60} required />
          </Field>
          <Field label="Clean-down buffer (minutes)" htmlFor="bufferMin" hint="Blocked after the appointment.">
            <Input id="bufferMin" name="bufferMin" type="number" min={0} step={5} defaultValue={values.bufferMin ?? 0} />
          </Field>
          <Field label="Price" htmlFor="price" required hint="Tax is applied at checkout.">
            <Input id="price" name="price" inputMode="decimal" defaultValue={values.price ?? '0,00'} required />
          </Field>
          <Field label="Direct cost" htmlFor="cost" hint="Used for margin reporting.">
            <Input id="cost" name="cost" inputMode="decimal" defaultValue={values.cost ?? '0,00'} />
          </Field>
          <Field label="Commission override (%)" htmlFor="commissionBps" hint="Blank uses the therapist's own rate.">
            <Input id="commissionBps" name="commissionBps" inputMode="decimal" defaultValue={values.commissionBps ?? ''} />
          </Field>
          <Field label="Calendar colour" htmlFor="colorHex">
            <Input id="colorHex" name="colorHex" type="color" defaultValue={values.colorHex ?? '#0ea5e9'} className="h-10 p-1" />
          </Field>
          <Field label="Description" htmlFor="description" className="sm:col-span-2">
            <Textarea id="description" name="description" rows={2} defaultValue={values.description ?? ''} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Who and where" description="Only selected staff and rooms can be booked for this service." />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="label">Staff</p>
            <div className="space-y-1.5">
              {staff.map((member) => (
                <label key={member.id} className="flex items-center gap-2 text-sm text-ink">
                  <Checkbox name="staffIds" value={member.id} defaultChecked={selectedStaff.has(member.id)} />
                  {member.firstName} {member.lastName}
                  {member.title ? <span className="text-xs text-ink-subtle">· {member.title}</span> : null}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Rooms</p>
            <div className="space-y-1.5">
              {rooms.map((room) => (
                <label key={room.id} className="flex items-center gap-2 text-sm text-ink">
                  <Checkbox name="roomIds" value={room.id} defaultChecked={selectedRooms.has(room.id)} />
                  {room.name}
                </label>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Products used"
          description="Deducted from stock automatically when the appointment is completed."
          action={
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4" /> Add product
            </Button>
          }
        />
        <CardBody>
          {usageRows.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No products linked. Add one so stock and treatment cost stay accurate.
            </p>
          ) : (
            <ul className="space-y-2">
              {usageRows.map((row) => {
                const product = products.find((item) => item.id === row.productId)
                return (
                  <li key={row.key} className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Select
                        name="usageProductId"
                        value={row.productId}
                        onChange={(event) => updateRow(row.key, { productId: event.target.value })}
                      >
                        <option value="">Choose a product…</option>
                        {products.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.sku})
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="w-32">
                      <Input
                        name="usageQuantity"
                        inputMode="decimal"
                        value={row.quantity}
                        onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                        aria-label="Quantity used"
                      />
                    </div>
                    <span className="w-14 pb-2.5 text-xs text-ink-subtle">{product?.unit ?? ''}</span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.key)} aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Safety and booking rules" />
        <CardBody className="space-y-4">
          <label className="flex items-start gap-3 text-sm text-ink">
            <Checkbox
              name="requiresConsent"
              defaultChecked={values.requiresConsent}
              onChange={(event) => setRequiresConsent(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              Requires a signed consent form
              <span className="block text-xs text-ink-muted">Flagged at booking and at check-in.</span>
            </span>
          </label>
          {requiresConsent ? (
            <Field label="Consent form" htmlFor="consentTemplateId">
              <Select id="consentTemplateId" name="consentTemplateId" defaultValue={values.consentTemplateId ?? ''}>
                <option value="">Choose a form…</option>
                {consentTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </Select>
            </Field>
          ) : null}

          <label className="flex items-start gap-3 text-sm text-ink">
            <Checkbox
              name="requiresPatchTest"
              defaultChecked={values.requiresPatchTest}
              onChange={(event) => setRequiresPatchTest(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              Requires a patch test beforehand
              <span className="block text-xs text-ink-muted">Warns if the client has no recent test.</span>
            </span>
          </label>
          {requiresPatchTest ? (
            <Field label="Patch test lead time (days)" htmlFor="patchTestDays">
              <Input id="patchTestDays" name="patchTestDays" type="number" min={0} defaultValue={values.patchTestDays ?? 2} />
            </Field>
          ) : null}

          <Field label="Aftercare instructions" htmlFor="aftercareNote" hint="Sent to the client after the appointment.">
            <Textarea id="aftercareNote" name="aftercareNote" rows={3} defaultValue={values.aftercareNote ?? ''} />
          </Field>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox name="isActive" defaultChecked={values.isActive ?? true} /> Active
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox name="isOnlineBookable" defaultChecked={values.isOnlineBookable ?? true} /> Bookable
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
