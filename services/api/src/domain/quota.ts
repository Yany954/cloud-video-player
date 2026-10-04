import { DomainError } from './errors';

const GIB = 1024 ** 3;

/**
 * What a new account gets. Sign-up is open, so this caps what a stranger can cost the owner.
 * A user's own limit is stored in their profile once they upload; raise it there.
 */
export const DEFAULT_QUOTA_BYTES = 5 * GIB;

export interface StorageUsage {
  bytesUsed: number;
  quotaBytes: number;
}

export function fits(usage: StorageUsage, sizeBytes: number): boolean {
  return usage.bytesUsed + sizeBytes <= usage.quotaBytes;
}

export function assertFits(usage: StorageUsage, sizeBytes: number): void {
  if (!fits(usage, sizeBytes)) {
    const freeBytes = Math.max(0, usage.quotaBytes - usage.bytesUsed);
    throw new DomainError(
      'QUOTA_EXCEEDED',
      `File is ${sizeBytes} bytes but only ${freeBytes} bytes of storage are free`,
    );
  }
}
