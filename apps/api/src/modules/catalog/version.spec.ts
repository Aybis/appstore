import { describe, expect, it } from 'vitest'
import { compareVersions, isOlderThan, updateSeverity } from './version'

describe('compareVersions', () => {
  it('orders numerically, not lexically', () => {
    // The bug this exists to prevent: "1.10.0" < "1.9.0" as strings.
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1)
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1)
  })

  it('treats missing trailing segments as zero', () => {
    expect(compareVersions('2.1', '2.1.0')).toBe(0)
    expect(compareVersions('2.1.1', '2.1')).toBe(1)
  })

  it('handles the real strings in the catalog', () => {
    expect(compareVersions('573.0.0.37.74', '573.0.0.37.75')).toBe(-1)
    expect(compareVersions('9.72.0 build 3 64377', '9.72.0 build 3 64376')).toBe(1)
    expect(compareVersions('11.32.945', '11.32.945')).toBe(0)
    expect(compareVersions('9.2 (941607204)', '9.2 (941607205)')).toBe(-1)
  })

  it('does not crash on empty or non-numeric input', () => {
    expect(compareVersions('', '')).toBe(0)
    expect(compareVersions('', '1.0.0')).toBe(-1)
    expect(compareVersions('beta', '1.0.0')).toBe(-1)
  })

  it('ignores pre-release qualifiers — the documented limit', () => {
    expect(compareVersions('1.0.0-rc1', '1.0.0')).toBe(1)
  })

  it('isOlderThan reads the way callers expect', () => {
    expect(isOlderThan('1.0.0', '1.0.1')).toBe(true)
    expect(isOlderThan('1.0.1', '1.0.0')).toBe(false)
    expect(isOlderThan('1.0.0', '1.0.0')).toBe(false)
  })
})

describe('updateSeverity', () => {
  // The organization's rule, stated in its own terms: first two digits are
  // major, the last is minor. These are the exact cases from the brief.
  it('treats a change in the second digit as major', () => {
    expect(updateSeverity('1.0.0', '1.1.0')).toBe('major')
  })

  it('treats a change in the first digit as major', () => {
    expect(updateSeverity('1.0.0', '2.0.0')).toBe('major')
  })

  it('treats a change in the last digit alone as minor', () => {
    expect(updateSeverity('1.0.0', '1.0.1')).toBe('minor')
  })

  it('reports none when the device is already current', () => {
    expect(updateSeverity('1.1.0', '1.1.0')).toBe('none')
  })

  it('reports none when the device is somehow ahead of the catalog', () => {
    expect(updateSeverity('1.2.0', '1.1.0')).toBe('none')
  })

  // Trailing build metadata is not a reason to lock someone out of their app.
  it('ignores build metadata beyond the third segment', () => {
    expect(updateSeverity('9.72.0 build 3', '9.72.0 build 4')).toBe('minor')
  })

  it('still sees a real minor bump carrying build metadata', () => {
    expect(updateSeverity('9.72.0 build 3', '9.72.1 build 1')).toBe('minor')
  })

  it('sees a major bump carrying build metadata', () => {
    expect(updateSeverity('9.72.0 build 3', '9.73.0 build 1')).toBe('major')
  })

  // A short version must not read as equal to a longer one on the missing
  // segment — "2" to "2.1" moved Y and is major.
  it('compares a short version against a longer one on the missing segment', () => {
    expect(updateSeverity('2', '2.1')).toBe('major')
    expect(updateSeverity('2.1', '2.1.3')).toBe('minor')
  })
})
