'use client'

import { useActionState, useState } from 'react'
import { Field, FormError, FormSuccess, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { formatMoney } from '@/lib/money'
import { emptyState, type ActionState } from '@/lib/forms'

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>

const METHODS = [
  ['CARD', 'Card'],
  ['CASH', 'Cash'],
  ['BANK_TRANSFER', 'Bank transfer'],
  ['ONLINE', 'Online'],
  ['GIFT_CARD', 'Gift card'],
]

export function PaymentForm({ action, outstanding }: { action: Action; outstanding: number }) {
  const [state, formAction] = useActionState(action, emptyState)
  const [amount, setAmount] = useState(formatMoney(outstanding, { withSymbol: false }))

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Method" htmlFor="method">
          <Select id="method" name="method" defaultValue="CARD">
            {METHODS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Amount" htmlFor="amount" hint={`${formatMoney(outstanding)} outstanding`}>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
      </div>
      <Field label="Reference" htmlFor="reference">
        <Input id="reference" name="reference" placeholder="Card last 4 digits, transfer reference…" />
      </Field>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      <div className="flex justify-end">
        <SubmitButton size="sm">Record payment</SubmitButton>
      </div>
    </form>
  )
}

export function RefundForm({ action, maxMinor }: { action: Action; maxMinor: number }) {
  const [state, formAction] = useActionState(action, emptyState)

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Amount" htmlFor="refundAmount" hint={`Up to ${formatMoney(maxMinor)}`}>
        <Input
          id="refundAmount"
          name="amount"
          inputMode="decimal"
          defaultValue={formatMoney(maxMinor, { withSymbol: false })}
        />
      </Field>
      <Field label="Reason" htmlFor="refundReason" required>
        <Textarea id="refundReason" name="reason" rows={2} required placeholder="Why is this being refunded?" />
      </Field>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      <div className="flex justify-end">
        <SubmitButton size="sm" variant="danger" pendingLabel="Refunding…">
          Refund
        </SubmitButton>
      </div>
    </form>
  )
}

export function VoidForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, emptyState)

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Reason" htmlFor="voidReason" required>
        <Input id="voidReason" name="reason" required placeholder="Raised in error, duplicate…" />
      </Field>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      <div className="flex justify-end">
        <SubmitButton size="sm" variant="outline">Void invoice</SubmitButton>
      </div>
    </form>
  )
}
