import { describe, expect, it } from 'vitest';
import { assignToCategory, createCategory } from '../domain/category';
import { reviewVideo } from '../domain/moderation';
import {
  completeUpload,
  markReady,
  startProcessing,
  startUpload,
  type Video,
} from '../domain/video';
import { fromVideoItem, toVideoItem, userKey, videoKey } from './video-item';

const uploading: Video = {
  ...startUpload({
    id: 'video-1',
    ownerId: 'user-1',
    fileName: 'concert.mp4',
    sizeBytes: 1_000,
    now: new Date('2026-10-03T10:00:00.000Z'),
  }),
  uploadSessionId: 'session-1',
};

describe('video item mapping', () => {
  it('builds the single-table keys', () => {
    expect(videoKey('video-1')).toEqual({ PK: 'VIDEO#video-1', SK: 'META' });
    expect(userKey('user-1')).toEqual({ PK: 'USER#user-1', SK: 'PROFILE' });
  });

  it('indexes every video under its owner, sorted by creation time', () => {
    expect(toVideoItem(uploading)).toMatchObject({
      PK: 'VIDEO#video-1',
      SK: 'META',
      type: 'Video',
      GSI1PK: 'OWNER#user-1',
      GSI1SK: '2026-10-03T10:00:00.000Z',
    });
  });

  it('expires an abandoned upload 8 days after it started', () => {
    const eightDays = 8 * 24 * 60 * 60;
    expect(toVideoItem(uploading).expiresAt).toBe(
      Date.parse('2026-10-03T10:00:00.000Z') / 1000 + eightDays,
    );
  });

  it('never expires a finished upload', () => {
    expect(toVideoItem(completeUpload(uploading, 1_000))).not.toHaveProperty('expiresAt');
  });

  it('round-trips a video without leaking table keys into the domain', () => {
    expect(fromVideoItem(toVideoItem(uploading))).toEqual(uploading);
  });
});

describe('moderation index', () => {
  const ready = markReady(startProcessing(completeUpload(uploading, 1_000)), {
    durationSeconds: 60,
    width: 1920,
    height: 1080,
  });
  const review = (decision: 'approve' | 'reject') =>
    reviewVideo(ready, decision, 'admin-1', new Date('2026-10-03T12:00:00.000Z'));

  it('puts a playable, undecided video in the review queue, by upload time', () => {
    expect(toVideoItem(ready)).toMatchObject({
      GSI3PK: 'MODERATION#queue',
      GSI3SK: '2026-10-03T10:00:00.000Z',
    });
  });

  it.each([
    ['an approved video', review('approve')],
    ['a rejected video', review('reject')],
    ['a video that is not playable yet', completeUpload(uploading, 1_000)],
  ])('keeps %s out of the queue, and in no list that others can read', (_, video) => {
    expect(toVideoItem(video)).not.toHaveProperty('GSI3PK');
    expect(toVideoItem(video)).not.toHaveProperty('GSI3SK');
  });

  it('indexes an approved video of an event by its category only', () => {
    const event = createCategory({
      id: 'cat-1',
      ownerId: 'user-1',
      name: 'Concert',
      now: new Date(),
    });
    const item = toVideoItem(assignToCategory(review('approve'), event));

    expect(item).not.toHaveProperty('GSI3PK');
    expect(item).toMatchObject({
      private: true,
      GSI2PK: 'CATEGORY#cat-1',
      GSI2SK: '2026-10-03T10:00:00.000Z',
    });
  });

  it('gives a video with no category no category keys', () => {
    expect(toVideoItem(ready)).not.toHaveProperty('GSI2PK');
  });

  it('round-trips the review', () => {
    expect(fromVideoItem(toVideoItem(review('approve')))).toEqual(review('approve'));
  });
});
