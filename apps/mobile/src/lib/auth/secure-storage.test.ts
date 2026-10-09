import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
  getItemAsync: async (key: string) => store.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (!/^[A-Za-z0-9._-]+$/.test(key)) throw new Error(`Invalid key: ${key}`);
    if (value.length > 2048) throw new Error('Value too large');
    store.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    store.delete(key);
  },
}));

const { safeKey, secureStorage, split } = await import('./secure-storage');

beforeEach(() => store.clear());

describe('secure storage for sign-in tokens', () => {
  const key = 'CognitoIdentityServiceProvider.client.user@example.com.idToken';

  it('turns any key into one the secure store accepts, without collisions', () => {
    expect(safeKey(key)).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(safeKey('a@b')).not.toBe(safeKey('a_b'));
  });

  it('stores and returns a short value', async () => {
    await secureStorage.setItem(key, 'short');
    expect(await secureStorage.getItem(key)).toBe('short');
  });

  it('splits a value longer than the limit and joins it back exactly', async () => {
    const token = 'x'.repeat(5000) + 'end';
    await secureStorage.setItem(key, token);

    expect(await secureStorage.getItem(key)).toBe(token);
    expect(split(token)).toHaveLength(3);
  });

  it('leaves no old pieces behind when a shorter value replaces a longer one', async () => {
    await secureStorage.setItem(key, 'y'.repeat(5000));
    await secureStorage.setItem(key, 'short');

    expect(await secureStorage.getItem(key)).toBe('short');
    expect(store.size).toBe(2);
  });

  it('removes every piece, and answers null for a missing or half-written value', async () => {
    await secureStorage.setItem(key, 'z'.repeat(5000));
    store.delete(`${safeKey(key)}.1`);
    expect(await secureStorage.getItem(key)).toBeNull();

    await secureStorage.removeItem(key);
    expect(store.size).toBe(0);
    expect(await secureStorage.getItem('never-set')).toBeNull();
  });

  it('keeps an empty value as empty, not as missing', async () => {
    await secureStorage.setItem(key, '');
    expect(await secureStorage.getItem(key)).toBe('');
  });
});
