import { ApiError } from '@cvp/upload-client';

export const ACCEPTED_EXTENSIONS = ['mp4', 'mov', 'mkv', 'avi'];
export const UNSUPPORTED_FORMAT_MESSAGE = 'Only MP4, MOV, MKV and AVI videos can be uploaded.';

export function hasAcceptedExtension(fileName: string): boolean {
  const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  return ACCEPTED_EXTENSIONS.includes(extension);
}

export function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'QUOTA_EXCEEDED') return 'Not enough storage left for this video.';
    if (error.code === 'UNSUPPORTED_FORMAT') return UNSUPPORTED_FORMAT_MESSAGE;
    if (error.status === 401) return 'Your session ended. Sign in again to continue.';
    return 'The server could not process this upload. Try again.';
  }
  return 'Connection lost. Your progress is saved, so you can resume.';
}
