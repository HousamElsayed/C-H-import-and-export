'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Checkbox, Field, FormError, FormSuccess, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { buttonClass } from '@/components/ui/button'
import { emptyState, type ActionState } from '@/lib/forms'

export type ClientFormValues = {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string | null
  birthDate?: string | null
  gender?: string
  status?: string
  source?: string
  address?: string | null
  city?: string | null
  occupation?: string | null
  skinType?: string | null
  allergies?: string | null
  medications?: string | null
  medicalNotes?: string | null
  preferences?: string | null
  internalNotes?: string | null
  referredById?: string | null
  marketingSms?: boolean
  marketingEmail?: boolean
  marketingWhatsapp?: boolean
  kvkkConsent?: boolean
  tagIds?: string[]
}

const GENDERS = [
  ['FEMALE', 'Female'],
  ['MALE', 'Male'],
  ['OTHER', 'Other'],
  ['UNDISCLOSED', 'Prefer not to say'],
]

const STATUSES = [
  ['LEAD', 'Lead'],
  ['ACTIVE', 'Active'],
  ['DORMANT', 'Dormant'],
  ['BLOCKED', 'Blocked'],
]

const SOURCES = [
  ['WALK_IN', 'Walk-in'],
  ['PHONE', 'Phone'],
  ['WHATSAPP', 'WhatsApp'],
  ['INSTAGRAM', 'Instagram'],
  ['WEBSITE', 'Website'],
  ['REFERRAL', 'Referral'],
  ['OTHER', 'Other'],
]

export function ClientForm({
  action,
  values = {},
  tags,
  referrers,
  canEditClinical,
  submitLabel = 'Save client',
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  values?: ClientFormValues
  tags: { id: string; name: string; colorHex: string }[]
  referrers: { id: string; firstName: string; lastName: string }[]
  canEditClinical: boolean
  submitLabel?: string
  cancelHref: string
}) {
  const [state, formAction] = useActionState(action, emptyState)
  const selectedTags = new Set(values.tagIds ?? [])

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />

      <Card>
        <CardHeader title="Personal details" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="firstName" required error={state.fieldErrors?.firstName}>
            <Input id="firstName" name="firstName" defaultValue={values.firstName} required />
          </Field>
          <Field label="Last name" htmlFor="lastName" required error={state.fieldErrors?.lastName}>
            <Input id="lastName" name="lastName" defaultValue={values.lastName} required />
          </Field>
          <Field label="Phone" htmlFor="phone" required error={state.fieldErrors?.phone} hint="Used for reminders and duplicate checks.">
            <Input id="phone" name="phone" defaultValue={values.phone} required placeholder="+90 5xx xxx xx xx" />
          </Field>
          <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
            <Input id="email" name="email" type="email" defaultValue={values.email ?? ''} />
          </Field>
          <Field label="Date of birth" htmlFor="birthDate" hint="Drives birthday offers.">
            <Input id="birthDate" name="birthDate" type="date" defaultValue={values.birthDate ?? ''} />
          </Field>
          <Field label="Gender" htmlFor="gender">
            <Select id="gender" name="gender" defaultValue={values.gender ?? 'UNDISCLOSED'}>
              {GENDERS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="City" htmlFor="city">
            <Input id="city" name="city" defaultValue={values.city ?? ''} />
          </Field>
          <Field label="Occupation" htmlFor="occupation">
            <Input id="occupation" name="occupation" defaultValue={values.occupation ?? ''} />
          </Field>
          <Field label="Address" htmlFor="address" className="sm:col-span-2">
            <Textarea id="address" name="address" rows={2} defaultValue={values.address ?? ''} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Relationship" description="How this client found the clinic and how they are managed." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={values.status ?? 'ACTIVE'}>
              {STATUSES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Source" htmlFor="source">
            <Select id="source" name="source" defaultValue={values.source ?? 'WALK_IN'}>
              {SOURCES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Referred by" htmlFor="referredById" className="sm:col-span-2">
            <Select id="referredById" name="referredById" defaultValue={values.referredById ?? ''}>
              <option value="">No referrer</option>
              {referrers.map((referrer) => (
                <option key={referrer.id} value={referrer.id}>
                  {referrer.firstName} {referrer.lastName}
                </option>
              ))}
            </Select>
          </Field>

          {tags.length > 0 ? (
            <div className="sm:col-span-2">
              <p className="label">Tags</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-muted transition has-[:checked]:border-brand-ring has-[:checked]:bg-brand-soft has-[:checked]:text-brand-strong"
                  >
                    <Checkbox name="tagIds" value={tag.id} defaultChecked={selectedTags.has(tag.id)} />
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: tag.colorHex }} />
                    {tag.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Clinical record"
          description={
            canEditClinical
              ? 'Confidential. Visible to clinical staff and managers only.'
              : 'Your role cannot edit clinical fields.'
          }
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Skin type" htmlFor="skinType">
            <Input id="skinType" name="skinType" defaultValue={values.skinType ?? ''} disabled={!canEditClinical} />
          </Field>
          <Field label="Allergies" htmlFor="allergies" hint="Shown as a warning at booking and checkout.">
            <Input id="allergies" name="allergies" defaultValue={values.allergies ?? ''} disabled={!canEditClinical} />
          </Field>
          <Field label="Current medication" htmlFor="medications" className="sm:col-span-2">
            <Textarea id="medications" name="medications" rows={2} defaultValue={values.medications ?? ''} disabled={!canEditClinical} />
          </Field>
          <Field label="Medical history" htmlFor="medicalNotes" className="sm:col-span-2">
            <Textarea id="medicalNotes" name="medicalNotes" rows={3} defaultValue={values.medicalNotes ?? ''} disabled={!canEditClinical} />
          </Field>
          <Field label="Preferences" htmlFor="preferences" className="sm:col-span-2" hint="Preferred therapist, room temperature, music, pressure…">
            <Textarea id="preferences" name="preferences" rows={2} defaultValue={values.preferences ?? ''} />
          </Field>
          <Field label="Internal notes" htmlFor="internalNotes" className="sm:col-span-2" hint="Never shown to the client.">
            <Textarea id="internalNotes" name="internalNotes" rows={2} defaultValue={values.internalNotes ?? ''} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Consent and marketing" description="Only contact clients on channels they have agreed to." />
        <CardBody className="space-y-3">
          <label className="flex items-start gap-3 text-sm text-ink">
            <Checkbox name="kvkkConsent" defaultChecked={values.kvkkConsent} className="mt-0.5" />
            <span>
              Data processing consent signed
              <span className="block text-xs text-ink-muted">
                Required before storing clinical notes or photographs.
              </span>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox name="marketingSms" defaultChecked={values.marketingSms} /> SMS
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox name="marketingEmail" defaultChecked={values.marketingEmail} /> Email
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox name="marketingWhatsapp" defaultChecked={values.marketingWhatsapp} /> WhatsApp
            </label>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href={cancelHref} className={buttonClass('outline', 'md')}>
          Cancel
        </Link>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  )
}
