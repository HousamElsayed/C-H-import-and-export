import {
  addDays,
  addMinutes,
  differenceInMinutes,
  endOfDay,
  endOfMonth,
  format,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

export const MINUTES_PER_DAY = 1440

export function minutesFromMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

export function atMinutes(day: Date, minutes: number) {
  const base = startOfDay(day)
  return addMinutes(base, minutes)
}

export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function parseTimeToMinutes(value: string) {
  const [h, m] = value.split(':').map((part) => Number.parseInt(part, 10))
  if (Number.isNaN(h)) return 0
  return h * 60 + (Number.isNaN(m) ? 0 : m)
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd
}

export function durationMinutes(start: Date, end: Date) {
  return differenceInMinutes(end, start)
}

export function dayRange(day: Date) {
  return { from: startOfDay(day), to: endOfDay(day) }
}

export function weekRange(day: Date, weekStartsOn: 0 | 1 = 1) {
  const from = startOfWeek(day, { weekStartsOn })
  return { from, to: endOfDay(addDays(from, 6)) }
}

export function monthRange(day: Date) {
  return { from: startOfMonth(day), to: endOfDay(endOfMonth(day)) }
}

export function toDateInput(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export function fromDateInput(value: string) {
  return parse(value, 'yyyy-MM-dd', new Date())
}

export function formatDate(date: Date, locale = 'tr-TR') {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}

export function formatTime(date: Date, locale = 'tr-TR') {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date)
}

export function formatDateTime(date: Date, locale = 'tr-TR') {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatRelativeDay(date: Date, locale = 'tr-TR') {
  const today = startOfDay(new Date())
  const target = startOfDay(date)
  const diff = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (Math.abs(diff) < 7) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(diff, 'day')
  }
  return formatDate(date, locale)
}

export function age(birthDate: Date) {
  const now = new Date()
  let years = now.getFullYear() - birthDate.getFullYear()
  const m = now.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) years -= 1
  return years
}

export { addDays, addMinutes, startOfDay, endOfDay, format }
