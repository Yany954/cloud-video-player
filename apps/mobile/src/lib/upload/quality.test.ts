import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => void store.set(key, value),
  },
}));

const { readUploadQuality, writeUploadQuality } = await import('./quality');

beforeEach(() => store.clear());

describe('upload quality choice', () => {
  it('is "smaller" until the person asks for originals, and is remembered', async () => {
    expect(await readUploadQuality()).toBe('smaller');
    await writeUploadQuality('original');
    expect(await readUploadQuality()).toBe('original');
    await writeUploadQuality('smaller');
    expect(await readUploadQuality()).toBe('smaller');
  });

  it('falls back to "smaller" for anything unexpected in storage', async () => {
    store.set('cvp.upload-quality', 'huge');
    expect(await readUploadQuality()).toBe('smaller');
  });
});
