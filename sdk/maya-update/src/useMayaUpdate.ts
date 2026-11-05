import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform as RNPlatform } from 'react-native';

import { checkForUpdate, type CheckOptions, type UpdateInfo } from './check';
import { startUpdate, type DownloadProgress, type StartOptions, type UpdateOutcome } from './install';

export type MayaUpdateConfig = Omit<CheckOptions, 'platform' | 'signal'> &
  Pick<StartOptions, 'mode' | 'mayaLandingUrl' | 'onEvent'> & {
    /** Set false to skip the check, e.g. in development builds. */
    enabled?: boolean;
  };

export interface MayaUpdateState {
  /** The pending update, or null when current (or when the check failed). */
  update: UpdateInfo | null;
  /** True while a prompt should be shown. Always true for an immediate update. */
  visible: boolean;
  /** Download progress of an in-place Android update. */
  progress: DownloadProgress | null;
  busy: boolean;
  lastOutcome: UpdateOutcome | null;
  /** Starts the update. */
  start: () => Promise<UpdateOutcome | null>;
  /** "Later". Inert for an immediate update, by construction. */
  dismiss: () => void;
  /** Checks again. */
  refresh: () => void;
}

/**
 * The whole flow as one hook: check on launch, check again whenever the app
 * comes back to the foreground, and start or postpone the update.
 *
 * Why foreground: someone sent to MAYA (or the installer) to update comes BACK
 * to this app afterwards, and it has to notice it is now current instead of
 * holding them behind a stale "update required".
 *
 * Headless on purpose. Draw the prompt in the app's own design; render no way
 * out when `update.flow === 'immediate'`, and on Android also swallow the back
 * button (BackHandler) while it is shown.
 */
export const useMayaUpdate = (config: MayaUpdateConfig): MayaUpdateState => {
  const { enabled = true, apiBaseUrl, org, packageId, currentVersion, installKey, timeoutMs } = config;
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<UpdateOutcome | null>(null);

  // Read through a ref so the callbacks below do not change identity, and
  // re-run the check, every time the host passes a new inline onEvent.
  const startOptions = useRef(config);
  startOptions.current = config;

  const run = useCallback(
    (signal?: AbortSignal) => {
      if (!enabled) return;
      void checkForUpdate({
        apiBaseUrl,
        org,
        packageId,
        currentVersion,
        platform: RNPlatform.OS === 'ios' ? 'ios' : 'android',
        ...(installKey ? { installKey } : {}),
        ...(timeoutMs ? { timeoutMs } : {}),
        ...(signal ? { signal } : {}),
      }).then((result) => {
        if (!signal?.aborted) setUpdate(result);
      });
    },
    [enabled, apiBaseUrl, org, packageId, currentVersion, installKey, timeoutMs],
  );

  useEffect(() => {
    const controller = new AbortController();
    run(controller.signal);
    return () => controller.abort();
  }, [run]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => subscription.remove();
  }, [run]);

  const start = useCallback(async () => {
    if (!update || busy) return null;
    setBusy(true);
    setProgress(null);
    try {
      const { mode, mayaLandingUrl, onEvent } = startOptions.current;
      const outcome = await startUpdate(update, {
        ...(mode ? { mode } : {}),
        ...(mayaLandingUrl ? { mayaLandingUrl } : {}),
        ...(onEvent ? { onEvent } : {}),
        onProgress: setProgress,
      });
      setLastOutcome(outcome);
      // A signed URL is single-use in practice (15 minutes); a retry needs a
      // fresh one, so check again after any in-place attempt.
      if (outcome !== 'installed') run();
      return outcome;
    } finally {
      setBusy(false);
    }
  }, [update, busy, run]);

  const dismiss = useCallback(() => {
    if (!update || update.flow === 'immediate') return;
    setDismissedVersion(update.latestVersion);
  }, [update]);

  return {
    update,
    // Dismissing hides THIS version's prompt; a newer one shows again.
    visible: Boolean(update) && (update?.flow === 'immediate' || dismissedVersion !== update?.latestVersion),
    progress,
    busy,
    lastOutcome,
    start,
    dismiss,
    refresh: () => run(),
  };
};
