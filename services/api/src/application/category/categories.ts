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
  canReorderCategory,
  canViewCategory,
  createCategory,
  inPlayingOrder,
  renameCategory,
  reorderCategory,
  setTheme,
  setVisibility,
  type Category,
  type CategoryTheme,
  type CategoryVisibility,
} from '../../domain/category';
import { DomainError } from '../../domain/errors';
import { canView, type Viewer } from '../../domain/moderation';
import { isOwnedBy, type Video } from '../../domain/video';
import { NotFoundError } from '../errors';
import { isHiddenByBlock } from '../../domain/safety';
import type {
  BlockRepository,
  CategoryRepository,
  Clock,
  IdGenerator,
  TokenGenerator,
  VideoRepository,
} from '../ports';
import { blockedIdsOf, NO_BLOCKS } from '../safety/defaults';

// Enough for the MVP. Add a cursor when someone gets close to these.
export const MAX_LISTED_CATEGORIES = 100;
export const MAX_CATEGORY_VIDEOS = 200;

const NOT_FOUND = 'Event not found';

/** A category the caller may not manage looks the same as one that does not exist. */
async function findManaged(
  categories: CategoryRepository,
  categoryId: string,
  userId: string,
): Promise<Category> {
  const category = await categories.findById(categoryId);
  if (!category || !canManageCategory(category, userId)) throw new NotFoundError(NOT_FOUND);
  return category;
}

export class CreateCategory {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly newId: IdGenerator,
    private readonly now: Clock,
  ) {}

  async execute(input: {
    userId: string;
    name: string;
    visibility?: CategoryVisibility;
    theme?: CategoryTheme;
  }): Promise<Category> {
    const category = createCategory({
      id: this.newId(),
      ownerId: input.userId,
      name: input.name,
      visibility: input.visibility,
      theme: input.theme,
      now: this.now(),
    });
    await this.categories.create(category);
    return category;
  }
}

export class ListCategories {
  constructor(private readonly categories: CategoryRepository) {}

  /** The caller's own events, the ones they were invited to, and the ones shared with everyone. */
  async execute(input: {
    userId: string;
  }): Promise<{ mine: Category[]; invited: Category[]; shared: Category[] }> {
    const [mine, invited, shared] = await Promise.all([
      this.categories.listByOwner(input.userId, MAX_LISTED_CATEGORIES),
      this.categories.listByMember(input.userId, MAX_LISTED_CATEGORIES),
      this.categories.listShared(MAX_LISTED_CATEGORIES),
    ]);
    const listed = new Set([...mine, ...invited].map((category) => category.id));
    return { mine, invited, shared: shared.filter((category) => !listed.has(category.id)) };
  }
}

export class GetCategory {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly videos: VideoRepository,
    private readonly blocks: BlockRepository = NO_BLOCKS,
  ) {}

  /** The event and the videos of it that this viewer may see, in playing order. */
  async execute(input: {
    viewer: Viewer;
    categoryId: string;
  }): Promise<{ category: Category; videos: Video[] }> {
    const category = await this.categories.findById(input.categoryId);
    if (!category || !canViewCategory(category, input.viewer)) throw new NotFoundError(NOT_FOUND);

    const videos = await this.videos.listByCategory(category.id, MAX_CATEGORY_VIDEOS);
    const blocked = await blockedIdsOf(this.blocks, input.viewer.userId);
    return {
      category,
      videos: inPlayingOrder(
        category,
        videos.filter(
          (video) => canView(video, input.viewer, category) && !isHiddenByBlock(video, blocked),
        ),
      ),
    };
  }
}

export class UpdateCategory {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly videos: VideoRepository,
  ) {}

  async execute(input: {
    userId: string;
    categoryId: string;
    name?: string;
    visibility?: CategoryVisibility;
    theme?: CategoryTheme;
  }): Promise<Category> {
    let category = await findManaged(this.categories, input.categoryId, input.userId);
    if (input.name !== undefined) category = renameCategory(category, input.name);
    if (input.theme !== undefined) category = setTheme(category, input.theme);
    if (input.visibility !== undefined) category = setVisibility(category, input.visibility);
    await this.categories.save(category);

    if (input.visibility !== undefined) {
      // Each video carries its category's privacy. Done even when the visibility did not
      // change, so repeating a request that failed half-way finishes the job.
      const videos = await this.videos.listByCategory(category.id, MAX_CATEGORY_VIDEOS);
      for (const video of videos) {
        await this.videos.saveCategoryOf(assignToCategory(video, category));
      }
    }
    return category;
  }
}

