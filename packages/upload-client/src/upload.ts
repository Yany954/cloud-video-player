import type { VideoResponse } from '@cvp/shared';
import type { UploadApi } from './api';

export interface PutPartArgs<TSource> {
  source: TSource;
  url: string;
  partNumber: number;
  /** Byte range of this part within the file: [start, end). */
  start: number;
  end: number;
  signal: AbortSignal;
  /** Report how many of this part's bytes have been sent so far. */
  onProgress(bytesSent: number): void;
}

/**
 * Sends one part's bytes to its presigned URL. The only platform-specific piece: the web
 * app implements it with the browser, the mobile app with its native uploader.
 */
export type PutPart<TSource> = (args: PutPartArgs<TSource>) => Promise<void>;

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
}

export interface UploadVideoOptions<TSource> {
  api: UploadApi;
  putPart: PutPart<TSource>;
  source: TSource;
  fileName: string;
  sizeBytes: number;
  title?: string;
  /** Resume this upload instead of starting a new one. */
  videoId?: string;
  /** Abort to pause. The upload stays on the server and can be resumed with `videoId`. */
  signal?: AbortSignal;
  onProgress?(progress: UploadProgress): void;
  /** Called once the upload exists on the server: remember the id to resume later. */
  onStarted?(videoId: string): void;
  concurrency?: number;
  /** Give up after this many rounds in a row in which no part got through. */
  maxStalledRounds?: number;
  /** Wait between stalled rounds. Injectable so tests don't really wait. */
  sleep?(ms: number, signal?: AbortSignal): Promise<void>;
}

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_MAX_STALLED_ROUNDS = 3;

export async function uploadVideo<TSource>(
  options: UploadVideoOptions<TSource>,
): Promise<VideoResponse> {
  const { api, sizeBytes, signal } = options;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const maxStalledRounds = options.maxStalledRounds ?? DEFAULT_MAX_STALLED_ROUNDS;
  const sleep = options.sleep ?? defaultSleep;

  let videoId = options.videoId;
  if (!videoId) {
    signal?.throwIfAborted();
    const started = await api.initiate({
      fileName: options.fileName,
      sizeBytes,
      title: options.title,
    });
    videoId = started.videoId;
    options.onStarted?.(videoId);
  }

  let stalledRounds = 0;
  // Each round asks the server what is missing, so it also covers resuming, batches of
  // URLs, expired URLs and parts that failed in the previous round.
  for (;;) {
    signal?.throwIfAborted();
    const round = await api.getPartUrls(videoId);
    if (round.urls.length === 0) break;

    const rangeOf = (partNumber: number) => {
      const start = (partNumber - 1) * round.partSizeBytes;
      return { start, end: Math.min(start + round.partSizeBytes, sizeBytes) };
    };
    const sizeOf = (partNumber: number) => {
      const { start, end } = rangeOf(partNumber);
      return end - start;
    };

    let completedBytes = round.uploadedPartNumbers.reduce((sum, part) => sum + sizeOf(part), 0);
    const inFlight = new Map<number, number>();
    const report = () => {
      let sending = 0;
      for (const bytes of inFlight.values()) sending += bytes;
      options.onProgress?.({ uploadedBytes: completedBytes + sending, totalBytes: sizeBytes });
    };
    report();

    let succeeded = 0;
    let lastError: unknown;
    const queue = [...round.urls];
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        signal?.throwIfAborted();
        const { partNumber, url } = next;
        try {
          await options.putPart({
            source: options.source,
            url,
            partNumber,
            ...rangeOf(partNumber),
            signal: signal ?? new AbortController().signal,
            onProgress(bytesSent) {
              inFlight.set(partNumber, Math.min(bytesSent, sizeOf(partNumber)));
              report();
            },
          });
          completedBytes += sizeOf(partNumber);
          succeeded++;
        } catch (error) {
          if (signal?.aborted) throw error;
          lastError = error;
        } finally {
          inFlight.delete(partNumber);
          report();
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));

    if (succeeded > 0) {
      stalledRounds = 0;
    } else {
      stalledRounds++;
      if (stalledRounds >= maxStalledRounds) throw lastError;
      await sleep(1000 * 2 ** stalledRounds, signal);
    }
  }

  signal?.throwIfAborted();
  const video = await api.complete(videoId);
  options.onProgress?.({ uploadedBytes: sizeBytes, totalBytes: sizeBytes });
  return video;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
