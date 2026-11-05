import { Directory, DownloadTask, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

import { InstalledApps, type ApkIdentity } from '../../../modules/installed-apps';

/**
 * Android install pipeline: download in-app to app storage, verify the bytes,
 * keep them until the app is really on the device, hand them to the installer.
 *
 * Deliberately NOT Linking.openURL — that punts to the browser, which shows a
 * "file might be harmful" interstitial, drops the file in Downloads, and gives
 * the store no progress, no resume and no way to know whether the install ran.
 *
 * The rule this file exists to enforce: NOTHING reaches the system installer
 * unless it is a complete, verified APK. The earlier version reused any file
 * that happened to exist at the target path, and the path was written to
 * directly while downloading — so a download cut off by the OS ("Software
 * caused connection abort" when the app was minimised), or an HTTP error page
 * saved as if it were the APK, was later handed to Android as a finished
 * package. Android answered "There was a problem with the app file", and every
 * retry reused the same broken file, so it never recovered.
 *
 * Now there are two files per artifact:
 *
 *   <sha>.apk.part  — bytes in flight. Never installed. Its length is the
 *                     offset the next attempt resumes from.
 *   <sha>.apk       — only ever created by renaming a .part that passed
 *                     verification (size, SHA-256, and Android parsing it).
 */

/**
 * Document storage, not cache: Android may clear the cache under storage
 * pressure, and the APK has to survive until the user has actually finished
 * installing — including a trip to Settings to allow "install unknown apps".
 */
const downloadDir = (): Directory => new Directory(Paths.document, 'installs');

/** Why an install stopped, in a form the UI can translate and act on. */
export type InstallErrorCode =
  /** Connection dropped mid-download (backgrounded app, network switch). Resumable. */
  | 'interrupted'
  /** The server answered with an error status instead of the file. */
  | 'http'
  /** The signed download link was refused — usually expired. A retry fetches a new one. */
  | 'link_expired'
  /** The file finished but is shorter or longer than the store said it would be. */
  | 'size_mismatch'
  /** The bytes are complete but are not the build the store published. */
  | 'checksum_mismatch'
  /** Android cannot read the file as an APK. */
  | 'invalid_apk'
  /** Not enough free space for the download. */
  | 'storage_full'
  /** MAYA is not allowed to install apps yet ("install unknown apps"). */
  | 'permission_required'
  /** An installed copy is signed with another key (INSTALL_FAILED_UPDATE_INCOMPATIBLE). */
  | 'signature_conflict'
  /** The system installer refused the package; `detail` says why. */
  | 'install_failed'
  /** Anything else. */
  | 'unknown';

export class InstallError extends Error {
  readonly code: InstallErrorCode;
  /** Technical detail shown under the friendly message, e.g. "HTTP 404". */
  readonly detail: string | null;

  constructor(code: InstallErrorCode, detail: string | null = null) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'InstallError';
    this.code = code;
    this.detail = detail;
  }
}

export interface DownloadProgress {
  /** 0..1, or null while the server has not reported a total size. */
  fraction: number | null;
  bytesWritten: number;
  bytesTotal: number;
}

/** What the store promised the file would be. */
export interface ExpectedArtifact {
  /** Lowercase hex SHA-256 from the download ticket, when the server sent one. */
  sha256?: string | null;
  /** Exact byte size from the ticket; 0 or less when unknown. */
  sizeBytes: number;
}

export interface VerifiedArtifact {
  uri: string;
  /** Null only on a native build that predates APK inspection. */
  identity: ApkIdentity | null;
}

const isSha256 = (value: string | null | undefined): value is string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);

/** File names are derived from the key, so keep it to safe characters. */
const safeKey = (key: string): string => key.replace(/[^A-Za-z0-9._-]/g, '_');

const filesFor = (key: string) => {
  const dir = downloadDir();
  const name = safeKey(key);
  return {
    dir,
    apk: new File(dir, `${name}.apk`),
    part: new File(dir, `${name}.apk.part`),
  };
};

const ensureDir = (): void => {
  const dir = downloadDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
};

const remove = (file: File): void => {
  try {
    if (file.exists) file.delete();
  } catch {
    // Already gone, or the OS is holding it — neither should fail the install.
  }
};

/**
 * True when this app may hand a package to the system installer.
 *
 * On a native build without the check, assume yes: the installer intent then
 * surfaces the system prompt itself, which is what happened before.
 */
export const canInstallPackages = (): boolean => {
  if (Platform.OS !== 'android') return false;
  try {
    return InstalledApps.canRequestPackageInstalls?.() ?? true;
  } catch {
    return true;
  }
};

/** Opens the per-app "install unknown apps" screen so the user can grant it. */
export const openInstallPermissionSettings = async (packageName: string): Promise<void> => {
  await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
    data: `package:${packageName}`,
  });
};

