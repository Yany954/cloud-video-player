import { beforeEach, describe, expect, it } from 'vitest';
import { assignToCategory, createCategory } from '../../domain/category';
import { reviewVideo } from '../../domain/moderation';
import { completeUpload, markReady, startProcessing, startUpload } from '../../domain/video';
import { NotFoundError } from '../errors';
import { InMemoryBlocks, InMemoryDatabase, InMemoryObjectStorage } from '../testing/fakes';
import { GetDownload } from './get-download';

const now = new Date('2026-10-09T12:00:00.000Z');
const uploaded = (title?: string) =>
  completeUpload(
    {
      ...startUpload({
        id: 'video-1',
        ownerId: 'ana',
        fileName: 'IMG_9837.mov',
        sizeBytes: 1_000,
        title,
        now,
      }),
      uploadSessionId: 'session-1',
    },
    1_000,
  );
const ready = (title?: string) =>
  markReady(startProcessing(uploaded(title)), { durationSeconds: 90, width: 1920, height: 1080 });
const approved = () => reviewVideo(ready(), 'approve', 'admin-1', now);
const viewer = (userId: string, isAdmin = false) => ({ userId, isAdmin });

let db: InMemoryDatabase;
let blocks: InMemoryBlocks;
let getDownload: GetDownload;

beforeEach(() => {
  db = new InMemoryDatabase();
  blocks = new InMemoryBlocks();
  getDownload = new GetDownload(db, new InMemoryObjectStorage(), () => now, db.categories, blocks);
});

describe('GetDownload', () => {
  it('gives the owner a link that lasts 15 minutes, named after the title', async () => {
    await db.create(ready('Rosalía: "Malamente" 1/2'));

    expect(await getDownload.execute({ viewer: viewer('ana'), videoId: 'video-1' })).toEqual({
      url: `https://storage.test/media/video-1/video.mp4?name=${encodeURIComponent('Rosalía Malamente 1 2.mp4')}&ttl=900`,
      fileName: 'Rosalía Malamente 1 2.mp4',
      expiresAt: '2026-10-09T12:15:00.000Z',
    });
  });

  it('follows the playback rule: invited people yes, everyone else "not found"', async () => {
    const event = {
      ...createCategory({ id: 'cat-1', ownerId: 'ana', name: 'Concert', now }),
      collaboratorIds: ['ben'],
    };
    await db.categories.create(event);
    await db.create(assignToCategory(approved(), event));

    await expect(
      getDownload.execute({ viewer: viewer('ben'), videoId: 'video-1' }),
    ).resolves.toMatchObject({ fileName: 'IMG_9837.mp4' });
    await expect(
      getDownload.execute({ viewer: viewer('carla'), videoId: 'video-1' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('refuses a video outside every event to others, and one hidden by a block', async () => {
    await db.create(approved());
    await expect(
      getDownload.execute({ viewer: viewer('ben'), videoId: 'video-1' }),
    ).rejects.toThrow(NotFoundError);
    await expect(getDownload.execute({ viewer: viewer('ben'), videoId: 'nope' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('refuses a video that is not playable yet', async () => {
    await db.create(uploaded());

    await expect(
      getDownload.execute({ viewer: viewer('ana'), videoId: 'video-1' }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
});
