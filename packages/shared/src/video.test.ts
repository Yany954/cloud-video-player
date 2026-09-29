import { describe, expect, it } from 'vitest';
import { isModerationStatus } from './video';

describe('isModerationStatus', () => {
  it.each(['pending', 'approved', 'flagged', 'rejected'])('accepts %s', (status) => {
    expect(isModerationStatus(status)).toBe(true);
  });

  it.each(['public', '', 42, null, undefined])('rejects %s', (value) => {
    expect(isModerationStatus(value)).toBe(false);
  });
});
