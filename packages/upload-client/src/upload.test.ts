import type { PartUrlsResponse, VideoResponse } from '@cvp/shared';
import { describe, expect, it, vi } from 'vitest';
import type { UploadApi } from './api';
import { uploadVideo, type PutPart, type UploadProgress } from './upload';

const PART = 10;

/** An in-memory stand-in for the API + S3: remembers which parts arrived. */
function fakeServer(options: { sizeBytes: number; urlsPerRequest?: number }) {
  const uploaded = new Set<number>();
  const partCount = Math.ceil(options.sizeBytes / PART);
  const calls = { initiate: 0, getPartUrls: 0, complete: 0, abort: 0 };

  const api: UploadApi = {
    async initiate() {
      calls.initiate++;
      return { videoId: 'video-1', partSizeBytes: PART, partCount };
    },
    async getPartUrls(): Promise<PartUrlsResponse> {
      calls.getPartUrls++;
      const missing = Array.from({ length: partCount }, (_, index) => index + 1).filter(
        (part) => !uploaded.has(part),
      );
      return {
        partSizeBytes: PART,
        partCount,
        uploadedPartNumbers: [...uploaded].sort((a, b) => a - b),
        urls: missing
          .slice(0, options.urlsPerRequest ?? 100)
          .map((partNumber) => ({ partNumber, url: `https://s3.test/part/${partNumber}` })),
      };
    },
    async complete(): Promise<VideoResponse> {
      calls.complete++;
      return {
        id: 'video-1',
        title: 'Concert',
        fileName: 'concert.mp4',
        sizeBytes: options.sizeBytes,
        uploadStatus: 'uploaded',
        moderationStatus: 'pending',
        createdAt: '2026-10-03T10:00:00.000Z',
      };
    },
    async abort() {
      calls.abort++;
    },
    async getStorageUsage() {
      return { bytesUsed: 0, quotaBytes: 100 };
    },
  };

  const putPart: PutPart<string> = async ({ partNumber, start, end, onProgress }) => {
    onProgress(end - start);
    uploaded.add(partNumber);
  };

  return { api, putPart, uploaded, calls };
}

const base = { source: 'file', fileName: 'concert.mp4', sleep: async () => {} };

describe('uploadVideo', () => {
  it('starts, uploads every part with the right byte range, and completes', async () => {
    const server = fakeServer({ sizeBytes: 25 });
    const ranges: [number, number, number][] = [];
    const putPart: PutPart<string> = async (args) => {
      ranges.push([args.partNumber, args.start, args.end]);
      await server.putPart(args);
    };
    const onStarted = vi.fn();

    const video = await uploadVideo({ ...base, ...server, putPart, sizeBytes: 25, onStarted });

    expect(video.uploadStatus).toBe('uploaded');
    expect(ranges.sort((a, b) => a[0] - b[0])).toEqual([
      [1, 0, 10],
      [2, 10, 20],
      [3, 20, 25],
    ]);
    expect(onStarted).toHaveBeenCalledExactlyOnceWith('video-1');
    expect(server.calls).toMatchObject({ initiate: 1, complete: 1, abort: 0 });
  });

  it('reports progress that only grows and ends at 100%', async () => {
    const server = fakeServer({ sizeBytes: 25 });
    const seen: UploadProgress[] = [];

    await uploadVideo({ ...base, ...server, sizeBytes: 25, onProgress: (p) => seen.push(p) });

    const bytes = seen.map((progress) => progress.uploadedBytes);
    expect(bytes).toEqual([...bytes].sort((a, b) => a - b));
    expect(seen.at(-1)).toEqual({ uploadedBytes: 25, totalBytes: 25 });
  });

  it('never sends more than 3 parts at the same time', async () => {
    const server = fakeServer({ sizeBytes: 100 });
    let active = 0;
    let peak = 0;
    const putPart: PutPart<string> = async (args) => {
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      await server.putPart(args);
    };

    await uploadVideo({ ...base, ...server, putPart, sizeBytes: 100 });

    expect(peak).toBe(3);
    expect(server.uploaded.size).toBe(10);
  });

  it('resumes: skips the parts the server already has and does not start a new upload', async () => {
    const server = fakeServer({ sizeBytes: 45 });
    server.uploaded.add(1).add(3);
    const sent: number[] = [];
    const putPart: PutPart<string> = async (args) => {
      sent.push(args.partNumber);
      await server.putPart(args);
    };
    const seen: UploadProgress[] = [];

    await uploadVideo({
      ...base,
      ...server,
      putPart,
      sizeBytes: 45,
      videoId: 'video-1',
      onProgress: (p) => seen.push(p),
    });

    expect(server.calls.initiate).toBe(0);
    expect(sent.sort()).toEqual([2, 4, 5]);
    // The progress bar starts where the last session stopped (2 parts = 20 bytes).
    expect(seen[0]).toEqual({ uploadedBytes: 20, totalBytes: 45 });
  });

  it('keeps asking for more URLs when the server hands them out in batches', async () => {
    const server = fakeServer({ sizeBytes: 50, urlsPerRequest: 2 });

    await uploadVideo({ ...base, ...server, sizeBytes: 50 });

    expect(server.uploaded.size).toBe(5);
    expect(server.calls.getPartUrls).toBe(4); // 2 + 2 + 1 parts, then one empty answer
  });

  it('retries a part that failed, in the next round', async () => {
    const server = fakeServer({ sizeBytes: 30 });
    let failuresLeft = 1;
    const putPart: PutPart<string> = async (args) => {
      if (args.partNumber === 2 && failuresLeft-- > 0) throw new Error('connection dropped');
      await server.putPart(args);
    };

    const video = await uploadVideo({ ...base, ...server, putPart, sizeBytes: 30 });

    expect(video.uploadStatus).toBe('uploaded');
    expect(server.uploaded.size).toBe(3);
  });

  it('gives up after 3 rounds with no progress, without completing or aborting', async () => {
    const server = fakeServer({ sizeBytes: 30 });
    const putPart = vi.fn<PutPart<string>>().mockRejectedValue(new Error('offline'));
    const sleep = vi.fn(async () => {});

    await expect(
      uploadVideo({ ...base, ...server, putPart, sizeBytes: 30, sleep }),
    ).rejects.toThrow('offline');

    expect(server.calls.getPartUrls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    // The upload stays on the server, so the user can resume when back online.
    expect(server.calls).toMatchObject({ complete: 0, abort: 0 });
  });

  it('pauses when the signal is aborted, leaving the upload resumable', async () => {
    const server = fakeServer({ sizeBytes: 100 });
    const controller = new AbortController();
    const putPart: PutPart<string> = async (args) => {
      await server.putPart(args);
      if (server.uploaded.size >= 4) controller.abort();
    };

    await expect(
      uploadVideo({ ...base, ...server, putPart, sizeBytes: 100, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(server.uploaded.size).toBeLessThan(10);
    expect(server.calls).toMatchObject({ complete: 0, abort: 0 });

    // Resuming later finishes the job.
    await uploadVideo({ ...base, ...server, sizeBytes: 100, videoId: 'video-1' });
    expect(server.uploaded.size).toBe(10);
    expect(server.calls.complete).toBe(1);
  });
});
