import { DomainError } from './errors';
import { planUpload } from './upload-plan';
import { videoFormatOf, type VideoFormat } from './video-format';

export type UploadStatus = 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed';
export type ModerationStatus = 'pending' | 'approved' | 'flagged' | 'rejected';

const MAX_TITLE_LENGTH = 200;

export interface Video {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly fileName: string;
  readonly format: VideoFormat;
  readonly categoryId: string | null;
  /** What the client said before uploading; `sizeBytes` is the measured size once uploaded. */
  readonly declaredSizeBytes: number;
  readonly sizeBytes: number | null;
  readonly uploadStatus: UploadStatus;
  readonly moderationStatus: ModerationStatus;
  /** Opaque handle of the in-progress upload in the object store; null once finished. */
  readonly uploadSessionId: string | null;
  readonly createdAt: string;
}

export interface StartUploadInput {
  id: string;
  ownerId: string;
  fileName: string;
  sizeBytes: number;
  title?: string;
  categoryId?: string;
  now: Date;
}

/** Every upload starts as `uploading` + `pending`: only its owner can see it until moderated. */
export function startUpload(input: StartUploadInput): Video {
  const format = videoFormatOf(input.fileName);
  planUpload(input.sizeBytes);

  const title = (input.title ?? input.fileName.replace(/\.[^.]+$/, '')).trim();
  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
    throw new DomainError('INVALID_TITLE', `Title must be 1 to ${MAX_TITLE_LENGTH} characters`);
  }

  return {
    id: input.id,
    ownerId: input.ownerId,
    title,
    fileName: input.fileName,
    format,
    categoryId: input.categoryId ?? null,
    declaredSizeBytes: input.sizeBytes,
    sizeBytes: null,
    uploadStatus: 'uploading',
    moderationStatus: 'pending',
    uploadSessionId: null,
    createdAt: input.now.toISOString(),
  };
}

export function isOwnedBy(video: Video, userId: string): boolean {
  return video.ownerId === userId;
}

/** Returns the session id, proving the video can still receive parts, be completed or aborted. */
export function activeUploadSession(video: Video): string {
  if (video.uploadStatus !== 'uploading' || video.uploadSessionId === null) {
    throw new DomainError('INVALID_STATE', `Video is ${video.uploadStatus}, not uploading`);
  }
  return video.uploadSessionId;
}

export function completeUpload(video: Video, actualSizeBytes: number): Video {
  activeUploadSession(video);
  return { ...video, uploadStatus: 'uploaded', sizeBytes: actualSizeBytes, uploadSessionId: null };
}
