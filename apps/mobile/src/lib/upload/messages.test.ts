import { ApiError } from '@cvp/upload-client';
import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/messages/en';
import { hasAcceptedExtension, uploadErrorMessage as translated } from './messages';

const uploadErrorMessage = (error: unknown) => translated(error, en.upload.errors);

describe('hasAcceptedExtension', () => {
  it.each(['a.mp4', 'a.MOV', 'my.concert.mkv', 'x.avi'])('accepts %s', (name) => {
    expect(hasAcceptedExtension(name)).toBe(true);
  });

  it.each(['notes.pdf', 'mp4', 'clip.mp4.zip', ''])('rejects %j', (name) => {
    expect(hasAcceptedExtension(name)).toBe(false);
  });
});

describe('uploadErrorMessage', () => {
  it('explains a full quota', () => {
    expect(uploadErrorMessage(new ApiError(413, 'QUOTA_EXCEEDED', 'x'))).toMatch(
      /Not enough storage/,
    );
  });

  it('explains an event that is gone', () => {
    expect(uploadErrorMessage(new ApiError(404, 'NOT_FOUND', 'x'))).toMatch(
      /event no longer exists/,
    );
  });

  it('explains an expired session', () => {
    expect(uploadErrorMessage(new ApiError(401, 'UNAUTHENTICATED', 'x'))).toMatch(/Sign in again/);
  });

  it('never shows raw server messages', () => {
    expect(uploadErrorMessage(new ApiError(500, 'INTERNAL', 'table exploded'))).not.toContain(
      'table',
    );
  });

  it('treats anything else as a connection problem that can be resumed', () => {
    expect(uploadErrorMessage(new Error('Network error while uploading'))).toMatch(/resume/);
  });
});
