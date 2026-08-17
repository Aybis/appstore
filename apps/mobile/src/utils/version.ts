/**
 * Client-side mirror of the API's comparator (apps/api/src/catalog/version.ts).
 *
 * Store version strings are not semver — the catalog holds "9.72.0 build 3
 * 64377" and "9.2 (941607204)" — so every run of digits becomes one numeric
 * segment, compared left to right with missing segments treated as 0. This is
 * what decides Install vs Update on a card, so it has to agree with the server.
 */
const segments = (version: string): number[] =>
  (version.match(/\d+/g) ?? []).map((part) => Number.parseInt(part, 10));

/** -1 if a < b, 0 if equal, 1 if a > b. */
export const compareVersions = (a: string, b: string): number => {
  const left = segments(a);
  const right = segments(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const x = left[i] ?? 0;
    const y = right[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};

export const isOlderThan = (version: string, other: string): boolean =>
  compareVersions(version, other) < 0;
