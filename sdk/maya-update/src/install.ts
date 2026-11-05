import { Linking, Platform as RNPlatform } from 'react-native';

import type { UpdateInfo } from './check';

/**
 * Starting an update, the two ways MAYA supports.
 *
 *   - `maya`: open this app's page in MAYA (`storeUrl`). MAYA downloads and
 *     installs with the person's own sign-in, so nothing about the binary is
 *     ever reachable without one. Always available. The default.
 *   - `in-place`: the app installs the update itself, like Play's in-app
 *     update. Only when an admin allowed it for this app, in which case the
 *     version check carried a signed, 15-minute `downloadUrl`. On Android the
 *     APK is downloaded here and handed to the system installer; on iOS the
 *     itms-services link is opened and iOS installs it.
 *
 * `auto` picks in-place when it is available and falls back to MAYA when it is
 * not, or when the in-place attempt fails.
 */
export type UpdateMode = 'auto' | 'maya' | 'in-place';

export type UpdateOutcome =
  /** The system installer reported success (Android in-place only). */
  | 'installed'
  /** Handed to MAYA, to iOS, or to the installer, which did not confirm. */
  | 'handed-off'
  /** MAYA is not installed; the landing page was opened instead. */
  | 'opened-landing-page'
  | 'failed';

export interface DownloadProgress {
  bytesWritten: number;
  bytesTotal: number;
  /** 0..1, or null while the total is unknown. */
  fraction: number | null;
}

/** The moments worth recording, for the host app's own analytics (Firebase, say). */
export type UpdateEvent =
  | { type: 'update_started'; mode: 'maya' | 'in-place'; from: string; to: string }
  | { type: 'update_downloaded'; to: string; sizeBytes: number }
  | { type: 'update_finished'; outcome: UpdateOutcome; to: string }
  | { type: 'update_failed'; stage: 'download' | 'install' | 'open'; to: string; message: string };

export interface StartOptions {
  mode?: UpdateMode;
  /**
   * Where to send someone who does not have MAYA: the MAYA landing page.
   * Without it, a missing MAYA is reported as `failed`.
   */
  mayaLandingUrl?: string;
  onProgress?: (progress: DownloadProgress) => void;
  onEvent?: (event: UpdateEvent) => void;
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Opens MAYA at this app's page, or the landing page if MAYA is missing.
 *
 * `openURL` is tried rather than `canOpenURL` first: canOpenURL needs the
 * `maya` scheme declared in LSApplicationQueriesSchemes (iOS) and a <queries>
 * entry (Android 11+), and answers false without them even when MAYA is there.
 */
const openMaya = async (info: UpdateInfo, options: StartOptions): Promise<UpdateOutcome> => {
  try {
    await Linking.openURL(info.storeUrl);
    return 'handed-off';
  } catch (error) {
    if (!options.mayaLandingUrl) {
      options.onEvent?.({ type: 'update_failed', stage: 'open', to: info.latestVersion, message: message(error) });
      return 'failed';
    }
    try {
      await Linking.openURL(options.mayaLandingUrl);
      return 'opened-landing-page';
    } catch (fallback) {
      options.onEvent?.({ type: 'update_failed', stage: 'open', to: info.latestVersion, message: message(fallback) });
      return 'failed';
    }
  }
};

/**
 * Android: download the APK into this app's cache, then hand it to the
 * package installer through a content:// URI.
 *
 * Requires, in the HOST app: the REQUEST_INSTALL_PACKAGES permission, and
 * expo-file-system plus expo-intent-launcher. Loaded with require so an app
 * that only ever updates through MAYA does not need either.
 *
 * The file is named after the server's sha256, so a finished download is
 * reused rather than fetched again, and a partial one never passes for the
 * next version. The bytes are not re-hashed on the phone: hashing 100 MB in
 * JavaScript would cost more than the download. They arrive over TLS from a
 * URL the server signed, and Android refuses an APK whose signing key does not
 * match the installed app's — which is the check that matters for an update.
 */
const installApkInPlace = async (info: UpdateInfo, options: StartOptions): Promise<UpdateOutcome> => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const IntentLauncher = require('expo-intent-launcher') as typeof import('expo-intent-launcher');

