import type { UploadSource } from './source';

/**
 * One video waiting to be sent, as it is remembered on the phone. Everything needed to carry
 * on after the app was closed: where the prepared file is, and which server upload it is.
 */
export interface QueuedUpload extends UploadSource {
  /** Made on the phone; also the name of the kept file. */
  id: string;
  /** The event the video goes into, chosen when it was added. */
  eventId: string | null;
  /** The server's upload, once it has been started. With it, sending resumes. */
  videoId: string | null;
  addedAt: string;
}

/** The same video chosen twice is queued once: by its place in the library, else by name and size. */
export function isSameVideo(a: UploadSource, b: UploadSource): boolean {
  if (a.assetId !== null && b.assetId !== null) return a.assetId === b.assetId;
  return a.fileName === b.fileName && a.sizeBytes === b.sizeBytes;
}

/** Oldest first: videos are sent in the order they were chosen. */
export function inSendingOrder(queue: readonly QueuedUpload[]): QueuedUpload[] {
  return [...queue].sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id));
}

/** What was stored may be from an older version of the app, or damaged: keep only whole entries. */
export function parseQueue(stored: string | null): QueuedUpload[] {
  if (!stored) return [];
  try {
    const value: unknown = JSON.parse(stored);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (entry): entry is QueuedUpload =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as QueuedUpload).id === 'string' &&
        typeof (entry as QueuedUpload).uri === 'string' &&
        typeof (entry as QueuedUpload).fileName === 'string' &&
        typeof (entry as QueuedUpload).sizeBytes === 'number' &&
        typeof (entry as QueuedUpload).addedAt === 'string',
    );
  } catch {
    return [];
  }
}
