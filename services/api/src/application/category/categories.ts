import {
  assignToCategory,
  canAddVideo,
  canManageCategory,
  canViewCategory,
  createCategory,
  inPlayingOrder,
  renameCategory,
  reorderCategory,
  setVisibility,
  type Category,
  type CategoryVisibility,
} from '../../domain/category';
import { DomainError } from '../../domain/errors';
import { canView, type Viewer } from '../../domain/moderation';
import { isOwnedBy, type Video } from '../../domain/video';
import { NotFoundError } from '../errors';
import type { CategoryRepository, Clock, IdGenerator, VideoRepository } from '../ports';

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
  }): Promise<Category> {
    const category = createCategory({
      id: this.newId(),
      ownerId: input.userId,
      name: input.name,
      visibility: input.visibility,
      now: this.now(),
    });
    await this.categories.create(category);
    return category;
  }
}

export class ListCategories {
  constructor(private readonly categories: CategoryRepository) {}

  /** The caller's own events, then the ones other people shared with everyone. */
  async execute(input: { userId: string }): Promise<{ mine: Category[]; shared: Category[] }> {
    const [mine, shared] = await Promise.all([
      this.categories.listByOwner(input.userId, MAX_LISTED_CATEGORIES),
      this.categories.listShared(MAX_LISTED_CATEGORIES),
    ]);
    return { mine, shared: shared.filter((category) => category.ownerId !== input.userId) };
  }
}

export class GetCategory {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly videos: VideoRepository,
  ) {}

  /** The event and the videos of it that this viewer may see, in playing order. */
  async execute(input: {
    viewer: Viewer;
    categoryId: string;
  }): Promise<{ category: Category; videos: Video[] }> {
    const category = await this.categories.findById(input.categoryId);
    if (!category || !canViewCategory(category, input.viewer)) throw new NotFoundError(NOT_FOUND);

    const videos = await this.videos.listByCategory(category.id, MAX_CATEGORY_VIDEOS);
    return {
      category,
      videos: inPlayingOrder(
        category,
        videos.filter((video) => canView(video, input.viewer, category)),
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
  }): Promise<Category> {
    let category = await findManaged(this.categories, input.categoryId, input.userId);
    if (input.name !== undefined) category = renameCategory(category, input.name);
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
    const category = await findManaged(this.categories, input.categoryId, input.userId);
    const reordered = reorderCategory(category, input.videoIds);
    await this.categories.save(reordered);
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
    await this.categories.delete(category.id);
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
