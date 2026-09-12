import { describe, expect, it } from 'vitest'
import { atMinutes, durationMinutes, formatMinutes, minutesFromMidnight, overlaps, parseTimeToMinutes } from './dates'

describe('minute helpers', () => {
  it('round-trips a clock time', () => {
    expect(parseTimeToMinutes('09:30')).toBe(570)
    expect(formatMinutes(570)).toBe('09:30')
    expect(formatMinutes(0)).toBe('00:00')
  })

  it('reads the time of day from a date', () => {
    const date = new Date(2026, 8, 12, 14, 45)
    expect(minutesFromMidnight(date)).toBe(885)
  })

  it('builds a date at a given minute of the day', () => {
    const day = new Date(2026, 8, 12, 23, 59)
    expect(minutesFromMidnight(atMinutes(day, 600))).toBe(600)
  })
})

describe('overlaps', () => {
  const at = (hour: number, minute = 0) => new Date(2026, 8, 12, hour, minute)

  it('detects a genuine clash', () => {
    expect(overlaps(at(10), at(11), at(10, 30), at(11, 30))).toBe(true)
  })

  it('treats back-to-back bookings as free', () => {
    expect(overlaps(at(10), at(11), at(11), at(12))).toBe(false)
  })

  it('detects full containment in both directions', () => {
    expect(overlaps(at(10), at(12), at(10, 30), at(11))).toBe(true)
    expect(overlaps(at(10, 30), at(11), at(10), at(12))).toBe(true)
  })

  it('ignores periods that do not touch', () => {
    expect(overlaps(at(9), at(10), at(11), at(12))).toBe(false)
  })
})

describe('durationMinutes', () => {
  it('measures a slot', () => {
    expect(durationMinutes(new Date(2026, 8, 12, 9), new Date(2026, 8, 12, 10, 30))).toBe(90)
  })
})
