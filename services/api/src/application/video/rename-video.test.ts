import { beforeEach, describe, expect, it } from 'vitest';
import { startUpload } from '../../domain/video';
import { NotFoundError } from '../errors';
import { InMemoryDatabase } from '../testing/fakes';
import { RenameVideo } from './rename-video';

let db: InMemoryDatabase;
let rename: RenameVideo;

beforeEach(async () => {
  db = new InMemoryDatabase();
  rename = new RenameVideo(db);
  await db.create(
    startUpload({
      id: 'video-1',
      ownerId: 'ana',
      fileName: 'IMG_9837.mov',
      sizeBytes: 1_000,
      now: new Date('2026-10-03T10:00:00.000Z'),
    }),
  );
});

describe('RenameVideo', () => {
  it('changes the title for the owner, trimmed, and keeps the file name', async () => {
    const renamed = await rename.execute({
      userId: 'ana',
      videoId: 'video-1',
      title: '  Rosalía, first song ',
    });

    expect(renamed.title).toBe('Rosalía, first song');
    expect(await db.findById('video-1')).toMatchObject({
      title: 'Rosalía, first song',
      fileName: 'IMG_9837.mov',
    });
  });

  it('answers "not found" to anyone else, admins included, and for a missing video', async () => {
    await expect(
      rename.execute({ userId: 'ben', videoId: 'video-1', title: 'Mine now' }),
    ).rejects.toThrow(NotFoundError);
    await expect(rename.execute({ userId: 'ana', videoId: 'nope', title: 'x' })).rejects.toThrow(
      NotFoundError,
    );
    expect((await db.findById('video-1'))?.title).toBe('IMG_9837');
  });

  it.each([['   '], ['x'.repeat(201)]])('refuses an empty or too long title', async (title) => {
    await expect(
      rename.execute({ userId: 'ana', videoId: 'video-1', title }),
    ).rejects.toMatchObject({ code: 'INVALID_TITLE' });
  });
});
