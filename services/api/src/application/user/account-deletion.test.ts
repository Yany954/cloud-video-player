import { beforeEach, describe, expect, it } from 'vitest';
import { assignToCategory, createCategory } from '../../domain/category';
import { reviewVideo } from '../../domain/moderation';
import { completeUpload, markReady, startProcessing, startUpload } from '../../domain/video';
import { ForbiddenError, NotFoundError } from '../errors';
import { InMemoryDatabase, InMemoryObjectStorage, InMemoryUserAccounts } from '../testing/fakes';
import { ListLibrary } from '../video/list-library';
import { DeleteAccountData, RequestAccountDeletion } from './account-deletion';

const now = new Date('2026-10-04T12:00:00.000Z');
const uploaded = (id: string, ownerId: string) =>
  completeUpload(
    {
      ...startUpload({ id, ownerId, fileName: `${id}.mp4`, sizeBytes: 1_000, now }),
      uploadSessionId: 'session-1',
    },
    1_000,
  );
const approved = (id: string, ownerId: string) =>
  reviewVideo(
    markReady(startProcessing(uploaded(id, ownerId)), {
      durationSeconds: 60,
      width: 1920,
      height: 1080,
    }),
    'approve',
    'admin-1',
    now,
  );

let users: InMemoryUserAccounts;
let db: InMemoryDatabase;
let storage: InMemoryObjectStorage;
let queued: string[];
let request: RequestAccountDeletion;
let job: DeleteAccountData;

beforeEach(() => {
  users = new InMemoryUserAccounts();
  users.add('admin-1', 'admin@example.com', 'admin');
  users.add('ana', 'ana@example.com');
  users.add('ben', 'ben@example.com');
  db = new InMemoryDatabase();
  storage = new InMemoryObjectStorage();
  queued = [];
  request = new RequestAccountDeletion(users, { enqueue: async (id) => void queued.push(id) });
  job = new DeleteAccountData(db, db.categories, storage, db, users);
});

const admin = { userId: 'admin-1', isAdmin: true };
const ana = { userId: 'ana', isAdmin: false };

describe('RequestAccountDeletion', () => {
  it('lets people delete their own account with their password: suspended at once, data queued', async () => {
    await request.execute({ viewer: ana, userId: 'ana', password: 'correct-password' });

    expect(users.users.get('ana')?.status).toBe('suspended');
    expect(queued).toEqual(['ana']);
  });

  it('refuses a wrong or missing password, and changes nothing', async () => {
    for (const password of ['wrong', undefined]) {
      await expect(request.execute({ viewer: ana, userId: 'ana', password })).rejects.toThrow(
        ForbiddenError,
      );
    }
    expect(users.users.get('ana')?.status).toBe('active');
    expect(queued).toEqual([]);
  });

  it('lets an admin delete someone else without their password', async () => {
    await request.execute({ viewer: admin, userId: 'ben' });

    expect(queued).toEqual(['ben']);
  });

  it("never lets a member delete someone else's account", async () => {
    await expect(request.execute({ viewer: ana, userId: 'ben' })).rejects.toThrow(ForbiddenError);
    expect(queued).toEqual([]);
  });

  it('keeps the last admin, but lets an admin go when another one exists', async () => {
    await expect(
      request.execute({ viewer: admin, userId: 'admin-1', password: 'correct-password' }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(queued).toEqual([]);

    users.add('admin-2', 'second@example.com', 'admin');
    await request.execute({ viewer: admin, userId: 'admin-1', password: 'correct-password' });
    expect(queued).toEqual(['admin-1']);
  });

  it('answers "not found" for an account that does not exist', async () => {
    await expect(request.execute({ viewer: admin, userId: 'nobody' })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('DeleteAccountData', () => {
  /** Ana owns an event with her video and one of Ben's; she is also a guest in Ben's event. */
  async function scenario() {
    const anasEvent = {
      ...createCategory({ id: 'anas', ownerId: 'ana', name: 'Concert', now }),
      collaboratorIds: ['ben'],
    };
    const bensEvent = {
      ...createCategory({ id: 'bens', ownerId: 'ben', name: 'Party', now }),
      collaboratorIds: ['ana'],
    };
    await db.categories.create(anasEvent);
    await db.categories.create(bensEvent);
    await db.create(assignToCategory(approved('ana-in-own', 'ana'), anasEvent));
    await db.create(assignToCategory(approved('ben-in-anas', 'ben'), anasEvent));
    await db.create(assignToCategory(approved('ana-in-bens', 'ana'), bensEvent));
    await db.create(approved('ana-loose', 'ana'));
    await db.create(approved('ben-loose', 'ben'));
    for (const id of ['ana-in-own', 'ana-in-bens', 'ana-loose']) {
      storage.originals.set(id, 1_000);
      storage.playables.add(id);
    }
    db.usage.set('ana', { bytesUsed: 3_000, quotaBytes: 5_000_000 });
  }

  it('removes every video, file and record of the person, and their sign-in account', async () => {
    await scenario();

    await job.execute({ userId: 'ana' });

    expect([...db.videos.keys()].sort()).toEqual(['ben-in-anas', 'ben-loose']);
    expect(storage.originals.size).toBe(0);
    expect(storage.playables.size).toBe(0);
    expect(db.usage.has('ana')).toBe(false);
    expect(users.users.has('ana')).toBe(false);
  });

  it('deletes the events they own and takes them out of other people’s events', async () => {
    await scenario();

    await job.execute({ userId: 'ana' });

    expect(await db.categories.findById('anas')).toBeNull();
    expect((await db.categories.findById('bens'))?.collaboratorIds).toEqual([]);
  });

  it('keeps a guest’s video from a deleted event, private to its uploader, out of the library', async () => {
    await scenario();

    await job.execute({ userId: 'ana' });

    expect(await db.findById('ben-in-anas')).toMatchObject({
      categoryId: null,
      private: true,
      moderationStatus: 'approved',
    });
    expect((await new ListLibrary(db).execute()).map((video) => video.id)).toEqual(['ben-loose']);
  });

  it('leaves everyone else untouched', async () => {
    await scenario();

    await job.execute({ userId: 'ana' });

    expect(users.users.has('ben')).toBe(true);
    expect((await db.categories.findById('bens'))?.ownerId).toBe('ben');
  });

  it('can run again after stopping half-way', async () => {
    await scenario();
    const failing = new DeleteAccountData(
      db,
      db.categories,
      storage,
      {
        ...db,
        getUsage: db.getUsage.bind(db),
        getUsages: db.getUsages.bind(db),
        setQuota: db.setQuota.bind(db),
        deleteAccount: async () => {
          throw new Error('table is down');
        },
      },
      users,
    );

    await expect(failing.execute({ userId: 'ana' })).rejects.toThrow('table is down');
    expect(users.users.has('ana')).toBe(true);

    await job.execute({ userId: 'ana' });
    expect(users.users.has('ana')).toBe(false);
    expect(db.usage.has('ana')).toBe(false);
  });

  it('stops, to be retried, while one of their videos is still being processed', async () => {
    await db.create(startProcessing(uploaded('busy', 'ana')));

    await expect(job.execute({ userId: 'ana' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(users.users.has('ana')).toBe(true);
  });
});
