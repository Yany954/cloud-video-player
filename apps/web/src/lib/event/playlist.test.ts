import { describe, expect, it } from 'vitest';
import { nextId, previousId, readAutoplay, startingId, writeAutoplay } from './playlist';

const ids = ['a', 'b', 'c'];

describe('nextId and previousId', () => {
  it('walk the list in order', () => {
    expect(nextId(ids, 'a')).toBe('b');
    expect(previousId(ids, 'c')).toBe('b');
  });

  it('stop at both ends', () => {
    expect(nextId(ids, 'c')).toBeNull();
    expect(previousId(ids, 'a')).toBeNull();
  });

  it('have nowhere to go from a video that is not in the list', () => {
    expect(nextId(ids, 'x')).toBeNull();
    expect(previousId(ids, null)).toBeNull();
  });
});

describe('startingId', () => {
  it('starts with the requested video when it can be played', () => {
    expect(startingId(ids, 'b')).toBe('b');
  });

  it('falls back to the first video, or nothing in an empty event', () => {
    expect(startingId(ids, 'gone')).toBe('a');
    expect(startingId(ids, null)).toBe('a');
    expect(startingId([], 'a')).toBeNull();
  });
});

describe('autoplay choice', () => {
  const storage = () => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
  };

  it('is on until the viewer turns it off, and remembers either choice', () => {
    const store = storage();
    expect(readAutoplay(store)).toBe(true);
    writeAutoplay(store, false);
    expect(readAutoplay(store)).toBe(false);
    writeAutoplay(store, true);
    expect(readAutoplay(store)).toBe(true);
  });

  it('stays on when storage is missing or throws', () => {
    expect(readAutoplay(undefined)).toBe(true);
    expect(
      readAutoplay({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBe(true);
  });
});
