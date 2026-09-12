'use client'

import { useActionState, useState } from 'react'
import { Checkbox, Field, FormError, FormSuccess, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { TEMPLATE_TOKENS } from '@/lib/template-tokens'
import { emptyState, type ActionState } from '@/lib/forms'

const PURPOSES = [
  ['CAMPAIGN', 'Campaign'],
  ['APPOINTMENT_REMINDER', 'Appointment reminder'],
  ['APPOINTMENT_CONFIRMATION', 'Booking confirmation'],
  ['APPOINTMENT_CANCELLATION', 'Cancellation'],
  ['BIRTHDAY', 'Birthday'],
  ['WIN_BACK', 'Win back'],
  ['AFTERCARE', 'Aftercare'],
]

export function TemplateEditor({
  action,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
}) {
  const [state, formAction] = useActionState(action, emptyState)
  const [channel, setChannel] = useState('SMS')

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Name" htmlFor="templateName" required>
        <Input id="templateName" name="name" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Channel" htmlFor="templateChannel">
          <Select
            id="templateChannel"
            name="channel"
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
          >
            <option value="SMS">SMS</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">Email</option>
          </Select>
        </Field>
        <Field label="Purpose" htmlFor="templatePurpose">
          <Select id="templatePurpose" name="purpose" defaultValue="CAMPAIGN">
            {PURPOSES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
      </div>
      {channel === 'EMAIL' ? (
        <Field label="Subject" htmlFor="templateSubject">
          <Input id="templateSubject" name="subject" />
        </Field>
      ) : null}
      <Field
        label="Message"
        htmlFor="templateBody"
        required
        hint={TEMPLATE_TOKENS.map((token) => `{{${token}}}`).join(' ')}
      >
        <Textarea id="templateBody" name="body" rows={4} required />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink">
        <Checkbox name="isActive" defaultChecked /> Active
      </label>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      <div className="flex justify-end">
        <SubmitButton size="sm">Save template</SubmitButton>
      </div>
    </form>
  )
}
