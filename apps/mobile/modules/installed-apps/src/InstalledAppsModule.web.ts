/** The web build has no device to ask. */
export default {
  isSupported: (): boolean => false,
  getInstalledVersions: (): Record<string, string | null> => ({}),
};
