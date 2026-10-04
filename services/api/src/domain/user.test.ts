import { describe, expect, it } from 'vitest';
import { assertAllowedChange, normalizeEmail, quotaBytesFromGb } from './user';

describe('quotaBytesFromGb', () => {
  it('converts whole gigabytes', () => {
    expect(quotaBytesFromGb(50)).toBe(50 * 1024 ** 3);
  });

  it.each([0, -5, 1.5, 1001, Number.NaN])('rejects %s GB', (quotaGb) => {
    expect(() => quotaBytesFromGb(quotaGb)).toThrow(
      expect.objectContaining({ code: 'INVALID_QUOTA' }),
    );
  });
});

describe('assertAllowedChange', () => {
  it('lets an admin change anything on someone else', () => {
    expect(() =>
      assertAllowedChange('admin-1', 'ben', { suspended: true, role: 'user', quotaGb: 1 }),
    ).not.toThrow();
  });

  it('stops admins from suspending themselves or dropping their own admin role', () => {
    for (const change of [{ suspended: true }, { role: 'user' as const }]) {
      expect(() => assertAllowedChange('admin-1', 'admin-1', change)).toThrow(
        expect.objectContaining({ code: 'INVALID_STATE' }),
      );
    }
  });

  it('still lets admins change their own quota, or keep themselves admin and active', () => {
    expect(() =>
      assertAllowedChange('admin-1', 'admin-1', { quotaGb: 100, role: 'admin', suspended: false }),
    ).not.toThrow();
  });
});

describe('normalizeEmail', () => {
  it('ignores case and surrounding spaces', () => {
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com');
  });
});
