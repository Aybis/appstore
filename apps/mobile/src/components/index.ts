/**
 * Atomic design layers (https://atomicdesign.bradfrost.com/chapter-2/).
 *
 *   atoms      → indivisible primitives, theme-only
 *   molecules  → a few atoms bound into one control, still domain-agnostic
 *   organisms  → interface sections that understand App / Category
 *   templates  → page layout, no data
 *   pages      → the expo-router routes in app/, which supply real data
 *
 * Import from a layer directly (`../src/components/organisms`) when you want
 * the boundary to be visible at the call site; this barrel is the convenience
 * re-export for pages that pull from several layers at once.
 */
export * from './atoms';
export * from './molecules';
export * from './organisms';
export * from './templates';
