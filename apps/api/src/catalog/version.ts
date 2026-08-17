/**
 * Version ordering for real-world store version strings.
 *
 * These are not semver. The catalog already holds "9.72.0 build 3 64377",
 * "573.0.0.37.74" and "11.32.945", so a semver parser would reject most of the
 * corpus. Instead every run of digits becomes one numeric segment, compared
 * left to right, with missing segments treated as 0:
 *
 *   1.10.0      -> [1, 10, 0]     beats 1.9.0 -> [1, 9, 0]      (10 > 9)
 *   2.1         -> [2, 1]         equals 2.1.0 -> [2, 1, 0]
 *   9.72.0 b3   -> [9, 72, 0, 3]
 *
 * Known limit: only the digits survive, so a pre-release qualifier contributes
 * its own number — "1.0.0-rc1" parses as [1,0,0,1] and therefore sorts ABOVE
 * "1.0.0", which is backwards. Pre-release ordering needs a real semver column
 * on the release row, not a heuristic over a display string. Publishing a
 * release named "-rc" is the case to avoid until that exists.
 */
const segments = (version: string): number[] =>
  (version.match(/\d+/g) ?? []).map((part) => Number.parseInt(part, 10))

/** -1 if a < b, 0 if equal, 1 if a > b. */
export const compareVersions = (a: string, b: string): number => {
  const left = segments(a)
  const right = segments(b)
  const length = Math.max(left.length, right.length)

  for (let i = 0; i < length; i += 1) {
    const x = left[i] ?? 0
    const y = right[i] ?? 0
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

export const isOlderThan = (version: string, other: string): boolean =>
  compareVersions(version, other) < 0
