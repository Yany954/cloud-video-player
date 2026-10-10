import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system', () => ({ Directory: class {}, File: class {}, Paths: {} }));

const { partCreatedAt, partsAtOnce } = await import('./put-part');

const GB = 1024 * 1024 * 1024;

describe('partsAtOnce', () => {
  it('hands the whole video to the phone when there is room for the temporary copies', () => {
    expect(partsAtOnce(0.6 * GB, 20 * GB)).toBe(64);
  });

  it('goes two at a time when space is short', () => {
    expect(partsAtOnce(3 * GB, 3.5 * GB)).toBe(2);
    expect(partsAtOnce(0.6 * GB, 0)).toBe(2);
  });
});

describe('partCreatedAt', () => {
  it('reads the time from a part file name', () => {
    expect(partCreatedAt('1791600000000-12-ab3x.part')).toBe(1791600000000);
  });

  it('answers null for anything else, so unknown files are treated as old', () => {
    expect(partCreatedAt('notes.txt')).toBeNull();
    expect(partCreatedAt('-3-x.part')).toBeNull();
  });
});
