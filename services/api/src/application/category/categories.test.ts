import { beforeEach, describe, expect, it } from 'vitest';
import { assignToCategory } from '../../domain/category';
import { reviewVideo } from '../../domain/moderation';
import { completeUpload, markReady, startProcessing, startUpload } from '../../domain/video';
import { NotFoundError } from '../errors';
import { InMemoryDatabase, InMemoryObjectStorage } from '../testing/fakes';
import { InitiateUpload } from '../upload/initiate-upload';
import { GetPlayback } from '../video/get-playback';
import { ListLibrary } from '../video/list-library';
import {
  CreateCategory,
  DeleteCategory,
  GetCategory,
  ListCategories,
  ReorderCategory,
  SetVideoCategory,
  UpdateCategory,
} from './categories';

const now = () => new Date('2026-10-03T12:00:00.000Z');
const uploaded = (id: string, ownerId: string, createdAt: string) =>
  completeUpload(
    {
      ...startUpload({
        id,
        ownerId,
        fileName: `${id}.mp4`,
        sizeBytes: 1_000,
        now: new Date(createdAt),
      }),
      uploadSessionId: 'session-1',
    },
    1_000,
  );
const ready = (id: string, ownerId = 'ana', createdAt = '2026-10-03T10:00:00.000Z') =>
  markReady(startProcessing(uploaded(id, ownerId, createdAt)), {
    durationSeconds: 60,
    width: 1920,
    height: 1080,
  });
const approved = (id: string, ownerId = 'ana', createdAt?: string) =>
  reviewVideo(ready(id, ownerId, createdAt), 'approve', 'admin-1', now());

const viewer = (userId: string, isAdmin = false) => ({ userId, isAdmin });
const ids = (items: { id: string }[]) => items.map((item) => item.id);

let db: InMemoryDatabase;
let create: CreateCategory;
let list: ListCategories;
let get: GetCategory;
let update: UpdateCategory;
let reorder: ReorderCategory;
let remove: DeleteCategory;
let setVideoCategory: SetVideoCategory;

beforeEach(() => {
  db = new InMemoryDatabase();
  let nextId = 1;
  create = new CreateCategory(db.categories, () => `cat-${nextId++}`, now);
  list = new ListCategories(db.categories);
  get = new GetCategory(db.categories, db);
  update = new UpdateCategory(db.categories, db);
  reorder = new ReorderCategory(db.categories);
  remove = new DeleteCategory(db.categories, db);
  setVideoCategory = new SetVideoCategory(db.categories, db);
});

const concert = (visibility?: 'private' | 'shared') =>
  create.execute({ userId: 'ana', name: 'Concert', visibility });

describe('CreateCategory and ListCategories', () => {
  it('lets any user create a private event of their own', async () => {
    expect(await concert()).toMatchObject({ id: 'cat-1', ownerId: 'ana', visibility: 'private' });
  });

  it('lists my events, and separately the ones others shared', async () => {
    await concert();
    await create.execute({ userId: 'ana', name: 'Family', visibility: 'shared' });
    await create.execute({ userId: 'ben', name: 'Ben private' });
    await create.execute({ userId: 'ben', name: 'Ben shared', visibility: 'shared' });

    const { mine, shared } = await list.execute({ userId: 'ana' });

    expect(mine.map((category) => category.name).sort()).toEqual(['Concert', 'Family']);
    expect(shared.map((category) => category.name)).toEqual(['Ben shared']);
  });
});

