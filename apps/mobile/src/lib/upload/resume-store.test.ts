import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => void store.set(key, value),
  },
}));
vi.mock('expo-file-system', () => ({}));

const { resumeStore } = await import('./resume-store');
const { fingerprint } = await import('./source');

const video = {
  uri: 'file:///tmp/copy-1.mov',
  fileName: 'IMG_0001.MOV',
  sizeBytes: 1_000,
  assetId: 'asset-1',
  durationSeconds: 10,
  thumbnailUri: null,
};

beforeEach(async () => {
  store.clear();
  await resumeStore.load();
});

describe('resume store', () => {
  it('remembers an unfinished upload across a restart of the app', async () => {
    resumeStore.set('key-1', 'video-1');
    await Promise.resolve();
    await resumeStore.load();

    expect(resumeStore.get('key-1')).toBe('video-1');
  });

  it('forgets a finished one and keeps the others', async () => {
    resumeStore.set('key-1', 'video-1');
    resumeStore.set('key-2', 'video-2');
    resumeStore.delete('key-1');

    expect(resumeStore.get('key-1')).toBeUndefined();
    expect(resumeStore.get('key-2')).toBe('video-2');
  });

  it('starts empty when what was stored cannot be read', async () => {
    store.set('cvp.uploads-in-progress', 'not json');
    await resumeStore.load();

    expect(resumeStore.get('key-1')).toBeUndefined();
  });
});

describe('fingerprint', () => {
  it('is the same for the same video chosen again, although the copy has a new address', () => {
    expect(fingerprint('ana', { ...video, uri: 'file:///tmp/copy-2.mov' })).toBe(
      fingerprint('ana', video),
    );
  });

  it('differs for another person, another video or another size', () => {
    const base = fingerprint('ana', video);
    expect(fingerprint('ben', video)).not.toBe(base);
    expect(fingerprint('ana', { ...video, assetId: 'asset-2' })).not.toBe(base);
    expect(fingerprint('ana', { ...video, sizeBytes: 2_000 })).not.toBe(base);
  });

  it('falls back to the file name for a new recording', () => {
    expect(fingerprint('ana', { ...video, assetId: null })).toContain('IMG_0001.MOV');
  });
});
