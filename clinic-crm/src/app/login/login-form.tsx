'use client'

import { useActionState } from 'react'
import { login, type LoginState } from './actions'
import { Field, FormError, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'

const initialState: LoginState = {}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(login, initialState)

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="you@clinic.com"
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </Field>

      <FormError message={state.error} />

      <SubmitButton className="w-full" size="lg" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  )
}
