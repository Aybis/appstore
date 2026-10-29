import { useEffect, useState } from 'react';

import { registerDevice } from '../device/telemetry';
import { track } from '../telemetry';
import { onPushTokenChange, registerForPushToken } from './notifications';

export interface PushRegistration {
  token: string | null;
  /** Why there is no token, when there isn't one. */
  reason: 'pending' | 'ready' | 'unavailable';
}

/**
 * Obtains this device's FCM token once per app run and hands it to the API,
 * which is what lets a published release reach this phone while MAYA is closed.
 *
 * Returns `unavailable` rather than failing on an emulator, on iOS, in a build
 * without google-services.json, or when the user declined — see
 * registerForPushToken. Local notifications are unaffected either way.
 *
 * Re-registering on every launch is deliberate: it is also the device's
 * "still here" ping, and a token the server lost is recovered on the next open
 * rather than never.
 */
export const usePushRegistration = (enabled: boolean): PushRegistration => {
  const [state, setState] = useState<PushRegistration>({
    token: null,
    reason: 'pending',
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void registerForPushToken().then((token) => {
      if (cancelled) return;
      setState({ token, reason: token ? 'ready' : 'unavailable' });
      track('push_registration', { outcome: token ? 'ready' : 'unavailable' });
      if (token) void registerDevice(token);
    });

    const unsubscribe = onPushTokenChange((token) => {
      setState({ token, reason: 'ready' });
      void registerDevice(token);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enabled]);

  return state;
};
