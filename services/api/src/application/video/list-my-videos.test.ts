import { describe, expect, it } from 'vitest';
import { startUpload } from '../../domain/video';
import { InMemoryDatabase } from '../testing/fakes';
import { ListMyVideos } from './list-my-videos';

const video = (id: string, ownerId: string, createdAt: string) =>
  startUpload({ id, ownerId, fileName: `${id}.mp4`, sizeBytes: 10, now: new Date(createdAt) });

describe('ListMyVideos', () => {
  it("returns only the caller's videos, newest first", async () => {
    const db = new InMemoryDatabase();
    await db.create(video('old', 'ana', '2026-10-01T10:00:00.000Z'));
    await db.create(video('new', 'ana', '2026-10-03T10:00:00.000Z'));
    await db.create(video('bens', 'ben', '2026-10-02T10:00:00.000Z'));

    const videos = await new ListMyVideos(db).execute({ userId: 'ana' });

    expect(videos.map((v) => v.id)).toEqual(['new', 'old']);
  });

  it('returns an empty list for someone who never uploaded', async () => {
    expect(await new ListMyVideos(new InMemoryDatabase()).execute({ userId: 'ana' })).toEqual([]);
  });
});
