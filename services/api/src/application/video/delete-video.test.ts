import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_QUOTA_BYTES } from '../../domain/quota';
import {
  completeUpload,
  markReady,
  startProcessing,
  startUpload,
  type Video,
} from '../../domain/video';
import { NotFoundError } from '../errors';
import { InMemoryDatabase, InMemoryObjectStorage } from '../testing/fakes';
import { DeleteVideo } from './delete-video';

const uploading = (): Video => ({
  ...startUpload({
    id: 'video-1',
    ownerId: 'ana',
    fileName: 'concert.mp4',
    sizeBytes: 1_000,
    now: new Date('2026-10-03T10:00:00.000Z'),
  }),
  uploadSessionId: 'session-1',
});
const uploaded = () => completeUpload(uploading(), 1_000);
const ready = () =>
  markReady(startProcessing(uploaded()), { durationSeconds: 60, width: 1920, height: 1080 });

const ana = { userId: 'ana', isAdmin: false };
const ben = { userId: 'ben', isAdmin: false };
const admin = { userId: 'admin-1', isAdmin: true };

let db: InMemoryDatabase;
let storage: InMemoryObjectStorage;
let deleteVideo: DeleteVideo;

/** A playable video whose 1,000 bytes are counted, with both of its files in storage. */
async function storeReady() {
  await db.create(ready());
  db.usage.set('ana', { bytesUsed: 1_500, quotaBytes: DEFAULT_QUOTA_BYTES });
  storage.originals.set('video-1', 1_000);
  storage.playables.add('video-1');
}

beforeEach(() => {
  db = new InMemoryDatabase();
  storage = new InMemoryObjectStorage();
  deleteVideo = new DeleteVideo(db, storage);
});

describe('DeleteVideo', () => {
  it('removes the record and both files, and gives the bytes back to the owner', async () => {
    await storeReady();

    await deleteVideo.execute({ viewer: ana, videoId: 'video-1' });

    expect(await db.findById('video-1')).toBeNull();
    expect(storage.originals.has('video-1')).toBe(false);
    expect(storage.playables.has('video-1')).toBe(false);
    expect((await db.getUsage('ana')).bytesUsed).toBe(500);
  });

  it("lets an admin delete someone else's video; the bytes go back to its owner", async () => {
    await storeReady();

    await deleteVideo.execute({ viewer: admin, videoId: 'video-1' });

    expect(await db.findById('video-1')).toBeNull();
    expect((await db.getUsage('ana')).bytesUsed).toBe(500);
  });

  it('answers "not found" to another user and deletes nothing', async () => {
    await storeReady();

    await expect(deleteVideo.execute({ viewer: ben, videoId: 'video-1' })).rejects.toThrow(
      NotFoundError,
    );
    expect(await db.findById('video-1')).not.toBeNull();
    expect(storage.originals.has('video-1')).toBe(true);
    expect((await db.getUsage('ana')).bytesUsed).toBe(1_500);
  });

  it('never gives the same bytes back twice', async () => {
    await storeReady();

    await deleteVideo.execute({ viewer: ana, videoId: 'video-1' });
    await expect(deleteVideo.execute({ viewer: ana, videoId: 'video-1' })).rejects.toThrow(
      NotFoundError,
    );

    expect((await db.getUsage('ana')).bytesUsed).toBe(500);
  });

  it('discards an unfinished upload without touching the usage', async () => {
    await db.create(uploading());
    await storage.startMultipartUpload();

    await deleteVideo.execute({ viewer: ana, videoId: 'video-1' });

    expect(await db.findById('video-1')).toBeNull();
    expect(storage.sessions.has('session-1')).toBe(false);
    expect((await db.getUsage('ana')).bytesUsed).toBe(0);
  });

  it('refuses a video that is being processed, and keeps it', async () => {
    await db.create(startProcessing(uploaded()));

    await expect(deleteVideo.execute({ viewer: ana, videoId: 'video-1' })).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
    expect(await db.findById('video-1')).not.toBeNull();
  });

  it('keeps the video gone even if deleting a file fails', async () => {
    await storeReady();
    storage.deleteOriginal = async () => {
      throw new Error('S3 is down');
    };

    await expect(deleteVideo.execute({ viewer: ana, videoId: 'video-1' })).rejects.toThrow(
      'S3 is down',
    );
    expect(await db.findById('video-1')).toBeNull();
    expect((await db.getUsage('ana')).bytesUsed).toBe(500);
  });
});
