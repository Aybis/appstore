import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { getClient } from '../api';
import { InstalledApps } from '../../modules/installed-apps';
import { readInstalls, type InstallRecord } from '../storage/installs';
import { compareVersions } from '../utils/version';
import { useAsync, type AsyncState } from './useAsync';
import type { App } from '../types';

export type InstalledApp = {
  app: App;
  record: InstallRecord;
  /** Catalog has moved past the version on this device. */
  updateAvailable: boolean;
  /** True when the OS confirmed it, rather than our own log claiming it. */
  verified: boolean;
};

/**
 * "My Apps" — what is actually on this device, checked against the catalog.
 *
 * WHERE THE TRUTH COMES FROM
 *
 * On Android the OS is asked directly: every catalog app's package id goes to
 * `PackageManager` in one batched call, and the version it reports is the
 * version we compare. That makes the list correct through things our own log
 * can never see — an app uninstalled from the launcher, one installed by
 * another means, a build that failed to install, or a device restored from
 * backup.
 *
 * On iOS there is no such API, so the local install log remains the only
 * source. `InstalledApps.isSupported()` is what decides, rather than a platform
 * check here, so the fallback follows the module's own capability.
 *
 * The log is still consulted on both: it carries the install date, which the OS
 * does not expose, and it is what the iOS path runs on entirely. An entry is
 * `verified` when the OS confirmed it — the UI can then be honest about which
 * rows it is sure of.
 */
export const useInstalledApps = (): AsyncState<InstalledApp[]> => {
  const task = useCallback(async (): Promise<InstalledApp[]> => {
    const [records, apps] = await Promise.all([
      readInstalls(),
      getClient().listApps({ category: null, featuredOnly: false, sort: 'name' }),
    ]);

    const byPackage = new Map(apps.filter((app) => app.packageId).map((app) => [app.packageId, app]));
    const recordBySlug = new Map(records.map((record) => [record.slug, record]));

    if (!InstalledApps.isSupported()) {
      // iOS: the log is all there is.
      return records.flatMap((record) => {
        const app = apps.find((candidate) => candidate.slug === record.slug);
        if (!app) return [];
        return [
          {
            app,
            record,
            updateAvailable: compareVersions(record.version, app.version) < 0,
            verified: false,
          },
        ];
      });
    }

    const installed = InstalledApps.getInstalledVersions([...byPackage.keys()]);

    return Object.entries(installed).flatMap(([packageId, deviceVersion]) => {
      if (deviceVersion == null) return [];
      const app = byPackage.get(packageId);
      if (!app) return [];

      // The device's version wins over whatever we logged: an app updated
      // outside MAYA would otherwise keep showing an update that is already
      // installed.
      const record = recordBySlug.get(app.slug) ?? {
        slug: app.slug,
        version: deviceVersion,
        installedAt: '',
      };

      return [
        {
          app,
          record: { ...record, version: deviceVersion },
          updateAvailable: compareVersions(deviceVersion, app.version) < 0,
          verified: true,
        },
      ];
    });
  }, []);

  const state = useAsync(task, []);
  const { refresh } = state;

  // Installing happens on the detail screen, so the list is stale by the time
  // the user comes back. Refresh on re-focus, but skip the focus that fires
  // alongside the initial mount load.
  //
  // The dependency is `refresh`, NOT `state`. useAsync returns a fresh object
  // every render, so depending on the whole thing gave the callback a new
  // identity each render; useFocusEffect re-ran, called refresh, re-rendered,
  // and looped until React gave up with "Maximum update depth exceeded".
  // `refresh` is a stable useCallback, so the effect now fires on focus only.
  const mounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (mounted.current) refresh();
      mounted.current = true;
    }, [refresh]),
  );

  return state;
};
