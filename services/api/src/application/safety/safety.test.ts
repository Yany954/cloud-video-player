import { beforeEach, describe, expect, it } from 'vitest';
import { assignToCategory, createCategory } from '../../domain/category';
import { reviewVideo } from '../../domain/moderation';
import { completeUpload, markReady, startProcessing, startUpload } from '../../domain/video';
import { GetCategory, JoinCategory, OpenInvite } from '../category/categories';
import { ForbiddenError, NotFoundError } from '../errors';
import { ReviewVideo } from '../moderation/review-video';
import {
  InMemoryBlocks,
  InMemoryDatabase,
  InMemoryObjectStorage,
  InMemoryReports,
} from '../testing/fakes';
import { DeleteVideo } from '../video/delete-video';
import { GetPlayback } from '../video/get-playback';
import { ListLibrary } from '../video/list-library';
import {
  BlockUploader,
  ListBlocks,
  ListReviewQueueWithReports,
  ReportVideo,
  Unblock,
} from './safety';

const now = () => new Date('2026-10-04T12:00:00.000Z');
const ready = (id: string, ownerId: string) =>
  markReady(
    startProcessing(
      completeUpload(
        {
          ...startUpload({ id, ownerId, fileName: `${id}.mp4`, sizeBytes: 1_000, now: now() }),
          uploadSessionId: 'session-1',
        },
        1_000,
      ),
    ),
    { durationSeconds: 60, width: 1920, height: 1080 },
  );
const approved = (id: string, ownerId: string) =>
  reviewVideo(ready(id, ownerId), 'approve', 'admin-1', now());

const viewer = (userId: string, isAdmin = false) => ({ userId, isAdmin });
const signer = { sign: async () => ({ video: 'video-url', poster: 'poster-url' }) };

let db: InMemoryDatabase;
let reports: InMemoryReports;
let blocks: InMemoryBlocks;
let report: ReportVideo;
let block: BlockUploader;
let library: ListLibrary;
let playback: GetPlayback;

beforeEach(() => {
  db = new InMemoryDatabase();
  reports = new InMemoryReports();
  blocks = new InMemoryBlocks();
  report = new ReportVideo(db, db.categories, reports, now);
  block = new BlockUploader(db, db.categories, blocks, now);
  library = new ListLibrary(db, blocks);
  playback = new GetPlayback(db, signer, now, db.categories, blocks);
});

const ids = (videos: { id: string }[]) => videos.map((video) => video.id);

