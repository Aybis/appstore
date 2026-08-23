import { describe, expect, it } from 'vitest'
import { UploadSlots } from './upload-slots'

/**
 * The cap exists because `limits.fileSize` bounds ONE upload and says nothing
 * about fifty arriving together — and the spool is written before anything
 * validates it, so a CI job stuck in a retry loop can fill a disk with files
 * the server has not yet agreed to keep.
 */
describe('UploadSlots', () => {
  it('allows uploads up to the limit', () => {
    const slots = new UploadSlots()
    expect(() => {
      slots.acquire('org-a')
      slots.acquire('org-a')
      slots.acquire('org-a')
    }).not.toThrow()
    expect(slots.countFor('org-a')).toBe(3)
  })

  it('refuses the one past the limit, with 429', () => {
    const slots = new UploadSlots()
    slots.acquire('org-a')
    slots.acquire('org-a')
    slots.acquire('org-a')

    try {
      slots.acquire('org-a')
      throw new Error('should have refused')
    } catch (error) {
      expect((error as { getStatus?: () => number }).getStatus?.()).toBe(429)
    }
  })

  it('counts each organization separately', () => {
    // One busy tenant must not stop another from publishing.
    const slots = new UploadSlots()
    slots.acquire('org-a')
    slots.acquire('org-a')
    slots.acquire('org-a')
    expect(() => slots.acquire('org-b')).not.toThrow()
  })

  it('frees the slot on release', () => {
    const slots = new UploadSlots()
    slots.acquire('org-a')
    slots.acquire('org-a')
    slots.acquire('org-a')
    slots.release('org-a')
    expect(() => slots.acquire('org-a')).not.toThrow()
  })

  it('forgets an org once idle, so the map cannot grow forever', () => {
    // Keyed by org on a multi-tenant deployment: leaving a 0 behind would make
    // this a slow memory leak rather than a counter.
    const slots = new UploadSlots()
    slots.acquire('org-a')
    slots.release('org-a')
    expect(slots.countFor('org-a')).toBe(0)
  })

  it('does not go negative when released more than acquired', () => {
    const slots = new UploadSlots()
    slots.release('org-a')
    slots.release('org-a')
    expect(slots.countFor('org-a')).toBe(0)
    expect(() => slots.acquire('org-a')).not.toThrow()
  })
})