/**
 * Proves a finished file is the build we asked for. Throws an InstallError
 * naming the first check that failed; the caller deletes the file.
 *
 * Ordered cheapest first: size is free, the hash reads the whole file once,
 * and parsing is the check that matches what the installer itself will do.
 */
const verify = async (file: File, expected: ExpectedArtifact): Promise<ApkIdentity | null> => {
  const size = file.size ?? 0;
  if (size === 0) throw new InstallError('size_mismatch', 'The downloaded file is empty.');
  if (expected.sizeBytes > 0 && size !== expected.sizeBytes) {
    throw new InstallError('size_mismatch', `Got ${size} of ${expected.sizeBytes} bytes.`);
  }

  if (isSha256(expected.sha256)) {
    const actual = await file.digest('SHA-256');
    if (actual.toLowerCase() !== expected.sha256.toLowerCase()) {
      throw new InstallError(
        'checksum_mismatch',
        `SHA-256 ${actual.slice(0, 12)}… ≠ ${expected.sha256.slice(0, 12)}…`,
      );
    }
  }

  if (!InstalledApps.inspectApk) return null;
  const identity = await InstalledApps.inspectApk(file.uri);
  if (!identity) {
    throw new InstallError('invalid_apk', 'Android could not read the file as an app package.');
  }
  return identity;
};

/** Turns a native download rejection into something the user can act on. */
const classifyDownloadFailure = (caught: unknown): InstallError => {
  if (caught instanceof InstallError) return caught;
  const message = caught instanceof Error ? caught.message : String(caught);

  const status = /HTTP (\d{3})/.exec(message)?.[1];
  if (status) {
    // The stream endpoint answers 403 only for a bad or expired signature.
    if (status === '403') return new InstallError('link_expired', `HTTP ${status}`);
    return new InstallError('http', `HTTP ${status}`);
  }
  if (/ENOSPC|No space left/i.test(message)) return new InstallError('storage_full', message);
  // Everything else on this path is the connection: "Software caused
  // connection abort", "Connection reset", timeouts, DNS while switching
  // networks. The .part file is kept so the next attempt continues from it.
  return new InstallError('interrupted', message);
};

/**
 * Downloads (or resumes) an artifact and returns it only once verified.
 *
 * `key` must identify the exact build — the server's SHA-256 — so a new
 * version never picks up an old version's bytes.
 */
export const downloadArtifact = async (
  url: string,
  key: string,
  expected: ExpectedArtifact,
  onProgress: (progress: DownloadProgress) => void,
): Promise<VerifiedArtifact> => {
  ensureDir();
  const { apk, part } = filesFor(key);

  // A file from an earlier run is reused only after it passes the same checks
  // as a fresh download. That keeps the good behaviour — "come back from
  // Settings and it installs without downloading again" — without ever
  // re-offering a broken file.
  if (apk.exists) {
    try {
      const identity = await verify(apk, expected);
      return { uri: apk.uri, identity };
    } catch {
      remove(apk);
    }
  }

  // A .part already at full size is a download that finished but was never
  // promoted (the process died in between). Verify it rather than fetch again;
  // one that is full-size but wrong is garbage and starts over.
  if (part.exists && expected.sizeBytes > 0 && (part.size ?? 0) >= expected.sizeBytes) {
    try {
      const identity = await verify(part, expected);
      remove(apk);
      await part.move(apk);
      return { uri: apk.uri, identity };
    } catch {
      remove(part);
    }
  }

  const needed = Math.max(expected.sizeBytes - (part.exists ? (part.size ?? 0) : 0), 0);
  const free = Paths.availableDiskSpace;
  if (needed > 0 && typeof free === 'number' && free > 0 && free < needed + 20 * 1024 * 1024) {
    throw new InstallError('storage_full', `${needed} bytes needed, ${free} free.`);
  }

  const options = {
    onProgress: ({ bytesWritten, totalBytes }: { bytesWritten: number; totalBytes: number }) => {
      const total = totalBytes > 0 ? totalBytes : expected.sizeBytes;
      onProgress({
        bytesWritten,
        bytesTotal: total,
        fraction: total > 0 ? Math.min(bytesWritten / total, 1) : null,
      });
    },
  };

  /*
   * Resume from what is already on disk. On Android the resume token is just
   * the byte offset, and the native task checks the reply: a 206 appends, a
   * plain 200 (server ignored Range) truncates and starts over. So resuming is
   * never a way to glue two different bodies together — the old failure mode.
   * The URL is the fresh one from this ticket, since signed links expire.
   */
  const offset = part.exists ? (part.size ?? 0) : 0;
  const task =
    offset > 0
      ? DownloadTask.fromSavable(
          { url, fileUri: part.uri, isDirectory: false, resumeData: String(offset) },
          options,
        )
      : File.createDownloadTask(url, part, options);

  try {
    const result = offset > 0 ? await task.resumeAsync() : await task.downloadAsync();
    if (!result) throw new InstallError('interrupted', 'The download was paused.');
  } catch (caught) {
    const error = classifyDownloadFailure(caught);
    // Keep partial bytes only when the failure was the connection. After an
    // HTTP error the file may hold the error body, so it must not survive.
    if (error.code !== 'interrupted') remove(part);
    throw error;
  } finally {
    try {
      task.release();
    } catch {
      // Already released by the native side.
    }
  }

  let identity: ApkIdentity | null;
  try {
    identity = await verify(part, expected);
  } catch (caught) {
    remove(part);
    throw caught instanceof InstallError
      ? caught
      : new InstallError('unknown', caught instanceof Error ? caught.message : String(caught));
  }

  remove(apk);
  await part.move(apk);
  return { uri: apk.uri, identity };
};

