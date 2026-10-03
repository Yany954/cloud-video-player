import { assertFits } from '../../domain/quota';
import { planUpload, type UploadPlan } from '../../domain/upload-plan';
import { startUpload } from '../../domain/video';
import type {
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
  ) {}

  async execute(input: InitiateUploadInput): Promise<InitiateUploadResult> {
    const video = startUpload({
      ...input,
      id: this.newId(),
      ownerId: input.userId,
      now: this.now(),
    });

    // Early, friendly check on the declared size. The binding check is in CompleteUpload.
    assertFits(await this.accounts.getUsage(input.userId), video.declaredSizeBytes);

    const uploadSessionId = await this.storage.startMultipartUpload(video);
    await this.videos.create({ ...video, uploadSessionId });

    return { videoId: video.id, ...planUpload(video.declaredSizeBytes) };
  }
}
