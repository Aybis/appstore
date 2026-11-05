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
import { AppState } from 'react-native';

import { useT } from '../../i18n';
import { readInstalls, type InstallRecord } from '../storage/installs';
import { InstalledApps } from '../../../modules/installed-apps';
import { notify } from '../notifications/notifications';
import { track } from '../telemetry';
import { isOlderThan } from '../../utils/version';
import type { App } from '../../types';
import { describeInstallError } from './describe';
import { purgeLegacyArtifacts } from './installer';
import { IDLE, runInstall, type InstallSnapshot } from './pipeline';

/**
 * How many times in a row an interrupted download resumes by itself when the
 * app comes back to the foreground. Bounded so a link that keeps dropping ends
 * in a visible Retry instead of a loop the user cannot see.
 */
const MAX_AUTO_RESUMES = 3;

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
  /**
   * Launches an app that is already on the device. Returns false when it
   * could not be launched — not installed, no launcher activity (a service or
   * plugin package), or iOS, which cannot do this at all.
   */
  launch: (app: App) => boolean;
  /** Installed version for an app, or null when it was never installed here. */
  installedVersionFor: (slug: string) => string | null;
  snapshotFor: (slug: string) => InstallSnapshot;
  install: (app: App) => void;
  /** Re-reads the local install log (after an install, or on tab focus). */
  refresh: () => void;
  /**
   * Asks the OS which of these packages are installed, and caches the answer.
   *
   * Called once per catalog load with every package id, rather than per card:
   * a bridge crossing per row would be the most expensive thing the list does.
   */
  syncDevice: (packageIds: readonly string[]) => void;
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
  /** packageId -> version reported by the OS. Empty where the OS cannot say. */
  const [deviceVersions, setDeviceVersions] = useState<Record<string, string>>({});
  const [snapshots, setSnapshots] = useState<Record<string, InstallSnapshot>>({});
  // Downloads are large and metered — never start one without an explicit yes.
  const [pending, setPending] = useState<App | null>(null);
  const running = useRef<Set<string>>(new Set());
  /** Downloads cut off by the connection, waiting to resume on foreground. */
  const interrupted = useRef<Map<string, { app: App; attempts: number }>>(new Map());
  const t = useT();

  // Files written by the old pipeline may be the broken "APKs" that made every
  // retry fail; the new pipeline never reads that directory, so clear it.
  useEffect(purgeLegacyArtifacts, []);

  const refresh = useCallback(() => {
    void readInstalls().then((list) => {
      setRecords(Object.fromEntries(list.map((record) => [record.slug, record])));
    });
  }, []);

  useEffect(refresh, [refresh]);

  const syncDevice = useCallback((packageIds: readonly string[]) => {
    if (!InstalledApps.isSupported() || packageIds.length === 0) return;

    const found = InstalledApps.getInstalledVersions([...packageIds]);
    setDeviceVersions(
      Object.fromEntries(
        Object.entries(found).filter((entry): entry is [string, string] => entry[1] != null),
      ),
    );
  }, []);

  const install = useCallback(
    (app: App) => {
      if (running.current.has(app.slug)) return;
      running.current.add(app.slug);

      void runInstall(app, (snapshot) => {
        setSnapshots((current) => ({ ...current, [app.slug]: snapshot }));

        const terminal =
          snapshot.phase === 'done' || snapshot.phase === 'error' || snapshot.phase === 'idle';
        if (!terminal) return;

        // 'idle' is terminal too (installer dismissed, server instructions).
        // It used to leave the slug in `running`, so every later tap on that
        // app was silently ignored until MAYA was restarted.
        running.current.delete(app.slug);

        // Only tell the user through a notification when they are not looking
        // at MAYA; on screen, the button and the note under it already say it.
        const away = AppState.currentState !== 'active';

        if (snapshot.phase === 'done') {
          interrupted.current.delete(app.slug);
          // A finished install changes the button from Install to Open,
          // which only happens once the log is re-read.
          refresh();
          if (away) {
            void notify(
              t('install.notify.readyTitle', { app: app.name }),
              t('install.notify.readyBody', { version: app.version }),
              { slug: app.slug },
            );
          }
          return;
        }

        if (snapshot.phase !== 'error') {
          interrupted.current.delete(app.slug);
          return;
        }

        if (snapshot.errorCode === 'interrupted') {
          const previous = interrupted.current.get(app.slug);
          const attempts = previous?.attempts ?? 0;
          if (attempts < MAX_AUTO_RESUMES) {
            interrupted.current.set(app.slug, { app, attempts });
            if (away) {
              void notify(
                t('install.notify.pausedTitle', { app: app.name }),
                t('install.notify.pausedBody'),
                { slug: app.slug },
              );
            }
            return;
          }
          interrupted.current.delete(app.slug);
        } else {
          interrupted.current.delete(app.slug);
        }

        if (away) {
          void notify(
            t('install.notify.failedTitle', { app: app.name }),
            describeInstallError(t, snapshot) ?? t('install.error.unknown'),
            { slug: app.slug },
          );
        }
      });
    },
    [refresh, t],
  );

  /*
   * Android drops the download's connection when MAYA is minimised long enough
   * ("Software caused connection abort"). The partial file is kept, so coming
   * back resumes it from where it stopped instead of leaving a Retry button
   * the user has to find.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      for (const [slug, entry] of [...interrupted.current]) {
        interrupted.current.set(slug, { app: entry.app, attempts: entry.attempts + 1 });
        install(entry.app);
      }
    });
    return () => subscription.remove();
  }, [install]);

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
        // The OS wins when it can answer. Our log only knows what MAYA itself
        // installed, so it says "Install" for an app the user already has and
        // keeps saying "Update" for one they updated elsewhere.
        const onDevice = app.packageId ? deviceVersions[app.packageId] : undefined;
        const installedVersion = onDevice ?? records[app.slug]?.version;

        if (!installedVersion) return 'install';
        return isOlderThan(installedVersion, app.version) ? 'update' : 'open';
      },
      /**
       * Launches an app already on the device. False when it could not be.
       *
       * Lives here rather than in the screen because the provider is what
       * decided the row should say "Open" in the first place — the promise and
       * the means to keep it belong together.
       */
      launch: (app) => {
        if (!app.packageId) return false;
        const launched = InstalledApps.launchApp(app.packageId);
        track('app_launched', { slug: app.slug, version: app.version, ok: launched });
        return launched;
      },
      installedVersionFor: (slug) => records[slug]?.version ?? null,
      snapshotFor: (slug) => snapshots[slug] ?? IDLE,
      install,
      syncDevice,
      refresh,
    }),
    [
      records,
      deviceVersions,
      snapshots,
      install,
      refresh,
      syncDevice,
      pending,
      requestInstall,
      confirmInstall,
      cancelInstall,
    ],
  );

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>;
};

export const useInstalls = (): InstallContextValue => {
  const context = useContext(InstallContext);
  if (!context) throw new Error('useInstalls must be used inside InstallProvider');
  return context;
};
