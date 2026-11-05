import { Alert, Linking, Platform } from 'react-native';

import { config, getClient, toErrorMessage } from '../api';
import { recordInstall } from '../storage/installs';
import { reportInstall } from '../device/telemetry';
import { breadcrumb, recordError, track } from '../telemetry';
import { formatBytes } from '../../utils/format';
import type { App } from '../../types';
import {
  canInstallPackages,
  discardArtifact,
  discardIfInvalid,
  downloadArtifact,
  installApk,
  InstallError,
  isOnDevice,
  type DownloadProgress,
  type InstallErrorCode,
} from './installer';

export type InstallPhase =
  | 'idle'
  | 'preparing'
  | 'downloading'
  | 'installing'
  | 'done'
  | 'error';

export interface InstallSnapshot {
  phase: InstallPhase;
  /** 0..1 while downloading, null when the total size is unknown. */
  progress: number | null;
  /** "42.1 MB of 102 MB" while downloading. */
  detail: string | null;
  /** What kind of failure, so the UI can explain it and say what to do. */
  errorCode: InstallErrorCode | null;
  /** Technical detail for the failure ("HTTP 404", "code -7"), if any. */
  error: string | null;
}

export const IDLE: InstallSnapshot = {
  phase: 'idle',
  progress: null,
  detail: null,
  errorCode: null,
  error: null,
};

export const isInstallBusy = (phase: InstallPhase): boolean =>
  phase === 'preparing' || phase === 'downloading' || phase === 'installing';

/**
 * The install pipeline as a plain function so it can be driven from anywhere —
 * a card in the list or the detail screen's bottom bar — with the owning
 * provider holding the state per slug.
 *
 *   resolve ticket -> download (resumable, in-app) -> hand to system installer
 */
