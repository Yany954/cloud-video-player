const KEY = 'cvp.uploads-in-progress';

type Entries = Record<string, string>;

function read(): Entries {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Entries;
  } catch {
    return {};
  }
}

function write(entries: Entries) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked: uploads still work, they just can't resume after a reload.
  }
}

/**
 * Identifies "the same file, picked again". The browser cannot keep access to a file
 * across reloads, so resuming means the user re-selects it and we match it here.
 */
export function fingerprint(userId: string, file: File): string {
  return [userId, file.name, file.size, file.lastModified].join(':');
}

/** Remembers which server upload each unfinished file belongs to. */
export const resumeStore = {
  get: (key: string): string | undefined => read()[key],
  set(key: string, videoId: string) {
    write({ ...read(), [key]: videoId });
  },
  delete(key: string) {
    const entries = read();
    delete entries[key];
    write(entries);
  },
};
