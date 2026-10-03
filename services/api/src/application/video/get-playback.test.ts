import { beforeEach, describe, expect, it } from 'vitest';
import { reviewVideo } from '../../domain/moderation';
import {
  completeUpload,
  markReady,
  startProcessing,
  startUpload,
  type Video,
} from '../../domain/video';
import { NotFoundError } from '../errors';
import type { PlaybackUrlSigner } from '../ports';
import { InMemoryDatabase } from '../testing/fakes';
import { GetPlayback } from './get-playback';

const uploaded = (): Video =>
  completeUpload(
    {
      ...startUpload({
        id: 'video-1',
        ownerId: 'ana',
        fileName: 'concert.mov',
        sizeBytes: 1_000,
        now: new Date('2026-10-03T10:00:00.000Z'),
      }),
      uploadSessionId: 'session-1',
    },
    1_000,
  );
const ready = () =>
  markReady(startProcessing(uploaded()), { durationSeconds: 90, width: 1920, height: 1080 });

const approved = () => reviewVideo(ready(), 'approve', 'admin-1', new Date());
const rejected = () => reviewVideo(ready(), 'reject', 'admin-1', new Date());

const ana = { userId: 'ana', isAdmin: false };
const ben = { userId: 'ben', isAdmin: false };
const admin = { userId: 'admin-1', isAdmin: true };

const signer: PlaybackUrlSigner = {
  sign: async (videoId, expiresAt) => ({
    video: `https://cdn.test/${videoId}/video.mp4?until=${expiresAt.toISOString()}`,
    poster: `https://cdn.test/${videoId}/poster.jpg`,
  }),
};

let db: InMemoryDatabase;
let getPlayback: GetPlayback;

beforeEach(() => {
  db = new InMemoryDatabase();
  getPlayback = new GetPlayback(db, signer, () => new Date('2026-10-03T12:00:00.000Z'));
});

describe('GetPlayback', () => {
  it('gives the owner links that expire in 6 hours, with the media facts', async () => {
    await db.create(ready());

    expect(await getPlayback.execute({ viewer: ana, videoId: 'video-1' })).toEqual({
      video: 'https://cdn.test/video-1/video.mp4?until=2026-10-03T18:00:00.000Z',
      poster: 'https://cdn.test/video-1/poster.jpg',
      durationSeconds: 90,
      width: 1920,
      height: 1080,
      title: 'concert',
      moderationStatus: 'pending',
      canDelete: true,
      expiresAt: '2026-10-03T18:00:00.000Z',
    });
  });

  it.each([
    ['waiting for review', ready],
    ['rejected', rejected],
  ])('hides a video that is %s from other users, as if it did not exist', async (_, make) => {
    await db.create(make());

    await expect(getPlayback.execute({ viewer: ben, videoId: 'video-1' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('lets any signed-in user play an approved video', async () => {
    await db.create(approved());

    const playback = await getPlayback.execute({ viewer: ben, videoId: 'video-1' });

    expect(playback.video).toContain('video-1/video.mp4');
    expect(playback.canDelete).toBe(false);
  });

  it('lets an admin play a video that is waiting for review', async () => {
    await db.create(ready());

    const playback = await getPlayback.execute({ viewer: admin, videoId: 'video-1' });

    expect(playback.title).toBe('concert');
  });

  it('keeps letting the owner play their rejected video', async () => {
    await db.create(rejected());

    await expect(getPlayback.execute({ viewer: ana, videoId: 'video-1' })).resolves.toMatchObject({
      title: 'concert',
    });
  });

  it('answers "not found" for a video that does not exist', async () => {
    await expect(getPlayback.execute({ viewer: admin, videoId: 'nope' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it.each([
    ['still waiting to be processed', uploaded],
    ['being processed', () => startProcessing(uploaded())],
  ])('refuses a video that is %s', async (_, make) => {
    await db.create(make());

    await expect(getPlayback.execute({ viewer: ana, videoId: 'video-1' })).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
  });
});
