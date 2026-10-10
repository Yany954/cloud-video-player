import type { PutPart } from '@cvp/upload-client';
import { Directory, File, Paths } from 'expo-file-system';
import type { UploadSource } from './source';

// Read and written a few megabytes at a time, so a part never sits whole in JavaScript memory.
const COPY_CHUNK_BYTES = 4 * 1024 * 1024;

/** Where the pieces being sent wait. The system may clear it; nothing here is the only copy. */
const partsDirectory = () => new Directory(Paths.cache, 'upload-parts');

/**
 * Sends one part of the video straight to S3.
 *
 * iOS uploads in the background only from a file, so the part's bytes are first copied into
 * a small temporary file, and that file is handed to iOS's background transfer service. Once
 * handed over, iOS keeps sending it while the app is in the background or the phone is
 * locked, and even if the app is closed. What needs the app again is everything around it:
 * handing over further parts, and telling our server that the upload is complete.
 */
export const putPartFromPhone: PutPart<UploadSource> = async ({
  source,
  url,
  partNumber,
  start,
  end,
  signal,
  onProgress,
}) => {
  signal.throwIfAborted();
  const directory = partsDirectory();
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  const part = new File(
    directory,
    `${Date.now()}-${partNumber}-${Math.random().toString(36).slice(2)}.part`,
  );

  try {
    await copyRange(new File(source.uri), part, start, end, signal);
    const result = await part.upload(url, {
      httpMethod: 'PUT',
      sessionType: 'background',
      signal,
      onProgress: ({ bytesSent }) => onProgress(bytesSent),
    });
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Storage rejected the part with status ${result.status}`);
    }
  } finally {
    // Only reached while the app is alive. If it was closed meanwhile, iOS may still be
    // sending this file: `clearOldParts` removes it later.
    try {
      if (part.exists) part.delete();
    } catch {
      // A leftover piece in the cache is harmless.
    }
  }
};

/** Copies a few megabytes at a time and lets the screen breathe in between. */
async function copyRange(
  from: File,
  to: File,
  start: number,
  end: number,
  signal: AbortSignal,
): Promise<void> {
  const reader = from.open();
  to.create({ overwrite: true });
  const writer = to.open();
  try {
    reader.offset = start;
    for (let position = start; position < end;) {
      signal.throwIfAborted();
      const bytes = reader.readBytes(Math.min(COPY_CHUNK_BYTES, end - position));
      if (bytes.length === 0) throw new Error('The video file ended before the part did');
      writer.writeBytes(bytes);
      position += bytes.length;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    reader.close();
    writer.close();
  }
}

const PART_KEPT_FOR_MS = 24 * 60 * 60 * 1000;

/** The time a part file was made, read from its name (`<time>-<part>-<random>.part`). */
export function partCreatedAt(fileName: string): number | null {
  const time = Number(fileName.split('-')[0]);
  return Number.isFinite(time) && time > 0 ? time : null;
}

/**
 * Removes part files left by an earlier run, but only old ones: after the app was closed,
 * iOS may still be sending the recent ones, and the links they are sent to last one hour.
 */
export function clearOldParts(now = Date.now()): void {
  try {
    const directory = partsDirectory();
    if (!directory.exists) return;
    for (const entry of directory.list()) {
      const created = partCreatedAt(entry.name);
      if (created === null || now - created > PART_KEPT_FOR_MS) entry.delete();
    }
  } catch {
    // Nothing depends on it.
  }
}

/**
 * How many parts to hand to iOS at once. Every part handed over keeps being sent after the
 * app leaves the screen, so more is better, but each one is a temporary copy on the phone.
 * With room to spare the whole video is handed over; otherwise two at a time.
 */
export function partsAtOnce(sizeBytes: number, freeBytes = Paths.availableDiskSpace): number {
  const HEADROOM_BYTES = 1024 * 1024 * 1024;
  return freeBytes > sizeBytes + HEADROOM_BYTES ? MAX_PARTS_AT_ONCE : 2;
}

// The server hands out at most 100 part links per request.
const MAX_PARTS_AT_ONCE = 64;
