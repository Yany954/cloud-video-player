import { describe, expect, it } from 'vitest';
import { assertFits, DEFAULT_QUOTA_BYTES, fits } from './quota';

const GIB = 1024 ** 3;

describe('quota', () => {
  it('gives a new account 5 GiB', () => {
    expect(DEFAULT_QUOTA_BYTES).toBe(5 * GIB);
  });

  it('accepts a file that fills the quota exactly', () => {
    expect(fits({ bytesUsed: 40 * GIB, quotaBytes: 50 * GIB }, 10 * GIB)).toBe(true);
  });

  it('rejects a file that exceeds the quota by one byte', () => {
    expect(fits({ bytesUsed: 40 * GIB, quotaBytes: 50 * GIB }, 10 * GIB + 1)).toBe(false);
  });

  it('throws QUOTA_EXCEEDED with the free space in the message', () => {
    expect(() => assertFits({ bytesUsed: 90, quotaBytes: 100 }, 11)).toThrow(
      expect.objectContaining({ code: 'QUOTA_EXCEEDED', message: expect.stringContaining('10') }),
    );
  });

  it('does not throw when the file fits', () => {
    expect(() => assertFits({ bytesUsed: 0, quotaBytes: 100 }, 100)).not.toThrow();
  });
});
