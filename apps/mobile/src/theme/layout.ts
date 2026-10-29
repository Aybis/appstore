import { Platform } from 'react-native';

/**
 * Content height of the tab bar, excluding the home-indicator safe area.
 *
 * Lives here rather than in `app/(tabs)/_layout.tsx` because the tab bar is
 * `position: 'absolute'` — it floats over the scroll view instead of shrinking
 * it, so every scrolling screen under the tab group has to reserve this space
 * itself. Importing it from the layout would make screens depend on their own
 * navigator; a shared constant keeps that one number in one place.
 *
 * Add `useSafeAreaInsets().bottom` to it — the bar reserves that too.
 */
export const TAB_BAR_HEIGHT = Platform.select({ ios: 54, android: 60 }) ?? 60;
