import { DomainError } from './errors';
import { isOwnedBy, type Video } from './video';

// Shown to users as an "event" (e.g. "Concert Twenty One Pilots October 2026").

/** `private`: only its members see it and its videos. `shared`: every signed-in user does. */
export type CategoryVisibility = 'private' | 'shared';

/** The colour themes an event's header can use. The web app owns what each one looks like. */
export const CATEGORY_THEMES = [
  'stage',
  'sunset',
  'forest',
  'ocean',
  'ember',
  'violet',
  'gold',
  'steel',
] as const;
export type CategoryTheme = (typeof CATEGORY_THEMES)[number];

/** The theme an event gets when nobody chose one: always the same for the same id. */
export function defaultTheme(categoryId: string): CategoryTheme {
  let hash = 0;
  for (const character of categoryId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return CATEGORY_THEMES[hash % CATEGORY_THEMES.length]!;
}

const MAX_NAME_LENGTH = 120;
/** Keeps the stored order small; far more than one event's worth of recordings. */
export const MAX_ORDERED_VIDEOS = 1000;
export const MAX_COLLABORATORS = 50;

export interface Category {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly visibility: CategoryVisibility;
  /** The colours of its header. */
  readonly theme: CategoryTheme;
  /** People invited to add their own recordings. The owner is not listed here. */
  readonly collaboratorIds: readonly string[];
  /**
   * The secret in the event's invite link. Whoever opens the link while signed in becomes a
   * collaborator. Null when the owner has not made a link, or has turned it off.
   */
  readonly inviteToken: string | null;
  /**
   * Video ids in playing order. Only an order: which videos belong to the category is
   * recorded on each video (`categoryId`), so this list may lag behind without harm.
   */
  readonly order: readonly string[];
  readonly createdAt: string;
}

export interface CreateCategoryInput {
  id: string;
  ownerId: string;
  name: string;
  visibility?: CategoryVisibility;
  theme?: CategoryTheme;
  now: Date;
}

/** Private unless its creator says otherwise. */
export function createCategory(input: CreateCategoryInput): Category {
  return {
    id: input.id,
    ownerId: input.ownerId,
    name: validName(input.name),
    visibility: input.visibility ?? 'private',
    theme: input.theme ?? defaultTheme(input.id),
    collaboratorIds: [],
    inviteToken: null,
    order: [],
    createdAt: input.now.toISOString(),
  };
}

export function renameCategory(category: Category, name: string): Category {
  return { ...category, name: validName(name) };
}

export function setTheme(category: Category, theme: CategoryTheme): Category {
  return { ...category, theme };
}

export function setVisibility(category: Category, visibility: CategoryVisibility): Category {
  return { ...category, visibility };
}

function validName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) {
    throw new DomainError('INVALID_NAME', `Name must be 1 to ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

/** Makes a new invite link. Any earlier link stops working. */
export function openInvite(category: Category, token: string): Category {
  return { ...category, inviteToken: token };
}

/** Turns the invite link off. People who already joined stay. */
export function closeInvite(category: Category): Category {
  return { ...category, inviteToken: null };
}

/** True only for the event's current link. Compares every character, whatever the input. */
export function acceptsInvite(category: Category, token: string): boolean {
  const expected = category.inviteToken;
  if (expected === null || expected.length === 0) return false;
  let difference = expected.length ^ token.length;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ (token.charCodeAt(index) || 0);
  }
  return difference === 0;
}

/** Adds someone who opened the invite link. The owner, or a member, is left as they are. */
export function addCollaborator(category: Category, userId: string): Category {
  if (isMember(category, userId)) return category;
  if (category.collaboratorIds.length >= MAX_COLLABORATORS) {
    throw new DomainError(
      'INVALID_STATE',
      `An event holds at most ${MAX_COLLABORATORS} invited people`,
    );
  }
  return { ...category, collaboratorIds: [...category.collaboratorIds, userId] };
}

export function removeCollaborator(category: Category, userId: string): Category {
  return {
    ...category,
    collaboratorIds: category.collaboratorIds.filter((id) => id !== userId),
  };
}

/** The owner removes anyone; collaborators can only remove themselves (leave). */
export function canRemoveCollaborator(
  category: Category,
  actorId: string,
  collaboratorId: string,
): boolean {
  return category.ownerId === actorId || actorId === collaboratorId;
}

/** The owner and the collaborators. */
export function isMember(category: Category, userId: string): boolean {
  return category.ownerId === userId || category.collaboratorIds.includes(userId);
}

/** Members and admins always; everyone else only when it is shared. */
export function canViewCategory(
  category: Category,
  viewer: { userId: string; isAdmin: boolean },
): boolean {
  return category.visibility === 'shared' || viewer.isAdmin || isMember(category, viewer.userId);
}

/** Renaming, reordering, changing who sees it and deleting are the owner's alone. */
export function canManageCategory(category: Category, userId: string): boolean {
  return category.ownerId === userId;
}

/** Members add their own recordings, never someone else's. */
export function canAddVideo(category: Category, video: Video, userId: string): boolean {
  return isMember(category, userId) && isOwnedBy(video, userId);
}

/** Puts a video in a category, or takes it out with `null`. It inherits the category's privacy. */
export function assignToCategory(video: Video, category: Category | null): Video {
  return {
    ...video,
    categoryId: category?.id ?? null,
    private: category?.visibility === 'private',
  };
}

/**
 * Takes a video out of an event that is being deleted by someone else (its owner closed their
 * account). It stays private to its uploader instead of landing in the library unasked.
 */
export function detachPrivately(video: Video): Video {
  return { ...video, categoryId: null, private: true };
}

/** Replaces the playing order. The ids come from the client, so they are checked first. */
export function reorderCategory(category: Category, videoIds: readonly string[]): Category {
  if (videoIds.length > MAX_ORDERED_VIDEOS) {
    throw new DomainError('INVALID_ORDER', `An order holds at most ${MAX_ORDERED_VIDEOS} videos`);
  }
  if (new Set(videoIds).size !== videoIds.length) {
    throw new DomainError('INVALID_ORDER', 'A video appears more than once in the order');
  }
  return { ...category, order: [...videoIds] };
}

/**
 * The category's videos in playing order. Videos the order does not mention yet (just added)
 * go last, oldest first; ids in the order that are no longer in the category are ignored.
 */
export function inPlayingOrder<T extends Pick<Video, 'id' | 'createdAt'>>(
  category: Category,
  videos: readonly T[],
): T[] {
  const position = new Map(category.order.map((id, index) => [id, index]));
  return [...videos].sort((a, b) => {
    const [pa, pb] = [position.get(a.id), position.get(b.id)];
    if (pa !== undefined && pb !== undefined) return pa - pb;
    if (pa !== undefined) return -1;
    if (pb !== undefined) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}
