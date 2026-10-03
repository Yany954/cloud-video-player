import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_QUOTA_BYTES } from '../../domain/quota';
import { NotFoundError } from '../errors';
import { InMemoryDatabase, InMemoryObjectStorage, InMemoryProcessingQueue } from '../testing/fakes';
import { AbortUpload } from './abort-upload';
import { CompleteUpload } from './complete-upload';
import { GetPartUrls } from './get-part-urls';
import { GetStorageUsage } from './get-storage-usage';
import { InitiateUpload } from './initiate-upload';

const MIB = 1024 ** 2;
const ANA = 'user-ana';
const BEN = 'user-ben';

let db: InMemoryDatabase;
let storage: InMemoryObjectStorage;
let queue: InMemoryProcessingQueue;
let initiate: InitiateUpload;
let getPartUrls: GetPartUrls;
let complete: CompleteUpload;
let abort: AbortUpload;
let getUsage: GetStorageUsage;

beforeEach(() => {
  db = new InMemoryDatabase();
  storage = new InMemoryObjectStorage();
  queue = new InMemoryProcessingQueue();
  let nextId = 1;
  initiate = new InitiateUpload(
    db,
    db,
    storage,
    () => `video-${nextId++}`,
    () => new Date('2026-10-03T10:00:00.000Z'),
  );
  getPartUrls = new GetPartUrls(db, storage);
  complete = new CompleteUpload(db, db, storage, queue);
  abort = new AbortUpload(db, storage);
  getUsage = new GetStorageUsage(db);
});

/** Starts a 40 MiB upload (3 parts: 16 + 16 + 8) and returns its ids. */
async function startConcert(userId = ANA, sizeBytes = 40 * MIB) {
  const { videoId } = await initiate.execute({ userId, fileName: 'concert.mp4', sizeBytes });
  const sessionId = db.videos.get(videoId)!.uploadSessionId!;
  return { videoId, sessionId };
}

function putAllParts(sessionId: string, sizes = [16 * MIB, 16 * MIB, 8 * MIB]) {
  sizes.forEach((size, index) => storage.putPart(sessionId, index + 1, size));
}

