import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

export interface Loaded<T> {
  /** null until the first answer. */
  data: T | null;
  /** The last attempt failed (data, if any, is from an earlier one). */
  failed: boolean;
  /** The person pulled the list down. */
  refreshing: boolean;
  refresh(): void;
  /** Loads again without the pull-down spinner. */
  reload(): Promise<void>;
  error: unknown;
}

/**
 * Loads a screen's data when the screen comes into view, and again whenever the person returns
 * to it, so a list is never left stale after watching a video or switching tabs.
 */
export function useLoad<T>(load: () => Promise<T>): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Only the newest request may write its answer.
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const id = ++latest.current;
    try {
      const value = await load();
      if (id !== latest.current) return;
      setData(value);
      setError(null);
    } catch (caught) {
      if (id === latest.current) setError(caught ?? new Error('failed'));
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        latest.current++;
      };
    }, [reload]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void reload().finally(() => setRefreshing(false));
  }, [reload]);

  return { data, failed: error !== null, error, refreshing, refresh, reload };
}
