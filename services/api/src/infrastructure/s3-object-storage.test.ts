import { S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { startUpload } from '../domain/video';
import { s3ClientConfig } from './aws-clients';
import { originalKey, S3ObjectStorage } from './s3-object-storage';

const video = startUpload({
  id: 'video-1',
  ownerId: 'user-1',
  fileName: 'Concert.MOV',
  sizeBytes: 1_000,
  now: new Date('2026-10-03T10:00:00.000Z'),
});

describe('S3ObjectStorage', () => {
  it("stores originals under the owner's prefix", () => {
    expect(originalKey(video)).toBe('uploads/user-1/video-1/original.mov');
  });

  // Signing is pure local crypto: no network and no real credentials needed.
  it('signs one-hour URLs scoped to a single part, with no checksum to satisfy', async () => {
    const s3 = new S3Client({
      ...s3ClientConfig,
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    });

    const [first, second] = await new S3ObjectStorage(s3, 'bucket', 'media-bucket').signPartUrls(
      video,
      'session-1',
      [1, 2],
    );

    const url = new URL(first!.url);
    expect(url.pathname).toBe('/uploads/user-1/video-1/original.mov');
    expect(url.searchParams.get('partNumber')).toBe('1');
    expect(url.searchParams.get('uploadId')).toBe('session-1');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('3600');
    expect(first!.url).not.toMatch(/checksum/i);
    expect(new URL(second!.url).searchParams.get('partNumber')).toBe('2');
  });
});
