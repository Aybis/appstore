import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { apiUrl, config } from '../api/config';
import { track } from '../telemetry';
import { deviceKey } from './identity';

const REPORTED_KEY = 'maya.funnel.first_open.v1';

let attempted = false;

/**
 * Tells the API this install of MAYA opened for the first time.
 *
 * The step between "the landing page served a download" and "somebody signed
 * in": without it, an install that never got past the sign-in screen is
 * invisible, and that is exactly the install the funnel exists to find.
 *
 * Sent with the device key as the install key, the same key /devices later
 * registers under, so the API can tell which first opens went on to sign in.
 * No session is needed — this runs before the sign-in screen — and nothing
 * else about the person or the phone is sent.
 *
 * Marked as done only once the API has accepted it, so a first launch with no
 * network reports on the next launch instead of never. Swallows every error:
 * a funnel count is never a reason for a cold start to fail.
 */
export const reportFirstOpen = async (): Promise<void> => {
  if (attempted || config.useMockData) return;
  attempted = true;

  try {
    if (await AsyncStorage.getItem(REPORTED_KEY)) return;

    const installKey = await deviceKey();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const appVersion = Constants.expoConfig?.version ?? '';

    const response = await fetch(apiUrl('/funnel/events'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [{ event: 'first_open', platform, installKey, appVersion }] }),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return;

    await AsyncStorage.setItem(REPORTED_KEY, new Date().toISOString());
    // Firebase records its own `first_open` automatically; this one marks the
    // moment MAYA's own funnel learned of it, for comparing the two.
    track('maya_first_open_reported', { platform });
  } catch {
    // Deliberately silent; retried on the next launch.
  }
};
