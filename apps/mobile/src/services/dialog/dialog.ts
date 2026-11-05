/**
 * One place that asks the user a question, for the whole app.
 *
 * The native `Alert` is not used anywhere: it draws the platform's own chrome
 * (a different shape and font on each OS, no dark mode, no translation of its
 * buttons) and cannot be reached from a test or styled to match the app. These
 * calls open the app's own modal instead, drawn by `DialogHost`.
 *
 * A module-level queue rather than React context, because the callers include
 * code that is not a component — the install pipeline reports problems from
 * plain async functions — and a question must be askable from there too.
 */

export interface DialogRequest {
  title: string;
  message?: string;
  /** Defaults to "OK". */
  confirmLabel?: string;
  /** Omit for a notice with a single button; pass for a real question. */
  cancelLabel?: string;
  /** `danger` for anything that removes something or ends a session. */
  tone?: 'default' | 'danger';
}

export interface PendingDialog extends DialogRequest {
  id: number;
  resolve: (confirmed: boolean) => void;
}

type Listener = () => void;

let counter = 0;
let queue: PendingDialog[] = [];
const listeners = new Set<Listener>();

const emit = (): void => {
  for (const listener of listeners) listener();
};

export const subscribeDialogs = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The dialog on screen now, or null. Stable between changes, as a store snapshot must be. */
export const currentDialog = (): PendingDialog | null => queue[0] ?? null;

/** Called by the host when the user answers. Shows the next one, if any waited. */
export const settleDialog = (id: number, confirmed: boolean): void => {
  const current = queue[0];
  if (!current || current.id !== id) return;
  queue = queue.slice(1);
  current.resolve(confirmed);
  emit();
};

/**
 * Asks a question. Resolves true on the confirm button, false on cancel, on
 * tapping outside, and on the Android back button.
 */
export const confirmDialog = (request: DialogRequest & { cancelLabel: string }): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    counter += 1;
    queue = [...queue, { ...request, id: counter, resolve }];
    emit();
  });

/** Tells the user something. Resolves once they have dismissed it. */
export const showMessage = (title: string, message?: string): Promise<void> =>
  new Promise<void>((resolve) => {
    counter += 1;
    queue = [
      ...queue,
      { title, ...(message ? { message } : {}), id: counter, resolve: () => resolve() },
    ];
    emit();
  });
