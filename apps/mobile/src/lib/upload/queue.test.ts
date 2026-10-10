import { describe, expect, it } from 'vitest';
import { inSendingOrder, isSameVideo, parseQueue, type QueuedUpload } from './queue';

const video = {
  uri: 'file:///cache/copy-1.mp4',
  fileName: 'IMG_1556.mp4',
  sizeBytes: 656_600_000,
  assetId: 'asset-1',
  durationSeconds: 190,
  thumbnailUri: null,
};
const queued = (id: string, addedAt: string): QueuedUpload => ({
  ...video,
  id,
  eventId: null,
  videoId: null,
  addedAt,
});

describe('isSameVideo', () => {
  it('recognises a video chosen again, although the prepared copy is a new file', () => {
    expect(isSameVideo(video, { ...video, uri: 'file:///cache/copy-2.mp4', sizeBytes: 1 })).toBe(
      true,
    );
  });

  it('tells two library videos apart even when name and size match', () => {
    expect(isSameVideo(video, { ...video, assetId: 'asset-2' })).toBe(false);
  });

  it('falls back to name and size for a new recording', () => {
    const recording = { ...video, assetId: null };
    expect(isSameVideo(recording, { ...recording, uri: 'file:///other' })).toBe(true);
    expect(isSameVideo(recording, { ...recording, sizeBytes: 5 })).toBe(false);
  });
});

describe('inSendingOrder', () => {
  it('sends videos in the order they were chosen', () => {
    const order = inSendingOrder([
      queued('c', '2026-10-10T09:02:00.000Z'),
      queued('a', '2026-10-10T09:00:00.000Z'),
      queued('b', '2026-10-10T09:01:00.000Z'),
    ]);
    expect(order.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('parseQueue', () => {
  it('reads back what was stored', () => {
    const stored = [queued('a', '2026-10-10T09:00:00.000Z')];
    expect(parseQueue(JSON.stringify(stored))).toEqual(stored);
  });

  it('starts empty for nothing, for damaged text, and for something that is not a list', () => {
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue('not json')).toEqual([]);
    expect(parseQueue('{"a":1}')).toEqual([]);
  });

  it('drops entries that are not whole, and keeps the rest', () => {
    const good = queued('a', '2026-10-10T09:00:00.000Z');
    expect(parseQueue(JSON.stringify([good, { id: 'b' }, null, 7]))).toEqual([good]);
  });
});
