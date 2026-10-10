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
 * iOS uploads from a file, not from memory, so the part's bytes are first copied into a small
 * temporary file and that file is handed to the system's uploader. The same mechanism can
 * later continue with the app in the background (`sessionType: 'background'`).
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
    copyRange(new File(source.uri), part, start, end, signal);
    const result = await part.upload(url, {
      httpMethod: 'PUT',
      sessionType: 'foreground',
      signal,
      onProgress: ({ bytesSent }) => onProgress(bytesSent),
    });
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Storage rejected the part with status ${result.status}`);
    }
  } finally {
    try {
      if (part.exists) part.delete();
    } catch {
      // A leftover piece in the cache is harmless; the system clears it.
    }
  }
};

function copyRange(from: File, to: File, start: number, end: number, signal: AbortSignal): void {
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
    }
  } finally {
    reader.close();
    writer.close();
  }
}

/** Removes pieces left behind by an upload that was interrupted (the app was closed). */
export function clearLeftoverParts(): void {
  try {
    const directory = partsDirectory();
    if (directory.exists) directory.delete();
  } catch {
    // Nothing depends on it.
  }
}