/** What the system installer reported back. */
export type InstallOutcome = 'installed' | 'dismissed';

/**
 * Android's PackageManager.INSTALL_FAILED_* codes worth naming to a user. The
 * rest are reported by number, which is still enough to look up.
 */
const INSTALL_FAILURES: Record<number, string> = {
  [-1]: 'An app with this package is already installed.',
  [-2]: 'The package file is invalid.',
  [-4]: 'Not enough storage on the device.',
  [-7]:
    'The installed version is signed with a different key. Uninstall the existing app, then install again.',
  [-12]: 'This app needs a newer Android version.',
  [-16]: 'This app does not support this device’s processor.',
  [-25]: 'A newer version is already installed (downgrade not allowed).',
  [-26]: 'The package is not signed correctly.',
  [-100]: 'The package could not be read.',
  [-103]: 'The package is not signed.',
  [-104]: 'The package signature is inconsistent.',
  [-115]: 'Installation was aborted.',
};

/**
 * Hands the verified APK to the system installer and reports what it said.
 *
 * EXTRA_RETURN_RESULT makes the installer answer with a real outcome instead
 * of a bare "cancelled", including Android's own failure code — the
 * difference between "could not be installed" and "uninstall the old build
 * first, it was signed with another key".
 *
 * `dismissed` covers a user backing out of the sheet or being sent to the
 * "install unknown apps" setting. Neither is a failure, and the artifact is
 * kept so the next tap installs without downloading again.
 */
export const installApk = async (fileUri: string): Promise<InstallOutcome> => {
  const contentUri = new File(fileUri).contentUri;

  const result = await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
    extra: { 'android.intent.extra.RETURN_RESULT': true },
  });

  if (result.resultCode === IntentLauncher.ResultCode.Success) return 'installed';

  if (result.resultCode === IntentLauncher.ResultCode.FirstUser) {
    const raw = (result.extra as Record<string, unknown> | undefined)?.[
      'android.intent.extra.INSTALL_RESULT'
    ];
    const code = typeof raw === 'number' ? raw : Number(raw);
    if (code === -7) {
      throw new InstallError('signature_conflict', `${INSTALL_FAILURES[code]} (code ${code})`);
    }
    if (Number.isFinite(code) && code !== 1) {
      throw new InstallError(
        'install_failed',
        `${INSTALL_FAILURES[code] ?? 'The installer refused the package.'} (code ${code})`,
      );
    }
  }

  return 'dismissed';
};

/**
 * True when the OS reports the package at (at least) the version just handed
 * over. The installer's result code is unreliable across OEM builds, so the
 * device itself is the final word on whether an install landed.
 */
export const isOnDevice = (identity: ApkIdentity | null): boolean => {
  if (!identity || !InstalledApps.isSupported()) return false;
  try {
    const installed = InstalledApps.getInstalledVersions([identity.packageName])[identity.packageName];
    if (installed == null) return false;
    return identity.versionName == null || installed === identity.versionName;
  } catch {
    return false;
  }
};

/** Removes a cached artifact once the app is confirmed on the device. */
export const discardArtifact = (key: string): void => {
  const { apk, part } = filesFor(key);
  remove(apk);
  remove(part);
};

/**
 * Deletes artifacts left by the previous pipeline, which wrote straight to
 * the final path in the cache directory. Those files may be the truncated or
 * error-page "APKs" that made every retry fail, so none of them is trusted.
 */
export const purgeLegacyArtifacts = (): void => {
  try {
    const legacy = new Directory(Paths.cache, 'installs');
    if (legacy.exists) legacy.delete();
  } catch {
    // Best effort: the cache is the OS's to clear anyway.
  }
};

/** Drops a cached artifact the installer rejected, so the next try re-downloads. */
export const discardIfInvalid = async (key: string): Promise<void> => {
  const { apk } = filesFor(key);
  if (!apk.exists || !InstalledApps.inspectApk) return;
  try {
    if (!(await InstalledApps.inspectApk(apk.uri))) remove(apk);
  } catch {
    remove(apk);
  }
};
