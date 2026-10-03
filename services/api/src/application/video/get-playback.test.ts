import { beforeEach, describe, expect, it } from 'vitest';
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

    expect(await getPlayback.execute({ userId: 'ana', videoId: 'video-1' })).toEqual({
      video: 'https://cdn.test/video-1/video.mp4?until=2026-10-03T18:00:00.000Z',
      poster: 'https://cdn.test/video-1/poster.jpg',
      durationSeconds: 90,
      width: 1920,
      height: 1080,
      title: 'concert',
      expiresAt: '2026-10-03T18:00:00.000Z',
    });
  });

  it('never signs links for someone who is not the owner', async () => {
    await db.create(ready());

    await expect(getPlayback.execute({ userId: 'ben', videoId: 'video-1' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it.each([
    ['still waiting to be processed', uploaded],
    ['being processed', () => startProcessing(uploaded())],
  ])('refuses a video that is %s', async (_, make) => {
    await db.create(make());

    await expect(getPlayback.execute({ userId: 'ana', videoId: 'video-1' })).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
  });
});
