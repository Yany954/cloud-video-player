import { describe, expect, it } from 'vitest';
import { reviewVideo } from './moderation';
import { createBlock, createReport, flagVideo, isHiddenByBlock } from './safety';
import { completeUpload, markReady, startProcessing, startUpload } from './video';

const now = new Date('2026-10-04T12:00:00.000Z');
const ready = markReady(
  startProcessing(
    completeUpload(
      {
        ...startUpload({ id: 'v1', ownerId: 'ana', fileName: 'Concert.mp4', sizeBytes: 10, now }),
        uploadSessionId: 's',
      },
      10,
    ),
  ),
  { durationSeconds: 60, width: 1920, height: 1080 },
);
const approved = reviewVideo(ready, 'approve', 'admin-1', now);

describe('createReport', () => {
  it('records who reported what, why and when', () => {
    expect(
      createReport({
        video: approved,
        reporterId: 'ben',
        reason: 'violence',
        note: ' a fight ',
        now,
      }),
    ).toEqual({
      videoId: 'v1',
      reporterId: 'ben',
      reason: 'violence',
      note: 'a fight',
      createdAt: '2026-10-04T12:00:00.000Z',
    });
  });

  it('treats an empty note as no note', () => {
    expect(
      createReport({ video: approved, reporterId: 'ben', reason: 'other', note: '  ', now }).note,
    ).toBeNull();
    expect(
      createReport({ video: approved, reporterId: 'ben', reason: 'other', now }).note,
    ).toBeNull();
  });

  it('refuses a report on your own video, and a note that is too long', () => {
    expect(() =>
      createReport({ video: approved, reporterId: 'ana', reason: 'other', now }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }));
    expect(() =>
      createReport({
        video: approved,
        reporterId: 'ben',
        reason: 'other',
        note: 'x'.repeat(501),
        now,
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_NOTE' }));
  });
});

describe('flagVideo', () => {
  it('hides an approved video and sends it back for review', () => {
    expect(flagVideo(approved).moderationStatus).toBe('flagged');
  });

  it('leaves a video that is waiting, or was rejected, as it is', () => {
    expect(flagVideo(ready).moderationStatus).toBe('pending');
    expect(flagVideo(reviewVideo(ready, 'reject', 'admin-1', now)).moderationStatus).toBe(
      'rejected',
    );
  });
});

describe('blocking', () => {
  it('remembers the video the block started from, as a label', () => {
    expect(createBlock({ video: approved, blockerId: 'ben', now })).toEqual({
      blockerId: 'ben',
      blockedId: 'ana',
      videoTitle: 'Concert',
      createdAt: '2026-10-04T12:00:00.000Z',
    });
  });

  it('refuses blocking yourself', () => {
    expect(() => createBlock({ video: approved, blockerId: 'ana', now })).toThrow(
      expect.objectContaining({ code: 'INVALID_STATE' }),
    );
  });

  it('hides exactly the videos of blocked people', () => {
    expect(isHiddenByBlock(approved, new Set(['ana']))).toBe(true);
    expect(isHiddenByBlock(approved, new Set(['carla']))).toBe(false);
    expect(isHiddenByBlock(approved, new Set())).toBe(false);
  });
});
