import type { Translate } from '../../i18n';
import type { InstallSnapshot } from './pipeline';

/**
 * The user-facing explanation of a failed install: what happened and what to
 * do, in the user's language, followed by the technical detail ("HTTP 404",
 * "code -7") so a screenshot sent to IT is enough to diagnose it.
 *
 * Replaces the bare native message ("Software caused connection abort"),
 * which said what broke without saying whether retrying would help.
 */
export const describeInstallError = (t: Translate, snapshot: InstallSnapshot): string | null => {
  if (snapshot.phase !== 'error') return null;
  const message = t(`install.error.${snapshot.errorCode ?? 'unknown'}`);
  return snapshot.error ? `${message}\n${snapshot.error}` : message;
};
