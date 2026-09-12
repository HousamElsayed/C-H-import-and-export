'use client'

import { useActionState } from 'react'
import { Field, FormError, FormSuccess, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { emptyState, type ActionState } from '@/lib/forms'

export function AppointmentNotes({
  action,
  notes,
  internalNotes,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  notes: string | null
  internalNotes: string | null
}) {
  const [state, formAction] = useActionState(action, emptyState)

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Note for the therapist" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} defaultValue={notes ?? ''} />
      </Field>
      <Field label="Internal note" htmlFor="internalNotes" hint="Not shown to the client.">
        <Textarea id="internalNotes" name="internalNotes" rows={2} defaultValue={internalNotes ?? ''} />
      </Field>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      <div className="flex justify-end">
        <SubmitButton size="sm">Save notes</SubmitButton>
      </div>
    </form>
  )
}
