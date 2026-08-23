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
  /**
   * Launches an installed app. False when it could not be launched — not
   * installed, no launcher activity, or a platform that cannot do this at all.
   *
   * Never throws, so a caller can treat it as "did this work?" and fall back
   * rather than wrapping every press in a try/catch.
   */
  launchApp(packageName: string): boolean;
}

export default requireNativeModule<InstalledAppsModule>('InstalledApps');
