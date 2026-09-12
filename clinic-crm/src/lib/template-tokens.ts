/**
 * Pure template helpers. Kept free of database imports so client components
 * (template editor, campaign builder) can use them without pulling the Prisma
 * driver into the browser bundle.
 */

export const TEMPLATE_TOKENS = [
  'client_first_name',
  'client_last_name',
  'clinic_name',
  'clinic_phone',
  'service_name',
  'staff_name',
  'date',
  'time',
] as const

export type TemplateTokens = Record<string, string>

/** Replaces {{token}} placeholders; unknown tokens are stripped rather than shown. */
export function renderTemplate(body: string, tokens: TemplateTokens) {
  return body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => tokens[key] ?? '')
}
