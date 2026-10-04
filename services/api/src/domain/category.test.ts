import { describe, expect, it } from 'vitest';
import {
  acceptsInvite,
  addCollaborator,
  assignToCategory,
  canRemoveCollaborator,
  closeInvite,
  openInvite,
  removeCollaborator,
  canAddVideo,
  canManageCategory,
  canViewCategory,
  createCategory,
  inPlayingOrder,
  isMember,
  renameCategory,
  reorderCategory,
  setVisibility,
  type Category,
} from './category';
import { startUpload } from './video';

const category = (overrides: Partial<Category> = {}): Category => ({
  ...createCategory({
    id: 'cat-1',
    ownerId: 'ana',
    name: 'Concert Twenty One Pilots October 2026',
    now: new Date('2026-10-03T10:00:00.000Z'),
  }),
  ...overrides,
});

const video = (id: string, ownerId = 'ana', createdAt = '2026-10-03T10:00:00.000Z') =>
  startUpload({ id, ownerId, fileName: `${id}.mp4`, sizeBytes: 10, now: new Date(createdAt) });

const user = (userId: string) => ({ userId, isAdmin: false });

describe('createCategory', () => {
  it('starts private and empty, owned by its creator', () => {
    expect(category()).toEqual({
      id: 'cat-1',
      ownerId: 'ana',
      name: 'Concert Twenty One Pilots October 2026',
      visibility: 'private',
      collaboratorIds: [],
      inviteToken: null,
      order: [],
      createdAt: '2026-10-03T10:00:00.000Z',
    });
  });

  it('can be created shared, and trims its name', () => {
    const shared = createCategory({
      id: 'cat-2',
      ownerId: 'ana',
      name: '  Family  ',
      visibility: 'shared',
      now: new Date(),
    });
    expect(shared).toMatchObject({ name: 'Family', visibility: 'shared' });
  });

  it.each(['', '   ', 'x'.repeat(121)])('rejects an invalid name', (name) => {
    expect(() => renameCategory(category(), name)).toThrow(
      expect.objectContaining({ code: 'INVALID_NAME' }),
    );
  });
});

describe('who can do what', () => {
  const withBen = category({ collaboratorIds: ['ben'] });

  it('counts the owner and the collaborators as members', () => {
    expect(isMember(withBen, 'ana')).toBe(true);
    expect(isMember(withBen, 'ben')).toBe(true);
    expect(isMember(withBen, 'carla')).toBe(false);
  });

  it('shows a private category only to its members and to admins', () => {
    expect(canViewCategory(withBen, user('ben'))).toBe(true);
    expect(canViewCategory(withBen, user('carla'))).toBe(false);
    expect(canViewCategory(withBen, { userId: 'admin-1', isAdmin: true })).toBe(true);
  });

  it('shows a shared category to everyone', () => {
    expect(canViewCategory(setVisibility(withBen, 'shared'), user('carla'))).toBe(true);
  });

  it('lets only the owner manage it', () => {
    expect(canManageCategory(withBen, 'ana')).toBe(true);
    expect(canManageCategory(withBen, 'ben')).toBe(false);
  });

  it('lets members add their own videos, never someone else’s', () => {
    expect(canAddVideo(withBen, video('v1', 'ben'), 'ben')).toBe(true);
    expect(canAddVideo(withBen, video('v1', 'ana'), 'ben')).toBe(false);
    expect(canAddVideo(withBen, video('v1', 'carla'), 'carla')).toBe(false);
  });
});

describe('assignToCategory', () => {
  it('makes a video private when its category is private', () => {
    expect(assignToCategory(video('v1'), category())).toMatchObject({
      categoryId: 'cat-1',
      private: true,
    });
  });

  it('keeps a video in a shared category public', () => {
    expect(assignToCategory(video('v1'), category({ visibility: 'shared' }))).toMatchObject({
      categoryId: 'cat-1',
      private: false,
    });
  });

  it('takes a video out of its category, and out of its privacy', () => {
    const inside = assignToCategory(video('v1'), category());
    expect(assignToCategory(inside, null)).toMatchObject({ categoryId: null, private: false });
  });
});

