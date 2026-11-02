import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { config } from '../api/config';
import { downloadArtifact, installApk } from '../install/installer';
import { recordError, track } from '../telemetry';
import type { VersionCheck } from './version-check';

export type InAppUpdatePhase = 'idle' | 'downloading' | 'ready' | 'installing' | 'error';

export interface InAppUpdateState {
  phase: InAppUpdatePhase;
  /** 0..1 while downloading, null when the server sent no size. */
  progress: number | null;
  bytesWritten: number;
  bytesTotal: number;
}

const IDLE: InAppUpdateState = { phase: 'idle', progress: null, bytesWritten: 0, bytesTotal: 0 };

/**
 * True when this update can be downloaded and installed without leaving the
 * app: Android, and a plain http(s) link to the APK. iOS only ever gets an
 * itms-services link, and a catalog app's storeUrl is a deep link into MAYA —
 * both of those are still opened, not downloaded.
 */
export const canUpdateInApp = (check: VersionCheck | null): boolean =>
  Platform.OS === 'android' &&
  !config.useMockData &&
  Boolean(check && /^https?:\/\//i.test(check.storeUrl));

/**
 * Updates the running app in place: download the APK inside the app with
 * progress, then hand it straight to the system installer.
 *
 * This replaces opening the link in the browser, which meant Chrome, a
 * "file might be harmful" warning, a trip to Downloads and a tap on the file —
 * four steps where people gave up. Now the only screen that is not ours is
 * Android's own "Do you want to update this app?" sheet, which no app can skip.
 *
 * Backing out of that sheet leaves the file where it is (`ready`), so "Install"
 * re-opens the installer without downloading again. A confirmed install
 * usually never reports back: Android replaces this process as it installs.
 */
export const useInAppUpdate = (check: VersionCheck | null) => {
  const [state, setState] = useState<InAppUpdateState>(IDLE);
  const file = useRef<string | null>(null);

  const install = useCallback(async (fileUri: string) => {
    setState((current) => ({ ...current, phase: 'installing' }));
    const outcome = await installApk(fileUri);
    // 'installed' rarely gets here — the new build replaces this process — but
    // when it does there is nothing left to show.
    setState((current) => ({ ...current, phase: outcome === 'installed' ? 'idle' : 'ready' }));
  }, []);

  const start = useCallback(async () => {
    if (!check) return;
    if (state.phase === 'ready' && file.current) {
      await install(file.current);
      return;
    }
    if (state.phase === 'downloading' || state.phase === 'installing') return;

    const params = { from_version: check.currentVersion, to_version: check.latestVersion };
    setState({ ...IDLE, phase: 'downloading' });
    const startedAt = Date.now();
    try {
      // Named after the build's digest when the server sends one, so a retry
      // resumes the same file and a newer build never collides with it.
      const fileUri = await downloadArtifact(
        check.storeUrl,
        check.sha256 ?? `maya-${check.latestVersion}`,
        ({ fraction, bytesWritten, bytesTotal }) =>
          setState({ phase: 'downloading', progress: fraction, bytesWritten, bytesTotal }),
      );
      file.current = fileUri;
      track('self_update_downloaded', { ...params, duration_ms: Date.now() - startedAt });
      await install(fileUri);
    } catch (caught) {
      track('self_update_failed', params);
      recordError(caught, { where: 'self_update', version: check.latestVersion });
      setState({ ...IDLE, phase: 'error' });
    }
  }, [check, state.phase, install]);

  return { state, start };
};
