import type { Viewer } from '../../domain/moderation';
import type { StorageUsage } from '../../domain/quota';
import {
  assertAllowedChange,
  normalizeEmail,
  quotaBytesFromGb,
  type UserAccount,
  type UserChange,
} from '../../domain/user';
import { ForbiddenError, NotFoundError } from '../errors';
import type { StorageAccountAdmin, UserAccounts } from '../ports';

// Enough for the MVP. Add paging when the group gets close to this.
export const MAX_LISTED_USERS = 200;

export interface UserWithUsage extends UserAccount {
  usage: StorageUsage;
}

function assertAdmin(viewer: Viewer): void {
  if (!viewer.isAdmin) throw new ForbiddenError();
}

export class ListUsers {
  constructor(
    private readonly users: UserAccounts,
    private readonly accounts: StorageAccountAdmin,
  ) {}

  /** Admins only. Every account with how much it stores. */
  async execute(input: { viewer: Viewer }): Promise<UserWithUsage[]> {
    assertAdmin(input.viewer);
    const users = await this.users.list(MAX_LISTED_USERS);
    const usages = await this.accounts.getUsages(users.map((user) => user.id));
    return users.map((user) => ({ ...user, usage: usages.get(user.id)! }));
  }
}

export class InviteUser {
  constructor(
    private readonly users: UserAccounts,
    private readonly accounts: StorageAccountAdmin,
  ) {}

  /** Admins only. The person gets an email with a temporary password. */
  async execute(input: { viewer: Viewer; email: string }): Promise<UserWithUsage> {
    assertAdmin(input.viewer);
    const user = await this.users.invite(normalizeEmail(input.email));
    return { ...user, usage: await this.accounts.getUsage(user.id) };
  }
}

export class UpdateUser {
  constructor(
    private readonly users: UserAccounts,
    private readonly accounts: StorageAccountAdmin,
  ) {}

  /** Admins only. Changes the quota, the role, or whether the account can sign in. */
  async execute(input: {
    viewer: Viewer;
    userId: string;
    change: UserChange;
  }): Promise<UserWithUsage> {
    assertAdmin(input.viewer);
    const { change, userId } = input;
    assertAllowedChange(input.viewer.userId, userId, change);
    // Validated before anything is written, so a bad quota changes nothing.
    const quotaBytes = change.quotaGb === undefined ? undefined : quotaBytesFromGb(change.quotaGb);
    if (!(await this.users.findById(userId))) throw new NotFoundError('User not found');

    if (quotaBytes !== undefined) await this.accounts.setQuota(userId, quotaBytes);
    if (change.role !== undefined) await this.users.setRole(userId, change.role);
    if (change.suspended !== undefined) await this.users.setSuspended(userId, change.suspended);

    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return { ...user, usage: await this.accounts.getUsage(userId) };
  }
}
