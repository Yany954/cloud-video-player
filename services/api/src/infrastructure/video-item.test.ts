import { describe, expect, it } from 'vitest';
import { completeUpload, startUpload, type Video } from '../domain/video';
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
