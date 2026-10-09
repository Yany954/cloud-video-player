import { reviewVideo, type ReviewDecision, type Viewer } from '../../domain/moderation';
import type { Video } from '../../domain/video';
import { ForbiddenError, NotFoundError } from '../errors';
import type { Clock, VideoRepository } from '../ports';

export class ReviewVideo {
  constructor(
    private readonly videos: VideoRepository,
    private readonly now: Clock,
  ) {}

  /** Admins only. Approving lets the people of the video's event watch it; rejecting hides it from everyone but its owner. */
  async execute(input: {
    reviewer: Viewer;
    videoId: string;
    decision: ReviewDecision;
  }): Promise<Video> {
    if (!input.reviewer.isAdmin) throw new ForbiddenError();
    const video = await this.videos.findById(input.videoId);
    if (!video) throw new NotFoundError();

    const reviewed = reviewVideo(video, input.decision, input.reviewer.userId, this.now());
    await this.videos.saveModeration(reviewed);
    return reviewed;
  }
}
