import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { getClient } from '../api';
import { readInstalls, type InstallRecord } from '../storage/installs';
import { useAsync, type AsyncState } from './useAsync';
import type { App } from '../types';

export type InstalledApp = {
  app: App;
  record: InstallRecord;
  /** Catalog has moved past the version this device installed. */
  updateAvailable: boolean;
};

/**
 * "My Apps" — the local install log joined against the live catalog, so each
 * entry carries current metadata and can flag an available update. Records
 * whose slug no longer exists in the catalog are dropped (app unpublished).
 */
export const useInstalledApps = (): AsyncState<InstalledApp[]> => {
  const task = useCallback(async (): Promise<InstalledApp[]> => {
    const [records, apps] = await Promise.all([
      readInstalls(),
      getClient().listApps({ category: null, featuredOnly: false, sort: 'name' }),
    ]);

    const bySlug = new Map(apps.map((app) => [app.slug, app]));

    return records.flatMap((record) => {
      const app = bySlug.get(record.slug);
      if (!app) return [];
      return [{ app, record, updateAvailable: app.version !== record.version }];
    });
  }, []);

  const state = useAsync(task, []);

  // Installing happens on the detail screen, so the list is stale by the time
  // the user comes back. Refresh on re-focus, but skip the focus that fires
  // alongside the initial mount load.
  const skippedFirstFocus = useRef(false);
  const { refresh } = state;

  useFocusEffect(
    useCallback(() => {
      if (!skippedFirstFocus.current) {
        skippedFirstFocus.current = true;
        return;
      }
      refresh();
    }, [refresh]),
  );

  return state;
};
