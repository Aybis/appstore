import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: unknown;
  /** True while a refresh runs over already-loaded data (pull-to-refresh). */
  refreshing: boolean;
  refresh: () => void;
};

/**
 * Minimal request-state primitive: runs `task` on mount and whenever `deps`
 * change, ignores results from superseded runs, and never sets state after
 * unmount. This is the one place async plumbing lives — TanStack Query can
 * replace it later without touching call sites.
 */
export const useAsync = <T>(
  task: () => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  const mounted = useRef(true);
  const runId = useRef(0);
  // Keep the latest task without making it a dependency of the effect.
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const currentRun = runId.current + 1;
    runId.current = currentRun;

    const isRefresh = nonce > 0;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    taskRef
      .current()
      .then((result) => {
        if (!mounted.current || runId.current !== currentRun) return;
        setData(result);
      })
      .catch((caught: unknown) => {
        if (!mounted.current || runId.current !== currentRun) return;
        setError(caught);
        setData(null);
      })
      .finally(() => {
        if (!mounted.current || runId.current !== currentRun) return;
        setLoading(false);
        setRefreshing(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, refreshing, refresh };
};
