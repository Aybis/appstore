/**
 * Haptic feedback, centralised and fire-and-forget.
 *
 * Two reasons this is not `expo-haptics` called directly from components.
 * Every call is a promise that rejects on a device with no haptic engine (and
 * on every Android emulator), and an unhandled rejection inside a press handler
 * surfaces as a red box over the UI it was supposed to embellish — so each call
 * swallows its own failure. And feedback should be described by MEANING at the
 * call site (`tap`, `confirm`, `success`) rather than by intensity, so the
 * whole app can be retuned here instead of in forty components.
 */

import * as Haptics from 'expo-haptics';

const fire = (run: () => Promise<void>): void => {
  void run().catch(() => {
    // No haptic engine on this device. Not a failure worth surfacing.
  });
};

export const haptics = {
  /** Any ordinary tap: a card, a chip, a tab. */
  tap: (): void => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A committing press: install, sign in, publish. */
  confirm: (): void => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Selection moving across a set — filter chips, segmented controls. */
  select: (): void => fire(() => Haptics.selectionAsync()),
  /** An operation finished well. */
  success: (): void =>
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** An operation failed. */
  error: (): void =>
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
} as const;
