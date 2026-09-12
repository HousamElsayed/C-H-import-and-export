'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Checkbox, Field, FormError, FormSuccess, Input, Select } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { buttonClass } from '@/components/ui/button'
import { ROLE_LABELS } from '@/lib/rbac'
import { formatMinutes } from '@/lib/dates'
import { emptyState, type ActionState } from '@/lib/forms'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export type StaffFormValues = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string | null
  role?: string
  title?: string | null
  colorHex?: string
  commission?: string
  isBookable?: boolean
  isActive?: boolean
  workingHours?: { weekday: number; startMin: number; endMin: number }[]
}

export function StaffForm({
  action,
  values = {},
  isNew,
  canAssignOwner,
  cancelHref,
  submitLabel = 'Save team member',
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  values?: StaffFormValues
  isNew: boolean
  canAssignOwner: boolean
  cancelHref: string
  submitLabel?: string
}) {
  const [state, formAction] = useActionState(action, emptyState)
  const hoursByDay = new Map((values.workingHours ?? []).map((hour) => [hour.weekday, hour]))

  const roles = (Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[]).filter(
    (role) => role !== 'OWNER' || canAssignOwner,
  )

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />

      <Card>
        <CardHeader title="Person" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="firstName" required error={state.fieldErrors?.firstName}>
            <Input id="firstName" name="firstName" defaultValue={values.firstName} required />
          </Field>
          <Field label="Last name" htmlFor="lastName" required error={state.fieldErrors?.lastName}>
            <Input id="lastName" name="lastName" defaultValue={values.lastName} required />
          </Field>
          <Field label="Email" htmlFor="email" required error={state.fieldErrors?.email} hint="Used to sign in.">
            <Input id="email" name="email" type="email" defaultValue={values.email} required />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={values.phone ?? ''} />
          </Field>
          <Field label="Job title" htmlFor="title">
            <Input id="title" name="title" defaultValue={values.title ?? ''} placeholder="Senior aesthetician" />
          </Field>
          <Field label="Calendar colour" htmlFor="colorHex">
            <Input id="colorHex" name="colorHex" type="color" defaultValue={values.colorHex ?? '#8b5cf6'} className="h-10 p-1" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Access and pay" description="The role decides what this person can see and do." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Role" htmlFor="role" required>
            <Select id="role" name="role" defaultValue={values.role ?? 'RECEPTIONIST'} required>
              {roles.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Commission (%)" htmlFor="commission" hint="Applied to services they deliver.">
            <Input id="commission" name="commission" inputMode="decimal" defaultValue={values.commission ?? '0'} />
          </Field>
          <Field
            label={isNew ? 'Password' : 'New password'}
            htmlFor="password"
            required={isNew}
            error={state.fieldErrors?.password}
            hint={isNew ? 'At least 10 characters.' : 'Leave blank to keep the current password. Changing it signs them out everywhere.'}
            className="sm:col-span-2"
          >
            <Input id="password" name="password" type="password" autoComplete="new-password" required={isNew} minLength={10} />
          </Field>
          <div className="flex flex-wrap gap-5 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox name="isBookable" defaultChecked={values.isBookable} /> Appears in the calendar
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox name="isActive" defaultChecked={values.isActive ?? true} /> Account active
            </label>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Working hours" description="Bookings outside these hours are flagged as out of shift." />
        <CardBody className="space-y-2">
          {WEEKDAYS.map((label, weekday) => {
            const existing = hoursByDay.get(weekday)
            return (
              <div key={weekday} className="flex flex-wrap items-center gap-3">
                <label className="flex w-36 items-center gap-2 text-sm text-ink">
                  <Checkbox name={`day-${weekday}-enabled`} defaultChecked={Boolean(existing)} />
                  {label}
                </label>
                <Input
                  name={`day-${weekday}-start`}
                  type="time"
                  step={900}
                  defaultValue={existing ? formatMinutes(existing.startMin) : '09:00'}
                  className="w-32"
                  aria-label={`${label} start`}
                />
                <span className="text-ink-subtle">to</span>
                <Input
                  name={`day-${weekday}-end`}
                  type="time"
                  step={900}
                  defaultValue={existing ? formatMinutes(existing.endMin) : '19:00'}
                  className="w-32"
                  aria-label={`${label} end`}
                />
              </div>
            )
          })}
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href={cancelHref} className={buttonClass('outline', 'md')}>Cancel</Link>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  )
}
