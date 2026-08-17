import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useInstalls } from '../install/InstallProvider';
import type { App } from '../types';
import { notify, requestNotificationPermission } from './notifications';

/** Versions already announced, so the same update is never notified twice. */
const ANNOUNCED_KEY = 'maya.announced-updates.v1';

const readAnnounced = async (): Promise<Record<string, string>> => {
  try {
    const raw = await AsyncStorage.getItem(ANNOUNCED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

/**
 * Tells the user when an app they installed has a newer build in the catalog.
 *
 * This is the local half of "check version on every open": the catalog is
 * fetched anyway when Discover loads, so comparing it against the install log
 * costs nothing and needs no server push. Remote push covers the case where the
 * app is not running at all, and needs EAS credentials.
 *
 * Announcements are keyed by (slug, version) so re-opening the app does not
 * re-notify, but a further release does.
 */
export const useUpdateNotifications = (apps: readonly App[]): void => {
  const { stateFor } = useInstalls();
  // Permission is asked once per app run, on the first catalog that loads.
  const asked = useRef(false);

  useEffect(() => {
    if (apps.length === 0) return;

    const run = async (): Promise<void> => {
      if (!asked.current) {
        asked.current = true;
        await requestNotificationPermission();
      }

      const pending = apps.filter((app) => stateFor(app) === 'update');
      if (pending.length === 0) return;

      const announced = await readAnnounced();
      const fresh = pending.filter((app) => announced[app.slug] !== app.version);
      if (fresh.length === 0) return;

      // One notification for a single app, a digest for several — a burst of
      // banners on launch is the fastest way to get notifications turned off.
      if (fresh.length === 1) {
        const app = fresh[0]!;
        await notify(
          `Update available for ${app.name}`,
          `Version ${app.version} is ready to install.`,
          { slug: app.slug },
        );
      } else {
        await notify(
          `${fresh.length} updates available`,
          fresh
            .slice(0, 3)
            .map((app) => app.name)
            .join(', ') + (fresh.length > 3 ? ' and more' : ''),
        );
      }

      await AsyncStorage.setItem(
        ANNOUNCED_KEY,
        JSON.stringify({
          ...announced,
          ...Object.fromEntries(fresh.map((app) => [app.slug, app.version])),
        }),
      );
    };

    void run();
  }, [apps, stateFor]);
};
