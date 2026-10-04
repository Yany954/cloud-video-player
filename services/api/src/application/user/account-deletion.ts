import { detachPrivately, removeCollaborator } from '../../domain/category';
import type { Viewer } from '../../domain/moderation';
import { assertDeletable } from '../../domain/user';
import { MAX_CATEGORY_VIDEOS, MAX_LISTED_CATEGORIES } from '../category/categories';
import { ForbiddenError, NotFoundError } from '../errors';
import type {
  AccountDeletionQueue,
  CategoryRepository,
  ObjectStorage,
  StorageAccountAdmin,
  UserAccounts,
  VideoRepository,
} from '../ports';
import { DeleteVideo } from '../video/delete-video';
import { MAX_LISTED_VIDEOS } from '../video/list-my-videos';

export class RequestAccountDeletion {
  constructor(
    private readonly users: UserAccounts,
    private readonly queue: AccountDeletionQueue,
  ) {}

  /**
   * People delete their own account, after proving it is them with their password; an admin
   * deletes anyone else's. The account stops working at once and its data is removed in the
   * background, because a library of large videos takes longer than one request may.
   */
  async execute(input: { viewer: Viewer; userId: string; password?: string }): Promise<void> {
    const { viewer, userId } = input;
    const isSelf = viewer.userId === userId;
    if (!isSelf && !viewer.isAdmin) throw new ForbiddenError();

    const target = await this.users.findById(userId);
    if (!target) throw new NotFoundError('User not found');
    if (isSelf) {
      const proven =
        input.password !== undefined && (await this.users.verifyPassword(userId, input.password));
      if (!proven) throw new ForbiddenError('Your password is not right');
    }
    assertDeletable(target, await this.users.countAdmins());

    // No new sign-ins while the data is being removed.
    await this.users.setSuspended(userId, true);
    await this.queue.enqueue(userId);
  }
}

export class DeleteAccountData {
  private readonly deleteVideo: DeleteVideo;

  constructor(
    private readonly videos: VideoRepository,
    private readonly categories: CategoryRepository,
    storage: ObjectStorage,
    private readonly accounts: StorageAccountAdmin,
    private readonly users: UserAccounts,
  ) {
    this.deleteVideo = new DeleteVideo(videos, storage);
  }

  /**
   * The background job. Safe to run again after a failure: every step only removes what is
   * still there, and the sign-in account goes last, so a retry can always find the rest.
   */
  async execute(input: { userId: string }): Promise<void> {
    const { userId } = input;
    const owner = { userId, isAdmin: false };

    // 1. Their videos: records, originals, playable copies and posters. A video that is being
    //    processed makes this throw; the queue then retries the whole job a little later.
    for (;;) {
      const videos = await this.videos.listByOwner(userId, MAX_LISTED_VIDEOS);
      if (videos.length === 0) break;
      for (const video of videos)
        await this.deleteVideo.execute({ viewer: owner, videoId: video.id });
    }

    // 2. The events they own. Other people's videos in them are kept, private to their uploader.
    for (const category of await this.categories.listByOwner(userId, MAX_LISTED_CATEGORIES)) {
      for (;;) {
        const guests = await this.videos.listByCategory(category.id, MAX_CATEGORY_VIDEOS);
        if (guests.length === 0) break;
        for (const video of guests) await this.videos.saveCategoryOf(detachPrivately(video));
      }
      await this.categories.delete(category);
    }

    // 3. Their place in other people's events.
    for (const category of await this.categories.listByMember(userId, MAX_LISTED_CATEGORIES)) {
      await this.categories.leave(removeCollaborator(category, userId), userId);
    }

    // 4. Their storage record, then the sign-in account itself.
    await this.accounts.deleteAccount(userId);
    await this.users.delete(userId);
  }
}
