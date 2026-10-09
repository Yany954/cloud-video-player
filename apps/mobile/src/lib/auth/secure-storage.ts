import * as SecureStore from 'expo-secure-store';

/**
 * Where the sign-in tokens live on the phone: the iOS Keychain / Android Keystore, through
 * expo-secure-store. They are never written to plain app storage.
 *
 * A stored value has a size limit on some systems (about 2 KB) and a token can be longer, so
 * a long value is split over several entries: `<key>` holds how many, `<key>.0`, `<key>.1`…
 * hold the pieces.
 */
const CHUNK = 1800;
const COUNT_PREFIX = 'chunks:';
// Stays readable while the phone is locked after its first unlock, so a refresh in the
// background (an upload that continues) can still read the session.
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** SecureStore keys allow only letters, digits, ".", "-" and "_". */
export function safeKey(key: string): string {
  return key.replace(
    /[^A-Za-z0-9._-]/g,
    (character) => `_${character.charCodeAt(0).toString(16)}_`,
  );
}

export function split(value: string, size = CHUNK): string[] {
  const pieces: string[] = [];
  for (let start = 0; start < value.length; start += size)
    pieces.push(value.slice(start, start + size));
  return pieces.length ? pieces : [''];
}

async function pieceCount(key: string): Promise<number> {
  const head = await SecureStore.getItemAsync(key, OPTIONS);
  return head?.startsWith(COUNT_PREFIX) ? Number(head.slice(COUNT_PREFIX.length)) : 0;
}

/** The storage interface Amplify asks for (`KeyValueStorageInterface`). */
export const secureStorage = {
  async setItem(rawKey: string, value: string): Promise<void> {
    const key = safeKey(rawKey);
    const before = await pieceCount(key);
    const pieces = split(value);
    await Promise.all(
      pieces.map((piece, index) => SecureStore.setItemAsync(`${key}.${index}`, piece, OPTIONS)),
    );
    await SecureStore.setItemAsync(key, `${COUNT_PREFIX}${pieces.length}`, OPTIONS);
    // A shorter value than before leaves no old pieces behind.
    for (let index = pieces.length; index < before; index++) {
      await SecureStore.deleteItemAsync(`${key}.${index}`, OPTIONS);
    }
  },

  async getItem(rawKey: string): Promise<string | null> {
    const key = safeKey(rawKey);
    const count = await pieceCount(key);
    if (count === 0) return null;
    const pieces = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(`${key}.${index}`, OPTIONS),
      ),
    );
    // A missing piece means a write was interrupted: treat the value as absent.
    return pieces.some((piece) => piece === null) ? null : pieces.join('');
  },

  async removeItem(rawKey: string): Promise<void> {
    const key = safeKey(rawKey);
    const count = await pieceCount(key);
    for (let index = 0; index < count; index++) {
      await SecureStore.deleteItemAsync(`${key}.${index}`, OPTIONS);
    }
    await SecureStore.deleteItemAsync(key, OPTIONS);
  },

  // Amplify calls this on sign-out after removing each of its keys one by one; SecureStore
  // cannot list keys, and nothing else of ours is kept through this storage.
  async clear(): Promise<void> {},
};
