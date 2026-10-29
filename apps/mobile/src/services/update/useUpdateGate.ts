import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import {
  fetchVersionCheck,
  runningVersion,
  type VersionCheck,
  type VersionCheckQuery,
} from './version-check';

export interface UpdateGateState {
  check: VersionCheck | null;
  /** True while the modal should be on screen. */
  visible: boolean;
  /** Dismiss. A no-op when the update is required — see the note below. */
  dismiss: () => void;
  /** Re-runs the check, e.g. after returning from the store. */
  refresh: () => void;
}

type Options = Partial<Pick<VersionCheckQuery, 'packageId' | 'orgSlug'>> & {
  /** Overrides the running version. Only useful for demonstrating the rule. */
  version?: string;
  enabled?: boolean;
};

/**
 * Drives the update prompt for the app this code is running inside.
 *
 * Two behaviours are deliberate and worth stating, because they are the whole
 * point of the severity rule:
 *
 *   - a REQUIRED update cannot be dismissed, and `dismiss()` is inert rather
 *     than merely hidden. If the only way to close the modal were a button we
 *     chose not to render, any future caller wiring up a back handler would
 *     silently reopen the escape hatch;
 *   - the check re-runs when the app returns to the foreground. Someone sent to
 *     the store to update comes BACK to this app, and it must notice they are
 *     now current instead of holding them behind a stale modal.
 */
export const useUpdateGate = (options: Options = {}): UpdateGateState => {
  const { enabled = true, packageId, orgSlug, version } = options;

  const [check, setCheck] = useState<VersionCheck | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const run = useCallback(
    (signal?: AbortSignal) => {
      if (!enabled || !packageId) return;
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';

      void fetchVersionCheck(
        { packageId, platform, orgSlug, version: version ?? runningVersion() },
        signal,
      ).then((result) => {
        if (signal?.aborted) return;
        setCheck(result);
        // A fresh answer re-opens the prompt: the user dismissed the PREVIOUS
        // version's notice, not this one.
        if (result?.latestVersion !== check?.latestVersion) setDismissed(false);
      });
    },
    [enabled, packageId, orgSlug, version, check?.latestVersion],
  );

  useEffect(() => {
    const controller = new AbortController();
    run(controller.signal);
    return () => controller.abort();
    // `run` intentionally omitted: it changes identity whenever the last result
    // changes, and depending on it here would re-fire the request on every
    // answer, in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, packageId, orgSlug, version]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => subscription.remove();
  }, [run]);

  const dismiss = useCallback(() => {
    // Inert for a required update, by construction rather than by not drawing
    // a button.
    if (check?.updateRequired) return;
    setDismissed(true);
  }, [check?.updateRequired]);

  return {
    check,
    visible: Boolean(check?.updateAvailable) && !dismissed,
    dismiss,
    refresh: () => run(),
  };
};
