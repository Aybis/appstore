import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { readInstalls, type InstallRecord } from '../storage/installs';
import { isOlderThan } from '../utils/version';
import type { App } from '../types';
import { IDLE, runInstall, type InstallSnapshot } from './pipeline';

/**
 * What the action button on a card should offer.
 *
 *   install — this device has no record of installing it
 *   update  — installed, but the catalog has moved past the installed version
 *   open    — installed and current
 */
export type AppInstallState = 'install' | 'update' | 'open';

interface InstallContextValue {
  stateFor: (app: App) => AppInstallState;
  /** App awaiting the user's confirmation, if any. */
  pending: App | null;
  /** Asks for confirmation first — nothing downloads until confirmInstall(). */
  requestInstall: (app: App) => void;
  confirmInstall: () => void;
  cancelInstall: () => void;
  /** Installed version for an app, or null when it was never installed here. */
  installedVersionFor: (slug: string) => string | null;
  snapshotFor: (slug: string) => InstallSnapshot;
  install: (app: App) => void;
  /** Re-reads the local install log (after an install, or on tab focus). */
  refresh: () => void;
}

const InstallContext = createContext<InstallContextValue | null>(null);

/**
 * Owns the install log and every in-flight install.
 *
 * State lives here rather than in each card so a download survives the row
 * scrolling out of view, and so the detail screen and the list show the same
 * progress for the same app.
 */
export const InstallProvider = ({ children }: { children: ReactNode }) => {
  const [records, setRecords] = useState<Record<string, InstallRecord>>({});
  const [snapshots, setSnapshots] = useState<Record<string, InstallSnapshot>>({});
  // Downloads are large and metered — never start one without an explicit yes.
  const [pending, setPending] = useState<App | null>(null);
  const running = useRef<Set<string>>(new Set());

  const refresh = useCallback(() => {
    void readInstalls().then((list) => {
      setRecords(Object.fromEntries(list.map((record) => [record.slug, record])));
    });
  }, []);

  useEffect(refresh, [refresh]);

  const install = useCallback(
    (app: App) => {
      if (running.current.has(app.slug)) return;
      running.current.add(app.slug);

      void runInstall(app, (snapshot) => {
        setSnapshots((current) => ({ ...current, [app.slug]: snapshot }));

        if (snapshot.phase === 'done' || snapshot.phase === 'error') {
          running.current.delete(app.slug);
          // A finished install changes the button from Install to Open, which
          // only happens once the log is re-read.
          if (snapshot.phase === 'done') refresh();
        }
      });
    },
    [refresh],
  );

  const requestInstall = useCallback((app: App) => setPending(app), []);
  const cancelInstall = useCallback(() => setPending(null), []);
  const confirmInstall = useCallback(() => {
    if (!pending) return;
    install(pending);
    setPending(null);
  }, [pending, install]);

  const value = useMemo<InstallContextValue>(
    () => ({
      pending,
      requestInstall,
      confirmInstall,
      cancelInstall,
      stateFor: (app) => {
        const record = records[app.slug];
        if (!record) return 'install';
        return isOlderThan(record.version, app.version) ? 'update' : 'open';
      },
      installedVersionFor: (slug) => records[slug]?.version ?? null,
      snapshotFor: (slug) => snapshots[slug] ?? IDLE,
      install,
      refresh,
    }),
    [records, snapshots, install, refresh, pending, requestInstall, confirmInstall, cancelInstall],
  );

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>;
};

export const useInstalls = (): InstallContextValue => {
  const context = useContext(InstallContext);
  if (!context) throw new Error('useInstalls must be used inside InstallProvider');
  return context;
};
