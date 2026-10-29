import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'maya.installs.v1';

export type InstallRecord = {
  slug: string;
  /** Version that was installed — lets the UI flag an available update. */
  version: string;
  /** ISO timestamp of the install. */
  installedAt: string;
};

/**
 * Local record of what this device installed *through MAYA*.
 *
 * Neither platform lets an app enumerate what else is installed — iOS has no
 * API at all, and Android requires the Play-restricted QUERY_ALL_PACKAGES — so
 * "My Apps" is built from our own install events rather than read off the OS.
 * When the API grows a per-user install record this becomes a cache in front of
 * it; the shape is deliberately the same.
 */
export const readInstalls = async (): Promise<InstallRecord[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InstallRecord[]) : [];
  } catch {
    // A corrupt blob should not brick the tab — start over.
    return [];
  }
};

export const recordInstall = async (
  slug: string,
  version: string,
): Promise<InstallRecord[]> => {
  const existing = await readInstalls();
  const next: InstallRecord[] = [
    { slug, version, installedAt: new Date().toISOString() },
    ...existing.filter((record) => record.slug !== slug),
  ];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
};

export const removeInstall = async (slug: string): Promise<InstallRecord[]> => {
  const next = (await readInstalls()).filter((record) => record.slug !== slug);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
};

export const clearInstalls = async (): Promise<void> => {
  await AsyncStorage.removeItem(KEY);
};
