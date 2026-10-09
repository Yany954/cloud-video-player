import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => void store.set(key, value),
  },
}));

const { nextId, previousId, readAutoplay, startingId, writeAutoplay } = await import('./playlist');

const ids = ['a', 'b', 'c'];
beforeEach(() => store.clear());

describe('playlist order', () => {
  it('goes to the next and the previous video, and stops at both ends', () => {
    expect(nextId(ids, 'a')).toBe('b');
    expect(nextId(ids, 'c')).toBeNull();
    expect(previousId(ids, 'b')).toBe('a');
    expect(previousId(ids, 'a')).toBeNull();
  });

  it('answers null for a video that is not in the list', () => {
    expect(nextId(ids, 'gone')).toBeNull();
    expect(previousId(ids, null)).toBeNull();
  });

  it('starts with the video asked for when it is playable, else the first', () => {
    expect(startingId(ids, 'b')).toBe('b');
    expect(startingId(ids, 'gone')).toBe('a');
    expect(startingId([], null)).toBeNull();
  });
});

describe('autoplay choice', () => {
  it('is on until the viewer turns it off, and is remembered', async () => {
    expect(await readAutoplay()).toBe(true);
    await writeAutoplay(false);
    expect(await readAutoplay()).toBe(false);
    await writeAutoplay(true);
    expect(await readAutoplay()).toBe(true);
  });
});
