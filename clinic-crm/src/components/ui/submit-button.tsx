'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import type { ComponentProps } from 'react'

type Props = Omit<ComponentProps<typeof Button>, 'type'> & { pendingLabel?: string }

export function SubmitButton({ children, pendingLabel, disabled, ...props }: Props) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? (pendingLabel ?? 'Saving…') : children}
    </Button>
  )
}
