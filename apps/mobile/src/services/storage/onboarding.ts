import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether this device has been through the intro.
 *
 * Onboarding explains what MAYA is. That is worth one viewing and no more —
 * an employee who signs out on Friday should land on the sign-in screen on
 * Monday, not be walked through the pitch again. It is also what makes "Skip"
 * mean anything: skipping something that returns every launch is not skipping.
 *
 * Kept as a module-level cache alongside the stored value, deliberately. The
 * auth gate has to make its routing decision synchronously inside an effect
 * that re-runs on every navigation, and awaiting storage there would let one
 * frame of the wrong screen through. The cache is read; the storage write is
 * how it survives a restart.
 */

const KEY = 'maya.onboarding.seen.v1';

/** null until read from storage — distinct from "read, and not seen". */
let cached: boolean | null = null;

export const loadOnboardingSeen = async (): Promise<boolean> => {
  try {
    cached = (await AsyncStorage.getItem(KEY)) === 'true';
  } catch {
    // Unreadable storage means showing the intro again, which is a far better
    // failure than blocking someone out of a screen they need.
    cached = false;
  }
  return cached;
};

/** The cached answer, or null if storage has not been read yet. */
export const onboardingSeen = (): boolean | null => cached;

export const markOnboardingSeen = async (): Promise<void> => {
  // Set before the await so the gate's next read is already correct — the
  // navigation that follows this call happens well before storage resolves.
  cached = true;
  try {
    await AsyncStorage.setItem(KEY, 'true');
  } catch {
    /* Shown again next launch. Not worth interrupting anyone over. */
  }
};
