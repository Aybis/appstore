import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { track } from '../telemetry';

/**
 * Notifications for install and update events.
 *
 * Two tiers, deliberately separated:
 *
 *  - LOCAL notifications work today with no credentials at all. Everything the
 *    store needs to tell a user about their own device — an install finished, a
 *    download failed, an update is waiting — is local.
 *  - REMOTE push (a publisher releases a build and every device hears about it)
 *    goes through Firebase Cloud Messaging. The app reports its FCM token to
 *    the API (POST /devices), and the API sends with firebase-admin when a
 *    release is published. Without google-services.json there is no token and
 *    registerForPushToken() returns null rather than throwing.
 */

/**
 * Also the FCM default channel (see the expo-notifications plugin in app.json),
 * so a push that arrives while the app is closed lands on the same channel the
 * user already controls in system settings, not on an unnamed "Miscellaneous".
 */
export const CHANNEL_ID = 'maya-installs';

/** Banner + list while the app is foregrounded; installs are worth interrupting for. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

/**
 * Android needs an explicit channel or notifications post silently with no
 * importance. Safe to call repeatedly — creating an existing channel is a no-op.
 */
const ensureChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'App installs and updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
};

export const requestNotificationPermission =
  async (): Promise<NotificationPermission> => {
    await ensureChannel();

    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    // Asking again after an explicit denial does nothing on either platform —
    // the user has to go to Settings — so don't nag.
    if (!current.canAskAgain) return 'denied';

    const next = await Notifications.requestPermissionsAsync();
    // Only here, where the system prompt was actually shown: the share of
    // people who say no is the ceiling on everything push can reach.
    track('notification_permission', { granted: next.granted });
    return next.granted ? 'granted' : 'denied';
  };

export const getNotificationPermission =
  async (): Promise<NotificationPermission> => {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    return current.canAskAgain ? 'undetermined' : 'denied';
  };

/**
 * The Android tag a release notice is posted under, locally and by the API
 * (push-message.ts). Same tag, same slot in the tray: when the app's own check
 * and a push both announce one update, the second replaces the first.
 */
export const releaseTag = (slug: string): string => `release-${slug}`;

/** Posts immediately (trigger: null). */
export const notify = async (
  title: string,
  body: string,
  data: Record<string, unknown> = {},
  identifier?: string,
): Promise<void> => {
  const permission = await getNotificationPermission();
  if (permission !== 'granted') return;

  await Notifications.scheduleNotificationAsync({
    ...(identifier && { identifier }),
    content: { title, body, data },
    trigger: null,
  });
};

/**
 * This device's FCM registration token, for server-initiated notifications.
 *
 * The NATIVE token, not an Expo push token: the API sends straight to Firebase
 * Cloud Messaging with firebase-admin, and FCM addresses devices by exactly
 * this string. There is no Expo push service in between.
 *
 * Returns null — without throwing — in every case where remote push cannot
 * work, and the caller treats null as "local notifications only":
 *
 *  - an emulator without Google Play services (the token call throws)
 *  - a build without google-services.json (getDevicePushTokenAsync throws,
 *    because no default Firebase app exists)
 *  - iOS, where this call returns an APNs token that FCM cannot address. iOS
 *    push needs GoogleService-Info.plist and an APNs key in Firebase first.
 *  - the user declined the permission
 */
export const registerForPushToken = async (): Promise<string | null> => {
  if (Platform.OS !== 'android') return null;

  if ((await requestNotificationPermission()) !== 'granted') return null;

  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return typeof token.data === 'string' ? token.data : null;
  } catch {
    return null;
  }
};

/**
 * FCM rotates tokens (app data cleared, restored from backup, periodically).
 * A rotated token that never reaches the server is a device that silently
 * stops hearing about updates, so the new one is reported as it arrives.
 */
export const onPushTokenChange = (listener: (token: string) => void): (() => void) => {
  if (Platform.OS !== 'android') return () => {};
  const subscription = Notifications.addPushTokenListener((token) => {
    if (typeof token.data === 'string') listener(token.data);
  });
  return () => subscription.remove();
};