  const dir = `${FileSystem.cacheDirectory}maya-update/`;
  const file = `${dir}${info.sha256 ?? info.latestVersion.replace(/[^\w.-]/g, '_')}.apk`;

  try {
    const folder = await FileSystem.getInfoAsync(dir);
    if (!folder.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

    const existing = await FileSystem.getInfoAsync(file);
    const complete = existing.exists && (!info.sizeBytes || existing.size === info.sizeBytes);
    if (!complete) {
      const download = FileSystem.createDownloadResumable(
        info.downloadUrl!,
        file,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) =>
          options.onProgress?.({
            bytesWritten: totalBytesWritten,
            bytesTotal: totalBytesExpectedToWrite,
            fraction: totalBytesExpectedToWrite > 0 ? Math.min(totalBytesWritten / totalBytesExpectedToWrite, 1) : null,
          }),
      );
      const result = await download.downloadAsync();
      if (!result || result.status < 200 || result.status >= 300) {
        await FileSystem.deleteAsync(file, { idempotent: true });
        throw new Error(`Download failed with status ${result?.status ?? 'unknown'}`);
      }
      const written = await FileSystem.getInfoAsync(file);
      if (info.sizeBytes && written.exists && written.size !== info.sizeBytes) {
        await FileSystem.deleteAsync(file, { idempotent: true });
        throw new Error(`Downloaded ${written.size} bytes, expected ${info.sizeBytes}`);
      }
    }
    options.onEvent?.({ type: 'update_downloaded', to: info.latestVersion, sizeBytes: info.sizeBytes ?? 0 });
  } catch (error) {
    options.onEvent?.({ type: 'update_failed', stage: 'download', to: info.latestVersion, message: message(error) });
    throw error;
  }

  try {
    const contentUri = await FileSystem.getContentUriAsync(file);
    const { resultCode } = await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    });
    if (resultCode === IntentLauncher.ResultCode.Success) {
      await FileSystem.deleteAsync(file, { idempotent: true });
      return 'installed';
    }
    // Back-press and a refused package look the same here; keep the file so
    // a retry does not download it again.
    return 'handed-off';
  } catch (error) {
    options.onEvent?.({ type: 'update_failed', stage: 'install', to: info.latestVersion, message: message(error) });
    throw error;
  }
};

/** iOS: iOS fetches the signed manifest, then the IPA, and installs it itself. */
const installIpaInPlace = async (info: UpdateInfo): Promise<UpdateOutcome> => {
  await Linking.openURL(info.downloadUrl!);
  return 'handed-off';
};

/**
 * Starts the update. Never throws: every failure comes back as an outcome,
 * and with `auto` an in-place failure falls back to MAYA.
 */
export const startUpdate = async (info: UpdateInfo, options: StartOptions = {}): Promise<UpdateOutcome> => {
  const mode = options.mode ?? 'auto';
  const inPlace = mode !== 'maya' && info.canUpdateInPlace;

  if (mode === 'in-place' && !info.canUpdateInPlace) {
    options.onEvent?.({
      type: 'update_failed',
      stage: 'download',
      to: info.latestVersion,
      message: 'In-place updates are not allowed for this app, or the download link expired. Check again.',
    });
    return 'failed';
  }

  options.onEvent?.({
    type: 'update_started',
    mode: inPlace ? 'in-place' : 'maya',
    from: info.currentVersion,
    to: info.latestVersion,
  });

  let outcome: UpdateOutcome;
  if (inPlace) {
    try {
      outcome = RNPlatform.OS === 'ios' ? await installIpaInPlace(info) : await installApkInPlace(info, options);
    } catch {
      outcome = mode === 'auto' ? await openMaya(info, options) : 'failed';
    }
  } else {
    outcome = await openMaya(info, options);
  }

  options.onEvent?.({ type: 'update_finished', outcome, to: info.latestVersion });
  return outcome;
};
