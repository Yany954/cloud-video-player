import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cvp.uploads-in-progress';

type Entries = Record<string, string>;

let entries: Entries = {};

function persist() {
  // Uploads still work if this fails; they just cannot resume after the app is closed.
  void AsyncStorage.setItem(KEY, JSON.stringify(entries)).catch(() => {});
}

/**
 * Remembers which server upload each unfinished video belongs to, so choosing the same video
 * again continues instead of starting over. Ids only: no file contents, nothing secret.
 */
export const resumeStore = {
  /** Reads what an earlier run of the app remembered. Call once, before the first upload. */
  async load(): Promise<void> {
    try {
      entries = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as Entries;
    } catch {
      entries = {};
    }
  },
  get: (key: string): string | undefined => entries[key],
  set(key: string, videoId: string) {
    entries = { ...entries, [key]: videoId };
    persist();
  },
  delete(key: string) {
    entries = Object.fromEntries(Object.entries(entries).filter(([name]) => name !== key));
    persist();
  },
};
