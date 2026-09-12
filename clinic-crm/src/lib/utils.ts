import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Normalises a phone number for storage and duplicate detection. */
export function normalisePhone(input: string) {
  const trimmed = input.trim().replace(/[\s()\-.]/g, '')
  if (trimmed.startsWith('00')) return `+${trimmed.slice(2)}`
  return trimmed
}

/** Stock quantities are fractional (0.05 of a bottle); keep them free of float drift. */
export function roundQty(value: number) {
  return Math.round(value * 1000) / 1000
}

export function formatQty(value: number, unit?: string) {
  const rounded = roundQty(value)
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0$/, '').replace(/\.$/, '')
  return unit ? `${text} ${unit}` : text
}

export function pluralise(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}
