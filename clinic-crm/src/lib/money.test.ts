import { describe, expect, it } from 'vitest'
import { applyBps, applyDiscount, computeTotals, formatBps, parseBps, parseMoney } from './money'

describe('parseMoney', () => {
  it('reads a plain decimal', () => {
    expect(parseMoney('12.50')).toBe(1250)
  })

  it('reads Turkish formatting where comma is the decimal separator', () => {
    expect(parseMoney('1.250,50')).toBe(125050)
    expect(parseMoney('1.250')).toBe(125000)
  })

  it('reads English thousands separators', () => {
    expect(parseMoney('1,250.50')).toBe(125050)
  })

  it('ignores currency symbols and spaces', () => {
    expect(parseMoney('₺ 2 500,00')).toBe(250000)
  })

  it('treats blanks and nonsense as zero', () => {
    expect(parseMoney('')).toBe(0)
    expect(parseMoney(null)).toBe(0)
    expect(parseMoney('abc')).toBe(0)
  })

  it('rounds to the nearest minor unit rather than truncating', () => {
    expect(parseMoney('0.005')).toBe(1)
    expect(parseMoney(19.999)).toBe(2000)
  })
})

describe('basis points', () => {
  it('round-trips a percentage', () => {
    expect(parseBps('20')).toBe(2000)
    expect(formatBps(2000)).toBe('20%')
    expect(formatBps(1250)).toBe('12.50%')
  })

  it('applies a rate without floating point drift', () => {
    expect(applyBps(10_00, 2000)).toBe(200)
    expect(applyBps(333, 2000)).toBe(67)
  })
})

describe('applyDiscount', () => {
  it('never discounts more than the subtotal', () => {
    expect(applyDiscount(5000, 'FIXED', 9000)).toBe(5000)
    expect(applyDiscount(5000, 'PERCENT', 20000)).toBe(5000)
  })

  it('ignores a negative fixed discount', () => {
    expect(applyDiscount(5000, 'FIXED', -100)).toBe(0)
  })
})

describe('computeTotals', () => {
  it('taxes the discounted subtotal, not the gross', () => {
    const totals = computeTotals({
      subtotalMinor: 100_00,
      discountType: 'PERCENT',
      discountValue: 1000, // 10%
      taxBps: 2000, // 20%
    })
    expect(totals.discountMinor).toBe(10_00)
    expect(totals.taxMinor).toBe(18_00)
    expect(totals.totalMinor).toBe(108_00)
  })

  it('handles a zero-rated sale', () => {
    const totals = computeTotals({
      subtotalMinor: 25_00,
      discountType: 'NONE',
      discountValue: 0,
      taxBps: 0,
    })
    expect(totals).toEqual({ discountMinor: 0, taxMinor: 0, totalMinor: 25_00 })
  })

  it('cannot produce a negative total', () => {
    const totals = computeTotals({
      subtotalMinor: 10_00,
      discountType: 'FIXED',
      discountValue: 50_00,
      taxBps: 2000,
    })
    expect(totals.totalMinor).toBe(0)
  })
})
