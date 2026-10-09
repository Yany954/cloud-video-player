import { beforeEach, describe, expect, it } from 'vitest';
import { assignToCategory, createCategory, type Category } from '../../domain/category';
import { reviewVideo } from '../../domain/moderation';
import { completeUpload, markReady, startProcessing, startUpload } from '../../domain/video';
import { InMemoryDatabase } from '../testing/fakes';
import { ListSharedWithMe } from './list-shared-with-me';

const now = new Date('2026-10-09T12:00:00.000Z');
const ready = (id: string, ownerId: string, createdAt = '2026-10-03T10:00:00.000Z') =>
  markReady(
    startProcessing(
      completeUpload(
        {
          ...startUpload({
            id,
            ownerId,
            fileName: `${id}.mp4`,
            sizeBytes: 1_000,
            now: new Date(createdAt),
          }),
          uploadSessionId: 'session-1',
        },
        1_000,
      ),
    ),
    { durationSeconds: 60, width: 1920, height: 1080 },
  );
const approved = (id: string, ownerId: string, createdAt?: string) =>
  reviewVideo(ready(id, ownerId, createdAt), 'approve', 'admin-1', now);

const viewer = (userId: string, isAdmin = false) => ({ userId, isAdmin });

let db: InMemoryDatabase;
let concert: Category;
let sharedWith: (userId: string, isAdmin?: boolean) => Promise<string[]>;

beforeEach(async () => {
  db = new InMemoryDatabase();
  concert = {
    ...createCategory({ id: 'concert', ownerId: 'ana', name: 'Concert', now }),
    collaboratorIds: ['ben'],
  };
  await db.categories.create(concert);
  const list = new ListSharedWithMe(db, db.categories);
  sharedWith = async (userId, isAdmin = false) =>
    (await list.execute({ viewer: viewer(userId, isAdmin) })).map((video) => video.id);
});

describe('ListSharedWithMe', () => {
  it('shows nothing to a new account, however many approved videos exist', async () => {
    await db.create(approved('loose', 'ana'));
    await db.create(assignToCategory(approved('in-concert', 'ana'), concert));

    expect(await sharedWith('mother')).toEqual([]);
  });

  it('shows an invited person the approved videos of the event, newest first', async () => {
    await db.create(
      assignToCategory(approved('older', 'ana', '2026-10-01T10:00:00.000Z'), concert),
    );
    await db.create(
      assignToCategory(approved('newer', 'ana', '2026-10-03T10:00:00.000Z'), concert),
    );
    await db.create(assignToCategory(ready('pending', 'ana'), concert));
    await db.create(approved('loose', 'ana'));

    expect(await sharedWith('ben')).toEqual(['newer', 'older']);
  });

  it('shows the event’s owner what guests added, and never your own videos', async () => {
    await db.create(assignToCategory(approved('anas', 'ana'), concert));
    await db.create(assignToCategory(approved('bens', 'ben'), concert));

    expect(await sharedWith('ana')).toEqual(['bens']);
    expect(await sharedWith('ben')).toEqual(['anas']);
  });

  it('drops a video once it is taken out of the event, or taken down', async () => {
    await db.create(assignToCategory(approved('removed', 'ana'), concert));
    await db.create(assignToCategory(approved('taken-down', 'ana'), concert));

    await db.saveCategoryOf(assignToCategory((await db.findById('removed'))!, null));
    await db.save(reviewVideo((await db.findById('taken-down'))!, 'reject', 'admin-1', now));

    expect(await sharedWith('ben')).toEqual([]);
  });

  it('gives an admin no more than any other member', async () => {
    await db.create(assignToCategory(ready('pending', 'ana'), concert));

    expect(await sharedWith('ben', true)).toEqual([]);
    expect(await sharedWith('admin-1', true)).toEqual([]);
  });
});
