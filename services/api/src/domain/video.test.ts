import { describe, expect, it } from 'vitest';
import { activeUploadSession, completeUpload, isOwnedBy, startUpload, type Video } from './video';
import { contentTypeOf } from './video-format';

const input = {
  id: 'video-1',
  ownerId: 'user-1',
  fileName: 'Rosalia Madrid.MOV',
  sizeBytes: 1_000,
  now: new Date('2026-10-03T10:00:00.000Z'),
};

const uploading = (): Video => ({ ...startUpload(input), uploadSessionId: 'session-1' });

describe('startUpload', () => {
  it('starts as uploading and pending, owned by the uploader', () => {
    expect(startUpload(input)).toEqual({
      id: 'video-1',
      ownerId: 'user-1',
      title: 'Rosalia Madrid',
      fileName: 'Rosalia Madrid.MOV',
      format: 'mov',
      categoryId: null,
      declaredSizeBytes: 1_000,
      sizeBytes: null,
      uploadStatus: 'uploading',
      moderationStatus: 'pending',
      uploadSessionId: null,
      createdAt: '2026-10-03T10:00:00.000Z',
    });
  });

  it('prefers an explicit title and category', () => {
    const video = startUpload({ ...input, title: '  Motomami tour  ', categoryId: 'cat-1' });
    expect(video).toMatchObject({ title: 'Motomami tour', categoryId: 'cat-1' });
  });

  it.each(['clip.mp4', 'clip.mov', 'clip.mkv', 'clip.AVI'])('accepts %s', (fileName) => {
    expect(() => startUpload({ ...input, fileName })).not.toThrow();
  });

  it.each(['notes.pdf', 'virus.exe', 'mp4', 'clip.mp4.zip'])('rejects %s', (fileName) => {
    expect(() => startUpload({ ...input, fileName })).toThrow(
      expect.objectContaining({ code: 'UNSUPPORTED_FORMAT' }),
    );
  });

  it('rejects an empty file', () => {
    expect(() => startUpload({ ...input, sizeBytes: 0 })).toThrow(
      expect.objectContaining({ code: 'INVALID_SIZE' }),
    );
  });

  it.each(['   ', 'x'.repeat(201)])('rejects an invalid title', (title) => {
    expect(() => startUpload({ ...input, title })).toThrow(
      expect.objectContaining({ code: 'INVALID_TITLE' }),
    );
  });
});

describe('contentTypeOf', () => {
  it('derives the content type from the format, not from the client', () => {
    expect(contentTypeOf('mov')).toBe('video/quicktime');
  });
});

describe('isOwnedBy', () => {
  it('is true only for the uploader', () => {
    expect(isOwnedBy(uploading(), 'user-1')).toBe(true);
    expect(isOwnedBy(uploading(), 'user-2')).toBe(false);
  });
});

describe('completeUpload', () => {
  it('records the measured size and closes the upload session', () => {
    expect(completeUpload(uploading(), 1_234)).toMatchObject({
      uploadStatus: 'uploaded',
      sizeBytes: 1_234,
      declaredSizeBytes: 1_000,
      uploadSessionId: null,
      moderationStatus: 'pending',
    });
  });

  it('cannot complete twice', () => {
    const uploaded = completeUpload(uploading(), 1_234);
    expect(() => completeUpload(uploaded, 1_234)).toThrow(
      expect.objectContaining({ code: 'INVALID_STATE' }),
    );
  });
});

describe('activeUploadSession', () => {
  it('returns the session of an upload in progress', () => {
    expect(activeUploadSession(uploading())).toBe('session-1');
  });

  it('rejects a video with no session yet', () => {
    expect(() => activeUploadSession(startUpload(input))).toThrow(
      expect.objectContaining({ code: 'INVALID_STATE' }),
    );
  });
});
