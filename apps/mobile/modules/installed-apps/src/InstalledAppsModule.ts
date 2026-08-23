import { NativeModule, requireNativeModule } from 'expo';

declare class InstalledAppsModule extends NativeModule<Record<never, never>> {
  /** False on platforms with no way to ask — iOS, and web. */
  isSupported(): boolean;
  /**
   * Installed versionName per package, or null.
   *
   * Null means "not installed, or not visible to us". Android does not
   * distinguish those, so absence is never proof of absence.
   */
  getInstalledVersions(packageNames: string[]): Record<string, string | null>;
}

export default requireNativeModule<InstalledAppsModule>('InstalledApps');
