import { describe, expect, it } from 'vitest';
import { awaitsReview, canView, isInLibrary, reviewVideo } from './moderation';
import { completeUpload, markFailed, markReady, startProcessing, startUpload } from './video';
import type { Video } from './video';

const now = new Date('2026-10-03T12:00:00.000Z');
const media = { durationSeconds: 60, width: 1920, height: 1080 };

const uploading = (): Video => ({
  ...startUpload({
    id: 'video-1',
    ownerId: 'owner',
    fileName: 'concert.mp4',
    sizeBytes: 1_000,
    now: new Date('2026-10-03T10:00:00.000Z'),
  }),
  uploadSessionId: 'session-1',
});
const processing = () => startProcessing(completeUpload(uploading(), 1_000));
const ready = () => markReady(processing(), media);
const approved = () => reviewVideo(ready(), 'approve', 'admin-1', now);
const rejected = () => reviewVideo(ready(), 'reject', 'admin-1', now);

const owner = { userId: 'owner', isAdmin: false };
const stranger = { userId: 'someone-else', isAdmin: false };
const admin = { userId: 'admin-1', isAdmin: true };

describe('reviewVideo', () => {
  it('approves a playable video and records who decided and when', () => {
    expect(approved()).toMatchObject({
      moderationStatus: 'approved',
      review: { reviewedBy: 'admin-1', reviewedAt: '2026-10-03T12:00:00.000Z' },
    });
  });

  it('rejects a playable video', () => {
    expect(rejected().moderationStatus).toBe('rejected');
  });

  it('lets an admin change a decision later', () => {
    const later = new Date('2026-10-04T09:00:00.000Z');

    expect(reviewVideo(approved(), 'reject', 'admin-2', later)).toMatchObject({
      moderationStatus: 'rejected',
      review: { reviewedBy: 'admin-2', reviewedAt: '2026-10-04T09:00:00.000Z' },
    });
    expect(reviewVideo(rejected(), 'approve', 'admin-2', later).moderationStatus).toBe('approved');
  });

  it.each([
    ['still uploading', uploading],
    ['being processed', processing],
    ['failed', () => markFailed(processing(), 'PROCESSING_ERROR')],
  ])('refuses a video that is %s', (_, make) => {
    expect(() => reviewVideo(make(), 'approve', 'admin-1', now)).toThrow(
      expect.objectContaining({ code: 'INVALID_STATE' }),
    );
  });
});

describe('awaitsReview', () => {
  it('is true for a playable video nobody decided on, or that was flagged', () => {
    expect(awaitsReview(ready())).toBe(true);
    expect(awaitsReview({ ...approved(), moderationStatus: 'flagged' })).toBe(true);
  });

  it('is false once decided, or while the video cannot be played', () => {
    expect(awaitsReview(approved())).toBe(false);
    expect(awaitsReview(rejected())).toBe(false);
    expect(awaitsReview(processing())).toBe(false);
  });
});

describe('isInLibrary', () => {
  it('holds only approved, playable videos', () => {
    expect(isInLibrary(approved())).toBe(true);
    expect(isInLibrary(ready())).toBe(false);
    expect(isInLibrary(rejected())).toBe(false);
    expect(isInLibrary({ ...processing(), moderationStatus: 'approved' })).toBe(false);
  });
});

describe('canView', () => {
  it('always lets the owner see their own video', () => {
    for (const video of [uploading(), processing(), ready(), approved(), rejected()]) {
      expect(canView(video, owner)).toBe(true);
    }
  });

  it('lets an admin see any playable video, to review it', () => {
    expect(canView(ready(), admin)).toBe(true);
    expect(canView(rejected(), admin)).toBe(true);
    expect(canView(processing(), admin)).toBe(false);
  });

  it('lets everyone else see only approved videos', () => {
    expect(canView(approved(), stranger)).toBe(true);
    expect(canView(ready(), stranger)).toBe(false);
    expect(canView(rejected(), stranger)).toBe(false);
    expect(canView({ ...approved(), moderationStatus: 'flagged' }, stranger)).toBe(false);
  });
});
