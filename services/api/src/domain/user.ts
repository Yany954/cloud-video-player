import { DomainError } from './errors';

export type UserRole = 'admin' | 'user';

/**
 * `invited`: created by an admin, has not chosen a password yet. `unconfirmed`: signed up but
 * has not entered the emailed code. `suspended`: cannot sign in.
 */
export type UserStatus = 'active' | 'invited' | 'unconfirmed' | 'suspended';

export interface UserAccount {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly createdAt: string;
}

const GIB = 1024 ** 3;
export const MAX_QUOTA_GB = 1000;

/** What an admin asks to change on an account. Absent fields stay as they are. */
export interface UserChange {
  quotaGb?: number;
  role?: UserRole;
  suspended?: boolean;
}

/** Whole gigabytes, at least 1: a quota below what the user already stores only blocks new uploads. */
export function quotaBytesFromGb(quotaGb: number): number {
  if (!Number.isInteger(quotaGb) || quotaGb < 1 || quotaGb > MAX_QUOTA_GB) {
    throw new DomainError('INVALID_QUOTA', `Quota must be 1 to ${MAX_QUOTA_GB} GB`);
  }
  return quotaGb * GIB;
}

/** Admins cannot suspend themselves or give up their own admin role: nobody locks themselves out. */
export function assertAllowedChange(actorId: string, targetId: string, change: UserChange): void {
  if (actorId !== targetId) return;
  if (change.suspended === true) {
    throw new DomainError('INVALID_STATE', 'You cannot suspend your own account');
  }
  if (change.role === 'user') {
    throw new DomainError('INVALID_STATE', 'You cannot remove your own admin role');
  }
}

/** Same address, however it was typed. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
