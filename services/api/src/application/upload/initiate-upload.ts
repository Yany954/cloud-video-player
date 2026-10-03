import { assignToCategory, canAddVideo } from '../../domain/category';
import { assertFits } from '../../domain/quota';
import { planUpload, type UploadPlan } from '../../domain/upload-plan';
import { startUpload } from '../../domain/video';
import { NotFoundError } from '../errors';
import type {
  CategoryRepository,
  Clock,
  IdGenerator,
  ObjectStorage,
  StorageAccountRepository,
  VideoRepository,
} from '../ports';

export interface InitiateUploadInput {
  userId: string;
  fileName: string;
  sizeBytes: number;
  title?: string;
  /** Puts the video straight into one of the uploader's events. */
  categoryId?: string;
}

export interface InitiateUploadResult extends UploadPlan {
  videoId: string;
}

export class InitiateUpload {
  constructor(
    private readonly videos: VideoRepository,
    private readonly accounts: StorageAccountRepository,
    private readonly storage: ObjectStorage,
    private readonly newId: IdGenerator,
    private readonly now: Clock,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(input: InitiateUploadInput): Promise<InitiateUploadResult> {
    const { categoryId, ...upload } = input;
    let video = startUpload({
      ...upload,
      id: this.newId(),
      ownerId: input.userId,
      now: this.now(),
    });

    if (categoryId !== undefined) {
      const category = await this.categories.findById(categoryId);
      // A category the uploader cannot add to looks the same as one that does not exist.
      if (!category || !canAddVideo(category, video, input.userId)) {
        throw new NotFoundError('Event not found');
      }
      video = assignToCategory(video, category);
    }

    // Early, friendly check on the declared size. The binding check is in CompleteUpload.
    assertFits(await this.accounts.getUsage(input.userId), video.declaredSizeBytes);

    const uploadSessionId = await this.storage.startMultipartUpload(video);
    await this.videos.create({ ...video, uploadSessionId });

    return { videoId: video.id, ...planUpload(video.declaredSizeBytes) };
  }
}
