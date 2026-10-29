import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { track } from '../telemetry';
import { markAnnounced } from './useUpdateNotifications';

/**
 * Where a notification asked to be taken, if anywhere.
 *
 * Two payload shapes reach here. A local notification carries its data as
 * given (`{ slug }`). A push from the API carries the FCM `data` map, which
 * expo-notifications exposes the same way — but some Android versions hand the
 * map over as a JSON string under `body` when the app was killed, so that is
 * read too rather than dropping the tap.
 */
const slugFrom = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (typeof record.slug === 'string' && record.slug) return record.slug;

  if (typeof record.body === 'string') {
    try {
      return slugFrom(JSON.parse(record.body));
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Opens the app a tapped notification is about.
 *
 * useLastNotificationResponse covers both a tap that cold-starts MAYA and one
 * that arrives while it is running. Mount it where navigation is possible and
 * the user is signed in — a tap that lands on the sign-in screen is routed
 * after sign-in by this same hook, because the response stays "last" until
 * cleared.
 */
export const useNotificationNavigation = (enabled: boolean): void => {
  const response = Notifications.useLastNotificationResponse();
  const router = useRouter();
  // The same response is returned on every render until another tap; without
  // this the detail screen would be pushed again on each re-render.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !response) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;

    const data = response.notification.request.content.data;
    const slug = slugFrom(data);
    const kind = typeof data?.kind === 'string' ? data.kind : 'local';
    track('notification_opened', { kind, has_target: slug !== null });

    // A tapped release push has done the local update check's job for it.
    const version = typeof data?.version === 'string' ? data.version : null;
    if (slug && version) void markAnnounced(slug, version);

    if (slug) router.push({ pathname: '/app/[slug]', params: { slug } });
    Notifications.clearLastNotificationResponse();
  }, [enabled, response, router]);
};