export const runInstall = async (
  app: App,
  emit: (snapshot: InstallSnapshot) => void,
): Promise<void> => {
  const set = (patch: Partial<InstallSnapshot>): void =>
    emit({ ...IDLE, ...patch });

  set({ phase: 'preparing' });
  track('install_started', { slug: app.slug, version: app.version });
  // The trail attached to whatever fails next. Installs are where this app
  // touches the OS, and "which app, which version" is the first thing anyone
  // reading a crash report needs.
  breadcrumb(`install ${app.slug}@${app.version}`);

  /*
   * Where in the pipeline a failure happened. "Installs fail 4% of the time"
   * is a number; "they fail at download, on one app" is a cause. Every exit
   * that is not a confirmed install is tracked under its own name, so the
   * funnel install_started -> install_completed accounts for everyone.
   */
  let stage: 'ticket' | 'download' | 'install' = 'ticket';
  /** Names the artifact on disk once the ticket says which build it is. */
  let key: string | null = null;
  const blocked = (reason: string): void =>
    track('install_blocked', { slug: app.slug, version: app.version, reason });

  try {
    const ticket = await getClient().downloadApp(app.slug);

    // iOS never receives bytes: the OS only acts on an itms-services link,
    // which the API now issues (DistributionPort / ItmsServicesAdapter).
    if (ticket.url.startsWith('itms-services://')) {
      set({ phase: 'idle' });

      // Instructions here mean the server told us the install cannot succeed —
      // today that is the HTTPS requirement. Opening the link anyway would
      // fail silently in Safari, so say why instead.
      if (ticket.instructions) {
        blocked('ios_server_refused');
        Alert.alert(`Cannot install ${app.name}`, ticket.instructions);
        return;
      }

      await Linking.openURL(ticket.url);
      await recordInstall(app.slug, ticket.version);
      track('install_handed_off', { slug: app.slug, version: ticket.version, platform: 'ios' });
      /*
       * NOT reported to the server here, deliberately. This is the iOS path:
       * the URL is handed to the OS and the app never learns whether the
       * install succeeded. Reporting "installed" would be recording an
       * outcome nobody observed — which is exactly the fiction the audit log
       * already suffers from and this telemetry exists to avoid.
       */
      return;
    }

    if (ticket.instructions) {
      set({ phase: 'idle' });
      blocked('server_instructions');
      Alert.alert(`Install ${app.name}`, ticket.instructions);
      return;
    }

    if (Platform.OS !== 'android') {
      set({ phase: 'idle' });
      blocked('unsupported_platform');
      Alert.alert(
        `Install ${app.name}`,
        'Direct install is available on Android only in this version.',
      );
      return;
    }

    if (config.useMockData) {
      set({ phase: 'idle' });
      blocked('mock_mode');
      Alert.alert(
        `Download ${app.name}`,
        `Mock mode — no binary is served.\nWould stream ${formatBytes(ticket.sizeBytes)}.`,
      );
      return;
    }

    // The server's SHA-256 names the file, so a new version never picks up
    // an old version's bytes, and a different app never shares a file.
    key = ticket.checksum || `${app.slug}-${ticket.version}`;

    stage = 'download';
    set({ phase: 'downloading' });
    const artifact = await downloadArtifact(
      ticket.url,
      key,
      { sha256: ticket.checksum, sizeBytes: ticket.sizeBytes },
      (p: DownloadProgress) =>
        set({
          phase: 'downloading',
          progress: p.fraction,
          detail:
            p.bytesTotal > 0
              ? `${formatBytes(p.bytesWritten)} of ${formatBytes(p.bytesTotal)}`
              : formatBytes(p.bytesWritten),
        }),
    );

    stage = 'install';
    set({ phase: 'installing' });
    const outcome = await installApk(artifact.uri);

    // The installer's answer is checked against the device itself: some OEM
    // builds report "cancelled" for an install that landed, and the store
    // used to believe whichever it was told.
    const landed = outcome === 'installed' || isOnDevice(artifact.identity);

    if (!landed) {
      // The artifact is deliberately kept — verified, in app storage — so the
      // next tap installs straight away instead of downloading again. That
      // covers both a user backing out and a trip to Settings to allow
      // "install unknown apps".
      if (!canInstallPackages()) {
        blocked('install_permission');
        set({ phase: 'error', errorCode: 'permission_required' });
        return;
      }
      set({ phase: 'idle' });
      track('install_dismissed', { slug: app.slug, version: ticket.version });
      return;
    }

    await recordInstall(app.slug, ticket.version);
    /*
     * Reported to the server as well as recorded locally. The local log is
     * what the app reads back; this is the only thing that tells the dashboard
     * an install actually landed — the audit log only knows a ticket was
     * issued, and whether it worked happens out here.
     */
    void reportInstall(app.slug, ticket.version, 'installed');
    track('install_completed', { slug: app.slug, version: ticket.version });
    // Only now, with the app confirmed on the device, is the APK let go.
    discardArtifact(key);

    set({ phase: 'done' });
  } catch (caught) {
    // Failures are reported too. A store that only counts what worked cannot
    // tell an app nobody wants from an app nobody can install, and those need
    // opposite responses.
    const failure =
      caught instanceof InstallError
        ? caught
        : new InstallError('unknown', toErrorMessage(caught));

    // A package the installer refused must not be offered again as-is.
    if (key && stage === 'install' && failure.code === 'install_failed') {
      await discardIfInvalid(key).catch(() => undefined);
    }

    // An interrupted download is not a failed install: it resumes on its own
    // when the app returns to the foreground, so it is not reported as one.
    if (failure.code !== 'interrupted') void reportInstall(app.slug, app.version, 'failed');
    track('install_failed', { slug: app.slug, version: app.version, stage, reason: failure.code });
    /*
     * Reported as a handled error, not just an event. A failed install is the
     * one failure in this app a user cannot work around, and the count alone
     * says how many without ever saying why — the stack is the difference
     * between knowing installs fail and being able to fix them.
     */
    recordError(caught, { where: 'install', stage, slug: app.slug, version: app.version });
    set({ phase: 'error', errorCode: failure.code, error: failure.detail });
  }
};
