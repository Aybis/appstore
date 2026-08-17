import { describe, expect, it } from 'vitest'
import { compareVersions, isOlderThan } from './version'

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
