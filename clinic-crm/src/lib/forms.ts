import { z } from 'zod'

/**
 * FormData.get() returns null for absent fields, which Zod's .optional()
 * rejects. These helpers normalise to undefined and coerce the common shapes.
 */

export function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)
  if (value === null) return undefined
  const text = String(value).trim()
  return text === '' ? undefined : text
}

export function bool(formData: FormData, key: string): boolean {
  const value = formData.get(key)
  return value === 'on' || value === 'true' || value === '1'
}

export function num(formData: FormData, key: string): number | undefined {
  const value = str(formData, key)
  if (value === undefined) return undefined
  const parsed = Number.parseFloat(value.replace(',', '.'))
  return Number.isNaN(parsed) ? undefined : parsed
}

export function int(formData: FormData, key: string): number | undefined {
  const value = num(formData, key)
  return value === undefined ? undefined : Math.round(value)
}

export function date(formData: FormData, key: string): Date | undefined {
  const value = str(formData, key)
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function list(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String).filter(Boolean)
}

/** Every value in the form, with empty strings and nulls dropped. */
export function toObject(formData: FormData): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}
  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key).map(String).filter((value) => value !== '')
    if (values.length === 0) continue
    result[key] = values.length === 1 ? values[0]! : values
  }
  return result
}

export type ActionState = {
  ok?: boolean
  error?: string
  fieldErrors?: Record<string, string>
  message?: string
}

export const emptyState: ActionState = {}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, error, fieldErrors }
}

export function succeed(message?: string): ActionState {
  return { ok: true, message }
}

export function zodFail(error: z.ZodError): ActionState {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return {
    ok: false,
    error: error.issues[0]?.message ?? 'Check the details you entered.',
    fieldErrors,
  }
}

/** Turns a thrown error from an action into a user-facing state. */
export function toActionState(error: unknown): ActionState {
  if (error instanceof z.ZodError) return zodFail(error)
  if (error instanceof Error) return fail(error.message)
  return fail('Something went wrong. Please try again.')
}