describe('SetVideoCategory', () => {
  it('puts my video in my private event, which takes it out of the library', async () => {
    await concert();
    await db.create(approved('v1'));

    await setVideoCategory.execute({ userId: 'ana', videoId: 'v1', categoryId: 'cat-1' });

    expect(await db.findById('v1')).toMatchObject({ categoryId: 'cat-1', private: true });
    expect(await new ListLibrary(db).execute()).toEqual([]);
  });

  it('takes it out again with null, back into the library', async () => {
    await concert();
    await db.create(assignToCategory(approved('v1'), (await db.categories.findById('cat-1'))!));

    await setVideoCategory.execute({ userId: 'ana', videoId: 'v1', categoryId: null });

    expect(await db.findById('v1')).toMatchObject({ categoryId: null, private: false });
    expect(ids(await new ListLibrary(db).execute())).toEqual(['v1']);
  });

  it('changes only the category, not what another job stored meanwhile', async () => {
    await concert();
    await db.create(ready('v1'));
    const stale = await db.findById('v1');
    await db.save(reviewVideo(stale!, 'approve', 'admin-1', now()));

    await setVideoCategory.execute({ userId: 'ana', videoId: 'v1', categoryId: 'cat-1' });

    expect((await db.findById('v1'))?.moderationStatus).toBe('approved');
  });

  it("refuses someone else's video, and an event I am not a member of", async () => {
    await concert();
    await db.create(ready('bens', 'ben'));
    await db.create(ready('v1'));

    await expect(
      setVideoCategory.execute({ userId: 'ana', videoId: 'bens', categoryId: 'cat-1' }),
    ).rejects.toThrow(NotFoundError);
    await expect(
      setVideoCategory.execute({ userId: 'ben', videoId: 'bens', categoryId: 'cat-1' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('lets a collaborator add their own video', async () => {
    const category = await concert();
    await db.categories.save({ ...category, collaboratorIds: ['ben'] });
    await db.create(ready('bens', 'ben'));

    await setVideoCategory.execute({ userId: 'ben', videoId: 'bens', categoryId: 'cat-1' });

    expect((await db.findById('bens'))?.categoryId).toBe('cat-1');
  });

  it('refuses a video that is still being prepared', async () => {
    await concert();
    await db.create(uploaded('v1', 'ana', '2026-10-03T10:00:00.000Z'));

    await expect(
      setVideoCategory.execute({ userId: 'ana', videoId: 'v1', categoryId: 'cat-1' }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
});

describe('GetCategory', () => {
  async function concertWithVideos(visibility?: 'private' | 'shared') {
    const category = await concert(visibility);
    await db.categories.save({ ...category, collaboratorIds: ['ben'] });
    const stored = (await db.categories.findById('cat-1'))!;
    await db.create(assignToCategory(approved('a', 'ana', '2026-10-01T10:00:00.000Z'), stored));
    await db.create(assignToCategory(ready('b', 'ana', '2026-10-02T10:00:00.000Z'), stored));
    await db.create(assignToCategory(approved('c', 'ben', '2026-10-03T10:00:00.000Z'), stored));
  }

  it('shows the owner all of their videos and the approved ones of collaborators', async () => {
    await concertWithVideos();

    const result = await get.execute({ viewer: viewer('ana'), categoryId: 'cat-1' });

    expect(ids(result.videos)).toEqual(['a', 'b', 'c']);
  });

  it('shows a collaborator only the approved videos of others, and their own', async () => {
    await concertWithVideos();

    const result = await get.execute({ viewer: viewer('ben'), categoryId: 'cat-1' });

    expect(ids(result.videos)).toEqual(['a', 'c']);
  });

  it('hides a private event from everyone else', async () => {
    await concertWithVideos();

    await expect(get.execute({ viewer: viewer('carla'), categoryId: 'cat-1' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('shows a shared event, with its approved videos, to everyone', async () => {
    await concertWithVideos('shared');

    const result = await get.execute({ viewer: viewer('carla'), categoryId: 'cat-1' });

    expect(ids(result.videos)).toEqual(['a', 'c']);
  });

  it('returns the videos in the chosen order', async () => {
    await concertWithVideos();
    await reorder.execute({ userId: 'ana', categoryId: 'cat-1', videoIds: ['c', 'a', 'b'] });

    const result = await get.execute({ viewer: viewer('ana'), categoryId: 'cat-1' });

    expect(ids(result.videos)).toEqual(['c', 'a', 'b']);
  });
});

describe('playback of a video in a private event', () => {
  const signer = { sign: async () => ({ video: 'video-url', poster: 'poster-url' }) };

  it('is allowed for a collaborator and refused to everyone else', async () => {
    const category = await concert();
    const stored = { ...category, collaboratorIds: ['ben'] };
    await db.categories.save(stored);
    await db.create(assignToCategory(approved('v1'), stored));
    const getPlayback = new GetPlayback(db, signer, now, db.categories);

    await expect(
      getPlayback.execute({ viewer: viewer('ben'), videoId: 'v1' }),
    ).resolves.toMatchObject({ video: 'video-url' });
    await expect(getPlayback.execute({ viewer: viewer('carla'), videoId: 'v1' })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('UpdateCategory', () => {
  it('renames, for the owner only', async () => {
    await concert();

    await update.execute({ userId: 'ana', categoryId: 'cat-1', name: 'Concert 2026' });
    await expect(
      update.execute({ userId: 'ben', categoryId: 'cat-1', name: 'Mine now' }),
    ).rejects.toThrow(NotFoundError);

    expect((await db.categories.findById('cat-1'))?.name).toBe('Concert 2026');
  });

  it('sharing an event puts its approved videos in the library; hiding it removes them', async () => {
    const category = await concert();
    await db.create(assignToCategory(approved('v1'), category));
    const library = new ListLibrary(db);

    await update.execute({ userId: 'ana', categoryId: 'cat-1', visibility: 'shared' });
    expect(ids(await library.execute())).toEqual(['v1']);

    await update.execute({ userId: 'ana', categoryId: 'cat-1', visibility: 'private' });
    expect(await library.execute()).toEqual([]);
  });
});

describe('ReorderCategory', () => {
  it('is the owner’s alone, even among collaborators', async () => {
    const category = await concert();
    await db.categories.save({ ...category, collaboratorIds: ['ben'] });

    await expect(
      reorder.execute({ userId: 'ben', categoryId: 'cat-1', videoIds: ['a'] }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('DeleteCategory', () => {
  it('deletes an empty event', async () => {
    await concert();

    await remove.execute({ userId: 'ana', categoryId: 'cat-1' });

    expect(await db.categories.findById('cat-1')).toBeNull();
  });

  it('refuses while it still holds videos, so none becomes public by surprise', async () => {
    const category = await concert();
    await db.create(assignToCategory(approved('v1'), category));

    await expect(remove.execute({ userId: 'ana', categoryId: 'cat-1' })).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
    expect(await db.categories.findById('cat-1')).not.toBeNull();
  });

  it('is refused to anyone but the owner', async () => {
    await concert();

    await expect(remove.execute({ userId: 'ben', categoryId: 'cat-1' })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('InitiateUpload into an event', () => {
  const initiate = () =>
    new InitiateUpload(db, db, new InMemoryObjectStorage(), () => 'v1', now, db.categories);
  const upload = { fileName: 'concert.mp4', sizeBytes: 1_000 };

  it('starts the video inside the event, private like it', async () => {
    await concert();

    await initiate().execute({ ...upload, userId: 'ana', categoryId: 'cat-1' });

    expect(await db.findById('v1')).toMatchObject({ categoryId: 'cat-1', private: true });
  });

  it('refuses an event the uploader is not a member of, and creates nothing', async () => {
    await concert();

    await expect(
      initiate().execute({ ...upload, userId: 'ben', categoryId: 'cat-1' }),
    ).rejects.toThrow(NotFoundError);
    expect(await db.findById('v1')).toBeNull();
  });
});
