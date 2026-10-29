import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { config } from '../api/config';
import { deviceKey } from './identity';

/**
 * Reads the current access token.
 *
 * Injected by the auth layer rather than imported, so this module does not
 * reach into auth state and create a cycle — AuthProvider already owns the
 * token and hands it to the data client the same way.
 */
let readToken: () => string | null = () => null;

export const bindTelemetryToken = (getToken: () => string | null): void => {
  readToken = getToken;
};

type Outcome = 'installed' | 'updated' | 'failed' | 'removed';

/**
 * Tells the server this device exists, and how installs went.
 *
 * EVERY FUNCTION HERE SWALLOWS ITS ERRORS, on purpose. Telemetry is the least
 * important thing the app does: a failed report must never surface to somebody
 * who was installing an app, and must never turn a successful install into a
 * visible failure. The dashboard being slightly wrong is a far better outcome
 * than an install that looks broken because a POST timed out.
 */

const post = async (path: string, body: unknown, token = readToken()): Promise<void> => {
  // Nothing to report as: these endpoints are per-member, and an anonymous
  // call would only be refused.
  if (!token || config.useMockData) return;

  try {
    await fetch(`${config.apiBaseUrl}${config.apiPrefix}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      // Telemetry must never hold a screen open. Shorter than the data
      // client's timeout on purpose.
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Deliberately silent — see the note above.
  }
};

const describeDevice = async () => ({
  deviceKey: await deviceKey(),
  platform: Platform.OS === 'ios' ? 'ios' : 'android',
  model: Device.modelName ?? '',
  osVersion: `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Device.osVersion ?? ''}`.trim(),
  clientVersion: Constants.expoConfig?.version ?? '',
});

/**
 * Registers this device, optionally with its FCM token.
 *
 * Leaving `pushToken` out keeps whatever token the server already holds, so a
 * sign-in that registers before the token is known does not wipe it.
 */
export const registerDevice = async (pushToken?: string): Promise<void> => {
  await post('/devices', { ...(await describeDevice()), ...(pushToken && { pushToken }) });
};

/**
 * Tells the server to stop pushing to this device.
 *
 * Called on sign-out. The access token is read NOW, synchronously, because the
 * caller is about to discard it — reading it after the await below would find
 * nothing and silently skip the call, leaving a signed-out phone receiving the
 * previous user's update notices.
 */
export const clearPushToken = async (): Promise<void> => {
  const token = readToken();
  await post('/devices', { ...(await describeDevice()), pushToken: null }, token);
};

export const reportInstall = async (
  appSlug: string,
  version: string,
  outcome: Outcome,
): Promise<void> => {
  await post('/devices/install-events', {
    deviceKey: await deviceKey(),
    appSlug,
    version,
    outcome,
  });
};
