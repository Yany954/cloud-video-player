import { DomainError } from './errors';

// Containers we accept. The real codec check (ffprobe) happens later, in processing.
const CONTENT_TYPES = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
} as const;

export type VideoFormat = keyof typeof CONTENT_TYPES;

export function videoFormatOf(fileName: string): VideoFormat {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (!fileName.includes('.') || !(extension in CONTENT_TYPES)) {
    throw new DomainError('UNSUPPORTED_FORMAT', 'Only MP4, MOV, MKV and AVI files are accepted');
  }
  return extension as VideoFormat;
}

/** Derived from the extension, never trusted from the client. */
export function contentTypeOf(format: VideoFormat): string {
  return CONTENT_TYPES[format];
}
