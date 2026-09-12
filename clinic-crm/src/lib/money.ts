/**
 * All monetary values are integers in minor units (1/100 of the currency).
 * Percentages and commission rates are basis points: 2000 bps = 20%.
 */

export const MINOR_PER_UNIT = 100

let displayLocale = 'tr-TR'
let displayCurrency = 'TRY'

export function configureMoney(locale: string, currency: string) {
  displayLocale = locale
  displayCurrency = currency
}

export function formatMoney(
  minor: number,
  options?: { locale?: string; currency?: string; withSymbol?: boolean },
): string {
  const locale = options?.locale ?? displayLocale
  const currency = options?.currency ?? displayCurrency
  const value = minor / MINOR_PER_UNIT
  if (options?.withSymbol === false) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

/** Parses user input such as "1.250,50", "1250.5" or "1 250" into minor units. */
export function parseMoney(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === '') return 0
  if (typeof input === 'number') return Math.round(input * MINOR_PER_UNIT)

  const cleaned = input.trim().replace(/[^\d.,-]/g, '')
  if (!cleaned) return 0

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let normalised: string

  if (lastComma === -1 && lastDot === -1) {
    normalised = cleaned
  } else if (lastComma > lastDot) {
    // Comma is the decimal separator: strip dots used as thousands separators.
    normalised = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    normalised = cleaned.replace(/,/g, '')
  }

  const value = Number.parseFloat(normalised)
  if (Number.isNaN(value)) return 0
  return Math.round(value * MINOR_PER_UNIT)
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`
}

export function parseBps(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === '') return 0
  const value = typeof input === 'number' ? input : Number.parseFloat(String(input).replace(',', '.'))
  if (Number.isNaN(value)) return 0
  return Math.round(value * 100)
}

export function applyBps(amountMinor: number, bps: number): number {
  return Math.round((amountMinor * bps) / 10000)
}

export function applyDiscount(
  subtotalMinor: number,
  type: 'NONE' | 'PERCENT' | 'FIXED',
  value: number,
): number {
  if (type === 'PERCENT') return Math.min(subtotalMinor, applyBps(subtotalMinor, value))
  if (type === 'FIXED') return Math.min(subtotalMinor, Math.max(0, value))
  return 0
}

/**
 * Totals an invoice. Tax is calculated on the discounted subtotal, which is the
 * convention for VAT-exclusive pricing. Set taxBps to 0 for tax-inclusive prices.
 */
export function computeTotals(params: {
  subtotalMinor: number
  discountType: 'NONE' | 'PERCENT' | 'FIXED'
  discountValue: number
  taxBps: number
}) {
  const discountMinor = applyDiscount(params.subtotalMinor, params.discountType, params.discountValue)
  const net = Math.max(0, params.subtotalMinor - discountMinor)
  const taxMinor = applyBps(net, params.taxBps)
  return { discountMinor, taxMinor, totalMinor: net + taxMinor }
}