describe('order', () => {
  const videos = [
    video('a', 'ana', '2026-10-01T10:00:00.000Z'),
    video('b', 'ana', '2026-10-02T10:00:00.000Z'),
    video('c', 'ana', '2026-10-03T10:00:00.000Z'),
  ];
  const ids = (list: { id: string }[]) => list.map((item) => item.id);

  it('plays in upload order until someone reorders', () => {
    expect(ids(inPlayingOrder(category(), [videos[2]!, videos[0]!, videos[1]!]))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('follows the chosen order', () => {
    const reordered = reorderCategory(category(), ['c', 'a', 'b']);
    expect(ids(inPlayingOrder(reordered, videos))).toEqual(['c', 'a', 'b']);
  });

  it('puts videos added after the last reorder at the end, oldest first', () => {
    const reordered = reorderCategory(category(), ['c']);
    expect(ids(inPlayingOrder(reordered, videos))).toEqual(['c', 'a', 'b']);
  });

  it('ignores ids of videos that left the category', () => {
    const reordered = reorderCategory(category(), ['gone', 'b', 'a', 'c']);
    expect(ids(inPlayingOrder(reordered, videos))).toEqual(['b', 'a', 'c']);
  });

  it('rejects an order that repeats a video or is too long', () => {
    expect(() => reorderCategory(category(), ['a', 'a'])).toThrow(
      expect.objectContaining({ code: 'INVALID_ORDER' }),
    );
    const tooMany = Array.from({ length: 1001 }, (_, index) => `v${index}`);
    expect(() => reorderCategory(category(), tooMany)).toThrow(
      expect.objectContaining({ code: 'INVALID_ORDER' }),
    );
  });
});

describe('invite link', () => {
  const open = openInvite(category(), 'secret-token');

  it('has no working link until the owner makes one', () => {
    expect(acceptsInvite(category(), '')).toBe(false);
    expect(acceptsInvite(category(), 'anything')).toBe(false);
  });

  it('accepts only the exact current token', () => {
    expect(acceptsInvite(open, 'secret-token')).toBe(true);
    expect(acceptsInvite(open, 'secret-toke')).toBe(false);
    expect(acceptsInvite(open, 'secret-token-and-more')).toBe(false);
    expect(acceptsInvite(open, 'Secret-token')).toBe(false);
  });

  it('stops accepting the old token when a new link is made or the link is turned off', () => {
    expect(acceptsInvite(openInvite(open, 'new-token'), 'secret-token')).toBe(false);
    expect(acceptsInvite(closeInvite(open), 'secret-token')).toBe(false);
  });

  it('keeps the people who already joined when the link is turned off', () => {
    expect(closeInvite(addCollaborator(open, 'ben')).collaboratorIds).toEqual(['ben']);
  });
});

describe('collaborators', () => {
  it('adds someone once, and never the owner', () => {
    const joined = addCollaborator(addCollaborator(category(), 'ben'), 'ben');
    expect(joined.collaboratorIds).toEqual(['ben']);
    expect(addCollaborator(category(), 'ana').collaboratorIds).toEqual([]);
  });

  it('refuses more than 50 invited people', () => {
    const full = category({ collaboratorIds: Array.from({ length: 50 }, (_, i) => `user-${i}`) });
    expect(() => addCollaborator(full, 'one-more')).toThrow(
      expect.objectContaining({ code: 'INVALID_STATE' }),
    );
  });

  it('removes a collaborator', () => {
    const withTwo = category({ collaboratorIds: ['ben', 'carla'] });
    expect(removeCollaborator(withTwo, 'ben').collaboratorIds).toEqual(['carla']);
  });

  it('lets the owner remove anyone, and collaborators only leave themselves', () => {
    const withTwo = category({ collaboratorIds: ['ben', 'carla'] });
    expect(canRemoveCollaborator(withTwo, 'ana', 'ben')).toBe(true);
    expect(canRemoveCollaborator(withTwo, 'ben', 'ben')).toBe(true);
    expect(canRemoveCollaborator(withTwo, 'ben', 'carla')).toBe(false);
  });
});