describe('ReportVideo', () => {
  it('hides an approved video from everyone at once and puts it in the review queue', async () => {
    await db.create(approved('v1', 'ana'));

    await report.execute({
      viewer: viewer('ben'),
      videoId: 'v1',
      reason: 'violence',
      note: 'a fight',
    });

    expect(await library.execute({ userId: 'carla' })).toEqual([]);
    await expect(playback.execute({ viewer: viewer('carla'), videoId: 'v1' })).rejects.toThrow(
      NotFoundError,
    );
    const queue = await new ListReviewQueueWithReports(db, reports).execute({
      viewer: viewer('admin-1', true),
    });
    expect(queue).toHaveLength(1);
    expect(queue[0]!.video.id).toBe('v1');
    expect(queue[0]!.reports).toMatchObject([
      { reporterId: 'ben', reason: 'violence', note: 'a fight' },
    ]);
  });

  it('still lets the uploader and admins see a reported video', async () => {
    await db.create(approved('v1', 'ana'));
    await report.execute({ viewer: viewer('ben'), videoId: 'v1', reason: 'other' });

    await expect(playback.execute({ viewer: viewer('ana'), videoId: 'v1' })).resolves.toBeTruthy();
    await expect(
      playback.execute({ viewer: viewer('admin-1', true), videoId: 'v1' }),
    ).resolves.toBeTruthy();
  });

  it('comes back when an admin approves it, and stays back if the same person reports again', async () => {
    await db.create(approved('v1', 'ana'));
    await report.execute({ viewer: viewer('ben'), videoId: 'v1', reason: 'other' });
    await new ReviewVideo(db, now).execute({
      reviewer: viewer('admin-1', true),
      videoId: 'v1',
      decision: 'approve',
    });

    await report.execute({ viewer: viewer('ben'), videoId: 'v1', reason: 'violence' });

    expect(ids(await library.execute({ userId: 'carla' }))).toEqual(['v1']);
    expect(reports.items).toHaveLength(1);
  });

  it('refuses a report on your own video', async () => {
    await db.create(approved('v1', 'ana'));

    await expect(
      report.execute({ viewer: viewer('ana'), videoId: 'v1', reason: 'other' }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('answers "not found" for a video the caller cannot see, and records nothing', async () => {
    await db.create(ready('pending', 'ana'));

    for (const videoId of ['pending', 'nope']) {
      await expect(
        report.execute({ viewer: viewer('ben'), videoId, reason: 'other' }),
      ).rejects.toThrow(NotFoundError);
    }
    expect(reports.items).toEqual([]);
  });

  it('removes the reports when the video is deleted', async () => {
    await db.create(approved('v1', 'ana'));
    await report.execute({ viewer: viewer('ben'), videoId: 'v1', reason: 'other' });

    await new DeleteVideo(db, new InMemoryObjectStorage(), reports).execute({
      viewer: viewer('ana'),
      videoId: 'v1',
    });

    expect(reports.items).toEqual([]);
  });

  it('shows the queue with reports to admins only', async () => {
    await expect(
      new ListReviewQueueWithReports(db, reports).execute({ viewer: viewer('ben') }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe('BlockUploader', () => {
  beforeEach(async () => {
    await db.create(approved('anas', 'ana'));
    await db.create(approved('carlas', 'carla'));
  });

  it('hides the blocked person’s videos from the blocker only', async () => {
    await block.execute({ viewer: viewer('ben'), videoId: 'anas' });

    expect(ids(await library.execute({ userId: 'ben' }))).toEqual(['carlas']);
    expect(ids(await library.execute({ userId: 'carla' })).sort()).toEqual(['anas', 'carlas']);
    await expect(playback.execute({ viewer: viewer('ben'), videoId: 'anas' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('is one-way: the blocked person still sees the blocker’s videos', async () => {
    await db.create(approved('bens', 'ben'));
    await block.execute({ viewer: viewer('ben'), videoId: 'anas' });

    expect(ids(await library.execute({ userId: 'ana' }))).toContain('bens');
  });

  it('removes the blocked person from the blocker’s events and keeps them out', async () => {
    const event = createCategory({ id: 'cat-1', ownerId: 'ben', name: 'Party', now: now() });
    await db.categories.create({ ...event, collaboratorIds: ['ana', 'carla'] });
    const token = await new OpenInvite(db.categories, () => 'token-1').execute({
      userId: 'ben',
      categoryId: 'cat-1',
    });

    await block.execute({ viewer: viewer('ben'), videoId: 'anas' });

    expect((await db.categories.findById('cat-1'))?.collaboratorIds).toEqual(['carla']);
    await expect(
      new JoinCategory(db.categories, blocks).execute({
        userId: 'ana',
        categoryId: 'cat-1',
        token,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('hides their videos inside an event both belong to', async () => {
    const event = {
      ...createCategory({ id: 'cat-1', ownerId: 'carla', name: 'Party', now: now() }),
      collaboratorIds: ['ana', 'ben'],
    };
    await db.categories.create(event);
    await db.create(assignToCategory(approved('ana-in-event', 'ana'), event));
    await db.create(assignToCategory(approved('carla-in-event', 'carla'), event));
    await block.execute({ viewer: viewer('ben'), videoId: 'anas' });

    const seen = await new GetCategory(db.categories, db, blocks).execute({
      viewer: viewer('ben'),
      categoryId: 'cat-1',
    });

    expect(ids(seen.videos)).toEqual(['carla-in-event']);
  });

  it('lists the blocks with the video they started from, and unblocking shows the videos again', async () => {
    await block.execute({ viewer: viewer('ben'), videoId: 'anas' });

    expect(await new ListBlocks(blocks).execute({ userId: 'ben' })).toMatchObject([
      { blockedId: 'ana', videoTitle: 'anas' },
    ]);

    await new Unblock(blocks).execute({ userId: 'ben', blockedId: 'ana' });
    expect(ids(await library.execute({ userId: 'ben' })).sort()).toEqual(['anas', 'carlas']);
  });

  it('refuses blocking yourself, and a video the caller cannot see', async () => {
    await db.create(ready('pending', 'ana'));

    await expect(block.execute({ viewer: viewer('ana'), videoId: 'anas' })).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
    await expect(block.execute({ viewer: viewer('ben'), videoId: 'pending' })).rejects.toThrow(
      NotFoundError,
    );
    expect(blocks.items).toEqual([]);
  });

  it('never hides a video from an admin who has to review it', async () => {
    await block.execute({ viewer: viewer('admin-1', true), videoId: 'anas' });

    await expect(
      playback.execute({ viewer: viewer('admin-1', true), videoId: 'anas' }),
    ).resolves.toBeTruthy();
  });
});
