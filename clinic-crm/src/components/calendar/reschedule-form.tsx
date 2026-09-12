'use client'

import { useActionState } from 'react'
import { Field, FormError, FormSuccess, Input, Select } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { emptyState, type ActionState } from '@/lib/forms'

export function RescheduleForm({
  action,
  staff,
  rooms,
  defaults,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  staff: { id: string; firstName: string; lastName: string }[]
  rooms: { id: string; name: string }[]
  defaults: { date: string; time: string; staffId: string; roomId: string }
}) {
  const [state, formAction] = useActionState(action, emptyState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="rescheduleDate">
          <Input id="rescheduleDate" name="date" type="date" defaultValue={defaults.date} required />
        </Field>
        <Field label="Start time" htmlFor="rescheduleTime">
          <Input id="rescheduleTime" name="time" type="time" step={900} defaultValue={defaults.time} required />
        </Field>
        <Field label="Team member" htmlFor="rescheduleStaff">
          <Select id="rescheduleStaff" name="staffId" defaultValue={defaults.staffId} required>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Room" htmlFor="rescheduleRoom">
          <Select id="rescheduleRoom" name="roomId" defaultValue={defaults.roomId}>
            <option value="">No room</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </Select>
        </Field>
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      <div className="flex justify-end">
        <SubmitButton size="sm" variant="outline" pendingLabel="Moving…">
          Move appointment
        </SubmitButton>
      </div>
    </form>
  )
}
