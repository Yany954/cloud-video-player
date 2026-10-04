import { ApiError } from '@cvp/upload-client';
import type { Messages } from '../i18n/messages/en';

export const ACCEPTED_EXTENSIONS = ['mp4', 'mov', 'mkv', 'avi'];
export function hasAcceptedExtension(fileName: string): boolean {
  const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  return ACCEPTED_EXTENSIONS.includes(extension);
}

type UploadErrors = Messages['upload']['errors'];

export function uploadErrorMessage(error: unknown, m: UploadErrors): string {
  if (error instanceof ApiError) {
    if (error.code === 'QUOTA_EXCEEDED') return m.quota;
    if (error.code === 'UNSUPPORTED_FORMAT') return m.unsupportedFormat;
    // Only starting an upload inside an event can answer "not found".
    if (error.status === 404) return m.eventGone;
    if (error.status === 401) return m.sessionEnded;
    return m.server;
  }
  return m.connection;
}
