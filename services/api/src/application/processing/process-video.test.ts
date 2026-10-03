import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProbeResult } from '../../domain/normalization';
import { completeUpload, startUpload, type Video } from '../../domain/video';
import type { MediaProcessor } from '../ports';
import { InMemoryDatabase } from '../testing/fakes';
import { ProcessVideo } from './process-video';

const goodProbe: ProbeResult = {
  videoCodec: 'hevc',
  audioCodec: 'aac',
  durationSeconds: 42.5,
  width: 1920,
  height: 1080,
};

let db: InMemoryDatabase;
let processor: { probe: ReturnType<typeof vi.fn>; normalize: ReturnType<typeof vi.fn> };
let processVideo: ProcessVideo;

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

beforeEach(async () => {
  db = new InMemoryDatabase();
  processor = {
    probe: vi.fn().mockResolvedValue(goodProbe),
    normalize: vi.fn().mockResolvedValue(undefined),
  };
  processVideo = new ProcessVideo(db, processor as unknown as MediaProcessor);
  await db.create(uploaded());
});

const run = (isLastAttempt = false) => processVideo.execute({ videoId: 'video-1', isLastAttempt });
const stored = () => db.videos.get('video-1')!;

describe('ProcessVideo', () => {
  it('normalizes the video and marks it ready with its measured facts', async () => {
    await run();

    expect(processor.normalize).toHaveBeenCalledWith(expect.objectContaining({ id: 'video-1' }), {
      kind: 'remux',
      video: 'copy',
      videoTag: 'hvc1',
      audio: 'copy',
    });
    expect(stored()).toMatchObject({
      uploadStatus: 'ready',
      media: { durationSeconds: 42.5, width: 1920, height: 1080 },
      failureReason: null,
      // Processing never changes who can see the video.
      moderationStatus: 'pending',
    });
  });

  it('shows the video as processing while the work is running', async () => {
    processor.normalize.mockImplementation(async () => {
      expect(stored().uploadStatus).toBe('processing');
    });

    await run();

    expect(processor.normalize).toHaveBeenCalledOnce();
  });

  it('marks an unsupported codec as failed without trying to convert it', async () => {
    processor.probe.mockResolvedValue({ ...goodProbe, videoCodec: 'prores' });

    await run();

    expect(processor.normalize).not.toHaveBeenCalled();
    expect(stored()).toMatchObject({
      uploadStatus: 'failed',
      failureReason: 'UNSUPPORTED_VIDEO_CODEC',
    });
  });

  it('leaves the video processing and rethrows, so the queue retries', async () => {
    processor.normalize.mockRejectedValue(new Error('network blip'));

    await expect(run(false)).rejects.toThrow('network blip');

    expect(stored().uploadStatus).toBe('processing');
  });

  it('marks the video failed when the last attempt also fails', async () => {
    processor.normalize.mockRejectedValue(new Error('still broken'));

    await expect(run(true)).rejects.toThrow('still broken');

    expect(stored()).toMatchObject({ uploadStatus: 'failed', failureReason: 'PROCESSING_ERROR' });
  });

  it('succeeds on a retry after a failed attempt', async () => {
    processor.normalize.mockRejectedValueOnce(new Error('network blip'));
    await expect(run()).rejects.toThrow();

    await run();

    expect(stored().uploadStatus).toBe('ready');
  });

  it('does nothing for a video that is already ready (duplicate delivery)', async () => {
    await run();
    processor.probe.mockClear();

    await run();

    expect(processor.probe).not.toHaveBeenCalled();
  });

  it('does nothing for a video that was deleted', async () => {
    await db.delete('video-1');

    await expect(run()).resolves.toBeUndefined();
    expect(processor.probe).not.toHaveBeenCalled();
  });
});
