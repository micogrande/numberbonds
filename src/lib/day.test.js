import { describe, expect, it } from 'vitest'

import { DAY_START_HOUR, dayKey, isDayKey, isSameDay } from './day'

/** Local wall-clock time, which is the only thing this module reasons about. */
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min)

describe('dayKey', () => {
  it('is the calendar date during the day', () => {
    expect(dayKey(at(2026, 9, 7, 12))).toBe('2026-09-07')
  })

  it('pads month and day so the key sorts as a string', () => {
    expect(dayKey(at(2026, 1, 5, 12))).toBe('2026-01-05')
  })

  // The whole point of the file.
  describe('the 04:00 boundary', () => {
    it('03:59 still belongs to the previous day', () => {
      expect(dayKey(at(2026, 9, 7, 3, 59))).toBe('2026-09-06')
    })

    it('04:00 exactly starts the new day', () => {
      expect(dayKey(at(2026, 9, 7, 4, 0))).toBe('2026-09-07')
    })

    it('04:01 is the new day', () => {
      expect(dayKey(at(2026, 9, 7, 4, 1))).toBe('2026-09-07')
    })

    it('a bedtime game at 23:55 and one at 00:05 are the same evening', () => {
      const beforeMidnight = at(2026, 9, 6, 23, 55)
      const afterMidnight = at(2026, 9, 7, 0, 5)

      expect(dayKey(beforeMidnight)).toBe('2026-09-06')
      expect(dayKey(afterMidnight)).toBe('2026-09-06')
      expect(isSameDay(beforeMidnight, afterMidnight)).toBe(true)
    })

    it('but 23:55 and the following afternoon are not', () => {
      expect(isSameDay(at(2026, 9, 6, 23, 55), at(2026, 9, 7, 15))).toBe(false)
    })
  })

  describe('rolling over a boundary in the calendar', () => {
    it('01:00 on the first of a month belongs to the last of the previous one', () => {
      expect(dayKey(at(2026, 10, 1, 1))).toBe('2026-09-30')
    })

    it('01:00 on new year\'s day belongs to new year\'s eve', () => {
      expect(dayKey(at(2026, 1, 1, 1))).toBe('2025-12-31')
    })

    it('01:00 on the first of March belongs to the last of February', () => {
      expect(dayKey(at(2026, 3, 1, 1))).toBe('2026-02-28')
    })

    it('handles a leap day', () => {
      expect(dayKey(at(2028, 3, 1, 1))).toBe('2028-02-29')
    })
  })

  // The reason this module does not do `now - 4 * HOUR`. These run in whatever
  // zone the machine is in; in a zone without DST they simply pass trivially,
  // which is fine — the assertion that matters is that nothing throws and the
  // key always tracks the wall clock rather than elapsed time.
  describe('daylight saving', () => {
    const springForward = at(2026, 3, 8, 12) // US spring transition weekend
    const autumnBack = at(2026, 11, 1, 12) // US autumn transition weekend

    it('gives a stable key across a spring-forward day', () => {
      expect(dayKey(springForward)).toBe('2026-03-08')
      expect(dayKey(at(2026, 3, 8, 3, 59))).toBe('2026-03-07')
      expect(dayKey(at(2026, 3, 8, 4, 0))).toBe('2026-03-08')
    })

    it('gives a stable key across an autumn-back day', () => {
      expect(dayKey(autumnBack)).toBe('2026-11-01')
      expect(dayKey(at(2026, 11, 1, 3, 59))).toBe('2026-10-31')
      expect(dayKey(at(2026, 11, 1, 4, 0))).toBe('2026-11-01')
    })

    it('every hour of a transition day maps to one of exactly two keys', () => {
      const keys = new Set()

      for (let hour = 0; hour < 24; hour += 1) {
        keys.add(dayKey(at(2026, 3, 8, hour)))
      }

      expect([...keys].sort()).toEqual(['2026-03-07', '2026-03-08'])
    })
  })

  describe('input handling', () => {
    it('accepts a timestamp as well as a Date', () => {
      const date = at(2026, 9, 7, 12)

      expect(dayKey(date.getTime())).toBe(dayKey(date))
    })

    it('throws on an unusable time rather than inventing a day', () => {
      expect(() => dayKey(Number.NaN)).toThrow(TypeError)
      expect(() => dayKey(new Date('nonsense'))).toThrow(TypeError)
    })
  })

  it('uses 04:00 by default', () => {
    expect(DAY_START_HOUR).toBe(4)
    expect(dayKey(at(2026, 9, 7, 3), DAY_START_HOUR)).toBe(dayKey(at(2026, 9, 7, 3)))
  })
})

describe('isDayKey', () => {
  it('accepts what dayKey produces', () => {
    expect(isDayKey(dayKey(at(2026, 9, 7)))).toBe(true)
  })

  it('rejects the shapes localStorage can actually hand back', () => {
    for (const value of [null, undefined, 42, {}, [], '', 'today', '2026-9-7', '2026-09-07T00:00:00Z']) {
      expect(isDayKey(value)).toBe(false)
    }
  })
})
