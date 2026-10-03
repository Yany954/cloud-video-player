import { beforeEach, describe, expect, it } from 'vitest';
import { completeUpload, markReady, startProcessing, startUpload } from '../../domain/video';
import { ForbiddenError, NotFoundError } from '../errors';
import { InMemoryDatabase } from '../testing/fakes';
import { ListLibrary } from '../video/list-library';
import { ListReviewQueue } from './list-review-queue';
import { ReviewVideo } from './review-video';

const uploaded = (id: string, createdAt: string) =>
  completeUpload(
    {
      ...startUpload({
        id,
        ownerId: 'ana',
        fileName: `${id}.mp4`,
        sizeBytes: 1_000,
        now: new Date(createdAt),
      }),
      uploadSessionId: 'session-1',
    },
    1_000,
  );
const ready = (id: string, createdAt = '2026-10-03T10:00:00.000Z') =>
  markReady(startProcessing(uploaded(id, createdAt)), {
    durationSeconds: 60,
    width: 1920,
    height: 1080,
  });

const admin = { userId: 'admin-1', isAdmin: true };
const ben = { userId: 'ben', isAdmin: false };

let db: InMemoryDatabase;
let reviewVideo: ReviewVideo;
let listReviewQueue: ListReviewQueue;
let listLibrary: ListLibrary;

beforeEach(() => {
  db = new InMemoryDatabase();
  reviewVideo = new ReviewVideo(db, () => new Date('2026-10-03T12:00:00.000Z'));
  listReviewQueue = new ListReviewQueue(db);
  listLibrary = new ListLibrary(db);
});

const ids = (videos: { id: string }[]) => videos.map((video) => video.id);

describe('ReviewVideo', () => {
  it('stores an approval with who decided and when', async () => {
    await db.create(ready('video-1'));

    await reviewVideo.execute({ reviewer: admin, videoId: 'video-1', decision: 'approve' });

    expect(await db.findById('video-1')).toMatchObject({
      moderationStatus: 'approved',
      review: { reviewedBy: 'admin-1', reviewedAt: '2026-10-03T12:00:00.000Z' },
    });
  });

  it('refuses anyone who is not an admin, and changes nothing', async () => {
    await db.create(ready('video-1'));

    await expect(
      reviewVideo.execute({ reviewer: ben, videoId: 'video-1', decision: 'approve' }),
    ).rejects.toThrow(ForbiddenError);
    expect((await db.findById('video-1'))?.moderationStatus).toBe('pending');
  });

  it("does not let owners approve their own video unless they're admins", async () => {
    await db.create(ready('video-1'));

    await expect(
      reviewVideo.execute({
        reviewer: { userId: 'ana', isAdmin: false },
        videoId: 'video-1',
        decision: 'approve',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('answers "not found" for a video that does not exist', async () => {
    await expect(
      reviewVideo.execute({ reviewer: admin, videoId: 'nope', decision: 'approve' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('refuses a video that is not playable yet', async () => {
    await db.create(uploaded('video-1', '2026-10-03T10:00:00.000Z'));

    await expect(
      reviewVideo.execute({ reviewer: admin, videoId: 'video-1', decision: 'approve' }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
});

describe('ListReviewQueue', () => {
  it('shows admins the playable, undecided videos, oldest first', async () => {
    await db.create(ready('newer', '2026-10-03T10:00:00.000Z'));
    await db.create(ready('older', '2026-10-01T10:00:00.000Z'));
    await db.create(ready('decided', '2026-10-02T10:00:00.000Z'));
    await db.create(uploaded('not-playable', '2026-09-30T10:00:00.000Z'));
    await reviewVideo.execute({ reviewer: admin, videoId: 'decided', decision: 'reject' });

    expect(ids(await listReviewQueue.execute({ viewer: admin }))).toEqual(['older', 'newer']);
  });

  it('refuses anyone who is not an admin', async () => {
    await expect(listReviewQueue.execute({ viewer: ben })).rejects.toThrow(ForbiddenError);
  });
});

describe('ListLibrary', () => {
  it('holds only approved videos, newest first', async () => {
    await db.create(ready('older', '2026-10-01T10:00:00.000Z'));
    await db.create(ready('newer', '2026-10-03T10:00:00.000Z'));
    await db.create(ready('pending', '2026-10-02T10:00:00.000Z'));
    await db.create(ready('rejected', '2026-10-02T11:00:00.000Z'));
    for (const videoId of ['older', 'newer']) {
      await reviewVideo.execute({ reviewer: admin, videoId, decision: 'approve' });
    }
    await reviewVideo.execute({ reviewer: admin, videoId: 'rejected', decision: 'reject' });

    expect(ids(await listLibrary.execute())).toEqual(['newer', 'older']);
  });

  it('drops a video that an admin takes down after approving it', async () => {
    await db.create(ready('video-1'));
    await reviewVideo.execute({ reviewer: admin, videoId: 'video-1', decision: 'approve' });
    await reviewVideo.execute({ reviewer: admin, videoId: 'video-1', decision: 'reject' });

    expect(await listLibrary.execute()).toEqual([]);
  });
});
