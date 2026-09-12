'use client'

import { useActionState, useRef } from 'react'
import { Checkbox, FormError, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { emptyState, type ActionState } from '@/lib/forms'

export function NoteForm({
  action,
  canWriteClinical,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  canWriteClinical: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await action(prev, formData)
      if (result.ok) formRef.current?.reset()
      return result
    },
    emptyState,
  )

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <Textarea name="body" rows={3} placeholder="Consultation notes, treatment observations, follow-up…" required />
      <FormError message={state.error} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {canWriteClinical ? (
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <Checkbox name="isClinical" /> Clinical note
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            <Checkbox name="isPinned" /> Pin to top
          </label>
        </div>
        <SubmitButton size="sm" pendingLabel="Adding…">
          Add note
        </SubmitButton>
      </div>
    </form>
  )
}
