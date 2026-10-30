import AsyncStorage from '@react-native-async-storage/async-storage';

import { track } from '../telemetry';
import type { InstallRecord } from '../storage/installs';

const KEY = 'maya.uninstalled.v1';

/**
 * Reports an app that MAYA installed and the OS no longer has.
 *
 * Android gives no uninstall callback to an app that is not running, so the
 * only honest signal is a later comparison: the install log says it was
 * installed, `PackageManager` says it is gone. Each (slug, installedAt) pair is
 * reported once, so opening My Apps ten times does not count ten uninstalls and
 * a reinstall (a new installedAt) can be reported again if it is removed again.
 */
export const reportUninstalls = async (
  gone: readonly InstallRecord[],
): Promise<void> => {
  if (gone.length === 0) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const seen: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const fresh = gone.filter((record) => seen[record.slug] !== record.installedAt);
    if (fresh.length === 0) return;

    for (const record of fresh) {
      track('app_uninstalled', { slug: record.slug, version: record.version });
      seen[record.slug] = record.installedAt;
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    // A missed uninstall event is not worth surfacing.
  }
};
