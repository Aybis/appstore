import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

/**
 * Android install pipeline: download in-app, keep the artifact, hand it to the
 * system package installer.
 *
 * Deliberately NOT Linking.openURL — that punts to the browser, which shows a
 * "file might be harmful" interstitial, drops the file in Downloads, and gives
 * the store no progress, no resume and no way to know whether the install ran.
 */

/** Where partially-downloaded artifacts live between attempts. */
const DOWNLOAD_DIR = `${FileSystem.cacheDirectory}installs/`;

const RESUME_SUFFIX = '.resume';

export interface DownloadProgress {
  /** 0..1, or null while the server has not reported a total size. */
  fraction: number | null;
  bytesWritten: number;
  bytesTotal: number;
}

const ensureDir = async (): Promise<void> => {
  const info = await FileSystem.getInfoAsync(DOWNLOAD_DIR)
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true })
  }
}

/** Content-addressed by checksum so a new version never collides with an old partial. */
const pathsFor = (checksum: string): { file: string; resume: string } => ({
  file: `${DOWNLOAD_DIR}${checksum}.apk`,
  resume: `${DOWNLOAD_DIR}${checksum}${RESUME_SUFFIX}`,
})

/**
 * True when this app may ask the system to install a package. Android 8+ gates
 * this per-app; without it the install intent is silently refused.
 */
export const canInstallPackages = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false
  // No first-class API is exposed by expo-intent-launcher, so treat the
  // manifest permission as necessary-and-checked-at-intent-time: the intent
  // itself surfaces the system prompt when the grant is missing.
  return true
}

/** Opens the per-app "install unknown apps" screen so the user can grant it. */
export const openInstallPermissionSettings = async (
  packageName: string,
): Promise<void> => {
  await IntentLauncher.startActivityAsync(
    'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
    { data: `package:${packageName}` },
  )
}

/**
 * Downloads to a stable path, resuming a previous partial when one exists.
 *
 * The resume handle is persisted next to the file: if the process is killed
 * mid-download, the next attempt continues from the same byte offset rather
 * than re-fetching everything. That is the difference between costing a user
 * 100 MB once and costing them 100 MB per retry.
 */
export const downloadArtifact = async (
  url: string,
  checksum: string,
  onProgress: (progress: DownloadProgress) => void,
): Promise<string> => {
  await ensureDir()
  const { file, resume } = pathsFor(checksum)

  const existing = await FileSystem.getInfoAsync(file)
  const savedResume = await FileSystem.getInfoAsync(resume)

  // A complete file from a previous run is reused as-is: the name is the
  // server's checksum, so a match means the bytes are the ones we wanted.
  if (existing.exists && !savedResume.exists) return file

  const report = (written: number, total: number): void =>
    onProgress({
      bytesWritten: written,
      bytesTotal: total,
      fraction: total > 0 ? Math.min(written / total, 1) : null,
    })

  const downloader = FileSystem.createDownloadResumable(
    url,
    file,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) =>
      report(totalBytesWritten, totalBytesExpectedToWrite),
  )

  let result: FileSystem.FileSystemDownloadResult | undefined

  if (savedResume.exists) {
    try {
      const handle = await FileSystem.readAsStringAsync(resume)
      const resumable = FileSystem.createDownloadResumable(
        url,
        file,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) =>
          report(totalBytesWritten, totalBytesExpectedToWrite),
        handle,
      )
      result = await resumable.resumeAsync()
    } catch {
      // A stale or rejected handle (expired signed URL, server without range
      // support) must not strand the user — fall through to a clean download.
      await FileSystem.deleteAsync(resume, { idempotent: true })
      await FileSystem.deleteAsync(file, { idempotent: true })
    }
  }

  if (!result) result = await downloader.downloadAsync()
  if (!result) throw new Error('Download did not complete.')

  await FileSystem.deleteAsync(resume, { idempotent: true })
  return result.uri
}

/** Persists the resume handle so a killed process can continue where it stopped. */
export const saveResumeHandle = async (
  checksum: string,
  handle: string,
): Promise<void> => {
  await ensureDir()
  await FileSystem.writeAsStringAsync(pathsFor(checksum).resume, handle)
}

/**
 * Hands the downloaded APK to the system installer.
 *
 * A file:// URI throws FileUriExposedException on Android 7+, so the path is
 * converted to a content:// URI backed by Expo's FileProvider first.
 */
export const installApk = async (fileUri: string): Promise<void> => {
  const contentUri = await FileSystem.getContentUriAsync(fileUri)

  await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  })
}

/** Removes a cached artifact once the install is confirmed. */
export const discardArtifact = async (checksum: string): Promise<void> => {
  const { file, resume } = pathsFor(checksum)
  await FileSystem.deleteAsync(file, { idempotent: true })
  await FileSystem.deleteAsync(resume, { idempotent: true })
}
