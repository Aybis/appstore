import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { config, getClient, toErrorMessage } from '../api';
import { formatBytes } from '../utils/format';
import type { App } from '../types';

export type DownloadState = {
  /** True while the download ticket is being resolved. */
  starting: boolean;
  start: () => void;
};

/**
 * Install / download action for the detail screen (FR-2.4, FR-2.5).
 *
 * Resolves a DownloadTicket through the client, then hands off:
 *   - Android → open the streaming URL so the system download manager + package
 *     installer take over.
 *   - iOS → show the distribution instructions (v1 has no direct install path).
 *
 * While the mock provider is active there is no real binary behind the URL, so
 * the handoff is described in an alert instead of attempted.
 */
export const useDownload = (app: App | null): DownloadState => {
  const [starting, setStarting] = useState(false);

  const start = useCallback(async () => {
    if (!app || starting) return;
    setStarting(true);

    try {
      const ticket = await getClient().downloadApp(app.slug);

      if (ticket.instructions) {
        Alert.alert(`Install ${app.name}`, ticket.instructions);
        return;
      }

      if (config.useMockData) {
        Alert.alert(
          `Download ${app.name}`,
          `Mock mode — no binary is served yet.\n\n` +
            `Version ${ticket.version} · ${formatBytes(ticket.sizeBytes)}\n` +
            `Would stream from:\n${ticket.url}`,
        );
        return;
      }

      const canOpen = await Linking.canOpenURL(ticket.url);
      if (!canOpen) throw new Error('No handler for the download URL.');
      await Linking.openURL(ticket.url);
    } catch (error) {
      Alert.alert('Download failed', toErrorMessage(error));
    } finally {
      setStarting(false);
    }
  }, [app, starting]);

  return { starting, start: () => void start() };
};
