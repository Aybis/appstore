/**
 * Which download a visitor should be offered.
 *
 * A portal that shows every platform makes each person read past the two
 * thirds that cannot help them. On a phone the answer is already known — the
 * device is holding the answer — so the page should just show it.
 *
 * The rules, in the order they are checked:
 *
 *   Android phone or tablet   → Android only
 *   iPhone or iPad            → iOS only
 *   Mac at a phone width      → iOS
 *   anything else (Windows,
 *   Linux, Mac at desk width) → both
 *
 * The Mac cases are the subtle ones. An iPad on iPadOS 13+ deliberately sends
 * a Macintosh user-agent, so UA alone reports a desktop; a touch-capable Mac
 * is therefore an iPad. And a Mac narrowed to a phone width is somebody
 * checking the mobile view, who wants to see what an iPhone visitor sees.
 */
export type Target = 'android' | 'ios'

/** Phone width. Matches the breakpoint the stylesheet already uses. */
const PHONE = '(max-width: 33.99rem)'

export const detectTargets = (): Target[] => {
  if (typeof window === 'undefined') return ['android', 'ios']

  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return ['android']
  if (/iPhone|iPad|iPod/i.test(ua)) return ['ios']

  const isMac = /Macintosh|Mac OS X/i.test(ua)
  // maxTouchPoints > 1 on a "Mac" is an iPad telling on itself.
  if (isMac && navigator.maxTouchPoints > 1) return ['ios']
  if (isMac && window.matchMedia(PHONE).matches) return ['ios']

  return ['android', 'ios']
}

/**
 * Is this visitor already holding the phone the app installs on?
 *
 * Decides between "Download" alone and "Download, or scan this from your
 * phone". A QR on a phone is a code the visitor cannot point their own camera
 * at, so it is only offered at a desk.
 */
export const isPhoneVisitor = (): boolean => {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true
  if (/Macintosh|Mac OS X/i.test(ua) && navigator.maxTouchPoints > 1) return true
  return window.matchMedia(PHONE).matches
}

/** The media query the Mac rule depends on, so callers can re-detect on resize. */
export const phoneQuery = PHONE
