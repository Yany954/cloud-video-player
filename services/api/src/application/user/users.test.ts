import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_QUOTA_BYTES } from '../../domain/quota';
import { ForbiddenError, NotFoundError } from '../errors';
import { InMemoryDatabase, InMemoryUserAccounts } from '../testing/fakes';
import { InviteUser, ListUsers, UpdateUser } from './users';

const GIB = 1024 ** 3;

const admin = { userId: 'admin-1', isAdmin: true };
const ben = { userId: 'ben', isAdmin: false };

let users: InMemoryUserAccounts;
let db: InMemoryDatabase;
let update: UpdateUser;

beforeEach(() => {
  users = new InMemoryUserAccounts();
  users.add('admin-1', 'admin@example.com', 'admin');
  users.add('ben', 'ben@example.com');
  db = new InMemoryDatabase();
  update = new UpdateUser(users, db);
});

describe('ListUsers', () => {
  it('shows admins every account with its storage', async () => {
    db.usage.set('ben', { bytesUsed: 2 * GIB, quotaBytes: 50 * GIB });

    const list = await new ListUsers(users, db).execute({ viewer: admin });

    expect(list.map((user) => [user.email, user.usage])).toEqual([
      ['admin@example.com', { bytesUsed: 0, quotaBytes: DEFAULT_QUOTA_BYTES }],
      ['ben@example.com', { bytesUsed: 2 * GIB, quotaBytes: 50 * GIB }],
    ]);
  });

  it('refuses anyone who is not an admin', async () => {
    await expect(new ListUsers(users, db).execute({ viewer: ben })).rejects.toThrow(ForbiddenError);
  });
});

describe('InviteUser', () => {
  const invite = () => new InviteUser(users, db);

  it('creates an invited account, with the address normalised and the default quota', async () => {
    const user = await invite().execute({ viewer: admin, email: '  Carla@Example.com ' });

    expect(user).toMatchObject({
      email: 'carla@example.com',
      status: 'invited',
      role: 'user',
      usage: { bytesUsed: 0, quotaBytes: DEFAULT_QUOTA_BYTES },
    });
  });

  it('refuses an email that already has an account, and a non-admin', async () => {
    await expect(
      invite().execute({ viewer: admin, email: 'BEN@example.com' }),
    ).rejects.toMatchObject({ code: 'USER_EXISTS' });
    await expect(invite().execute({ viewer: ben, email: 'x@example.com' })).rejects.toThrow(
      ForbiddenError,
    );
    expect(users.users.size).toBe(2);
  });
});

describe('UpdateUser', () => {
  it('raises a quota, even for someone who never uploaded', async () => {
    const user = await update.execute({ viewer: admin, userId: 'ben', change: { quotaGb: 50 } });

    expect(user.usage).toEqual({ bytesUsed: 0, quotaBytes: 50 * GIB });
  });

  it('keeps what the person already stores when the quota changes', async () => {
    db.usage.set('ben', { bytesUsed: 3 * GIB, quotaBytes: 5 * GIB });

    await update.execute({ viewer: admin, userId: 'ben', change: { quotaGb: 1 } });

    expect(await db.getUsage('ben')).toEqual({ bytesUsed: 3 * GIB, quotaBytes: 1 * GIB });
  });

  it('makes someone an admin, suspends and reactivates them', async () => {
    await update.execute({ viewer: admin, userId: 'ben', change: { role: 'admin' } });
    expect(users.users.get('ben')?.role).toBe('admin');

    const suspended = await update.execute({
      viewer: admin,
      userId: 'ben',
      change: { suspended: true },
    });
    expect(suspended.status).toBe('suspended');

    await update.execute({ viewer: admin, userId: 'ben', change: { suspended: false } });
    expect(users.users.get('ben')?.status).toBe('active');
  });

  it('never lets admins lock themselves out', async () => {
    for (const change of [{ suspended: true }, { role: 'user' as const }]) {
      await expect(
        update.execute({ viewer: admin, userId: 'admin-1', change }),
      ).rejects.toMatchObject({ code: 'INVALID_STATE' });
    }
    expect(users.users.get('admin-1')).toMatchObject({ role: 'admin', status: 'active' });
  });

  it('changes nothing when the quota is invalid', async () => {
    await expect(
      update.execute({ viewer: admin, userId: 'ben', change: { quotaGb: 0, role: 'admin' } }),
    ).rejects.toMatchObject({ code: 'INVALID_QUOTA' });
    expect(users.users.get('ben')?.role).toBe('user');
  });

  it('refuses a non-admin, and an account that does not exist', async () => {
    await expect(
      update.execute({ viewer: ben, userId: 'ben', change: { quotaGb: 500 } }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      update.execute({ viewer: admin, userId: 'nobody', change: { quotaGb: 50 } }),
    ).rejects.toThrow(NotFoundError);
  });
});
