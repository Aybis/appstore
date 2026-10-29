import { useEffect, useState } from 'react';

import { registerForPushToken } from './notifications';

export interface PushRegistration {
  token: string | null;
  /** Why there is no token, when there isn't one. */
  reason: 'pending' | 'ready' | 'unavailable';
}

/**
 * Obtains this device's Expo push token once per app run.
 *
 * Returns `unavailable` rather than failing on a simulator (Expo cannot mint a
 * token without real APNs/FCM registration) or when the EAS project has no push
 * credentials yet. Local notifications are unaffected either way.
 *
 * The token is not sent anywhere yet: the API has no device-registration
 * endpoint, so there is nothing to POST it to. That endpoint plus a sender is
 * the remaining half of remote push.
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
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
};