export class ReorderCategory {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: {
    userId: string;
    categoryId: string;
    videoIds: string[];
  }): Promise<Category> {
    const category = await this.categories.findById(input.categoryId);
    if (!category || !canReorderCategory(category, input.userId))
      throw new NotFoundError(NOT_FOUND);
    const reordered = reorderCategory(category, input.videoIds);
    // Only the order is written: several people may reorder, and none of them should undo
    // someone joining or the owner renaming the event at the same moment.
    await this.categories.saveOrder(reordered);
    return reordered;
  }
}

export class DeleteCategory {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly videos: VideoRepository,
  ) {}

  /**
   * Only an empty event can be deleted. Emptying it for the owner would silently move the
   * approved videos of a private event into the library.
   */
  async execute(input: { userId: string; categoryId: string }): Promise<void> {
    const category = await findManaged(this.categories, input.categoryId, input.userId);
    const [first] = await this.videos.listByCategory(category.id, 1);
    if (first) {
      throw new DomainError('INVALID_STATE', 'Take its videos out before deleting the event');
    }
    await this.categories.delete(category);
  }
}

export class SetVideoCategory {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly videos: VideoRepository,
  ) {}

  /** Moves the caller's own video into an event they are a member of, or out with `null`. */
  async execute(input: {
    userId: string;
    videoId: string;
    categoryId: string | null;
  }): Promise<Video> {
    const video = await this.videos.findById(input.videoId);
    if (!video || !isOwnedBy(video, input.userId)) throw new NotFoundError();
    // While it uploads or is processed, other jobs rewrite the whole video record.
    if (video.uploadStatus !== 'ready' && video.uploadStatus !== 'failed') {
      throw new DomainError('INVALID_STATE', 'Video is still being prepared, try again soon');
    }

    let category: Category | null = null;
    if (input.categoryId !== null) {
      category = await this.categories.findById(input.categoryId);
      if (!category || !canAddVideo(category, video, input.userId)) {
        throw new NotFoundError(NOT_FOUND);
      }
    }

    const moved = assignToCategory(video, category);
    await this.videos.saveCategoryOf(moved);
    return moved;
  }
}

export class OpenInvite {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly newToken: TokenGenerator,
  ) {}

  /** Owner only. Makes a new invite link; any earlier link stops working. */
  async execute(input: { userId: string; categoryId: string }): Promise<string> {
    const category = await findManaged(this.categories, input.categoryId, input.userId);
    const token = this.newToken();
    await this.categories.save(openInvite(category, token));
    return token;
  }
}

export class CloseInvite {
  constructor(private readonly categories: CategoryRepository) {}

  /** Owner only. Turns the link off; people who already joined stay. */
  async execute(input: { userId: string; categoryId: string }): Promise<void> {
    const category = await findManaged(this.categories, input.categoryId, input.userId);
    await this.categories.save(closeInvite(category));
  }
}

export class JoinCategory {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly blocks: BlockRepository = NO_BLOCKS,
  ) {}

  /**
   * What opening an invite link does for a signed-in user. A wrong or old link looks the same
   * as an event that does not exist, so links cannot be used to probe for events.
   */
  async execute(input: { userId: string; categoryId: string; token: string }): Promise<Category> {
    const category = await this.categories.findById(input.categoryId);
    if (!category || !acceptsInvite(category, input.token)) {
      throw new NotFoundError('This invite link is not valid any more');
    }
    // Someone the owner blocked gets the same answer as for a bad link: they are not told.
    if ((await blockedIdsOf(this.blocks, category.ownerId)).has(input.userId)) {
      throw new NotFoundError('This invite link is not valid any more');
    }
    const joined = addCollaborator(category, input.userId);
    // Already a member (or the owner): opening the link again changes nothing.
    if (joined !== category) await this.categories.join(joined, input.userId);
    return joined;
  }
}

export class RemoveCollaborator {
  constructor(private readonly categories: CategoryRepository) {}

  /** The owner removes anyone; collaborators can only remove themselves. Their videos stay. */
  async execute(input: {
    userId: string;
    categoryId: string;
    collaboratorId: string;
  }): Promise<void> {
    const category = await this.categories.findById(input.categoryId);
    if (
      !category ||
      !category.collaboratorIds.includes(input.collaboratorId) ||
      !canRemoveCollaborator(category, input.userId, input.collaboratorId)
    ) {
      throw new NotFoundError(NOT_FOUND);
    }
    await this.categories.leave(
      removeCollaborator(category, input.collaboratorId),
      input.collaboratorId,
    );
  }
}
