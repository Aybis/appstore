import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Notifications for install and update events.
 *
 * Two tiers, deliberately separated:
 *
 *  - LOCAL notifications work today with no credentials at all. Everything the
 *    store needs to tell a user about their own device — an install finished, a
 *    download failed, an update is waiting — is local.
 *  - REMOTE push (a publisher releases a build and every device hears about it)
 *    needs an Expo project id plus APNs/FCM credentials via EAS. That is not
 *    configured here, so registerForPushToken() returns null rather than
 *    throwing, and starts working the moment `extra.eas.projectId` exists.
 */

const CHANNEL_ID = 'maya-installs';

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
    return next.granted ? 'granted' : 'denied';
  };

export const getNotificationPermission =
  async (): Promise<NotificationPermission> => {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    return current.canAskAgain ? 'undetermined' : 'denied';
  };

/** Posts immediately (trigger: null). */
export const notify = async (
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> => {
  const permission = await getNotificationPermission();
  if (permission !== 'granted') return;

  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, ...(Platform.OS === 'android' ? {} : {}) },
    trigger: null,
  });
};

/**
 * Expo push token for server-initiated notifications.
 *
 * Returns null — without throwing — when this build has no EAS project id or
 * is running on a simulator, both of which are true today. The caller treats
 * null as "remote push not available yet", not as an error.
 */
export const registerForPushToken = async (): Promise<string | null> => {
  if (!Device.isDevice) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return null;

  if ((await requestNotificationPermission()) !== 'granted') return null;

  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: projectId as string,
    });
    return token.data;
  } catch {
    // Missing APNs/FCM credentials surface here; not fatal for local notices.
    return null;
  }
};