describe('InitiateUpload', () => {
  it('creates a pending video with an open upload session and returns the plan', async () => {
    const result = await initiate.execute({
      userId: ANA,
      fileName: 'concert.mp4',
      sizeBytes: 40 * MIB,
    });

    expect(result).toEqual({ videoId: 'video-1', partSizeBytes: 16 * MIB, partCount: 3 });
    expect(db.videos.get('video-1')).toMatchObject({
      ownerId: ANA,
      uploadStatus: 'uploading',
      moderationStatus: 'pending',
      uploadSessionId: 'session-1',
    });
  });

  it('rejects an unsupported format without opening an upload session', async () => {
    await expect(
      initiate.execute({ userId: ANA, fileName: 'notes.pdf', sizeBytes: 10 }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_FORMAT' });
    expect(storage.sessions.size).toBe(0);
    expect(db.videos.size).toBe(0);
  });

  it('rejects a file bigger than the free quota before anything is uploaded', async () => {
    db.usage.set(ANA, {
      bytesUsed: DEFAULT_QUOTA_BYTES - 10 * MIB,
      quotaBytes: DEFAULT_QUOTA_BYTES,
    });

    await expect(
      initiate.execute({ userId: ANA, fileName: 'concert.mp4', sizeBytes: 40 * MIB }),
    ).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
    expect(storage.sessions.size).toBe(0);
  });
});

describe('GetPartUrls', () => {
  it('signs a URL for every part of a fresh upload', async () => {
    const { videoId } = await startConcert();

    const result = await getPartUrls.execute({ userId: ANA, videoId });

    expect(result).toMatchObject({ partCount: 3, uploadedPartNumbers: [] });
    expect(result.urls.map((url) => url.partNumber)).toEqual([1, 2, 3]);
  });

  it('resumes: only signs the parts that are still missing', async () => {
    const { videoId, sessionId } = await startConcert();
    storage.putPart(sessionId, 1, 16 * MIB);
    storage.putPart(sessionId, 3, 8 * MIB);

    const result = await getPartUrls.execute({ userId: ANA, videoId });

    expect(result.uploadedPartNumbers).toEqual([1, 3]);
    expect(result.urls.map((url) => url.partNumber)).toEqual([2]);
  });

  it('hands out URLs in batches', async () => {
    const { videoId } = await startConcert();

    const result = await getPartUrls.execute({ userId: ANA, videoId, limit: 2 });

    expect(result.urls.map((url) => url.partNumber)).toEqual([1, 2]);
  });

  it("hides other users' videos and unknown ids behind the same error", async () => {
    const { videoId } = await startConcert();

    await expect(getPartUrls.execute({ userId: BEN, videoId })).rejects.toThrow(NotFoundError);
    await expect(getPartUrls.execute({ userId: ANA, videoId: 'nope' })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('CompleteUpload', () => {
  it('marks the video uploaded and adds the measured size to the usage', async () => {
    const { videoId, sessionId } = await startConcert();
    putAllParts(sessionId);

    const video = await complete.execute({ userId: ANA, videoId });

    expect(video).toMatchObject({
      uploadStatus: 'uploaded',
      moderationStatus: 'pending',
      sizeBytes: 40 * MIB,
      uploadSessionId: null,
    });
    expect(storage.originals.get(videoId)).toBe(40 * MIB);
    expect(await getUsage.execute({ userId: ANA })).toMatchObject({ bytesUsed: 40 * MIB });
    expect(queue.videoIds).toEqual([videoId]);
  });

  it('refuses to complete while parts are missing, changing nothing', async () => {
    const { videoId, sessionId } = await startConcert();
    storage.putPart(sessionId, 1, 16 * MIB);

    await expect(complete.execute({ userId: ANA, videoId })).rejects.toMatchObject({
      code: 'UPLOAD_INCOMPLETE',
      message: '1 of 3 parts have been uploaded',
    });
    expect(db.videos.get(videoId)?.uploadStatus).toBe('uploading');
    expect(storage.sessions.has(sessionId)).toBe(true);
  });

  it('counts the real bytes, not what the client declared', async () => {
    db.usage.set(ANA, { bytesUsed: 0, quotaBytes: 50 * MIB });
    const { videoId, sessionId } = await startConcert();
    // Declared 40 MiB, but actually uploads 60 MiB: over the 50 MiB quota.
    putAllParts(sessionId, [20 * MIB, 20 * MIB, 20 * MIB]);

    await expect(complete.execute({ userId: ANA, videoId })).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
    });
    expect(storage.sessions.has(sessionId)).toBe(false);
    expect(storage.originals.has(videoId)).toBe(false);
    expect(db.videos.has(videoId)).toBe(false);
    expect(await getUsage.execute({ userId: ANA })).toMatchObject({ bytesUsed: 0 });
    // A rejected upload is never sent to processing.
    expect(queue.videoIds).toEqual([]);
  });

  it('never passes the quota when two uploads finish at the same time', async () => {
    db.usage.set(ANA, { bytesUsed: 0, quotaBytes: 50 * MIB });
    const first = await startConcert(ANA, 30 * MIB);
    const second = await startConcert(ANA, 30 * MIB);
    putAllParts(first.sessionId, [16 * MIB, 14 * MIB]);
    putAllParts(second.sessionId, [16 * MIB, 14 * MIB]);
    // Both requests read the usage before either one wrote it.
    const staleAccounts = { getUsage: async () => ({ bytesUsed: 0, quotaBytes: 50 * MIB }) };
    const racing = new CompleteUpload(db, staleAccounts, storage, queue);

    await racing.execute({ userId: ANA, videoId: first.videoId });
    await expect(racing.execute({ userId: ANA, videoId: second.videoId })).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
    });

    expect(await getUsage.execute({ userId: ANA })).toMatchObject({ bytesUsed: 30 * MIB });
    expect(storage.originals.has(second.videoId)).toBe(false);
    expect(db.videos.has(second.videoId)).toBe(false);
    expect(queue.videoIds).toEqual([first.videoId]);
  });

  it('cannot complete the same upload twice', async () => {
    const { videoId, sessionId } = await startConcert();
    putAllParts(sessionId);
    await complete.execute({ userId: ANA, videoId });

    await expect(complete.execute({ userId: ANA, videoId })).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
    expect(await getUsage.execute({ userId: ANA })).toMatchObject({ bytesUsed: 40 * MIB });
  });

  it("cannot complete someone else's upload", async () => {
    const { videoId, sessionId } = await startConcert();
    putAllParts(sessionId);

    await expect(complete.execute({ userId: BEN, videoId })).rejects.toThrow(NotFoundError);
  });
});

describe('AbortUpload', () => {
  it('discards the parts and the video without touching the usage', async () => {
    const { videoId, sessionId } = await startConcert();
    storage.putPart(sessionId, 1, 16 * MIB);

    await abort.execute({ userId: ANA, videoId });

    expect(storage.sessions.has(sessionId)).toBe(false);
    expect(db.videos.has(videoId)).toBe(false);
    expect(await getUsage.execute({ userId: ANA })).toMatchObject({ bytesUsed: 0 });
    // A rejected upload is never sent to processing.
    expect(queue.videoIds).toEqual([]);
  });

  it('cannot abort a finished upload', async () => {
    const { videoId, sessionId } = await startConcert();
    putAllParts(sessionId);
    await complete.execute({ userId: ANA, videoId });

    await expect(abort.execute({ userId: ANA, videoId })).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
    expect(db.videos.has(videoId)).toBe(true);
  });

  it("cannot abort someone else's upload", async () => {
    const { videoId } = await startConcert();

    await expect(abort.execute({ userId: BEN, videoId })).rejects.toThrow(NotFoundError);
    expect(db.videos.has(videoId)).toBe(true);
  });
});

describe('GetStorageUsage', () => {
  it('gives a new user 0 bytes used and the default 50 GiB quota', async () => {
    expect(await getUsage.execute({ userId: ANA })).toEqual({
      bytesUsed: 0,
      quotaBytes: DEFAULT_QUOTA_BYTES,
    });
  });
});
