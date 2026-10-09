import { describe, expect, it } from 'vitest';
import { assertDeletable, awaitsReview, canDelete, canView, reviewVideo } from './moderation';
import { assignToCategory, createCategory } from './category';
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

  it('hides a video outside every event from everyone else, even when approved', () => {
    for (const video of [approved(), ready(), rejected()]) {
      expect(canView(video, stranger)).toBe(false);
    }
  });
});

describe('canDelete', () => {
  it('lets owners delete their own video in any state', () => {
    for (const video of [uploading(), ready(), approved(), rejected()]) {
      expect(canDelete(video, owner)).toBe(true);
    }
  });

  it("lets an admin delete anyone's video", () => {
    expect(canDelete(approved(), admin)).toBe(true);
    expect(canDelete(uploading(), admin)).toBe(true);
  });

  it('never lets another user delete it, even when they can watch it', () => {
    expect(canDelete(approved(), stranger)).toBe(false);
  });
});

describe('assertDeletable', () => {
  it('refuses a video that is being processed', () => {
    expect(() => assertDeletable(processing())).toThrow(
      expect.objectContaining({ code: 'INVALID_STATE' }),
    );
  });

  it('accepts every other state', () => {
    for (const video of [uploading(), ready(), markFailed(processing(), 'TOO_LARGE')]) {
      expect(() => assertDeletable(video)).not.toThrow();
    }
  });
});

describe('videos in an event', () => {
  const event = {
    ...createCategory({ id: 'cat-1', ownerId: 'owner', name: 'Concert', now }),
    collaboratorIds: ['collaborator'],
  };
  const privateApproved = () => assignToCategory(approved(), event);
  const collaborator = { userId: 'collaborator', isAdmin: false };

  it('are visible to members of the category once approved', () => {
    expect(canView(privateApproved(), collaborator, event)).toBe(true);
    expect(canView(assignToCategory(ready(), event), collaborator, event)).toBe(false);
    expect(canView(assignToCategory(rejected(), event), collaborator, event)).toBe(false);
    expect(
      canView({ ...privateApproved(), moderationStatus: 'flagged' }, collaborator, event),
    ).toBe(false);
  });

  it('are hidden from everyone else, and when the category is not the video’s own', () => {
    expect(canView(privateApproved(), stranger, event)).toBe(false);
    expect(canView(privateApproved(), collaborator)).toBe(false);
    expect(canView(privateApproved(), collaborator, { ...event, id: 'other' })).toBe(false);
  });

  it('are still visible to their owner and to admins', () => {
    expect(canView(privateApproved(), owner)).toBe(true);
    expect(canView(privateApproved(), admin)).toBe(true);
  });

  it('go back to their owner alone when taken out of the event', () => {
    const loose = assignToCategory(privateApproved(), null);

    expect(canView(loose, collaborator, event)).toBe(false);
    expect(canView(loose, owner)).toBe(true);
  });
});
