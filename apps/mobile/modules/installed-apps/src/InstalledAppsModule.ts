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
  /*
   * The members below are optional on purpose: they arrived after the first
   * native build shipped, and a JS bundle must not crash on a binary that
   * predates them. Callers check before calling and fall back to weaker checks.
   */
  /** Android only. False when "install unknown apps" is not granted to MAYA. */
  canRequestPackageInstalls?(): boolean;
  /**
   * Android only. Identity of an APK on disk, or null when Android cannot
   * parse it — the same condition the installer reports as a broken file.
   */
  inspectApk?(uri: string): Promise<ApkIdentity | null>;
}

export interface ApkIdentity {
  packageName: string;
  versionName: string | null;
  versionCode: number;
}

export default requireNativeModule<InstalledAppsModule>('InstalledApps');
