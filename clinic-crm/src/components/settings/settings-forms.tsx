'use client'

import { useActionState } from 'react'
import { Field, FormError, FormSuccess, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { emptyState, type ActionState } from '@/lib/forms'

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>

export function ClinicSettingsForm({
  action,
  values,
}: {
  action: Action
  values: {
    name: string
    legalName: string | null
    taxNumber: string | null
    phone: string | null
    email: string | null
    address: string | null
    currency: string
    currencySymbol: string
    locale: string
    timeZone: string
    defaultTax: string
    slotMinutes: number
    openTime: string
    closeTime: string
    reminderHoursBefore: number
    cancellationWindowH: number
    loyaltyPointsPerUnit: number
    loyaltyUnit: string
    loyaltyPointValue: string
  }
}) {
  const [state, formAction] = useActionState(action, emptyState)

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Clinic name" htmlFor="name" required>
          <Input id="name" name="name" defaultValue={values.name} required />
        </Field>
        <Field label="Legal name" htmlFor="legalName">
          <Input id="legalName" name="legalName" defaultValue={values.legalName ?? ''} />
        </Field>
        <Field label="Tax number" htmlFor="taxNumber">
          <Input id="taxNumber" name="taxNumber" defaultValue={values.taxNumber ?? ''} />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={values.phone ?? ''} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={values.email ?? ''} />
        </Field>
        <Field label="Address" htmlFor="address" className="sm:col-span-2">
          <Textarea id="address" name="address" rows={2} defaultValue={values.address ?? ''} />
        </Field>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">Money and locale</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency code" htmlFor="currency" hint="Three letters, e.g. TRY, EUR, GBP.">
            <Input id="currency" name="currency" defaultValue={values.currency} maxLength={3} required />
          </Field>
          <Field label="Currency symbol" htmlFor="currencySymbol">
            <Input id="currencySymbol" name="currencySymbol" defaultValue={values.currencySymbol} maxLength={4} />
          </Field>
          <Field label="Locale" htmlFor="locale" hint="Controls number and date formatting.">
            <Input id="locale" name="locale" defaultValue={values.locale} />
          </Field>
          <Field label="Time zone" htmlFor="timeZone">
            <Input id="timeZone" name="timeZone" defaultValue={values.timeZone} />
          </Field>
          <Field label="Default tax rate (%)" htmlFor="defaultTax">
            <Input id="defaultTax" name="defaultTax" inputMode="decimal" defaultValue={values.defaultTax} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">Diary</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opens at" htmlFor="openTime">
            <Input id="openTime" name="openTime" type="time" step={900} defaultValue={values.openTime} />
          </Field>
          <Field label="Closes at" htmlFor="closeTime">
            <Input id="closeTime" name="closeTime" type="time" step={900} defaultValue={values.closeTime} />
          </Field>
          <Field label="Calendar slot size" htmlFor="slotMinutes">
            <Select id="slotMinutes" name="slotMinutes" defaultValue={String(values.slotMinutes)}>
              {[5, 10, 15, 20, 30, 60].map((value) => (
                <option key={value} value={value}>{value} minutes</option>
              ))}
            </Select>
          </Field>
          <Field label="Cancellation window (hours)" htmlFor="cancellationWindowH">
            <Input id="cancellationWindowH" name="cancellationWindowH" type="number" min={0} defaultValue={values.cancellationWindowH} />
          </Field>
          <Field label="Send reminders (hours before)" htmlFor="reminderHoursBefore">
            <Input id="reminderHoursBefore" name="reminderHoursBefore" type="number" min={1} defaultValue={values.reminderHoursBefore} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">Loyalty</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Points earned" htmlFor="loyaltyPointsPerUnit">
            <Input id="loyaltyPointsPerUnit" name="loyaltyPointsPerUnit" type="number" min={0} defaultValue={values.loyaltyPointsPerUnit} />
          </Field>
          <Field label="Per amount spent" htmlFor="loyaltyUnit">
            <Input id="loyaltyUnit" name="loyaltyUnit" inputMode="decimal" defaultValue={values.loyaltyUnit} />
          </Field>
          <Field label="Each point is worth" htmlFor="loyaltyPointValue">
            <Input id="loyaltyPointValue" name="loyaltyPointValue" inputMode="decimal" defaultValue={values.loyaltyPointValue} />
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </form>
  )
}

export function QuickAddForm({
  action,
  label,
  placeholder,
  withColor,
  extraFields,
}: {
  action: Action
  label: string
  placeholder?: string
  withColor?: boolean
  extraFields?: { name: string; placeholder: string }[]
}) {
  const [state, formAction] = useActionState(action, emptyState)

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input name="name" placeholder={placeholder ?? label} required className="min-w-0 flex-1" />
        {withColor ? (
          <Input name="colorHex" type="color" defaultValue="#8b5b9e" className="h-10 w-14 p-1" aria-label="Colour" />
        ) : null}
        <SubmitButton size="sm" variant="outline">Add</SubmitButton>
      </div>
      {extraFields?.map((field) => (
        <Input key={field.name} name={field.name} placeholder={field.placeholder} />
      ))}
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
    </form>
  )
}
