import { describe, expect, it } from 'vitest'
import { formatTime } from './time'

describe('formatTime', () => {
  it('formats a fresh timer as 0:00', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('pads the seconds', () => {
    expect(formatTime(1_000)).toBe('0:01')
    expect(formatTime(9_000)).toBe('0:09')
  })

  it('truncates rather than rounding, so the timer never reads ahead of itself', () => {
    expect(formatTime(999)).toBe('0:00')
    expect(formatTime(59_999)).toBe('0:59')
  })

  it('holds the last second of the first minute', () => {
    expect(formatTime(59_000)).toBe('0:59')
  })

  it('rolls over at exactly one minute', () => {
    expect(formatTime(60_000)).toBe('1:00')
    expect(formatTime(61_000)).toBe('1:01')
  })

  it('handles ten minutes and beyond', () => {
    expect(formatTime(600_000)).toBe('10:00')
    expect(formatTime(659_000)).toBe('10:59')
    expect(formatTime(3_599_000)).toBe('59:59')
  })

  it('keeps counting in minutes past an hour instead of rolling to hours', () => {
    expect(formatTime(3_600_000)).toBe('60:00')
  })
})
