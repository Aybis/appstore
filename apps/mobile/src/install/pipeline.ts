import { Alert, Linking, Platform } from 'react-native';

import { config, getClient, toErrorMessage } from '../api';
import { recordInstall } from '../storage/installs';
import { formatBytes } from '../utils/format';
import type { App } from '../types';
import {
  discardArtifact,
  downloadArtifact,
  installApk,
  type DownloadProgress,
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
  error: string | null;
}

export const IDLE: InstallSnapshot = {
  phase: 'idle',
  progress: null,
  detail: null,
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
        Alert.alert(`Cannot install ${app.name}`, ticket.instructions);
        return;
      }

      await Linking.openURL(ticket.url);
      await recordInstall(app.slug, ticket.version);
      return;
    }

    if (ticket.instructions) {
      set({ phase: 'idle' });
      Alert.alert(`Install ${app.name}`, ticket.instructions);
      return;
    }

    if (Platform.OS !== 'android') {
      set({ phase: 'idle' });
      Alert.alert(
        `Install ${app.name}`,
        'Direct install is available on Android only in this version.',
      );
      return;
    }

    if (config.useMockData) {
      set({ phase: 'idle' });
      Alert.alert(
        `Download ${app.name}`,
        `Mock mode — no binary is served.\nWould stream ${formatBytes(ticket.sizeBytes)}.`,
      );
      return;
    }

    const checksum = ticket.checksum ?? `${app.slug}-${ticket.version}`;

    set({ phase: 'downloading' });
    const fileUri = await downloadArtifact(
      ticket.url,
      checksum,
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

    set({ phase: 'installing' });
    await installApk(fileUri);

    // The system installer runs in its own process and reports nothing back,
    // so this records "handed to the installer", not a confirmed install.
    await recordInstall(app.slug, ticket.version);
    await discardArtifact(checksum);

    set({ phase: 'done' });
  } catch (caught) {
    set({ phase: 'error', error: toErrorMessage(caught) });
  }
};
